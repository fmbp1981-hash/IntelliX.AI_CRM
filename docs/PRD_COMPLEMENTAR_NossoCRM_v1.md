# PRD Complementar — NossoCRM (IntelliX.AI_CRM)

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Status:** Proposta de Evolução  
**Tipo:** Documento Aditivo (não substitui o PRD original)

---

## 📋 Sumário Executivo

Este documento propõe **features complementares** ao NossoCRM existente, projetadas para:

- Agregar valor sem alterar a estrutura core do sistema
- Reutilizar a arquitetura existente (Supabase, Next.js, TanStack Query, SDK AI v6)
- Estender pontos de integração já implementados (Webhooks, API, MCP)
- Preencher gaps identificados na análise do PRD original

**Princípio fundamental:** Toda feature proposta deve se encaixar como módulo independente, usando os mesmos padrões de cache, RLS e autenticação já estabelecidos.

---

## 🎯 Escopo deste Documento

### Inclui

- Features que estendem módulos existentes
- Novos endpoints que seguem padrões da API pública
- Automações que usam webhooks existentes como base
- Melhorias no Inbox Inteligente e Assistente de IA
- Governança e observabilidade

### Não Inclui

- Mudanças no schema core de `deals`, `contacts`, `boards`
- Alterações no fluxo de autenticação
- Modificações no proxy ou middleware
- Refatoração de componentes existentes

---

## 🧩 Módulo 1: Smart Notifications (Notificações Inteligentes)

### Problema

O sistema atual não notifica proativamente o usuário sobre eventos críticos. O vendedor precisa abrir o CRM para descobrir que tem deals estagnados ou follow-ups pendentes.

### Solução

Sistema de notificações assíncronas que reutiliza a infraestrutura de webhooks outbound existente.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Alerta de Estagnação | Notifica quando deal fica X dias sem movimentação | Alta |
| Lembrete de Atividade | Aviso antes de atividade agendada (30min, 1h) | Alta |
| Deal Esfriando | Alerta quando probabilidade cai automaticamente | Média |
| Resumo Diário | Push com briefing do dia (8h da manhã) | Média |
| Win/Loss Alert | Notifica time quando deal fecha | Baixa |

### Implementação Técnica

**Novo endpoint:** `/api/notifications/preferences`

**Nova tabela:** `notification_preferences` (com RLS por `organization_id`)

```typescript
interface NotificationPreference {
  id: string;
  organizationId: string;
  userId: string;
  channel: 'email' | 'webhook' | 'push';
  eventType: 'stagnation' | 'activity_reminder' | 'daily_summary' | 'win_loss';
  enabled: boolean;
  config: {
    stagnationDays?: number;
    reminderMinutes?: number;
    summaryTime?: string; // "08:00"
  };
}
```

**Trigger:** Reutiliza `pg_net` já usado nos webhooks outbound

**Integração:** Dispara para URL configurada (n8n/Make) ou envia email via Resend/SendGrid

### User Story

> Como vendedor, quero receber um alerta no meu WhatsApp quando um deal ficar parado por mais de 5 dias, para que eu não perca oportunidades por esquecimento.

### Métrica de Sucesso

- % de deals estagnados que recebem ação em 24h após notificação
- Redução do tempo médio de estagnação

---

## 🧩 Módulo 2: Inbox Inteligente 2.0 (Evolução)

### Problema

O Inbox atual gera briefing diário, mas não especifica ações concretas nem mede engajamento.

### Solução

Evoluir o Inbox para uma **Central de Ações** com priorização inteligente e tracking de execução.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Action Items | Lista de ações específicas (não apenas informativo) | Alta |
| Priorização por IA | Ordena por urgência × impacto (valor do deal × dias parado) | Alta |
| Quick Actions | Botões de ação rápida (Ligar, Email, Mover) | Alta |
| Completion Tracking | Marcar ação como feita, métricas de execução | Média |
| Focus Mode | "Próximas 3 ações" para evitar overwhelm | Média |
| Streak Counter | Gamificação: dias seguidos completando inbox | Baixa |

### Implementação Técnica

**Novo componente:** `features/inbox/components/ActionItems.tsx`

**Nova interface:**

```typescript
interface InboxActionItem {
  id: string;
  dealId: string;
  contactId: string;
  type: 'call' | 'email' | 'move_stage' | 'schedule_meeting' | 'custom';
  title: string;
  reason: string; // "Deal parado há 7 dias"
  priority: number; // 1-100 calculado por IA
  suggestedScript?: string;
  completed: boolean;
  completedAt?: string;
}
```

