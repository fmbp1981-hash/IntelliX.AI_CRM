# PROJECT_REGISTRY.md — NossoCRM (IntelliX.AI_CRM)

> **Documento Vivo:** Atualizado a cada modificação significativa.
> **Última Atualização:** 14 de Março de 2026 (21:00 BRT)
> **Versão do Registro:** 2.2

---

## 1. Visão Geral do Produto

**NossoCRM** é uma plataforma CRM assistiva pró-ativa SaaS, posicionada como "CRM Assistivo Enterprise-Lean" para empresas B2B com 5 a 50 vendedores. Combina **Inbox Inteligente 2.0**, **AI Governance**, **Automações Nativas** (pg_net/pg_cron) e **Verticalização Multi-Nicho**.

| Atributo | Valor |
|---|---|
| **Repositório** | `thaleslaray/IntelliX.AI_CRM` |
| **Autor** | Thales Laray |
| **Licença** | Proprietária (IntelliX.AI) |
| **Deploy** | Vercel (frontend/API Edge) + Supabase (persistência) |
| **Produção** | Via wizard `/install` |

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | Next.js (App Router) + React + TypeScript | 16 / 19 / 5.x |
| **UI** | Tailwind CSS + Radix UI (Shadcn) + Framer Motion | v4 |
| **Estado** | TanStack Query v5 (SSOT no cache) + Zustand | v5 |
| **Backend/BD** | Supabase (PostgreSQL 15+) + Row-Level Security | 15+ |
| **IA** | Vercel AI SDK v6 (Claude, Gemini, GPT-4o) | v6 |
| **Deploy** | Vercel (frontend/APIs Edge) + Supabase (persistência) | — |
| **Automações** | pg_net + pg_cron (nativo no banco) | — |
| **Testes** | Vitest + happy-dom + React Testing Library | — |
| **Lint** | ESLint (zero warnings enforced) | — |

### Padrão SSOT (Cache)
Todas mutações iteram sobre mesma chave global do TanStack Query (ex: `[...queryKeys.deals.lists(), 'view']`), eliminando race conditions. Prefere `setQueryData` sobre `invalidateQueries`.

---

## 3. Arquitetura de Diretórios

```
IntelliX.AI_CRM/
├── app/                    # Rotas Next.js (App Router)
│   ├── (protected)/        #   Rotas autenticadas (dashboard, pipeline, inbox, etc.)
│   ├── api/                #   API Routes (ai/, contacts/, deals/, vertical/, webhooks/, properties/, dashboard/)
│   ├── auth/               #   Callback de autenticação
│   ├── install/            #   Wizard de instalação
│   ├── login/              #   Tela de login
│   └── join/               #   Convite de equipe
├── components/             # Componentes compartilhados (UI, layout, modais)
├── context/                # Contextos React (auth, sidebar, pipeline, etc.)
├── features/               # Módulos por domínio de negócio
│   ├── activities/         #   Atividades (tarefas, reuniões, chamadas)
│   ├── ai-hub/             #   Central de IA
│   ├── boards/             #   Pipeline Kanban (maior módulo)
│   ├── contacts/           #   Gestão de contatos
│   ├── dashboard/          #   Dashboard e métricas + vertical widgets
│   ├── deals/              #   Oportunidades
│   ├── decisions/          #   Decision matrix
│   ├── inbox/              #   Inbox Inteligente 2.0
│   ├── onboarding/         #   Onboarding + VerticalSelector
│   ├── profile/            #   Perfil do usuário
│   ├── properties/         #   Módulo imobiliário (PropertyCard, PropertyMatchList)
│   ├── reports/            #   Quick Reports
│   ├── settings/           #   Configurações (AI Governance, Notificações, Sequências)
│   └── shared/             #   Componentes compartilhados entre features
├── hooks/                  # Hooks globais (useVerticalConfig, useFeatureFlag, etc.)
├── lib/                    # Bibliotecas e lógica de negócio
│   ├── ai/                 #   IA: tools, prompt-composer, priority-score
│   ├── query/              #   Query keys + facades TanStack Query
│   ├── supabase/           #   Services: CRUD, auth, AI governance, inbox, custom-fields
│   ├── utils/              #   Utilitários (formatação, validação, etc.)
│   ├── realtime/           #   Subscriptions Supabase Realtime
│   ├── public-api/         #   API pública documentada
│   ├── templates/          #   Templates de pipeline
│   └── stores/             #   Zustand stores
├── types/                  # TypeScript interfaces globais
├── supabase/               # Configuração Supabase
│   ├── migrations/         #   SQL migrations (versionadas)
│   └── functions/          #   Edge Functions
├── test/                   # Fixtures de teste globais
├── docs/                   # Documentação técnica
│   ├── PRD_COMPLEMENTAR_NossoCRM_v1.md
│   ├── IMPLEMENTATION_DOCS_PRD_COMPLEMENTAR.md
│   ├── webhooks.md
│   ├── public-api.md
│   └── mcp.md
├── n8n-skills/             # Skills para automações n8n
├── AGENTS.md               # Guia para IA/dev (cache rules, stack, AI skills)
├── README.md               # Guia de uso (orientado ao usuário final)
└── PROJECT_REGISTRY.md     # << ESTE ARQUIVO — documento vivo do projeto
```

---

## 4. Módulos e Estado de Implementação

### 4.1 Core CRM (branch `main`)

| Módulo | Status | Descrição |
|---|---|---|
| **Auth + Multi-tenancy** | ✅ Completo | Supabase Auth, RLS por `organization_id`, roles admin/vendedor |
| **Pipeline Kanban** | ✅ Completo | Boards, stages, drag-and-drop, templates, journey flow |
| **Contatos** | ✅ Completo | CRUD, lifecycle stages, importação CSV, tags |
| **Deals** | ✅ Completo | Oportunidades, vinculação a contatos/boards, valores, probabilidade |
| **Atividades** | ✅ Completo | Tarefas, reuniões, chamadas, timestamps, conclusão |
| **Dashboard** | ✅ Completo | Métricas, gráficos, funil, valor total |
| **AI Central** | ✅ Completo | Chat com IA, criação de deals via NLP, análises, scripts |
| **Onboarding** | ✅ Completo | Wizard de instalação, configuração guiada |
| **Relatórios** | ✅ Completo | Quick Reports por período |
| **Integrações** | ✅ Completo | Webhooks inbound/outbound, API pública |

### 4.2 PRD Complementar (branch `feature/prd-complementar-implementation`)

