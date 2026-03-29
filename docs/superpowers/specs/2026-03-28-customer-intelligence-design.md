# Customer Intelligence Profile + Sentiment Analysis + AI Nurturing

> **Data:** 28 de Março de 2026
> **Branch:** `feature/nossoagent`
> **Status:** Design aprovado, implementação pendente
> **Prioridade:** Alta

---

## 1. Contexto

Crosscheck competitivo (Yup.ai, DUMA CRM) revelou gaps no NossoCRM:
- Falta perfil comportamental profundo de clientes (ticket médio, produtos, sazonalidade)
- Sem análise de sentimento em tempo real durante conversas
- Sem probabilidade de fechamento por deal
- Campanhas não segmentam por stage do pipeline
- Sem automações de trigger ao mudar de stage

O sistema deve permitir que a IA nutra leads/clientes com o produto certo, na hora certa, para a pessoa certa. Leads frios devem ser reativados automaticamente.

---

## 2. Arquitetura

```
contacts
  └── contact_behavioral_profile  (perfil computado: RFM, ticket, produtos, sazonalidade)
  └── nurturing_suggestions       (sugestões geradas pela IA)

deals
  └── +product_name, +product_category     (para alimentar perfil)
  └── +closing_probability, +closing_factors (calculados pelo engine)

conversations
  └── +current_sentiment, +sentiment_score, +sentiment_history

pipeline_triggers
  └── board_id + stage_id → ações automáticas

Edge Functions:
  compute-contact-profiles         (pg_cron diário 03:00 UTC)
  generate-nurturing-suggestions   (pg_cron 2x/dia 09:00 + 14:00 UTC)

Agent Engine:
  Step 14.5: analyzeSentiment() + updateClosingProbability()
  Tool: get_contact_intelligence(contact_id)
```

---

## 3. Schema de Banco de Dados

### 3.1 contact_behavioral_profile

```sql
CREATE TABLE contact_behavioral_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Ticket e receita
  avg_ticket NUMERIC(12,2) DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  deals_won_count INT DEFAULT 0,

  -- Produtos e categorias
  preferred_products JSONB DEFAULT '[]',  -- [{name, category, count, last_date}]
  preferred_categories JSONB DEFAULT '[]', -- [{category, count, revenue}]

  -- Sazonalidade
  peak_months JSONB DEFAULT '[]',  -- [{month: 1-12, deals_count, revenue}]

  -- RFM Score
  rfm_recency INT DEFAULT 1 CHECK (rfm_recency BETWEEN 1 AND 5),
  rfm_frequency INT DEFAULT 1 CHECK (rfm_frequency BETWEEN 1 AND 5),
  rfm_monetary INT DEFAULT 1 CHECK (rfm_monetary BETWEEN 1 AND 5),
  rfm_score INT GENERATED ALWAYS AS (rfm_recency + rfm_frequency + rfm_monetary) STORED,

  -- Risco de churn
  churn_risk TEXT DEFAULT 'unknown' CHECK (churn_risk IN ('low', 'medium', 'high', 'churned', 'unknown')),
  days_since_last_purchase INT DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,

  -- Melhor horário de contato
  best_contact_days INT[] DEFAULT '{}',   -- dias da semana (0-6)
  best_contact_hours INT[] DEFAULT '{}',  -- horas (0-23)
  response_rate NUMERIC(5,2) DEFAULT 0,   -- % de respostas a mensagens

  -- Insights IA
  ai_insights JSONB DEFAULT '{}',

  -- Metadata
  last_computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(contact_id)
);

-- RLS
ALTER TABLE contact_behavioral_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON contact_behavioral_profile
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Índices
CREATE INDEX idx_cbp_org ON contact_behavioral_profile(organization_id);
CREATE INDEX idx_cbp_rfm ON contact_behavioral_profile(organization_id, rfm_score DESC);
CREATE INDEX idx_cbp_churn ON contact_behavioral_profile(organization_id, churn_risk);
```