**Cálculo de Prioridade (tool de IA):**

```typescript
priority = (dealValue / avgDealValue) * stagnationDays * probabilityDecayFactor
```

### User Story

> Como vendedor, quero abrir meu Inbox e ver exatamente as 3 ações mais importantes do dia com scripts prontos, para que eu comece a trabalhar em menos de 2 minutos.

### Métrica de Sucesso

- % de Action Items completados por dia
- Tempo entre abertura do Inbox e primeira ação
- Correlação entre completion rate e win rate

---

## 🧩 Módulo 3: AI Governance (Governança de IA)

### Problema

O sistema tem 38+ tools de IA mas sem controle de custos, rate limits ou políticas de autonomia.

### Solução

Painel de governança que monitora e controla uso de IA por organização.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Usage Dashboard | Tokens consumidos por dia/semana/mês | Alta |
| Quota por Org | Limite mensal de tokens com alertas | Alta |
| Rate Limit | Requests por minuto por usuário | Alta |
| Cost Estimation | Custo estimado em USD por período | Média |
| Provider Fallback | Config de fallback automático (Gemini → OpenAI) | Média |
| Autonomy Levels | Níveis: Suggest, Confirm, Auto | Média |
| Audit Log | Histórico de todas as ações da IA | Baixa |

### Implementação Técnica

**Novas tabelas:**

```sql
-- ai_usage_logs (append-only, para métricas)
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  provider TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic'
  model TEXT NOT NULL,
  tool_name TEXT,
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ai_quotas (config por org)
CREATE TABLE ai_quotas (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  monthly_token_limit BIGINT DEFAULT 1000000,
  tokens_used_this_month BIGINT DEFAULT 0,
  reset_day INT DEFAULT 1, -- dia do mês para reset
  alert_threshold_percent INT DEFAULT 80
);
```

**Novo endpoint:** `/api/ai/usage` (GET: métricas, POST: registrar uso)

**Middleware de controle:** Intercepta `/api/ai/chat` para checar quota antes de processar

### User Story

> Como admin, quero ver quanto minha equipe está gastando com IA e definir um limite mensal, para evitar surpresas na fatura.

### Métrica de Sucesso

- Custo médio por deal criado via IA
- % de orgs que atingem quota (idealmente < 10%)
- Uptime do serviço com fallback ativo

---

## 🧩 Módulo 4: Webhook Events Expansion (Novos Eventos)

### Problema

Atualmente só dispara webhook em `deal.stage_changed`. Automações avançadas precisam de mais triggers.

### Solução

Expandir eventos outbound mantendo a mesma infraestrutura de `webhook_events_out` e `webhook_deliveries`.

### Novos Eventos

| Evento | Trigger | Payload Adicional |
|--------|---------|-------------------|
| `deal.created` | Novo deal (manual ou via API) | `source: 'manual' \| 'api' \| 'webhook' \| 'ai'` |
| `deal.won` | Deal marcado como ganho | `won_value`, `days_to_close` |
| `deal.lost` | Deal marcado como perdido | `loss_reason`, `days_in_pipeline` |
| `deal.stagnant` | Deal sem atividade há X dias | `stagnation_days`, `last_activity` |
| `contact.created` | Novo contato | `source`, `lifecycle_stage` |
| `contact.stage_changed` | Mudança de lifecycle | `from_stage`, `to_stage` |
| `activity.completed` | Atividade marcada como feita | `activity_type`, `deal_id` |

### Implementação Técnica

**Novo trigger Postgres (exemplo para deal.created):**