| Módulo | Fase | Status | Descrição |
|---|---|---|---|
| **Webhook Events Expansion** | P0 | ✅ Completo | 7 eventos (deal.created/won/lost/stagnant, contact.created/stage_changed, activity.completed) |
| **AI Governance** | P0 | ✅ Completo | Quotas mensais, logging, custos por modelo, dashboard, `checkQuota()` + 429 |
| **Inbox Inteligente 2.0** | P0 | ✅ Completo | Priority Score, Action Items, Streaks, geração via IA |
| **Smart Notifications** | P1 | ✅ Completo | Service (`notifications.ts`, 431 loc), API routes, hooks (6), NotificationPopover no header, Realtime, PreferencesSection em Settings |
| **Activity Sequences** | P1 | ✅ Completo | Service (`sequences.ts`, 436 loc), API route, hooks (8), SequencesManager UI em Settings, scheduler `processScheduledSteps` |
| **Bulk Operations** | P1 | ✅ Completo | API route `/api/deals/bulk` (6 ops: move/assign/tag/delete/export_csv), hooks (6), BulkActionsBar UI flutuante |
| **Deal Templates** | P2 | ✅ Completo | Service (`deal-templates.ts`, 200 loc), hooks (4), API route, DealTemplatesManager UI em Settings |
| **Quick Reports** | P2 | ✅ Completo | QuickReportsPanel presente em Settings tab |
| **Email Campaigns** | P1 | ✅ Completo | Migration (3 tabelas), service (395 loc), 5 API routes, 2 hooks, CampaignsManager UI em Settings, envio via Resend, segmentação multi-critério |
| **MCP OAuth** | P2 | ⏳ Planejado | — |
| **Contact Enrichment** | P3 | ✅ Completo | Service (`contact-enrichment.ts`, 179 loc), enrichContact + batch, AI-based inference |
| **Follow-ups/Nurturing** | P1 | ✅ Completo | Migration (4 tabelas), services (810 loc), 3 API routes, 10 hooks, FollowupsManager UI em Settings |
| **Knowledge Base/RAG** | P1 | ✅ Completo | pgvector + match_knowledge, search_knowledge tool, Business Profile Editor UI, prompt builder integrado |

### 4.3 Verticalização Multi-Nicho (branch `feature/verticalizacao-multi-nicho`)

| Fase | Status | Arquivos Principais |
|---|---|---|
| **1 — Infraestrutura** | ✅ Completo & Commitado | `20260224000001_vertical_infrastructure.sql`, `20260224000002_seed_vertical_configs.sql`, `types/vertical.ts`, `hooks/useVerticalConfig.ts`, `hooks/useFeatureFlag.ts` |
| **2 — Onboarding** | ✅ Completo & Commitado | `lib/supabase/vertical-activation.ts`, `app/api/vertical/activate/route.ts`, `features/onboarding/components/VerticalSelector.tsx` |
| **3 — Campos Custom** | ✅ Completo & Commitado | `lib/supabase/custom-fields.ts`, `hooks/useCustomFields.ts`, `features/shared/components/CustomFieldsRenderer.tsx` |
| **4 — IA Contextual** | ✅ Completo & Commitado | `lib/ai/prompt-composer.ts`, `lib/ai/priority-score.ts`, `app/api/ai/generate/route.ts` |
| **5 — Dashboard Widgets** | ✅ Completo & Commitado | `lib/supabase/vertical-widgets.ts`, `app/api/dashboard/vertical-widgets/route.ts`, `features/dashboard/hooks/useVerticalWidgets.ts`, `features/dashboard/components/VerticalDashboardWidgets.tsx` |
| **6 — Automações** | ✅ Completo & Commitado | `supabase/functions/vertical-automation/index.ts`, `20260224000003_setup_vertical_cron_jobs.sql` |
| **7 — Módulo Imobiliárias** | ✅ Completo & Commitado | `lib/supabase/vertical-properties.ts`, `hooks/useVerticalProperties.ts`, `features/properties/components/PropertyCard.tsx`, `features/properties/components/PropertyMatchList.tsx`, `app/api/properties/route.ts` |
| **8 — Polish + QA** | ✅ Verificado | TypeScript ✅, ESLint ✅ (0 warnings) |

**Verticais suportadas:** `generic`, `medical_clinic`, `dental_clinic`, `real_estate`

### 4.4 NossoAgent IA Nativo (branch `feature/nossoagent`)

| Fase | Status | Arquivos Principais |
|---|---|---|
| **1 — Infraestrutura** | ✅ Completo | `20260225000001_create_agent_tables.sql`, `types/agent.ts`, `lib/supabase/agent.ts`, `hooks/useAgentConfig.ts`, `hooks/useConversations.ts`, `hooks/useConversationRealtime.ts` |
| **2 — Webhook + Provider** | ✅ Completo | `agent-webhook/index.ts`, `agent-send-message/index.ts`, `lib/ai/agent-prompts.ts`, `lib/ai/agent-vertical-context.ts` |
| **3 — Agent Engine Core** | ✅ Completo | `agent-engine/index.ts` (14-step pipeline) |
| **4 — Agent Tools** | ✅ Completo | `lib/ai/agent-tools.ts` (12 tools: contacts, deals, activities, qualification, transfer, vertical) |
| **5 — Frontend Chat** | ✅ Completo | `ConversationsPage.tsx`, `MessageBubble.tsx`, `ConversationsList.tsx`, `ConversationChat.tsx`, `ConversationContext.tsx` |
| **6 — Config UI** | ✅ Completo | `AgentConfigPage.tsx` (6 tabs: Connection, Behavior, Hours, Qualification, Transfer, Metrics) |
| **7 — CRM Integrations** | ✅ Completo | Inbox, Webhooks, AI Governance |
| **8 — Media + Extras** | ✅ Completo | Media handler, resumo, métricas |
| **9 — Polish + QA** | ✅ Completo | Testes, edge cases |

### 4.4b NossoAgent Inbox — Chat de Atendimento Omnichannel (branch `feature/nossoagent`)

| Componente | Status | Arquivo | Descrição |
|---|---|---|---|
| **NossoAgentInboxPage** | ✅ Completo | `features/nossoagent/NossoAgentInboxPage.tsx` | Inbox estilo Chatwoot, 3 painéis (lista / chat / contexto CRM), dados reais Supabase Realtime, filtros por status com contadores, busca, handover IA↔Humano, notas internas, auto-scroll |
| **Rota `/atendimento`** | ✅ Completo | `app/(protected)/atendimento/page.tsx` | Dynamic import do Inbox |
| **Nav item** | ✅ Completo | `components/Layout.tsx` | Ícone `MessageCircle` + item "Atendimento" na sidebar |
| **Prefetch** | ✅ Completo | `lib/prefetch.ts` | `atendimento` registrado |

### 4.5 Multi-Agent Sales Methodology System (branch `feature/nossoagent`)