### 3.2 Campos adicionados em deals

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS product_category TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closing_probability INT DEFAULT 0 CHECK (closing_probability BETWEEN 0 AND 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closing_factors JSONB DEFAULT '{}';
-- closing_factors: {sentiment: 0-100, engagement: 0-100, qualification: 0-100, stage_velocity: 0-100, rfm: 0-100}
```

### 3.3 Campos adicionados em conversations

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS current_sentiment TEXT DEFAULT 'neutral'
  CHECK (current_sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sentiment_score INT DEFAULT 0
  CHECK (sentiment_score BETWEEN -100 AND 100);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sentiment_history JSONB DEFAULT '[]';
-- sentiment_history: [{timestamp, score, trigger_message_preview}]
```

### 3.4 nurturing_suggestions

```sql
CREATE TABLE nurturing_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  type TEXT NOT NULL CHECK (type IN ('reactivation', 'seasonal', 'upsell', 'cross_sell', 'follow_up', 'sentiment_recovery')),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

  title TEXT NOT NULL,
  reason TEXT NOT NULL,           -- por que a IA sugere isso
  suggested_message TEXT NOT NULL, -- mensagem personalizada gerada
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),

  auto_send BOOLEAN DEFAULT false, -- false = Modo B, true = Modo A
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'dismissed', 'snoozed')),

  snoozed_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE nurturing_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON nurturing_suggestions
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Índices
CREATE INDEX idx_ns_org_status ON nurturing_suggestions(organization_id, status);
CREATE INDEX idx_ns_contact ON nurturing_suggestions(contact_id);
CREATE INDEX idx_ns_urgency ON nurturing_suggestions(organization_id, urgency, status);
```

### 3.5 pipeline_triggers

```sql
CREATE TABLE pipeline_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,

  trigger_event TEXT NOT NULL DEFAULT 'on_enter' CHECK (trigger_event IN ('on_enter', 'on_exit')),

  actions JSONB NOT NULL DEFAULT '[]',
  -- actions: [{type: 'send_email'|'send_whatsapp'|'create_activity'|'notify_team'|'add_tag', config: {...}}]

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pipeline_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON pipeline_triggers
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_pt_board_stage ON pipeline_triggers(board_id, stage_id, trigger_event);
```

---

## 4. Sentiment Analysis no Agent Engine

### Step 14.5: analyzeSentiment()

Após cada resposta do agente, analisar o sentimento da última mensagem do cliente:

```typescript
async function analyzeSentiment(message: string, conversationId: string): Promise<void> {
  // Usa o LLM para classificar sentimento em 1 call (custo mínimo)
  const result = await generateObject({
    model,
    schema: z.object({
      sentiment: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),
      score: z.number().min(-100).max(100),
      reason: z.string().max(100)
    }),
    prompt: `Classifique o sentimento desta mensagem de cliente: "${message}"`
  })

  // Atualizar conversations
  await supabase.from('conversations').update({
    current_sentiment: result.sentiment,
    sentiment_score: result.score,
    sentiment_history: supabase.rpc('append_jsonb', {
      column: 'sentiment_history',
      value: { timestamp: new Date(), score: result.score, trigger: message.slice(0, 80) }
    })
  }).eq('id', conversationId)

  // Se negativo 3x consecutivo → sugerir escalar para humano
  if (result.sentiment === 'very_negative') {
    await checkNegativeSentimentEscalation(conversationId)
  }
}
```

### Closing Probability Calculator

5 fatores com pesos configuráveis:

| Fator | Peso | Cálculo |
|---|---|---|
| Sentimento atual | 25% | sentiment_score normalizado 0-100 |
| Engajamento | 20% | (respostas do cliente / total mensagens) * 100 |
| Qualificação | 25% | campos obrigatórios preenchidos / total campos * 100 |
| Velocidade no funil | 15% | max(0, 100 - dias_no_stage * 5) |
| RFM Score | 15% | (rfm_score / 15) * 100 |

```
closing_probability = Σ(fator_i * peso_i)
```

---

## 5. AI Nurturing Engine

### Modo B (default) — Sugestão Humana

1. Edge Function `generate-nurturing-suggestions` roda 2x/dia
2. Para cada org, lê `contact_behavioral_profile` + `deals.closing_probability` + `conversations.current_sentiment`
3. Gera sugestões por tipo (reativação, sazonal, upsell, sentiment_recovery, follow_up)
4. Sugestão aparece na UI `/nutricao` com urgência (low/medium/high/critical)
5. Vendedor aprova com 1 clique → envia via WhatsApp (Evolution API) ou email (Resend)

### Modo A (opt-in) — Automático

1. Mesmo pipeline do Modo B
2. `auto_send = true` no `nurturing_suggestions`
3. Sistema envia sem intervenção humana
4. Toggle em Configurações > Inteligência com confirmação de risco
5. Rate limit: max 2 mensagens auto/dia por contato
6. Safety: nunca envia fora do horário comercial, nunca para contatos opt-out

### Tipos de sugestão

| Tipo | Trigger | Urgency |
|---|---|---|
| reactivation | Sem compra há > 45 dias + RFM decaindo | high |
| seasonal | Mês de pico do cliente em ≤ 15 dias | medium |
| upsell | Comprou X, nunca comprou Y complementar | low |
| sentiment_recovery | Sentimento negativo + deal aberto | critical |
| follow_up | Deal parado em stage > 7 dias | high |

---

## 6. Segmentação de Campanha por Stage

Novos tipos de segmento em `email_campaigns`:

```typescript
type CampaignSegment =
  | { type: 'tag'; value: string }
  | { type: 'lifecycle'; value: string }
  | { type: 'vertical'; value: string }
  | { type: 'custom'; query: string }
  // NOVOS:
  | { type: 'pipeline_stage'; board_id: string; stage_ids: string[] }
  | { type: 'reactivation'; inactive_days: number }
  | { type: 'ready_for_proposal'; min_probability: number }
```

---

## 7. Pipeline Triggers

Ações automáticas executadas quando deal entra ou sai de um stage:

```typescript
type TriggerAction =
  | { type: 'send_email'; template_id: string }
  | { type: 'send_whatsapp'; message_template: string }
  | { type: 'create_activity'; activity_type: string; title: string; due_days: number }
  | { type: 'notify_team'; message: string }
  | { type: 'add_tag'; tag: string }

// Processamento: hook no webhook deal.stage_changed existente
// Para cada trigger ativo no (board_id, stage_id, 'on_enter'):
//   executar cada ação na lista
```

---

## 8. Humanização do Agente

Baseado na análise das skills humanizer-main e vibecoding-ai-agent:

### Aplicado ao NossoAgent Engine:
- Message batching: aguardar 2s antes de processar múltiplas mensagens
- Delays inteligentes: baseados em tamanho da resposta, hora do dia, fluxo da conversa
- Typing indicator proporcional: 4.5 chars/s, min 1.5s, max 12s, refresh a cada 4s
- Read receipt: marcar como lido ANTES de iniciar typing
- Message chunking: respostas > 300 chars quebradas em 2-3 balões
- Variação de saudações: nunca repetir mesma saudação consecutivamente
- Anti-patterns de escrita IA: 24 regras do humanizer aplicadas na geração de texto

---

## 9. Plano de Implementação

```
Fase 1: Schema & Tipos
  - Migration: contact_behavioral_profile, nurturing_suggestions, pipeline_triggers
  - Migration: +product_name/category em deals, +closing_probability/factors
  - Migration: +sentiment fields em conversations
  - Types TypeScript

Fase 2: Compute Engine
  - Edge Function compute-contact-profiles
  - pg_cron diário 03:00 UTC
  - Service layer + hooks TanStack Query

Fase 3: Sentiment Analysis
  - Step 14.5 no Agent Engine: analyzeSentiment()
  - Closing Probability Calculator
  - Tool get_contact_intelligence()
  - Realtime updates

Fase 4: Visual no Kanban + UI
  - DealCard: badges sentimento + % fechamento
  - ContactIntelligencePanel no detalhe do contato
  - Filtros no Kanban por sentimento/probabilidade

Fase 5: AI Nurturing Engine
  - Edge Function generate-nurturing-suggestions
  - pg_cron 2x/dia
  - Lógica Modo A/B
  - Envio via Evolution API / Resend

Fase 6: Nurturing UI
  - NurturingDashboard (/nutricao)
  - Aprovar/Editar/Dispensar/Adiar
  - Toggle Modo Automático em Configurações
  - Nav + Prefetch + Realtime

Fase 7: Campanhas por Stage
  - segment_type 'pipeline_stage' no CampaignsManager
  - Segmentos nativos: reactivation, ready_for_proposal
  - API segment-preview atualizada

Fase 8: Pipeline Triggers
  - Service pipeline-triggers + API
  - Hook no webhook deal.stage_changed
  - UI builder de automações
```

---

## 10. Decisões Técnicas

| Decisão | Razão |
|---|---|
| Modo B como default | Evitar spam e mensagens inapropriadas — humano valida antes de enviar |
| Sentimento via LLM (não regras) | Maior precisão com custo mínimo (1 call extra por mensagem) |
| RFM Score no banco (não calculado on-the-fly) | Performance — evitar joins pesados em cada render do dashboard |
| Closing probability como campo computado | Disponível para filtros, ordenação e segmentação sem recalcular |
| 5 fatores com pesos configuráveis | Cada vertical pode ajustar pesos (ex: clínica prioriza engajamento, imobiliária prioriza RFM) |
