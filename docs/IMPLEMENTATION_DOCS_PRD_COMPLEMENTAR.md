# Documentação de Implementação — PRD Complementar NossoCRM v1

> **Versão:** 1.0  
> **Data:** 11 de Fevereiro de 2026  
> **Abordagem:** 100% nativa (Supabase + Next.js), sem dependência de n8n  
> **Branch:** `feature/prd-complementar-implementation`

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura da Solução](#2-arquitetura-da-solução)
3. [Módulo 4 — Webhook Events Expansion](#3-módulo-4--webhook-events-expansion)
4. [Módulo 3 — AI Governance](#4-módulo-3--ai-governance)
5. [Módulo 2 — Inbox Inteligente 2.0](#5-módulo-2--inbox-inteligente-20)
6. [Arquivos Criados/Modificados](#6-arquivos-criadosmodificados)
7. [Guia de Configuração](#7-guia-de-configuração)

---

## 1. Visão Geral

### O que é o PRD Complementar?

O PRD Complementar NossoCRM v1 define 10 módulos de funcionalidades avançadas para o sistema NossoCRM, organizados em 4 fases de prioridade (P0 a P3). Esta implementação aborda a **Fase 1 (P0)** — os 3 módulos de maior prioridade que formam a fundação para os módulos
subsequentes.

### Por que 100% nativo?

A análise técnica concluiu que **nenhum dos 10 módulos requer n8n**. Todos podem ser implementados usando stack nativa:

| Tecnologia | Uso |
|---|---|
| **Supabase Database Triggers** | Eventos em tempo real (webhook outbound) |
| **pg_cron** | Agendamento de tarefas periódicas |
| **pg_net** | Requisições HTTP assíncronas do banco |
| **Supabase Edge Functions** | Lógica serverless para tarefas agendadas |
| **Next.js API Routes** | Endpoints REST para frontend |
| **React Query** | Gerenciamento de estado e cache no frontend |

### Benefícios da abordagem nativa:
- **Menor latência:** Sem overhead de comunicação com serviço externo
- **Menor custo operacional:** Sem licença n8n separada
- **Maior segurança:** API keys nunca saem do servidor
- **Simplicidade:** Uma stack, um deploy, um monitoramento

---

## 2. Arquitetura da Solução

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────>│  API Routes  │────>│    Supabase DB   │
│  (React +    │     │  (Next.js)   │     │                  │
│  React Query)│<────│              │<────│  Triggers +      │
└─────────────┘     └──────────────┘     │  pg_cron + RLS   │
                                         └────────┬─────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │  pg_net (HTTP)     │
                                         │  → Webhooks saída  │
                                         └───────────────────┘
```

### Camadas:

1. **Frontend (React):** Hooks + Componentes
2. **API Layer (Next.js):** Route Handlers com auth via cookies
3. **Service Layer:** `lib/supabase/*.ts` — lógica de negócio
4. **Database:** Triggers, Functions, pg_cron jobs
5. **Outbound:** pg_net para webhooks HTTP

---

## 3. Módulo 4 — Webhook Events Expansion

### Objetivo

Expandir o sistema de eventos outbound do CRM. Antes da implementação, apenas o evento `deal.stage_changed` era disparado. Agora, o sistema suporta **7 tipos de eventos** diferentes.

### Problema Resolvido

Integrações externas (n8n, Zapier, Make, sistemas internos) tinham visibilidade limitada — só sabiam quando um deal mudava de estágio. Agora é possível reagir a qualquer evento relevante do CRM.

### Eventos Implementados

| Evento | Trigger | Quando Dispara |
|---|---|---|
| `deal.created` | `AFTER INSERT ON deals` | Novo deal criado (manual ou via webhook) |
| `deal.won` | `AFTER UPDATE ON deals` | Deal marcado como ganho (`is_won = true`) |
| `deal.lost` | `AFTER UPDATE ON deals` | Deal marcado como perdido (`is_lost = true`) |
| `deal.stage_changed` | `AFTER UPDATE ON deals` | Deal muda de estágio (já existia) |
| `deal.stagnant` | `pg_cron` (hourly) | Deal aberto sem atividade há 7+ dias |
| `contact.created` | `AFTER INSERT ON contacts` | Novo contato criado |
| `contact.stage_changed` | `AFTER UPDATE ON contacts` | Contato muda de lifecycle stage |
| `activity.completed` | `AFTER UPDATE ON activities` | Atividade marcada como concluída |

### Função Reutilizável: `dispatch_webhook_event()`

Para evitar duplicação de código entre triggers, foi criada uma função genérica:

```sql
dispatch_webhook_event(
  p_event_type TEXT,          -- Ex: 'deal.created'
  p_organization_id UUID,     -- Org do evento
  p_deal_id UUID DEFAULT NULL,-- Deal associado (se aplicável)
  p_payload JSONB             -- Payload completo do evento
)
```

**Fluxo interno:**
1. Busca endpoints ativos (`integration_outbound_endpoints`) que escutam o evento
2. Insere registro em `webhook_events_out` (auditoria)
3. Cria registro em `webhook_deliveries` (tracking)
4. Dispara HTTP POST via `pg_net` (assíncrono)
5. Em caso de erro, marca delivery como `failed` com mensagem

### Payloads dos Eventos

Cada evento inclui dados contextuais enriquecidos. Exemplo `deal.won`:

```json
{
  "event_type": "deal.won",
  "occurred_at": "2026-02-11T18:30:00Z",
  "deal": {
    "id": "uuid",
    "title": "Contrato Empresa X",
    "value": 50000,
    "board_name": "Vendas B2B",
    "won_value": 50000,
    "days_to_close": 23,
    "contact_id": "uuid"
  },
  "contact": {
    "name": "João Silva",
    "phone": "+55 11 99999-0000",
    "email": "joao@empresa.com"
  }
}
```

### Detecção de Deals Estagnados

A função `check_stagnant_deals()` roda via `pg_cron` a cada hora:

- **Critério:** Deal aberto (`is_won=false, is_lost=false`) com `updated_at < now() - 7 days`
- **Anti-spam:** Não dispara se já houve evento `deal.stagnant` nas últimas 24h
- **Eficiência:** Só processa se existem endpoints ativos para o evento
- **Dados extras:** Calcula `stagnation_days` considerando última atividade

### Habilitação do pg_cron

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

O `pg_cron` é uma extensão nativa do Supabase que permite agendar execução periódica de SQL. Não requer infraestrutura externa.

### Arquivo

- **Migration:** `supabase/migrations/20260211000001_webhook_events_expansion.sql`

---

## 4. Módulo 3 — AI Governance

### Objetivo

Implementar controle completo sobre o uso de IA na plataforma: quotas mensais, logging de cada chamada, cálculo de custo estimado, e dashboard de monitoramento.

### Problema Resolvido

Sem governança, a organização:
- Não sabe quanto está gastando com IA
- Não consegue limitar uso excessivo
- Não tem visibilidade por provider/modelo/ação
- Pode exceder orçamentos sem perceber

### Componentes Implementados

#### 4.1 Service: `lib/supabase/ai-governance.ts`

**Funções principais:**

| Função | Descrição |
|---|---|
| `checkQuota(supabase, orgId)` | Verifica se a org está dentro do limite mensal de tokens |
| `logAIUsage(supabase, entry)` | Registra chamada com tokens, custo, duração |
| `getUsageStats(supabase, orgId, period)` | Agrega métricas por provider/model/action |
| `getQuotaStatus(supabase, orgId)` | Retorna % usado, limite, se está perto do limite |
| `estimateCost(model, inputTokens, outputTokens)` | Calcula custo estimado em USD |

**Tabela de custos por modelo (preços aproximados fev/2026):**

| Modelo | Input/1K | Output/1K |
|---|---|---|
| gemini-2.0-flash | $0.00010 | $0.00040 |
| gpt-4o | $0.00250 | $0.01000 |
| claude-3.5-sonnet | $0.00300 | $0.01500 |

#### 4.2 Integração no fluxo de IA

Ponto de aplicação: `/api/ai/actions/route.ts` (endpoint central de IA)

**Antes de processar:**
```
Auth → Feature Flags → QUOTA CHECK → Processar IA
```

**Depois de processar:**
```
Resultado → LOG USAGE (fire-and-forget) → Retornar resposta
```

Se a quota estiver excedida, retorna HTTP 429 com mensagem clara.

#### 4.3 Database Functions

| Função SQL | Chamada Por | Ação |
|---|---|---|
| `increment_ai_quota_usage(org_id, tokens)` | Service TypeScript | Incrementa contador mensal |
| `reset_monthly_ai_quotas()` | pg_cron (diário 00:05) | Reseta orgs cujo `reset_day == dia atual` |

#### 4.4 API Route: `/api/ai/usage`

| Endpoint | Params | Retorna |
|---|---|---|
| `GET /api/ai/usage` | `period=month` | `{ stats: AIUsageStats }` |
| `GET /api/ai/usage?view=quota` | — | `{ quota: AIQuotaStatus }` |

#### 4.5 React Hooks: `useAIGovernance.ts`

| Hook | Função |
|---|---|
| `useAIUsageStats(period)` | Busca estatísticas de uso por período |
| `useAIQuotaStatus()` | Busca status atual da quota |
| `useUpdateAIQuota()` | Mutation para admin alterar quota |

### Arquivos

- **Service:** `lib/supabase/ai-governance.ts`
- **Migration:** `supabase/migrations/20260211000002_ai_governance_functions.sql`
- **API Route:** `app/api/ai/usage/route.ts`
- **Hook:** `features/settings/hooks/useAIGovernance.ts`
- **Modificado:** `app/api/ai/actions/route.ts` (quota check + usage logging)

---

## 5. Módulo 2 — Inbox Inteligente 2.0

### Objetivo

Evoluir o inbox de simples lista de notificações para um **sistema inteligente de priorização de ações**, com gamificação e scripts sugeridos.

### Problema Resolvido

O vendedor:
- Não sabe o que fazer primeiro ao abrir o CRM
- Perde tempo priorizando manualmente
- Não tem visibilidade de deals que estão "esfriando"
- Falta motivação para manter ritmo constante

### Componentes Implementados

#### 5.1 Service: `lib/supabase/inbox-actions.ts`

**Algoritmo de priorização:**

```
priority_score = (dealValue / avgDealValue) × stagnationDays × urgencyMultiplier
```

Onde:
- `dealValue / avgDealValue`: Normaliza o valor relativo do deal
- `stagnationDays`: Dias sem atividade/atualização
- `urgencyMultiplier`: 10 para estagnação, 20 para atividade vencida

**Classificação por score:**

| Score | Priority | Cor |
|---|---|---|
| > 50 | `critical` | Vermelho |
| > 30 | `high` | Laranja |
| > 15 | `medium` | Amarelo |
| ≤ 15 | `low` | Verde |

**Fontes de action items:**

1. **Deals estagnados:** Deals abertos do vendedor sem atividade há 5+ dias
   - Ação sugerida: CALL (se > 10 dias) ou WHATSAPP (se 5-10 dias)
   
2. **Atividades vencidas:** Atividades não completadas cuja `due_date` já passou
   - Ação sugerida: Tipo original da atividade (CALL, EMAIL, etc.)

#### 5.2 CRUD Operations

| Função | Método | Descrição |
|---|---|---|
| `getActionItems()` | GET | Lista items por status, ordenados por score |
| `createActionItem()` | POST | Cria item individual |
| `completeActionItem()` | PATCH | Marca como completado + timestamp |
| `dismissActionItem()` | PATCH | Ignora item + timestamp |
| `snoozeActionItem()` | PATCH | Adia para data futura |
| `getUserStreak()` | GET | Calcula dias consecutivos de produtividade |

#### 5.3 Geração Inteligente

**Endpoint:** `POST /api/ai/inbox-generate`

**Fluxo:**
1. Busca deals estagnados do usuário (top 10 por valor)
2. Busca atividades vencidas (top 10 por data)
3. Calcula score de prioridade para cada
4. Verifica duplicatas (evita criar item se já existe pending)
5. Persiste action items
6. Retorna items criados

**Saída:**
```json
{
  "generated": 5,
  "items": [
    {
      "title": "Follow-up: Contrato Empresa X",
      "reason": "Sem atividade há 8 dias. Valor: R$ 50.000",
      "action_type": "WHATSAPP",
      "priority": "high",
      "priority_score": 42
    }
  ]
}
```

#### 5.4 Gamificação: Streak Counter

Implementa contagem de "dias consecutivos" em que o vendedor completou todas as ações do inbox:

- **`todayComplete`:** Boolean se todas as ações de hoje foram completadas
- **`streak`:** Número de dias consecutivos com ações completas
- Incentiva comportamento consistente

#### 5.5 React Hooks

| Hook | Função |
|---|---|
| `useActionItems(status)` | Lista action items filtrados por status |
| `useCompleteAction()` | Mutation para completar ação |
| `useDismissAction()` | Mutation para ignorar ação |
| `useSnoozeAction()` | Mutation para adiar ação |
| `useGenerateActions()` | Mutation para gerar novos items |
| `useUserStreak()` | Query para streak do usuário |

### Arquivos

- **Service:** `lib/supabase/inbox-actions.ts`
- **API Route:** `app/api/ai/inbox-generate/route.ts`
- **Hook:** `features/inbox/hooks/useActionItems.ts`

---

## 6. Arquivos Criados/Modificados

### Novos Arquivos

| Arquivo | Módulo | Tipo |
|---|---|---|
| `supabase/migrations/20260211000001_webhook_events_expansion.sql` | Mód. 4 | Migration SQL |
| `supabase/migrations/20260211000002_ai_governance_functions.sql` | Mód. 3 | Migration SQL |
| `lib/supabase/ai-governance.ts` | Mód. 3 | Service |
| `lib/supabase/inbox-actions.ts` | Mód. 2 | Service |
| `app/api/ai/usage/route.ts` | Mód. 3 | API Route |
| `app/api/ai/inbox-generate/route.ts` | Mód. 2 | API Route |
| `features/settings/hooks/useAIGovernance.ts` | Mód. 3 | React Hook |
| `features/inbox/hooks/useActionItems.ts` | Mód. 2 | React Hook |

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `app/api/ai/actions/route.ts` | Adicionado quota check + usage logging (governança) |

### Tabelas Existentes Utilizadas (da migration anterior)

| Tabela | Módulo |
|---|---|
| `ai_usage_logs` | Mód. 3 |
| `ai_quotas` | Mód. 3 |
| `inbox_action_items` | Mód. 2 |
| `notification_preferences` | Mód. 1 (futuro) |
| `webhook_events_out` | Mód. 4 |
| `webhook_deliveries` | Mód. 4 |
| `integration_outbound_endpoints` | Mód. 4 |

---

## 7. Guia de Configuração

### Pré-requisitos

1. **pg_cron** habilitado no Supabase (feito pela migration)
2. **pg_net** já está habilitado (usado pelos webhooks existentes)
3. **Tabelas complementares** já criadas pela migration `20260128000000_complementary_features.sql`

### Aplicar Migrations

Execute as migrations na ordem:
```bash
# Se usando Supabase CLI:
supabase db push

# Ou no SQL Editor do Supabase:
# 1. Executar 20260211000001_webhook_events_expansion.sql
# 2. Executar 20260211000002_ai_governance_functions.sql
```

### Configurar Webhooks

No painel de Settings → Integrações → Webhooks (saída):
1. Endpoint URL
2. Selecionar eventos desejados (deal.created, deal.won, etc.)
3. Ativar endpoint

### Configurar Quota de IA (Opcional)

No painel de Settings → IA → Governança:
1. Definir limite mensal de tokens (0 = sem limite)
2. Dia do reset mensal (default: 1)
3. Threshold de alerta (default: 80%)

### Gerar Action Items do Inbox

- O vendedor pode clicar "Gerar Ações" no Inbox
- Também pode ser automatizado via pg_cron (fase futura)

---

## Próximas Fases

| Fase | Módulos | Status |
|---|---|---|
| **Fase 1 (P0)** | Webhook Events, AI Governance, Inbox 2.0 | ✅ Implementado |
| **Fase 2 (P1)** | Smart Notifications, Activity Sequences, Bulk Ops | ⏳ Planejado |
| **Fase 3 (P2)** | Deal Templates, Quick Reports, MCP OAuth | ⏳ Planejado |
| **Fase 4 (P3)** | Contact Enrichment | ⏳ Planejado |