> **PRD:** `NossoCRM_PRD_MultiAgent_SalesMethodology.md` (v2.0)
> **Roadmap:** 6 fases · 23 agentes · 4 verticais · BANT + SPIN + MEDDIC + GPCT + Flávio Augusto + Neurovendas

| Fase | Status | Arquivos Principais |
|---|---|---|
| **1 — Migration + Types** | ✅ Completo | `20260313000001_agent_methodology_system.sql` (4 tabelas novas + ALTER agent_configs + 8 templates seed), `types/agent.ts` (20+ novos tipos: SalesMethodology, ToneOfVoice, KnowledgeBaseConfig, AgentBoardConfig, etc.) |
| **2 — Service Layer + API** | ✅ Completo | `lib/supabase/agent-methodology.ts` (service CRUD, resolveAgentConfig), `hooks/useAgentMethodology.ts` (10 hooks SSOT), 5 API routes: `methodology-templates`, `board-config`, `stage-config`, `personalization`, `generate-prompt` |
| **3 — Prompt Builder v2** | ✅ Completo | `lib/ai/prompt-builder.ts` (buildPersonalizedSystemPrompt) — injeta tone_of_voice, sales_methodology, behavioral_training, business_context_extended, follow_up_config, kb_config no prompt final |
| **4 — UI: 4 novas abas** | ✅ Completo | `AgentConfigPage.tsx` expandido: +4 abas IA Avançada (Metodologia, Personalidade, Conhecimento, Treinamento). 4 novos componentes: `AgentMethodologyTab`, `AgentPersonalityTab`, `AgentKnowledgeTab`, `AgentTrainingTab` |
| **5 — Agent Engine Enhancement** | ✅ Completo | `supabase/functions/agent-engine/index.ts` — Step 3.5 resolve stageId/boardId do deal em runtime; `resolveMethodology()` (stage_configs > board_configs > global); `loadPersonalization()` (tone, business context, behavioral training); `buildMethodologyGuide()` (BANT/SPIN/MEDDIC/GPCT/FA/Neurovendas/Consultivo/Híbrido); `composeSystemPrompt()` refatorado com 13 seções ordenadas |
| **6 — Vertical Packs + Aprender** | ✅ Completo | `app/api/agent/activate-vertical-pack/route.ts` (API de ativação por vertical com defaults de tom/regras), `features/conversations/components/VerticalPackWizard.tsx` (wizard 3-step modal), `supabase/migrations/20260314000002_agent_ab_tests.sql` (tabela agent_ab_tests + RLS), `app/api/agent/ab-tests/route.ts` (GET/POST/PATCH status), `features/conversations/components/AgentLearnModePanel.tsx` (painel A/B testing do modo Aprender). Agent Engine: `trackConversationMetric()` Step 13.5 coleta métricas diárias de metodologia. |

---

## 5. Migrations (Histórico Cronológico)

| # | Arquivo | Data | Descrição |
|---|---|---|---|
| 1 | `20251201000000_schema_init.sql` | 01/12/2025 | Schema inicial completo: tabelas core (organizations, profiles, contacts, deals, activities, boards, pipeline_stages, etc.), RLS, índices, triggers |
| 2 | `20260128000000_complementary_features.sql` | 28/01/2026 | Tabelas complementares: `ai_usage_logs`, `ai_quotas`, `inbox_action_items`, `notification_preferences`, `webhook_events_out`, `webhook_deliveries`, `integration_outbound_endpoints` |
| 3 | `20260211000001_webhook_events_expansion.sql` | 11/02/2026 | Triggers para 7 eventos de webhook + `dispatch_webhook_event()` + `check_stagnant_deals()` via pg_cron |
| 4 | `20260211000002_ai_governance_functions.sql` | 11/02/2026 | Functions `increment_ai_quota_usage()` + `reset_monthly_ai_quotas()` via pg_cron |
| 5 | `20260224000001_vertical_infrastructure.sql` | 24/02/2026 | Enum `business_type_enum`, tabelas `vertical_configs`, `custom_field_values`, `vertical_properties` + RLS + índices |
| 6 | `20260224000002_seed_vertical_configs.sql` | 24/02/2026 | Seed: 4 verticais com nomenclaturas, campos, pipelines, AI context, widgets, feature flags |
| 7 | `20260224000003_setup_vertical_cron_jobs.sql` | 25/02/2026 | 9 pg_cron jobs para automações verticais (medical 3, dental 3, real estate 3) via pg_net → Edge Function |
| 8 | `20260225000001_create_agent_tables.sql` | 25/02/2026 | Tabelas `agent_configs`, `conversations`, `messages`, `agent_tools_log` + RLS + 8 índices + Realtime + triggers `updated_at` |
| 9 | `20260314000001_email_campaigns.sql` | 14/03/2026 | Tabelas `email_campaigns`, `email_templates`, `email_campaign_sends` + ENUMs + descadastramento por token |
| 10 | `20260313000001_agent_methodology_system.sql` | 13/03/2026 | ALTER `agent_configs` (+7 campos JSON), 4 novas tabelas (`agent_methodology_templates`, `agent_board_configs`, `agent_stage_configs`, `agent_performance_metrics`), seed 8 templates de metodologias |
| 11 | `20260314000002_agent_ab_tests.sql` | 14/03/2026 | Tabela `agent_ab_tests` — A/B testing de metodologias (Aprender mode). Variantes A/B com split de tráfego, métricas de conversão, winner + confidence, RLS + trigger updated_at |

---

## 6. API Routes

