# PROJECT_REGISTRY.md — NossoCRM (IntelliX.AI_CRM)

> **Documento Vivo:** Atualizado a cada modificação significativa.
> **Última Atualização:** 25 de Fevereiro de 2026 (00:15 BRT)
> **Versão do Registro:** 1.1

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
| **Smart Notifications** | P1 | ⏳ Planejado | Componente criado, service pendente |
| **Activity Sequences** | P1 | ⏳ Planejado | Componente criado, service pendente |
| **Bulk Operations** | P1 | ⏳ Planejado | Componente criado, service pendente |
| **Deal Templates** | P2 | ⏳ Planejado | Componente criado, service pendente |
| **Quick Reports** | P2 | ⏳ Planejado | Componente criado, service pendente |
| **MCP OAuth** | P2 | ⏳ Planejado | — |
| **Contact Enrichment** | P3 | ⏳ Planejado | Componente criado, service pendente |

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

---

## 10. Histórico de Alterações (Changelog)

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

*Este documento é atualizado a cada modificação significativa do projeto.*
*Gerado e mantido por: IntelliX.AI Development Pipeline*