```sql
CREATE OR REPLACE FUNCTION notify_deal_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO webhook_events_out (organization_id, event_type, deal_id, payload)
  VALUES (
    NEW.organization_id,
    'deal.created',
    NEW.id,
    jsonb_build_object(
      'event_type', 'deal.created',
      'occurred_at', now(),
      'deal', row_to_json(NEW),
      'source', COALESCE(NEW.custom_fields->>'creation_source', 'manual')
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**UI:** Checkbox por evento em Settings → Integrações → Webhooks

### User Story

> Como usuário de n8n, quero receber um webhook quando um deal for marcado como Won, para disparar automação de onboarding do cliente.

### Métrica de Sucesso

- Número de webhooks outbound ativos por evento
- Taxa de entrega bem-sucedida (> 99%)

---

## 🧩 Módulo 5: Deal Templates (Templates de Negócio)

### Problema

Criar deals repetitivos (mesmo produto, mesmos campos) é manual e propenso a erros.

### Solução

Templates reutilizáveis que pré-configuram deals com valores padrão.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Criar Template | Salvar configuração de deal como template | Alta |
| Aplicar Template | Criar deal a partir de template | Alta |
| Template por Board | Templates vinculados a pipelines específicos | Média |
| Campos Dinâmicos | Placeholders como `{{contact.name}}` | Média |
| Template via API | Endpoint para criar deal a partir de template | Baixa |

### Modelo de Dados

```typescript
interface DealTemplate {
  id: string;
  organizationId: string;
  boardId?: string; // null = disponível em todos
  name: string;
  description?: string;
  defaults: {
    title?: string; // suporta placeholders
    value?: number;
    priority?: 'low' | 'medium' | 'high';
    probability?: number;
    items?: DealItem[];
    tags?: string[];
    customFields?: Record<string, any>;
  };
  createdBy: string;
  isActive: boolean;
}
```

### User Story

> Como vendedor, quero criar um deal de "Consultoria Mensal" com um clique, já com valor R$5.000 e itens pré-configurados.

### Métrica de Sucesso

- % de deals criados via template
- Redução no tempo médio de criação de deal

---

## 🧩 Módulo 6: Activity Sequences (Cadências)

### Problema

Follow-ups são manuais. Vendedor esquece de criar próxima atividade após completar a atual.

### Solução

Sequências automatizadas de atividades que se auto-agendam.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Criar Sequência | Definir série de atividades com intervalos | Alta |
| Vincular a Deal | Aplicar sequência a um deal específico | Alta |
| Auto-Schedule | Próxima atividade agenda automaticamente | Alta |
| Pause/Resume | Pausar sequência sem perder progresso | Média |
| Sequência por Stage | Auto-aplicar quando deal entra em estágio | Média |
| Skip Activity | Pular etapa mantendo sequência | Baixa |

### Modelo de Dados

```typescript
interface ActivitySequence {
  id: string;
  organizationId: string;
  name: string;
  steps: ActivitySequenceStep[];
  triggerStageId?: string; // auto-aplicar quando deal entra
}

interface ActivitySequenceStep {
  order: number;
  activityType: 'CALL' | 'EMAIL' | 'MEETING' | 'TASK';
  title: string;
  description?: string;
  delayDays: number; // dias após step anterior (ou após início)
  delayHours?: number;
}