| Endpoint | Método | Módulo | Descrição |
|---|---|---|---|
| `/api/ai/chat` | POST | Core AI | Chat conversacional com IA |
| `/api/ai/actions` | POST | Core AI | Ações de IA (com quota check + logging) |
| `/api/ai/usage` | GET | AI Governance | Estatísticas de uso e quota |
| `/api/ai/inbox-generate` | POST | Inbox 2.0 | Geração automática de Action Items |
| `/api/ai/generate` | POST | Verticalização | Endpoint unificado de IA contextual por vertical |
| `/api/contacts/*` | CRUD | Contatos | CRUD de contatos + enrich |
| `/api/deals/*` | CRUD | Deals | CRUD de deals |
| `/api/activities/*` | CRUD | Atividades | CRUD de atividades |
| `/api/boards/*` | CRUD | Pipeline | CRUD de boards e stages |
| `/api/vertical/activate` | POST | Verticalização | Ativa vertical: seta business_type + cria pipeline |
| `/api/dashboard/vertical-widgets` | GET | Dashboard | Dados dos widgets verticais por org |
| `/api/properties` | GET/POST | Imobiliárias | CRUD imóveis com 8 filtros (status, tipo, valor, quartos, etc.) |
| `/api/campaigns` | GET/POST | Email Campaigns | Lista e cria campanhas de email |
| `/api/campaigns/[id]/send` | POST | Email Campaigns | Dispara campanha (imediato, rate limited 50ms/msg) |
| `/api/campaigns/templates` | GET/POST | Email Campaigns | CRUD de templates + geração via IA |
| `/api/campaigns/segment-preview` | POST | Email Campaigns | Preview de destinatários sem disparar |
| `/api/unsubscribe/[token]` | GET | Email Campaigns | Descadastramento (pública, sem auth) |
| `/api/agent/methodology-templates` | GET | Multi-Agent | Lista templates de metodologia por vertical/role |
| `/api/agent/board-config` | GET/POST | Multi-Agent | Configuração de agente por board (get one, list all, upsert) |
| `/api/agent/stage-config` | GET/POST | Multi-Agent | Configuração de agente por estágio (get by stageId, list by boardId, upsert) |
| `/api/agent/personalization` | GET/POST | Multi-Agent | Leitura/atualização bulk de personalização global (7 seções) |
| `/api/agent/generate-prompt` | POST | Multi-Agent | Gera system prompt final resolvendo hierarquia stage>board>global + personalization |
| `/api/webhooks/*` | POST | Integrações | Endpoints inbound de webhooks |
| `/api/public/*` | CRUD | API Pública | API pública documentada |

---

## 7. Hooks Globais

| Hook | Arquivo | Descrição |
|---|---|---|
| `useVerticalConfig()` | `hooks/useVerticalConfig.ts` | Config da vertical ativa (`staleTime: Infinity`) |
| `useFeatureFlag(flag)` | `hooks/useFeatureFlag.ts` | Check booleano de feature flags por vertical |
| `useCustomFields()` | `hooks/useCustomFields.ts` | CRUD de campos customizados EAV |
| `useVerticalWidgets()` | `features/dashboard/hooks/useVerticalWidgets.ts` | Dados de widgets verticais (5min cache) |
| `useProperties()` | `hooks/useVerticalProperties.ts` | CRUD imóveis com filtros |
| `usePropertyMatches()` | `hooks/useVerticalProperties.ts` | Match de imóveis para cliente (4-factor scoring) |
| `useAIEnabled()` | `hooks/useAIEnabled.ts` | Verifica se IA está habilitada na org |
| `useConsent()` | `hooks/useConsent.ts` | Gerencia consentimento LGPD |
| `useFirstVisit()` | `hooks/useFirstVisit.ts` | Detecta primeira visita do usuário |
| `useIdleTimeout()` | `hooks/useIdleTimeout.ts` | Timeout por inatividade |
| `usePersistedState()` | `hooks/usePersistedState.ts` | Estado persistido em localStorage |
| `useResponsiveMode()` | `hooks/useResponsiveMode.ts` | Detecção de breakpoints |
| `useSpeechRecognition()` | `hooks/useSpeechRecognition.ts` | Reconhecimento de voz para IA |
| `useSystemNotifications()` | `hooks/useSystemNotifications.ts` | Notificações nativas do browser |
| `useMethodologyTemplates()` | `hooks/useAgentMethodology.ts` | Lista templates de metodologia (10min stale) |
| `useAgentBoardConfig(boardId)` | `hooks/useAgentMethodology.ts` | Configuração de agente por board |
| `useUpsertAgentBoardConfig()` | `hooks/useAgentMethodology.ts` | Mutation: upsert config de board (SSOT) |
| `useAgentStageConfigs(boardId)` | `hooks/useAgentMethodology.ts` | Lista configs de estágios por board |
| `useUpsertAgentStageConfig()` | `hooks/useAgentMethodology.ts` | Mutation: upsert config de estágio (SSOT) |
| `useAgentPersonalization()` | `hooks/useAgentMethodology.ts` | Config de personalização global (7 seções) |
| `useUpdateAgentPersonalization()` | `hooks/useAgentMethodology.ts` | Mutation: atualiza personalização bulk (SSOT) |

---

## 8. Decisões Arquiteturais (ADRs)

| # | Decisão | Data | Razão |
|---|---|---|---|
| ADR-001 | **100% nativo (sem n8n para core)** | 11/02/2026 | Nenhum dos 10 módulos complementares requer n8n. Stack nativa = menor latência, menor custo, maior segurança. |
| ADR-002 | **SSOT no cache (TanStack Query)** | Jan/2026 | Race conditions eliminadas. Uma chave por entidade. `setQueryData` > `invalidateQueries`. |
| ADR-003 | **EAV para campos customizados** | 24/02/2026 | Flexibilidade máxima para custom fields por vertical. Trade-off: queries mais complexas, mitigado por índices compostos + cache agressivo. |
| ADR-004 | **Verticalização por configuração** | 24/02/2026 | Core Engine único + Business Profile Layer. Cada vertical = JSON em `vertical_configs`, não um branch ou fork. |
| ADR-005 | **Proxy auth (não middleware.ts)** | Dez/2025 | `proxy.ts` + `lib/supabase/middleware.ts` para auth. Exclui `/api/*`. |
| ADR-006 | **pg_cron + pg_net para automações** | 11/02/2026 | Automações no banco eliminam dependência de serviço externo. Menor ponto de falha. |

---

## 9. PRDs (Product Requirements Documents)

| Arquivo | Escopo | Status |
|---|---|---|
| `docs/PRD_COMPLEMENTAR_NossoCRM_v1.md` | 10 módulos complementares (P0-P3) | Fase 1 (P0) implementada |
| `NossoCRM_PRD_Verticalizacao_Multi-Nicho.md` | Verticalização: 3 nichos + infraestrutura | ✅ Fases 1-8 completas |
| `NossoCRM_PRD_NossoAgent_IA_Nativo.md` | IA nativa avançada (NossoAgent) — 9 fases, ~11.5 semanas | 🟡 Próximo: implementação |
| `NossoCRM_PRD_NossoAgent_Followups_Nurturing.md` | Follow-ups automatizados + nurturing — 7 fases, ~9.5 semanas | ⏳ Após NossoAgent Fases 1-3 |
| `NossoCRM_PRD_NossoAgent_KnowledgeBase_RAG.md` | Knowledge Base + RAG + Catálogo — 6 fases, ~7.5 semanas | ⏳ Após NossoAgent Fases 1-3 |
| `NossoCRM_PRD_MultiAgent_SalesMethodology.md` | Multi-Agent Methodology System — 23 agentes especializados, 4 verticais, 6 fases, ~10 semanas | 🔄 Fases 1-4 concluídas, Fase 5 planejada |

---

## 10. Histórico de Alterações (Changelog)

### 14/03/2026 (v2.2) — Multi-Agent Methodology System — Phase 6: Vertical Packs + Aprender Mode

- **Branch:** `feature/nossoagent`
- **O que mudou:**
  - **Wizard de Ativação de Vertical Packs:**
    - `app/api/agent/activate-vertical-pack/route.ts`: POST que aceita `vertical` + `boardIds` + `overwrite`. Para cada board, busca o template mais adequado da vertical e faz upsert de `agent_board_config`. Também aplica defaults de personalização (tom, regras de negócio, listas SEMPRE/NUNCA, escalação) no `agent_configs` global da org. Retorna `boards_configured[]` com status (configured/skipped_existing) por board.
    - `features/conversations/components/VerticalPackWizard.tsx`: Modal wizard 3-step. Step 1: seleção de vertical com cards visuais (4 verticais, cor, emoji, lista de agentes configurados). Step 2: seleção de pipelines com toggle "Selecionar todos" e checkbox "Sobrescrever". Step 3: tela de confirmação com resumo. Tela "Done" com próximos passos sugeridos. Integrado via botão "✨ Ativar Pack" no `AgentMethodologyTab`.
  - **Modo Aprender — A/B Testing Infrastructure:**
    - `supabase/migrations/20260314000002_agent_ab_tests.sql`: Tabela `agent_ab_tests` com variantes A/B (metodologia, label, split de tráfego 1-99%), contadores de conversas/conversões/avg_msgs por variante, campos `winner` e `confidence_pct`, status check constraint, RLS + trigger `updated_at`.
    - `app/api/agent/ab-tests/route.ts`: GET (lista testes por org), POST (cria novo teste), PATCH (atualiza status: start/pause/stop com `started_at`/`ended_at` automáticos).
    - `features/conversations/components/AgentLearnModePanel.tsx`: Painel completo de A/B testing. Lista testes com status badge (draft/running/paused/completed), tabela de métricas lado a lado (Variante A vs B: conversas, taxa de conversão, msgs médias), botões de ação por status, formulário de criação de novo teste (nome, descrição, metodologias A/B, split de tráfego). Renderizado no `AgentMethodologyTab` quando modo "Aprender" está ativo.
  - **Agent Engine — Coleta de Métricas (Step 13.5):**
    - `trackConversationMetric()`: helper que faz upsert diário em `agent_performance_metrics` — incrementa `conversations_total` e recalcula `avg_messages_to_conversion` com média ponderada. Non-critical (nunca lança exceção). Chamado após Step 13 (post-processing) em cada resposta do engine.
- **Arquivos criados/modificados:**
  - `app/api/agent/activate-vertical-pack/route.ts` (novo)
  - `features/conversations/components/VerticalPackWizard.tsx` (novo)
  - `features/conversations/components/AgentMethodologyTab.tsx` (modificado — wizard + learn panel integrados)
  - `supabase/migrations/20260314000002_agent_ab_tests.sql` (novo)
  - `app/api/agent/ab-tests/route.ts` (novo)
  - `features/conversations/components/AgentLearnModePanel.tsx` (novo)
  - `supabase/functions/agent-engine/index.ts` (modificado — Step 13.5 + `trackConversationMetric`)
- **Status Multi-Agent Methodology System:** ✅ **TODAS AS 6 FASES CONCLUÍDAS**

---

### 14/03/2026 (v2.1) — Multi-Agent Methodology System — Phase 5: Agent Engine Enhancement

- **Branch:** `feature/nossoagent`
- **O que mudou:**
  - `supabase/functions/agent-engine/index.ts` refatorado com resolução de metodologia em runtime:
    - **Step 3.5 (novo):** Após carregar `agentConfig`, resolve `stageId`/`boardId` efetivos — tenta o deal vinculado à conversa (`deals.stage_id`, `deals.board_id`), cai para `config.default_stage_id`/`default_board_id`.
    - **`resolveMethodology()`** — implementa a hierarquia completa:
      1. `agent_stage_configs` — se tem `system_prompt_override`, usa diretamente
      2. `agent_board_configs` — se tem override, usa; se tem `methodology_template_id`, busca template
      3. Fallback global com metodologia da `agent_configs.sales_methodology`
    - **`loadPersonalization()`** — carrega 3 seções de `agent_configs`: `tone_of_voice`, `business_context_extended`, `behavioral_training`
    - **`buildMethodologyGuide()`** — guias inline de 8 metodologias: BANT, SPIN, MEDDIC, GPCT, Flávio Augusto, Neurovendas, Consultivo, Híbrido
    - **`buildToneSection()`, `buildBusinessContextSection()`, `buildBehavioralSection()`** — builders para cada dimensão de personalização
    - **`composeSystemPrompt()`** expandido de 6 para 13 seções ordenadas: base_prompt → methodology_guide → tone → business_context → behavioral_training → vertical_context → legacy_business_profile → knowledge_base → qualification_criteria → qualification_fields → contact/deal context → agent_role footer → conversation_summary
- **Arquivos modificados:**
  - `supabase/functions/agent-engine/index.ts` (+~250 linhas)

---

### 14/03/2026 (v2.0) — Multi-Agent Methodology System — Phase 4: UI 4 novas abas IA Avançada

- **Branch:** `feature/nossoagent`
- **O que mudou:**
  - `AgentConfigPage.tsx` expandido de 6 para 10 abas. As 4 novas abas ficam em grupo visual destacado como "✨ IA Avançada" no header de tabs:
    - **Metodologia** (`AgentMethodologyTab`): Seletor de modo (Automático / Templates / Aprender / Avançado) com 4 cards visuais. No modo Template: lista de templates por vertical/role. No modo Avançado: seletor de metodologia primária (BANT, SPIN, MEDDIC, GPCT, FA, Neurovendas, Consultiva, Híbrida, Custom) + metodologias secundárias em chips + campo de abordagem customizada.
    - **Personalidade** (`AgentPersonalityTab`): Persona (nome, papel, estilo). Tom de voz com 7 presets visuais (Formal, Profissional, Consultivo, Empático, Casual, Técnico, Inspirador). Language style (formalidade, energia, empatia, toggle emojis). Palavras para usar / evitar (chip input). Exemplos de conversa few-shot (add/remove).
    - **Conhecimento** (`AgentKnowledgeTab`): Toggle "pesquisar antes de responder". Slider de threshold de relevância (0.3–0.95). Select de max resultados. CRUD de fontes de conhecimento (nome, tipo, referência, descrição, toggle ativo).
    - **Treinamento** (`AgentTrainingTab`): Lista SEMPRE fazer (verde). Lista NUNCA fazer (vermelho). Gatilhos de escalação para humano (âmbar). Abordagens de abertura (violeta). Script CAC Zero para reativação (Flávio Augusto).
  - Cada aba tem save button próprio com estado `isDirty` — save independente via `useUpdateAgentPersonalization()` SSOT.
  - Todos os 4 componentes criados em `features/conversations/components/`.