interface DealSequenceEnrollment {
  id: string;
  dealId: string;
  sequenceId: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  startedAt: string;
  nextActivityDate?: string;
}
```

### User Story

> Como vendedor, quero que ao mover um deal para "Proposta Enviada", uma sequência de 3 follow-ups seja criada automaticamente (Day 2, Day 5, Day 10).

### Métrica de Sucesso

- % de deals com sequência ativa
- Taxa de conclusão de sequências
- Impacto no win rate de deals com sequência vs sem

---

## 🧩 Módulo 7: MCP OAuth & Marketplace Ready

### Problema

MCP atual usa API Key, incompatível com ChatGPT/Claude direto. Posicionamento como "infra de agentes" está subutilizado.

### Solução

Implementar OAuth 2.1/PKCE para compatibilidade com assistentes externos e preparar estrutura de marketplace.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| OAuth 2.1 Flow | Authorization code + PKCE | Alta |
| Scopes Granulares | `deals:read`, `deals:write`, `contacts:read` | Alta |
| Token Management | Refresh tokens, revogação | Alta |
| App Registry | Cadastro de apps externos | Média |
| Usage per App | Métricas separadas por app conectado | Média |
| Rate Limit per App | Limites diferenciados | Baixa |

### Implementação Técnica

**Novos endpoints:**

- `GET /api/oauth/authorize` — Tela de autorização
- `POST /api/oauth/token` — Troca code por access_token
- `POST /api/oauth/revoke` — Revogar token
- `GET /api/oauth/userinfo` — Info do usuário autenticado

**Novas tabelas:**

```sql
CREATE TABLE oauth_apps (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY,
  app_id UUID REFERENCES oauth_apps(id),
  user_id UUID REFERENCES auth.users(id),
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  scopes TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### User Story

> Como usuário do ChatGPT, quero conectar meu CRM como "custom GPT" e perguntar "quais deals fecham essa semana?" diretamente no chat.

### Métrica de Sucesso

- Número de apps OAuth conectados
- Requests via OAuth vs API Key
- Retenção de conexões ativas (30 dias)

---

## 🧩 Módulo 8: Quick Reports (Relatórios Rápidos)

### Problema

Dashboard atual mostra KPIs, mas não permite análises customizadas ou exportação.

### Solução

Gerador de relatórios com templates pré-definidos e export.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Templates de Relatório | Pipeline Summary, Activity Report, Win/Loss Analysis | Alta |
| Filtros Dinâmicos | Por período, board, owner, stage | Alta |
| Export PDF/CSV | Download formatado | Alta |
| Scheduled Reports | Envio automático semanal/mensal | Média |
| AI Insights | Análise narrativa gerada por IA | Média |
| Share Link | Link público temporário para relatório | Baixa |

### Templates Sugeridos

1. **Pipeline Snapshot** — Deals por estágio, valor total, previsão
2. **Activity Summary** — Atividades por tipo, completion rate, por vendedor
3. **Win/Loss Analysis** — Taxa de conversão, motivos de perda, tempo médio
4. **Stagnation Report** — Deals parados, aging por estágio
5. **Sales Forecast** — Projeção baseada em probabilidade × valor

### User Story

> Como gestor, quero receber todo domingo às 20h um PDF com o resumo da semana do meu time, sem precisar abrir o CRM.

### Métrica de Sucesso

- Relatórios gerados por semana
- % de relatórios com scheduled delivery
- Tempo economizado vs análise manual

---

## 🧩 Módulo 9: Contact Enrichment (Enriquecimento)

### Problema

Contatos entram com dados mínimos (email/telefone). Vendedor perde tempo pesquisando manualmente.

### Solução

Enriquecimento automático via APIs externas (clearbit-style) ou IA.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Auto-Enrich on Create | Busca dados ao criar contato | Alta |
| LinkedIn Preview | Sugestão de perfil LinkedIn | Média |
| Company Data | Setor, tamanho, website da empresa | Média |
| Manual Trigger | Botão "Enriquecer" no perfil do contato | Média |
| Enrichment Source | Config de provider (Apollo, Clearbit, IA) | Baixa |

### Implementação Técnica

**Novo campo em contacts:**

```typescript
interface Contact {
  // ... campos existentes
  enrichmentData?: {
    linkedinUrl?: string;
    companySize?: string;
    industry?: string;
    location?: string;
    enrichedAt?: string;
    source?: 'apollo' | 'clearbit' | 'ai' | 'manual';
  };
}
```

**Tool de IA:** `enrichContact` — Usa web search para inferir dados

### User Story

> Como vendedor, quero que ao cadastrar um contato com email corporativo, o sistema já preencha empresa, cargo e LinkedIn automaticamente.

### Métrica de Sucesso

- % de contatos com dados enriquecidos
- Tempo médio de enriquecimento
- Precisão dos dados (via feedback do usuário)

---

## 🧩 Módulo 10: Bulk Operations (Operações em Massa)

### Problema

Ações em múltiplos deals/contatos são feitas uma a uma.

### Solução

Seleção múltipla + ações em batch.

### Funcionalidades

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| Multi-Select | Checkbox em listas de deals/contatos | Alta |
| Bulk Move Stage | Mover N deals para estágio X | Alta |
| Bulk Assign Owner | Atribuir deals a vendedor | Alta |
| Bulk Add Tag | Adicionar tag em selecionados | Média |
| Bulk Delete | Excluir com confirmação | Média |
| Bulk Export | Exportar selecionados para CSV | Baixa |

### Implementação Técnica

**Novos endpoints:**

- `POST /api/public/v1/deals/bulk/move-stage`
- `POST /api/public/v1/deals/bulk/assign`
- `POST /api/public/v1/deals/bulk/tag`
- `DELETE /api/public/v1/deals/bulk`

**Payload padrão:**

```typescript
interface BulkOperationRequest {
  dealIds: string[];
  operation: 'move_stage' | 'assign' | 'add_tag' | 'delete';
  params: {
    stageId?: string;
    ownerId?: string;
    tag?: string;
  };
}
```

### User Story

> Como vendedor, quero selecionar 15 deals antigos e movê-los para "Arquivado" com um clique.

### Métrica de Sucesso

- % de operações feitas via bulk vs individual
- Tempo economizado por operação bulk

---

## 📊 Priorização Consolidada

### Matriz Impacto × Esforço

| Módulo | Impacto | Esforço | Prioridade |
|--------|---------|---------|------------|
| Inbox 2.0 (Action Items) | 🔴 Alto | 🟡 Médio | **P0** |
| AI Governance | 🔴 Alto | 🟡 Médio | **P0** |
| Webhook Events Expansion | 🔴 Alto | 🟢 Baixo | **P0** |
| Smart Notifications | 🟡 Médio | 🟡 Médio | **P1** |
| Activity Sequences | 🟡 Médio | 🟡 Médio | **P1** |
| Bulk Operations | 🟡 Médio | 🟢 Baixo | **P1** |
| Deal Templates | 🟡 Médio | 🟢 Baixo | **P2** |
| Quick Reports | 🟡 Médio | 🟡 Médio | **P2** |
| MCP OAuth | 🔴 Alto | 🔴 Alto | **P2** |
| Contact Enrichment | 🟢 Baixo | 🟡 Médio | **P3** |

### Roadmap Sugerido

**Sprint 1-2 (P0):**
- Webhook Events Expansion (fundação para automações)
- AI Governance (controle de custos)
- Inbox 2.0 MVP (action items + quick actions)

**Sprint 3-4 (P1):**
- Smart Notifications
- Activity Sequences
- Bulk Operations

**Sprint 5-6 (P2):**
- Deal Templates
- Quick Reports
- MCP OAuth (início)

**Sprint 7+ (P3):**
- Contact Enrichment
- MCP OAuth (conclusão)
- Features baseadas em feedback

---

## 📐 Padrões Técnicos (Obrigatórios)

Todas as features deste PRD DEVEM seguir:

### Cache

```typescript
// CORRETO: usar queryKeys do padrão existente
queryClient.setQueryData([...queryKeys.deals.lists(), 'view'], updater);

// INCORRETO: criar novos padrões de cache
queryClient.setQueryData(['my-custom-key'], data);
```

### RLS

Toda nova tabela DEVE ter policy por `organization_id`:

```sql
CREATE POLICY "org_isolation" ON nova_tabela
  FOR ALL USING (organization_id = auth.jwt()->>'organization_id');
```

### API Pública

Novos endpoints seguem padrão existente:

- Base: `/api/public/v1/`
- Auth: Header `X-Api-Key`
- Erro: `{ "error": "msg", "code": "CODE" }`
- Lista: `{ "data": [], "nextCursor": "..." }`

### Componentes

- Usar primitivos de `components/ui/` (Radix-based)
- Feature modules em `features/{nome}/`
- Testes junto ao código: `Component.test.tsx`

---

## ✅ Checklist de Validação

Antes de implementar qualquer feature deste PRD:

- [ ] Não altera tabelas core (`deals`, `contacts`, `boards`, `activities`)
- [ ] Usa RLS com `organization_id`
- [ ] Segue padrões de cache do AGENTS.md
- [ ] Tem endpoint em `/api/public/v1/` se exposta externamente
- [ ] Tem métrica de sucesso definida
- [ ] Tem user story clara
- [ ] Passou por `npm run precheck` sem erros

---

## 📚 Anexos

### Dependências de Módulos

```
Webhook Events Expansion
    └── Smart Notifications (usa novos eventos)
    └── Activity Sequences (trigger por stage)

AI Governance
    └── Inbox 2.0 (priorização por IA)
    └── Contact Enrichment (quota de enriquecimento)

MCP OAuth
    └── Quick Reports (share link autenticado)
```

### Estimativas de Tabelas Novas

| Tabela | Módulo | Rows/org estimados |
|--------|--------|-------------------|
| `notification_preferences` | Smart Notifications | ~10 |
| `ai_usage_logs` | AI Governance | ~10k/mês |
| `ai_quotas` | AI Governance | 1 |
| `deal_templates` | Deal Templates | ~20 |
| `activity_sequences` | Activity Sequences | ~10 |
| `deal_sequence_enrollments` | Activity Sequences | ~100 |
| `oauth_apps` | MCP OAuth | ~5 |
| `oauth_tokens` | MCP OAuth | ~50 |

---

**Documento elaborado como complemento aditivo ao PRD NossoCRM v1.0**

*Este PRD não substitui o documento original — deve ser lido em conjunto.*