- **Arquivos criados/modificados:**
  - `features/conversations/AgentConfigPage.tsx` (modificado — +4 tabs, novo TabId union)
  - `features/conversations/components/AgentMethodologyTab.tsx` (novo)
  - `features/conversations/components/AgentPersonalityTab.tsx` (novo)
  - `features/conversations/components/AgentKnowledgeTab.tsx` (novo)
  - `features/conversations/components/AgentTrainingTab.tsx` (novo)

---

### 14/03/2026 (v1.9) — Multi-Agent Methodology System — Phase 2 + Phase 3

- **Branch:** `feature/nossoagent`
- **O que mudou:**
  - **Fase 2 — Service Layer + API** concluída:
    - `lib/supabase/agent-methodology.ts`: `PersonalizationPayload` exportado (era privado)
    - `app/api/agent/stage-config/route.ts`: GET (por stageId ou boardId) + POST upsert
    - `app/api/agent/personalization/route.ts`: GET global personalization + POST bulk update (com sanitização de keys)
    - `app/api/agent/generate-prompt/route.ts`: POST que resolve hierarquia (stage > board > global), enriquece com personalização e retorna/salva o prompt final
  - **Fase 3 — Prompt Builder v2** concluída:
    - `lib/ai/prompt-builder.ts` (novo): `buildPersonalizedSystemPrompt()` monta o system prompt injetando todas as 7 seções de personalização: persona, tom de voz (com few-shot examples), metodologia(s) de vendas (guias completos), contexto de negócio, treinamento comportamental, KB config e follow-up config
    - Guias inline para: BANT, SPIN, MEDDIC, GPCT, Flávio Augusto, Neurovendas, Consultivo, Híbrido
    - Suporte a metodologia primária + secundárias + abordagem customizada

---

### 13/03/2026 (v2) — Multi-Agent Methodology System — PRD + Migration + Tipos
- **Branch:** `feature/nossoagent`
- **O que mudou:**
  - PRD `NossoCRM_PRD_MultiAgent_SalesMethodology.md` reescrito na v2.0 com:
    - Flávio Augusto adicionado em Generic CRM e Imobiliária (presente em todas as verticais que têm vendas)
    - Guia completo de 6 metodologias: BANT, SPIN, MEDDIC, GPCT, Flávio Augusto, Neurovendas — cada uma com explicação concisa, quando usar, eficiência e aplicação no CRM
    - System prompts completos para 9 agentes: SDRAgent, AECloserAgent, ReactivationAgent, ReceptionAgent (médica), ConversionAgent, NoShowRecoveryAgent, OrthoCloserAgent, LeadQualificationAgent, NegotiationAgent
    - Estrutura completa `AgentPersonalizationConfig` com 7 dimensões: Persona, Tom de Voz, Metodologia, RAG/Knowledge Base, Contexto do Negócio, Treinamento Comportamental, Follow-up
    - 4 modos de configuração UI: Automático, Templates, Aprender, Avançado
  - Migration `20260313000001_agent_methodology_system.sql`:
    - 7 novos campos JSON em `agent_configs`: persona, tone_of_voice, sales_methodology, knowledge_base_config, business_context_extended, behavioral_training, follow_up_config
    - 4 novas tabelas: agent_methodology_templates, agent_board_configs, agent_stage_configs, agent_performance_metrics
    - RLS em todas as tabelas + índices
    - Seed: 8 templates pré-configurados (SDR, Closer, Reactivation, Medical, Dental, Real Estate)
  - `types/agent.ts` expandido com 20+ novos tipos TypeScript: SalesMethodology, ToneOfVoice, KnowledgeBaseConfig, BusinessContextExtended, BehavioralTraining, FollowUpConfig, AgentMethodologyTemplate, AgentBoardConfig, AgentStageConfig, AgentMode

---

### 13/03/2026 — Email Campaigns + NossoAgent Inbox (Chat de Atendimento)
- **Branch:** `feature/nossoagent` (continuação)
- **O que mudou:**

  **Módulo Email Campaigns (v1.0):**
  - Migration: `20260314000001_email_campaigns.sql` — 3 tabelas: `email_campaigns`, `email_templates`, `email_campaign_sends`. ENUMs `campaign_status`, `campaign_segment_type`. Suporte a descadastramento com token.
  - Service: `lib/supabase/email-campaigns.ts` (395 loc) — CRUD de campanhas, templates, envio via Resend (fetch nativo), segmentação por tag/lifecycle/vertical/custom, preview de segmento.
  - API Routes: `/api/campaigns` (GET/POST), `/api/campaigns/[id]/send` (POST — disparo com rate limiting 50ms/msg), `/api/campaigns/templates` (GET/POST), `/api/campaigns/segment-preview` (POST), `/api/unsubscribe/[token]` (GET público, HTML de confirmação).
  - Hooks: `features/campaigns/hooks/useCampaigns.ts` (138 loc), `useEmailTemplates.ts` (100 loc) — TanStack Query SSOT, setQueryData.
  - UI: `features/campaigns/CampaignsManager.tsx` (614 loc) — gerenciador completo: lista de campanhas com métricas, criação/edição de campanha, editor de template, segmentação, disparo imediato ou agendado.
  - Integração: Aba "Campanhas" adicionada à `SettingsPage.tsx` com lazy import.

  **NossoAgent Inbox — Chat de Atendimento (v1.0):**
  - `features/nossoagent/NossoAgentInboxPage.tsx` (novo) — Inbox omnichannel estilo Chatwoot com dados reais Supabase Realtime. 3-panel layout: lista de conversas | janela de chat | contexto CRM. Responsive (mobile: 1 painel, tablet: 2 painéis, desktop: 3 painéis).
  - **Funcionalidades:** filtros por status (Todas / IA Ativa / Aguardando / Humano / Encerradas) com contadores em tempo real; busca por nome/número; handover IA ↔ Humano via `HandoverControls`; envio de mensagens com `role:'human'` pelo atendente; notas internas (`is_internal_note`); auto-scroll em novas mensagens; realtime via `useConversationRealtime` + `useConversationsListRealtime`; painel de contexto CRM (qualificação, sentiment, intent, summary da IA, links para contato e deal).
  - **Reutilização:** `MessageBubble`, `ConversationContext`, `HandoverControls`, `ChannelBadge` (componentes existentes), todos os hooks existentes.
  - Rota: `app/(protected)/atendimento/page.tsx` → `/atendimento`
  - Sidebar: item "Atendimento" com ícone `MessageCircle` adicionado a `components/Layout.tsx`
  - Prefetch: `atendimento` adicionado a `lib/prefetch.ts`

- **Arquivos criados/modificados:**
  - `supabase/migrations/20260314000001_email_campaigns.sql` (novo)
  - `lib/supabase/email-campaigns.ts` (novo)
  - `app/api/campaigns/route.ts` (novo)
  - `app/api/campaigns/[id]/send/route.ts` (novo)
  - `app/api/campaigns/templates/route.ts` (novo)
  - `app/api/campaigns/segment-preview/route.ts` (novo)
  - `app/api/unsubscribe/[token]/route.ts` (novo)
  - `features/campaigns/hooks/useCampaigns.ts` (novo)
  - `features/campaigns/hooks/useEmailTemplates.ts` (novo)
  - `features/campaigns/CampaignsManager.tsx` (novo)
  - `features/settings/SettingsPage.tsx` (modificado — aba Campanhas)
  - `features/nossoagent/NossoAgentInboxPage.tsx` (novo)
  - `app/(protected)/atendimento/page.tsx` (novo)
  - `components/Layout.tsx` (modificado — item Atendimento na nav)
  - `lib/prefetch.ts` (modificado — rota atendimento)

---

### 10/03/2026 — Polimento, Bugfixes Next.js (Failed to fetch) e RLS Supabase
- **Branch:** `feature/verticalizacao-multi-nicho` / `feature/nossoagent`
- **O que mudou:** 
  - **Módulos Clínicos:** Criação e injeção dinâmica de `PatientRecordView`, `PatientTimeline`, `TreatmentPlanEditor`, e `DentalChartSimple` no deal cockpit (`FocusContextPanel.tsx`). Correção de tipagem rigorosa de TypeScript e erros de comparação literals (`medical_clinic` vs `clinica_medica`).
  - **Módulo Imobiliário:** Melhorias visuais premium em `PropertyCard` e `PropertyMatchList`. Criação de `PropertyMatchDashboard` e `VisitScheduler` com injeção dinâmica baseada na vertical selecionada.
  - **Omnichannel Inbox:** Estruturação da UX do Inbox Unificado (`AgentInbox`), `HandoverControls` para alternar entre Atendimento Humano e Bot, e `ChannelBadge` para visualização de canais de comunicação.
  - **Bugfixes Estruturais:** 
      - Correção do Typecheck que causava quebra e página HTML "Failed to fetch" no build do Next.js Turbopack. Limpeza de cache `.next` bloqueado.
      - Criação de `useOrgBusinessType` hook para acesso assíncrono universal à Vertical da Org no Client Side.
      - Reparo na API `/api/vertical/activate` implementando o `createAdminClient` via Service Role (bypassing the Row Level Security - RLS) permitindo que o usuário altere seu nicho corretamente no onboarding gerando reflexo instantâneo no Dashboard.
- **Arquivos:** 9 novos componentes criados, `FocusContextPanel.tsx`, `TreatmentPlanContainer.tsx`, `PatientRecordContainer.tsx` e `DashboardPage` modificados para uso de hooks dinâmicos. RLS admin client injeção em routes da API.

### 25/02/2026 — Verticalização Multi-Nicho Fases 5-8
- **Branch:** `feature/verticalizacao-multi-nicho`
- **Commits:** `4f02069` (Fase 5), `2216163` (Fase 6), `d2d8e19` (Fase 7), `15c7165` (PRD docs)
- **O que mudou:**
  - **Fase 5:** Dashboard widgets — 18 fetcher KPIs por vertical, API route, hook, integração no Dashboard
  - **Fase 6:** Automations — Edge Function com 9 jobs (medical 3, dental 3, real estate 3) + migration pg_cron
  - **Fase 7:** Real Estate — CRUD imóveis, matching algorithm (4 fatores), 6 hooks, PropertyCard, PropertyMatchList, API com 8 filtros
  - **Fase 8:** Verificação — TypeScript ✅, ESLint ✅
- **Arquivos:** 13 novos, 1 modificado, ~3000 linhas
- **Status:** Pendente push + merge
- **Próximos passos:** Push desta branch → Criar `feature/nossoagent` → Implementar NossoAgent IA Nativo

### 24/02/2026 — Verticalização Multi-Nicho Fases 1-4
- **Branch:** `feature/verticalizacao-multi-nicho`
- **Commits:** `ecb8eff` (Fase 1), `03de62f` (Fases 2-4)
- **O que mudou:** Infraestrutura completa de verticalização (enum, tabelas, seeds), onboarding verticalizado, custom fields EAV com renderer dinâmico (10+ tipos), IA contextual com prompt composition em 3 níveis
- **Arquivos:** 15 novos, ~2500 linhas

### 11/02/2026 — PRD Complementar Fase 1 (P0)
- **Branch:** `feature/prd-complementar-implementation`
- **Commits:** `16d6681`, `2b582f8`, `2e001bb`
- **O que mudou:** Webhook Events Expansion (7 eventos), AI Governance (quotas, logs, custos), Inbox Inteligente 2.0 (Priority Score, Action Items, Streaks). Componentes para módulos P1-P3 criados (Smart Notifications, Sequences, Quick Reports, Bulk Ops, Deal Templates, Contact Enrichment)
- **Arquivos:** 8 novos, 1 modificado

### 28/01/2026 — Complementary Features Migration
- **Branch:** `main`
- **Commit:** Complementary features tables
- **O que mudou:** Tabelas de suporte: `ai_usage_logs`, `ai_quotas`, `inbox_action_items`, `notification_preferences`, `webhook_events_out`, `webhook_deliveries`

### Jan/2026 — SSOT Cache + Reorganização
- **Branch:** `main`
- **Commits:** `5dc9cca`, `3753761`, vários refactors
- **O que mudou:** Unificação de cache deals para single source of truth, reorganização de pastas (services/ → lib/supabase/, utils/ → lib/utils/, stores/ → lib/stores/), docs consolidados em docs/, zero-warning lint enforced

### Dez/2025–Jan/2026 — Core CRM
- **Branch:** `main`
- **O que mudou:** Schema inicial completo, pipeline Kanban, contatos, deals, atividades, dashboard, AI Central (chat + tools), autenticação, multi-tenancy com RLS, webhooks, API pública, wizard de instalação, performance sweep (~80 optimizações)

---

## 11. Branches Ativas

| Branch | Status | Base | Descrição |
|---|---|---|---|
| `main` | Produção | — | Core CRM estável |
| `feature/prd-complementar-implementation` | Mergeada em main | `main` | PRD Complementar P0 |
| `feature/verticalizacao-multi-nicho` | **Completa** (pendente merge) | `main` (pós-merge) | Verticalização — Fases 1-8 completas |
| `feature/nossoagent` | **Próxima** | `main` (pós-merge vertical) | NossoAgent IA Nativo — implementação do PRD principal |

---

## 12. Configurações Importantes

### Variáveis de Ambiente Requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                    # Connection string (Transaction pooler, porta 6543)
```

### Scripts npm
```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm run lint         # Verificar código (zero warnings)
npm run typecheck    # Verificar tipos
npm test             # Rodar testes (watch)
npm run test:run     # Testes single run
```

---

## 13. Deep Analysis: NossoAgent vs Vibecoding Skill

> **Data da Auditoria:** 02 de Março de 2026.
> **Contexto:** Análise profunda da skill genérica `vibecoding-ai-agent` solicitada pelo usuário para mapear gaps e adaptar para a solução nativa do CRM (NossoAgent).

**Conclusões Principais:**
1. O CRM nativo já possui RAG Supabase (pgvector), System Prompts injetáveis e Function Calling superiores e perfeitamente isolados por Tenant (via `organization_id`).
2. Ganharemos **imensa percepção de humanização** se adotarmos a inteligência de processamento da skill: Delayrandômico, Typing indicator e Quebra (Chunking) de respostas longas em balões separados (A implementar no motor de Webhooks/Mensageria).
3. Adaptação Vital (Obrigatória): O processo de qualificação de novos leads antes feito "organicamente" passará a ser **Estrito e Automático**. O agente forçará a qualificação de 4 dados cruciais (Nome, Telefone, Email, Nascimento) no 1º contato (sempre precedido da checagem de contexto histórico).
4. Processadores Multimodais (Vision, Whisper/Áudio) precisarão de fallbacks explícitos configurados nas nossas Edge Functions, pois o modelo nativo (React/Vercel) precisa de buffers adequados para isso.

*(Detalhes da Análise estão no artefato `agent_comparative_analysis.md` na raiz da brain)*

---

## 14. End-to-End Test Registry (E2E)

> Registro de auditoria QA e testes End-to-End, baseados na spec `SKILL_TestE2E.md`.

### NossoAgent (Fases 7 e 8) - Março 2026

* **Objetivo:** Validar integrações CRM, fluxos de governança AI, webhooks e painel de métricas pós-desenvolvimento.
* **Status Geral:** ✅ Completo

| Casos de Teste Estratégicos | Módulo | Status | Descrição Detalhada |
|---|---|---|---|
| Smoke Test - API Metrics | `ai-hub` | ✅ Completo | Responde HTTP 401 corretamente em rotas não-autenticadas e 200 nas públicas. |
| Negativo - AI Quota HTTP 429 | `ai-hub` / `governance` | ✅ Completo | Acesso sem autorização ou quota estourada resulta em bloqueio validado (HTTP 4xx). |
| Funcional - Webhook Outbound | `webhooks` | ✅ Completo | Criar deal via Agent Tool e assegurar trigger do Webhook de destino. Teste manual do trigger no `agent-tools.ts` provou a infraestrutura, a DB Migration v2 (`20260211000000_webhook_base.sql`) foi submetida e a inserção forçada removida provando que os gatilhos nativos funcionam. |
| UI/UX - Agent Config UI | `ai-hub` / `frontend` | ✅ Completo | Validar preenchimento, renderização e envio (save config) da janela de comportamento do bot via E2E (Vitest + RTL). |
| Segurança IA - Strict Qualification Bypass | `agent-engine` | ✅ Completo | 7 testes validando injeção da instrução de qualificação, campos obrigatórios vs opcionais, null safety. |
| Segurança IA - Prompt Injection / Jailbreak | `agent-engine` | ✅ Completo | 30 testes: 15 payloads maliciosos bloqueados, 10 mensagens safe passam, edge cases (case, embedding, empty). |
| Multimodal - Fallbacks (Vision/Audio) | `agent-engine` | ✅ Completo | 9 testes: fallbacks de áudio (download fail, whisper error), imagens com/sem legenda, document/video. |
| UI/UX - Chunking & Delay | `frontend` | ✅ Completo | 14 testes: chunkAIResponse (empty, short, paragraphs, long), calculateTypingDelay (bounds, proportional), buildHumanizedPipeline (first-chunk reduction). |
### Job - Offline Summarization Cron | `pg_cron` | ✅ Completo | 12 testes: formatação de transcript, composição de prompt (com/sem resumo anterior), janela de 2h, skip de conversas vazias. |

*Mais casos serão adicionados conforme progresso do testing.*

---

## 15. Deep Analysis: Verticalização UI & Omnichannel Agent

> **Data da Auditoria:** 10 de Março de 2026.
> **Contexto:** Análise de CRMs top de mercado (Simples Dental, Clinicorp, ImobiBrasil) vs nosso CRM atual.

**Descobertas Clínicas & Odontológicas:**
Nós criamos a fundação de dados (EAV), mas precisamos evoluir a **UI** para corresponder aos CRMs líderes. Eles possuem:
1. **Prontuário Eletrônico Dedicado:** (Substitui a view de contatos genérica). Anamnese digital, histórico clínico isolado, prescrições.
2. **Odontograma / Tratamentos:** Controle visual da arcada dentária, sessões realizadas vs. aprovadas por orçamento.
*Plano:* Injetar dinamicamente os componentes `PatientRecordView` e `TreatmentPlanEditor` via hook `useVerticalConfig`.

**Descobertas Imobiliárias:**
1. **Match Inteligente Aprimorado:** Dashboard focando no cruzamento automático de Perfis (Leads) com Imóveis Ativos (`vertical_properties`).
2. **Funil Logístico:** Controle de chaves e agendamento de visitas de forma mais proeminente que negociações estáticas.

**NossoAgent - Omnichannel & Handover:**
O AI Master precisa ser preparado para escala multi-canal (WhatsApp, Instagram, etc) e **não deve operar no escuro**.
1. **Inbox Unificado:** Painel estilo Chatwoot para acompanhamento em tempo real das conversas do NossoAgent com os leads.
2. **Handover de Atendimento:** Funcionalidade crucial para o corretor/atendente pausar o Agente IA (👤 assumir o controle) ou devolver o lead para o fluxo automático (🤖).
3. Estas regras arquiteturais serão incluídas no PRD do Agente e no roadmap de desenvolvimento do CRM.

---

*Este documento é atualizado a cada modificação significativa do projeto.*
*Gerado e mantido por: IntelliX.AI Development Pipeline*
