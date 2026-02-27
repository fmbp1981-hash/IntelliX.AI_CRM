# NossoCRM — PRD Complementar: Verticalização Multi-Nicho

> **Versão:** 1.0 — 24 de Fevereiro de 2026
> **Status:** Draft — Para Implementação
> **Tipo:** PRD Complementar (estende Core + PRD Complementar existente)
> **Confidencialidade:** Interno — IntelliX.AI

---

## IMPORTANTE: Contexto de Implementação

Este PRD é **complementar** ao core já implementado e ao PRD Complementar existente. **Não redefine nem duplica** funcionalidades que já existem. Assume como pré-requisitos operacionais:

- **Core (branch `main`):** Pipeline Kanban, Contatos, Deals, Atividades, Auth, Relatórios, AI Central, Onboarding, Multi-tenancy com isolamento por `organization_id`.
- **PRD Complementar (branch `feature/prd-complementar-implementation`):** Inbox Inteligente 2.0 (Priority Score, Action Items, Streaks), AI Governance (quotas, `ai_usage_logs`, bloqueio 429), Webhook Events Expansion (`deal.created`, `deal.won`, `deal.lost`, `deal.stagnant`, `contact.created`, `contact.stage_changed`, `activity.completed` via pg_net + pg_cron).
- **Stack:** Next.js 16 (App Router), React 19, TypeScript 5.x, Tailwind CSS v4, Radix UI/Shadcn, Framer Motion, TanStack Query v5 (SSOT no cache), Zustand, Supabase (PostgreSQL 15+, RLS), Vercel AI SDK v6 (Claude, Gemini, GPT-4o), Deploy Vercel + Supabase.
- **Padrão SSOT:** Todas mutações iteram sobre mesma chave global do TanStack Query (ex: `[...queryKeys.deals.lists(), 'view']`), eliminando race conditions.

Este PRD **estende** essa base adicionando a camada de verticalização. Nenhuma reescrita do core — apenas extensão por configuração.

---

## 1. Sumário Executivo

### 1.1 Visão do Produto

O NossoCRM (IntelliX.AI_CRM) é uma plataforma CRM assistiva pró-ativa SaaS, posicionada como "CRM Assistivo Enterprise-Lean" para empresas B2B com 5 a 50 vendedores. O produto combina três pilares diferenciais: Inbox Inteligente 2.0 com Priority Score gamificado, AI Governance com quotas e controle de custos por organização, e Automações Nativas no banco de dados via pg_net e pg_cron, eliminando dependências de middleware externo.

### 1.2 Objetivo deste PRD

Este documento especifica a implementação da camada de **Verticalização Multi-Nicho** — a **Business Profile Layer** — que transforma o CRM genérico em um produto verticalizado adaptável. Ao selecionar o tipo de negócio no onboarding, o sistema carrega automaticamente a estrutura operacional específica: campos customizados, nomenclaturas, pipelines padrão, automações, dashboards e contexto de IA.

### 1.3 Nichos Iniciais

A primeira release contempla três verticais com alta demanda no mercado brasileiro e características operacionais distintas que validam a flexibilidade da arquitetura:

| Vertical | Foco Operacional | Diferencial Competitivo |
|---|---|---|
| **Clínicas Médicas** | Agendamentos, convênios, reativação de pacientes, absenteísmo, LGPD | CRM assistivo sem prontuário — complementa iClinic/Feegow |
| **Clínicas Odontológicas** | Pipeline de orçamento, parcelamento, abandono de tratamento | Foco comercial: conversão orçamento → tratamento |
| **Imobiliárias** | Match cliente↔imóvel, gestão de visitas, comissões por corretor | CRM relacional com inteligência de match |

### 1.4 Benefícios Estratégicos

1. **Aumento de ticket médio:** Verticalização justifica precificação premium (CRM genérico R$99 vs. CRM para clínicas R$199).
2. **Retenção elevada:** Campos e automações específicas criam barreiras de churn — quanto mais o usuário configura, mais difícil migrar.
3. **Percepção de valor:** Usuário percebe solução feita para seu negócio, não um produto genérico adaptado.
4. **Escalabilidade modular:** Cada novo nicho é uma camada de configuração, não um fork do código.

---

## 2. Arquitetura Técnica

### 2.1 Princípio Fundamental

> **REGRA DE OURO:** NÃO criar 3 sistemas separados. O NossoCRM mantém um **Core Engine CRM único** + uma **Business Profile Layer** que ativa personalizações por nicho via configuração, não via código. Cada vertical é um conjunto de metadados, não um branch.

### 2.2 Stack de Referência

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | 16 / 19 / 5.x |
| UI | Tailwind CSS + Radix UI (Shadcn) + Framer Motion | v4 |
| Estado | TanStack Query v5 (SSOT no cache) + Zustand | v5 |
| Backend / BD | Supabase (PostgreSQL 15+) + Row-Level Security | 15+ |
| IA | Vercel AI SDK v6 (Claude, Gemini, GPT-4o) | v6 |
| Deploy | Vercel (frontend/APIs Edge) + Supabase (persistência) | — |
| Automações | pg_net + pg_cron (nativo no banco) | — |

### 2.3 Modelo de Dados — Business Profile Layer

#### 2.3.1 Enum: business_type

O campo `business_type` é o pilar central da verticalização. Definido como enum no PostgreSQL e armazenado na tabela `organizations` **já existente**, ele determina toda a experiência do tenant.

```sql
-- Migration: create_business_type_enum
CREATE TYPE business_type_enum AS ENUM (
  'generic',
  'medical_clinic',
  'dental_clinic',
  'real_estate'
);

ALTER TABLE organizations
  ADD COLUMN business_type business_type_enum NOT NULL DEFAULT 'generic';
```

#### 2.3.2 Tabela: vertical_configs

Armazena a configuração completa de cada vertical como JSON estruturado. Carregada uma única vez no login e cacheada no TanStack Query com `staleTime: Infinity`.

```sql
-- Migration: create_vertical_configs
CREATE TABLE vertical_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type business_type_enum UNIQUE NOT NULL,
  display_config JSONB NOT NULL DEFAULT '{}',
  -- Nomenclaturas: labels de Deal, Contact, Pipeline, etc.
  custom_fields_schema JSONB NOT NULL DEFAULT '{}',
  -- Schema dos campos customizados por entidade (contact, deal)
  default_pipeline_template JSONB NOT NULL DEFAULT '[]',
  -- Stages padrão do pipeline para este nicho
  default_automations JSONB NOT NULL DEFAULT '{}',
  -- Regras de automação ativadas por padrão
  ai_context JSONB NOT NULL DEFAULT '{}',
  -- System prompts e configurações de IA para a vertical
  dashboard_widgets JSONB NOT NULL DEFAULT '[]',
  -- Widgets e métricas específicas do dashboard
  inbox_rules JSONB NOT NULL DEFAULT '{}',
  -- Regras customizadas do Inbox Inteligente
  feature_flags JSONB NOT NULL DEFAULT '{}',
  -- Features habilitadas/desabilitadas por vertical
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vertical_configs ENABLE ROW LEVEL SECURITY;
-- Leitura pública (configuração de vertical não é dado sensível)
CREATE POLICY "vertical_configs_read" ON vertical_configs
  FOR SELECT USING (true);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `business_type` | business_type_enum (UNIQUE) | Tipo de negócio vinculado |
| `display_config` | JSONB | Nomenclaturas: labels de Deal, Contact, Pipeline, etc. |
| `custom_fields_schema` | JSONB | Schema dos campos customizados por entidade |
| `default_pipeline_template` | JSONB | Stages padrão do pipeline para este nicho |
| `default_automations` | JSONB | Regras de automação ativadas por padrão |
| `ai_context` | JSONB | System prompts e configurações de IA para a vertical |
| `dashboard_widgets` | JSONB | Widgets e métricas específicas do dashboard |
| `inbox_rules` | JSONB | Regras customizadas do Inbox Inteligente |
| `feature_flags` | JSONB | Features habilitadas/desabilitadas por vertical |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

#### 2.3.3 Tabela: custom_field_values

Armazena os valores dos campos customizados definidos pelo schema da vertical. Usa padrão **EAV (Entity-Attribute-Value)** para flexibilidade máxima.

```sql
-- Migration: create_custom_field_values
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL, -- 'contact', 'deal', 'activity'
  entity_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  field_value JSONB, -- Suporta string, number, boolean, array
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, entity_type, entity_id, field_key)
);

ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON custom_field_values
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_cfv_field ON custom_field_values(organization_id, field_key);
CREATE INDEX idx_cfv_lookup ON custom_field_values(organization_id, entity_type, entity_id);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `organization_id` | UUID (FK) | Organização (tenant) |
| `entity_type` | TEXT | Tipo: 'contact', 'deal', 'activity' |
| `entity_id` | UUID | ID do registro (contato, deal, etc.) |
| `field_key` | TEXT | Chave do campo (ex: 'convenio', 'tipo_imovel') |
| `field_value` | JSONB | Valor armazenado (suporta string, number, boolean, array) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

#### 2.3.4 Tabela: vertical_properties (Exclusiva — Imobiliárias)

Tabela dedicada para o cadastro de imóveis, exclusiva da vertical imobiliária. Ativada via feature flag `property_management`.

```sql
-- Migration: create_vertical_properties
CREATE TABLE vertical_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  property_type TEXT NOT NULL, -- apartamento, casa, comercial, terreno
  transaction_type TEXT NOT NULL, -- venda, locacao, venda_e_locacao
  address_json JSONB NOT NULL DEFAULT '{}',
  -- { rua, numero, bairro, cidade, estado, cep }
  value DECIMAL(12,2),
  area_m2 DECIMAL(8,2),
  bedrooms INT,
  status TEXT NOT NULL DEFAULT 'disponivel',
  -- disponivel, reservado, vendido, locado
  owner_contact_id UUID REFERENCES contacts(id),
  assigned_broker_id UUID REFERENCES profiles(id),
  features_json JSONB DEFAULT '[]',
  -- [garagem, piscina, varanda, churrasqueira, ...]
  photos_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vertical_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON vertical_properties
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_vp_org_status ON vertical_properties(organization_id, status);
CREATE INDEX idx_vp_type ON vertical_properties(organization_id, property_type, transaction_type);
CREATE INDEX idx_vp_broker ON vertical_properties(assigned_broker_id);
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `organization_id` | UUID (FK) | Organização (tenant) |
| `property_type` | TEXT | Tipo: apartamento, casa, comercial, terreno |
| `transaction_type` | TEXT | venda, locação, venda_e_locacao |
| `address_json` | JSONB | Endereço estruturado (rua, bairro, cidade, estado, CEP) |
| `value` | DECIMAL(12,2) | Valor do imóvel |
| `area_m2` | DECIMAL(8,2) | Área em metros quadrados |
| `bedrooms` | INT | Número de quartos |
| `status` | TEXT | disponivel, reservado, vendido, locado |
| `owner_contact_id` | UUID (FK) | Contato do proprietário |
| `assigned_broker_id` | UUID (FK) | Corretor responsável |
| `features_json` | JSONB | Características (garagem, piscina, varanda, etc.) |
| `photos_urls` | JSONB | Array de URLs de fotos |
| `created_at` | TIMESTAMPTZ | Data de criação |

---

## 3. Fluxo de Onboarding Verticalizado

### 3.1 Seleção de Vertical

Durante o onboarding, após criar conta e organização, o usuário responde: **"Qual tipo de negócio você gerencia?"**. A seleção dispara um processo automático de configuração que leva menos de 2 segundos.

Opções apresentadas:
- ( ) Vendas B2B (Genérico)
- ( ) Clínica Médica
- ( ) Clínica Odontológica
- ( ) Imobiliária

### 3.2 Processo de Ativação

Ao selecionar o `business_type`, o sistema executa automaticamente em sequência:

| # | Ação | Implementação |
|---|---|---|
| 1 | Grava business_type na organização | `UPDATE organizations SET business_type = $1` |
| 2 | Carrega vertical_config correspondente | `SELECT * FROM vertical_configs WHERE business_type = $1` |
| 3 | Cria pipeline padrão com stages do nicho | `INSERT INTO pipelines/pipeline_stages` usando `default_pipeline_template` |
| 4 | Ativa feature flags do nicho | Merge `feature_flags` no cache da org |
| 5 | Configura Inbox rules customizadas | Merge `inbox_rules` na configuração da org |
| 6 | Carrega contexto de IA da vertical | Cache `ai_context` no TanStack Query |
| 7 | Renderiza dashboard com widgets do nicho | `dashboard_widgets` determinam layout |
| 8 | Aplica nomenclaturas (display_config) | Labels dinâmicos no frontend via hook `useVerticalConfig()` |

### 3.3 Hook de Acesso: useVerticalConfig()

```typescript
// hooks/useVerticalConfig.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganization } from './useOrganization';

export function useVerticalConfig() {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['vertical-config', org?.business_type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vertical_configs')
        .select('*')
        .eq('business_type', org!.business_type)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity, // Configuração de vertical nunca muda em runtime
    enabled: !!org?.business_type,
  });
}

// Uso nos componentes:
const { data: config } = useVerticalConfig();
const dealLabel = config?.display_config?.deal_label ?? 'Deal';
// Retorna: 'Atendimento' (médica), 'Plano de Tratamento' (odonto), 'Negociação' (imob)
```

### 3.4 Hook de Feature Flags: useFeatureFlag()

```typescript
// hooks/useFeatureFlag.ts
export function useFeatureFlag(flag: string): boolean {
  const { data: config } = useVerticalConfig();
  return config?.feature_flags?.[flag] ?? false;
}

// Uso:
const hasPropertyManagement = useFeatureFlag('property_management');
// true apenas para imobiliárias
```

---

## 4. Especificação por Vertical

### 4.1 Clínicas Médicas

#### 4.1.1 Contexto de Mercado

CRMs atuais como iClinic, Feegow e Shosp são híbridos CRM + Prontuário Eletrônico. O NossoCRM se posiciona como **complemento assistivo**: foco no relacionamento comercial com pacientes, não no prontuário clínico. Forte exigência de LGPD para dados de saúde.

#### 4.1.2 Nomenclaturas (display_config)

```json
{
  "deal_label": "Atendimento",
  "deal_label_plural": "Atendimentos",
  "contact_label": "Paciente",
  "contact_label_plural": "Pacientes",
  "pipeline_label": "Jornada do Paciente",
  "activity_label": "Interação",
  "company_label": "Clínica / Unidade",
  "won_label": "Concluído",
  "lost_label": "Cancelado"
}
```

| Entidade Genérica | Nome Verticalizado | Contexto |
|---|---|---|
| Deal | Atendimento | Cada consulta/procedimento é um atendimento no pipeline |
| Contact | Paciente | Foco na relação continuada de saúde |
| Pipeline | Jornada do Paciente | Funil do primeiro contato até reativação |
| Activity | Interação | Cada contato telefônico, mensagem ou consulta |
| Company | Clínica / Unidade | Para redes com múltiplas unidades |

#### 4.1.3 Campos Customizados — Paciente (Contact)

```json
{
  "contact": [
    { "key": "convenio", "label": "Convênio", "type": "select", "options_configurable": true, "required": false },
    { "key": "carteirinha_convenio", "label": "Nº Carteirinha", "type": "text", "required": false },
    { "key": "medico_responsavel", "label": "Médico Responsável", "type": "select", "source": "team_members", "required": true },
    { "key": "especialidade", "label": "Especialidade", "type": "select", "options": ["Clínica Geral", "Cardiologia", "Dermatologia", "Ginecologia", "Oftalmologia", "Ortopedia", "Pediatria", "Outro"], "required": true },
    { "key": "ultima_consulta", "label": "Última Consulta", "type": "date", "auto_fill": true },
    { "key": "proximo_retorno", "label": "Próximo Retorno", "type": "date", "required": false },
    { "key": "status_clinico", "label": "Status Clínico", "type": "select", "options": ["Ativo", "Inativo", "Alta"], "auto_fill": true },
    { "key": "alergias", "label": "Alergias", "type": "text", "required": false },
    { "key": "observacoes_lgpd", "label": "Observações (LGPD)", "type": "textarea", "encrypted": true, "required": false }
  ]
}
```

| field_key | Label | Tipo | Obrigatório |
|---|---|---|---|
| `convenio` | Convênio | select (lista configurável) | Não |
| `carteirinha_convenio` | Nº Carteirinha | text | Não |
| `medico_responsavel` | Médico Responsável | select (equipe médica) | Sim |
| `especialidade` | Especialidade | select | Sim |
| `ultima_consulta` | Última Consulta | date | Auto |
| `proximo_retorno` | Próximo Retorno | date | Não |
| `status_clinico` | Status Clínico | select (ativo, inativo, alta) | Auto |
| `alergias` | Alergias | text | Não |
| `observacoes_lgpd` | Observações (LGPD) | textarea (criptografado) | Não |

#### 4.1.4 Campos Customizados — Atendimento (Deal)

```json
{
  "deal": [
    { "key": "tipo_procedimento", "label": "Tipo de Procedimento", "type": "select", "options": ["Consulta", "Exame", "Cirurgia", "Retorno"], "required": true },
    { "key": "valor_estimado", "label": "Valor Estimado", "type": "currency", "currency": "BRL", "required": false },
    { "key": "autorizacao_convenio", "label": "Autorização Convênio", "type": "select", "options": ["Pendente", "Autorizado", "Negado", "Particular"], "required": false },
    { "key": "status_agendamento", "label": "Status Agendamento", "type": "select", "options": ["Agendado", "Confirmado", "Em Espera", "Cancelado"], "required": true },
    { "key": "compareceu", "label": "Compareceu?", "type": "boolean", "required": false },
    { "key": "retorno_necessario", "label": "Retorno Necessário?", "type": "boolean", "required": false },
    { "key": "data_agendamento", "label": "Data do Agendamento", "type": "datetime", "required": true }
  ]
}
```

| field_key | Label | Tipo |
|---|---|---|
| `tipo_procedimento` | Tipo de Procedimento | select (consulta, exame, cirurgia, retorno) |
| `valor_estimado` | Valor Estimado | currency (BRL) |
| `autorizacao_convenio` | Autorização Convênio | select (pendente, autorizado, negado, particular) |
| `status_agendamento` | Status Agendamento | select (agendado, confirmado, em_espera, cancelado) |
| `compareceu` | Compareceu? | boolean |
| `retorno_necessario` | Retorno Necessário? | boolean |
| `data_agendamento` | Data do Agendamento | datetime |

#### 4.1.5 Pipeline Padrão — Jornada do Paciente

```json
{
  "stages": [
    { "order": 1, "name": "Primeiro Contato", "color": "#3B82F6", "automation": "ai_welcome_template" },
    { "order": 2, "name": "Agendamento", "color": "#8B5CF6", "automation": "reminder_24h" },
    { "order": 3, "name": "Confirmação", "color": "#F59E0B", "automation": "whatsapp_confirmation" },
    { "order": 4, "name": "Em Atendimento", "color": "#10B981", "automation": "duration_timer" },
    { "order": 5, "name": "Pós-Consulta", "color": "#6366F1", "automation": "ai_followup_satisfaction" },
    { "order": 6, "name": "Retorno Agendado", "color": "#EC4899", "automation": "reminder_return" },
    { "order": 7, "name": "Alta / Concluído", "color": "#22C55E", "automation": "reactivation_6months" }
  ]
}
```

| Ordem | Stage | Cor | Automação |
|---|---|---|---|
| 1 | Primeiro Contato | #3B82F6 (azul) | IA gera template de boas-vindas |
| 2 | Agendamento | #8B5CF6 (roxo) | Lembrete automático 24h antes |
| 3 | Confirmação | #F59E0B (amarelo) | WhatsApp automático de confirmação |
| 4 | Em Atendimento | #10B981 (verde) | Timer de duração da consulta |
| 5 | Pós-Consulta | #6366F1 (índigo) | Follow-up via IA (satisfação + retorno) |
| 6 | Retorno Agendado | #EC4899 (rosa) | Lembrete de retorno automático |
| 7 | Alta / Concluído | #22C55E (verde) | Campanha de reativação após 6 meses |

#### 4.1.6 Funcionalidades Críticas

- **Lembretes automáticos de consulta** via webhook `deal.stage_changed` → Agendamento. Dispara 48h, 24h e 2h antes.
- **Taxa de absenteísmo** como métrica principal do dashboard. Cálculo: `(não compareceram / total agendados) × 100`.
- **Campanhas de retorno periódico:** pg_cron job diário verifica pacientes com última consulta > X meses e gera action item na Inbox existente.
- **Gestão de convênios:** Dashboard de receita por convênio vs. particular. Relatório de autorizações pendentes.
- **Follow-up pós-atendimento via IA:** Ao mover para Pós-Consulta, IA gera mensagem personalizada de acompanhamento.

---

### 4.2 Clínicas Odontológicas

#### 4.2.1 Contexto de Mercado

Diferencia-se das clínicas médicas pelo alto ticket médio, tratamentos parcelados em múltiplas etapas e forte dependência de conversão de orçamento. O pipeline comercial é mais longo: orçamento → aprovação → tratamento → manutenção.

#### 4.2.2 Nomenclaturas (display_config)

```json
{
  "deal_label": "Plano de Tratamento",
  "deal_label_plural": "Planos de Tratamento",
  "contact_label": "Paciente",
  "contact_label_plural": "Pacientes",
  "pipeline_label": "Funil de Tratamento",
  "activity_label": "Interação",
  "company_label": "Clínica / Unidade",
  "won_label": "Tratamento Concluído",
  "lost_label": "Orçamento Recusado"
}
```

| Entidade Genérica | Nome Verticalizado | Contexto |
|---|---|---|
| Deal | Plano de Tratamento | Orçamento completo com procedimentos |
| Contact | Paciente | Foco na jornada de tratamento |
| Pipeline | Funil de Tratamento | Do orçamento à manutenção |
| Activity | Interação | Consultas, ligações, mensagens |
| Company | Clínica / Unidade | Para redes odontológicas |

#### 4.2.3 Campos Customizados — Paciente (Contact)

```json
{
  "contact": [
    { "key": "plano_odontologico", "label": "Plano Odontológico", "type": "select", "options_configurable": true, "required": false },
    { "key": "historico_tratamentos", "label": "Histórico de Tratamentos", "type": "text", "auto_fill": true, "required": false },
    { "key": "orcamento_pendente", "label": "Orçamento Pendente?", "type": "boolean", "auto_fill": true },
    { "key": "score_conversao", "label": "Score de Conversão", "type": "number", "min": 0, "max": 100, "auto_fill": true, "computed_by": "ai" },
    { "key": "ultima_manutencao", "label": "Última Manutenção", "type": "date" },
    { "key": "proxima_manutencao", "label": "Próxima Manutenção", "type": "date" }
  ]
}
```

| field_key | Label | Tipo |
|---|---|---|
| `plano_odontologico` | Plano Odontológico | select (lista configurável) |
| `historico_tratamentos` | Histórico de Tratamentos | text (auto-preenchido) |
| `orcamento_pendente` | Orçamento Pendente? | boolean (auto) |
| `score_conversao` | Score de Conversão | number (0-100, calculado por IA) |
| `ultima_manutencao` | Última Manutenção | date |
| `proxima_manutencao` | Próxima Manutenção | date |

#### 4.2.4 Campos Customizados — Plano de Tratamento (Deal)

```json
{
  "deal": [
    { "key": "tipo_procedimento", "label": "Tipo de Procedimento", "type": "select", "options": ["Implante", "Ortodontia", "Protética", "Endodontia", "Periodontia", "Estética", "Cirurgia", "Outro"], "required": true },
    { "key": "valor_total", "label": "Valor Total", "type": "currency", "currency": "BRL", "required": true },
    { "key": "valor_entrada", "label": "Valor de Entrada", "type": "currency", "currency": "BRL" },
    { "key": "parcelamento", "label": "Parcelamento", "type": "text", "placeholder": "Ex: 12x R$500" },
    { "key": "status_orcamento", "label": "Status Orçamento", "type": "select", "options": ["Elaborando", "Enviado", "Negociando", "Aprovado", "Recusado"], "required": true },
    { "key": "fase_tratamento", "label": "Fase do Tratamento", "type": "select", "options": ["Planejamento", "Em Andamento", "Finalizado"] },
    { "key": "dentista_responsavel", "label": "Dentista Responsável", "type": "select", "source": "team_members", "required": true },
    { "key": "sessoes_previstas", "label": "Sessões Previstas", "type": "number" },
    { "key": "sessoes_realizadas", "label": "Sessões Realizadas", "type": "number", "auto_fill": true }
  ]
}
```

| field_key | Label | Tipo |
|---|---|---|
| `tipo_procedimento` | Tipo de Procedimento | select (implante, ortodontia, protética, endodontia, etc.) |
| `valor_total` | Valor Total | currency (BRL) |
| `valor_entrada` | Valor de Entrada | currency (BRL) |
| `parcelamento` | Parcelamento | text (ex: 12x R$500) |
| `status_orcamento` | Status Orçamento | select (elaborando, enviado, negociando, aprovado, recusado) |
| `fase_tratamento` | Fase do Tratamento | select (planejamento, em_andamento, finalizado) |
| `dentista_responsavel` | Dentista Responsável | select (equipe) |
| `sessoes_previstas` | Sessões Previstas | number |
| `sessoes_realizadas` | Sessões Realizadas | number (auto) |

#### 4.2.5 Pipeline Padrão — Funil de Tratamento

```json
{
  "stages": [
    { "order": 1, "name": "Avaliação Inicial", "color": "#3B82F6", "automation": "ai_evaluation_brief" },
    { "order": 2, "name": "Orçamento Enviado", "color": "#F59E0B", "automation": "followup_3days" },
    { "order": 3, "name": "Negociação", "color": "#8B5CF6", "automation": "ai_negotiation_args" },
    { "order": 4, "name": "Orçamento Aprovado", "color": "#10B981", "automation": "schedule_first_session" },
    { "order": 5, "name": "Tratamento em Andamento", "color": "#6366F1", "automation": "session_progress_tracking" },
    { "order": 6, "name": "Tratamento Concluído", "color": "#22C55E", "automation": "satisfaction_followup_maintenance" },
    { "order": 7, "name": "Manutenção Recorrente", "color": "#EC4899", "automation": "reminder_6months" }
  ]
}
```

| Ordem | Stage | Cor | Automação |
|---|---|---|---|
| 1 | Avaliação Inicial | #3B82F6 (azul) | IA gera briefing da avaliação |
| 2 | Orçamento Enviado | #F59E0B (amarelo) | Timer: follow-up após 3 dias sem resposta |
| 3 | Negociação | #8B5CF6 (roxo) | IA sugere argumentos de negociação |
| 4 | Orçamento Aprovado | #10B981 (verde) | Gera primeira sessão na agenda |
| 5 | Tratamento em Andamento | #6366F1 (índigo) | Controle de sessões: X de Y realizadas |
| 6 | Tratamento Concluído | #22C55E (verde) | Follow-up de satisfação + agenda manutenção |
| 7 | Manutenção Recorrente | #EC4899 (rosa) | Lembrete semestral automático |

#### 4.2.6 Funcionalidades Críticas

- **Pipeline de orçamento com taxa de conversão:** Dashboard mostra `(orçamentos aprovados / orçamentos enviados) × 100`, com drill-down por dentista e por tipo de procedimento.
- **Controle de abandono de tratamento:** pg_cron detecta Planos de Tratamento em andamento sem atividade > 15 dias e gera action item crítico na Inbox.
- **IA de follow-up para orçamento parado:** Após 3 dias em Orçamento Enviado sem resposta, IA gera mensagem persuasiva contextualizada ao tipo de procedimento.
- **Gestão de parcelas:** Visualização de receita recebida vs. a receber por plano. Alerta de inadimplência.
- **Recorrência de manutenção:** Pacientes com tratamento concluído entram em ciclo automático de manutenção semestral.

---

### 4.3 Imobiliárias

#### 4.3.1 Contexto de Mercado

CRMs imobiliários tradicionais são orientados a oportunidade com integração a portais (Zap Imóveis, VivaReal, OLX). O diferencial do NossoCRM é o **match inteligente cliente↔imóvel via IA**, combinado com gestão de visitas e controle de comissões por corretor.

#### 4.3.2 Nomenclaturas (display_config)

```json
{
  "deal_label": "Negociação",
  "deal_label_plural": "Negociações",
  "contact_label": "Cliente",
  "contact_label_plural": "Clientes",
  "pipeline_label": "Funil de Vendas",
  "activity_label": "Interação",
  "company_label": "Imobiliária / Filial",
  "won_label": "Contrato Fechado",
  "lost_label": "Negociação Perdida"
}
```

| Entidade Genérica | Nome Verticalizado | Contexto |
|---|---|---|
| Deal | Negociação | Cada oportunidade de venda/locação |
| Contact | Cliente | Comprador, vendedor ou locatário |
| Pipeline | Funil de Vendas / Locação | Separados por tipo de transação |
| Activity | Interação | Visitas, ligações, propostas |
| Company | Imobiliária / Filial | Para redes com múltiplas unidades |

#### 4.3.3 Campos Customizados — Cliente (Contact)

```json
{
  "contact": [
    { "key": "tipo_cliente", "label": "Tipo de Cliente", "type": "select", "options": ["Comprador", "Vendedor", "Locatário", "Investidor"], "required": true },
    { "key": "faixa_orcamento_min", "label": "Orçamento Mínimo", "type": "currency", "currency": "BRL" },
    { "key": "faixa_orcamento_max", "label": "Orçamento Máximo", "type": "currency", "currency": "BRL" },
    { "key": "tipo_imovel_desejado", "label": "Tipo Imóvel Desejado", "type": "multi_select", "options": ["Apartamento", "Casa", "Comercial", "Terreno"] },
    { "key": "regiao_interesse", "label": "Região de Interesse", "type": "multi_select", "options_configurable": true },
    { "key": "quartos_minimo", "label": "Quartos Mínimo", "type": "number" },
    { "key": "aprovacao_financiamento", "label": "Financiamento Aprovado?", "type": "select", "options": ["Sim", "Não", "Em Análise", "Não Precisa"] },
    { "key": "banco_financiamento", "label": "Banco", "type": "text" }
  ]
}
```

| field_key | Label | Tipo |
|---|---|---|
| `tipo_cliente` | Tipo de Cliente | select (comprador, vendedor, locatário, investidor) |
| `faixa_orcamento_min` | Orçamento Mínimo | currency (BRL) |
| `faixa_orcamento_max` | Orçamento Máximo | currency (BRL) |
| `tipo_imovel_desejado` | Tipo Imóvel Desejado | multi-select (apartamento, casa, comercial, terreno) |
| `regiao_interesse` | Região de Interesse | multi-select (bairros configuráveis) |
| `quartos_minimo` | Quartos Mínimo | number |
| `aprovacao_financiamento` | Financiamento Aprovado? | select (sim, nao, em_analise, nao_precisa) |
| `banco_financiamento` | Banco | text |

#### 4.3.4 Campos Customizados — Negociação (Deal)

```json
{
  "deal": [
    { "key": "imovel_id", "label": "Imóvel Relacionado", "type": "fk", "references": "vertical_properties", "required": true },
    { "key": "corretor_responsavel", "label": "Corretor Responsável", "type": "select", "source": "team_members", "required": true },
    { "key": "comissao_percentual", "label": "Comissão (%)", "type": "decimal" },
    { "key": "comissao_valor", "label": "Valor Comissão", "type": "currency", "computed": true },
    { "key": "tipo_transacao", "label": "Tipo Transação", "type": "select", "options": ["Venda", "Locação"], "required": true },
    { "key": "data_visita", "label": "Data da Visita", "type": "datetime" },
    { "key": "feedback_visita", "label": "Feedback da Visita", "type": "textarea" },
    { "key": "proposta_valor", "label": "Valor da Proposta", "type": "currency" },
    { "key": "proposta_status", "label": "Status Proposta", "type": "select", "options": ["Pendente", "Aceita", "Contra-proposta", "Recusada"] }
  ]
}
```

| field_key | Label | Tipo |
|---|---|---|
| `imovel_id` | Imóvel Relacionado | FK → vertical_properties |
| `corretor_responsavel` | Corretor Responsável | select (equipe) |
| `comissao_percentual` | Comissão (%) | decimal |
| `comissao_valor` | Valor Comissão | currency (auto-calculado) |
| `tipo_transacao` | Tipo Transação | select (venda, locação) |
| `data_visita` | Data da Visita | datetime |
| `feedback_visita` | Feedback da Visita | textarea |
| `proposta_valor` | Valor da Proposta | currency |
| `proposta_status` | Status Proposta | select (pendente, aceita, contra_proposta, recusada) |

#### 4.3.5 Pipeline Padrão — Funil de Vendas

```json
{
  "stages": [
    { "order": 1, "name": "Lead Captado", "color": "#3B82F6", "automation": "ai_property_match" },
    { "order": 2, "name": "Qualificação", "color": "#8B5CF6", "automation": "check_financing_preferences" },
    { "order": 3, "name": "Visita Agendada", "color": "#F59E0B", "automation": "reminder_24h_photos" },
    { "order": 4, "name": "Visita Realizada", "color": "#10B981", "automation": "ai_followup_feedback" },
    { "order": 5, "name": "Proposta Enviada", "color": "#6366F1", "automation": "followup_2days" },
    { "order": 6, "name": "Negociação", "color": "#EC4899", "automation": "ai_counter_arguments" },
    { "order": 7, "name": "Contrato / Fechamento", "color": "#22C55E", "automation": "calculate_commission" }
  ]
}
```

| Ordem | Stage | Cor | Automação |
|---|---|---|---|
| 1 | Lead Captado | #3B82F6 (azul) | IA faz match automático com imóveis disponíveis |
| 2 | Qualificação | #8B5CF6 (roxo) | Verifica financiamento + preferências |
| 3 | Visita Agendada | #F59E0B (amarelo) | Lembrete 24h antes + envio de fotos do imóvel |
| 4 | Visita Realizada | #10B981 (verde) | IA gera follow-up baseado no feedback |
| 5 | Proposta Enviada | #6366F1 (índigo) | Timer: follow-up após 2 dias sem resposta |
| 6 | Negociação | #EC4899 (rosa) | IA sugere contra-argumentos |
| 7 | Contrato / Fechamento | #22C55E (verde) | Cálculo automático de comissão |

#### 4.3.6 Funcionalidades Críticas

- **Match automático cliente↔imóvel:** Ao cadastrar cliente ou imóvel, IA cruza preferências (tipo, região, orçamento, quartos) e sugere top 5 matches com score de compatibilidade.
- **Gestão de visitas:** Calendário dedicado com visão por corretor. Registro de feedback estruturado pós-visita.
- **Relatório de comissões:** Dashboard com comissão total por corretor, por período. Separa comissões a receber de recebidas.
- **Pipeline por corretor:** Visão filtrada do Kanban por corretor responsável, com métricas individuais de conversão.
- **Follow-up automático pós-visita:** Ao registrar Visita Realizada, IA gera mensagem contextualizada ao imóvel visitado e feedback do cliente.

---

## 5. Lógica de IA Contextual por Vertical

### 5.1 Arquitetura do Sistema de IA

A IA do NossoCRM opera em **três níveis de contexto** que se combinam para gerar respostas altamente especializadas por vertical. O campo `ai_context` da tabela `vertical_configs` armazena a configuração completa de cada nível.

#### 5.1.1 Níveis de Contexto

| Nível | Escopo | Fonte | Exemplo |
|---|---|---|---|
| 1. System Prompt Base | Identidade e regras globais | Hardcoded no backend | "Você é o assistente do NossoCRM, um CRM assistivo..." |
| 2. Vertical Context | Especialização por nicho | `ai_context` da `vertical_configs` | "Você está atuando para uma clínica médica..." |
| 3. Entity Context | Dados do registro atual | Query dinâmica no momento | "Paciente Maria, convênio Unimed, última consulta 15/01..." |

#### 5.1.2 Fluxo de Composição do Prompt

```
1. Carregar system_prompt_base (fixo, ~200 tokens)
2. Carregar ai_context.system_prompt_vertical do vertical_configs (~300 tokens)
3. Montar entity_context com dados do registro atual (~200 tokens)
4. Concatenar: [base] + [vertical] + [entity] + [user_message]
5. Enviar ao modelo via Vercel AI SDK v6 com streaming
6. Logar em ai_usage_logs com custo e tokens consumidos (AI Governance existente)
```

#### 5.1.3 Implementação do Compositor de Prompts

```typescript
// lib/ai/prompt-composer.ts
import { supabase } from '@/lib/supabase';

interface PromptComposition {
  systemPrompt: string;
  entityContext: string;
}

const SYSTEM_PROMPT_BASE = `Você é o assistente inteligente do NossoCRM, um CRM assistivo pró-ativo.
Suas respostas devem ser práticas, acionáveis e contextualizadas ao negócio do usuário.
Sempre use as nomenclaturas corretas da vertical ativa.
Respeite a LGPD: nunca inclua dados sensíveis em mensagens sugeridas.
Formato: responda em português brasileiro, tom profissional mas acessível.`;

export async function composePrompt(
  organizationId: string,
  entityType: 'deal' | 'contact' | 'activity',
  entityId: string,
  action: string
): Promise<PromptComposition> {
  // 1. Buscar business_type e vertical config
  const { data: org } = await supabase
    .from('organizations')
    .select('business_type')
    .eq('id', organizationId)
    .single();

  const { data: verticalConfig } = await supabase
    .from('vertical_configs')
    .select('ai_context, display_config')
    .eq('business_type', org.business_type)
    .single();

  // 2. Buscar dados da entidade + custom fields
  const { data: entity } = await supabase
    .from(entityType === 'deal' ? 'deals' : 'contacts')
    .select('*')
    .eq('id', entityId)
    .single();

  const { data: customFields } = await supabase
    .from('custom_field_values')
    .select('field_key, field_value')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  // 3. Montar entity context
  const entityContext = buildEntityContext(entity, customFields, verticalConfig.display_config);

  // 4. Compor system prompt
  const systemPrompt = [
    SYSTEM_PROMPT_BASE,
    verticalConfig.ai_context.system_prompt_vertical,
    verticalConfig.ai_context.action_prompts?.[action] ?? '',
  ].join('\n\n');

  return { systemPrompt, entityContext };
}

function buildEntityContext(
  entity: any,
  customFields: any[],
  displayConfig: any
): string {
  const cfMap = Object.fromEntries(
    customFields.map(cf => [cf.field_key, cf.field_value])
  );
  const label = displayConfig.contact_label ?? 'Contato';

  return `--- Contexto do ${label} ---
Nome: ${entity.name ?? 'N/A'}
Email: ${entity.email ?? 'N/A'}
Campos customizados: ${JSON.stringify(cfMap, null, 2)}
Criado em: ${entity.created_at}
Última atualização: ${entity.updated_at}`;
}
```

### 5.2 System Prompts por Vertical

#### 5.2.1 Clínicas Médicas — ai_context

```json
{
  "system_prompt_vertical": "Você é o assistente de CRM especializado para clínicas médicas. Seu contexto:\n\n- NOMENCLATURA: Deals são Atendimentos. Contacts são Pacientes. O pipeline é a Jornada do Paciente.\n- FOCO: Relacionamento continuado com pacientes, reativação, redução de absenteísmo, gestão de convênios.\n- TOM: Profissional e empático. Use linguagem de saúde, nunca de vendas agressivas.\n- PRIORIDADES: (1) Pacientes com retorno atrasado, (2) Orçamentos de convênio pendentes, (3) Reativação de inativos > 6 meses.\n- LGPD: Nunca inclua dados clínicos sensíveis (diagnósticos, exames) em mensagens sugeridas. Apenas referências genéricas ao atendimento.\n- MÉTRICAS: Priorize absenteísmo, taxa de retorno, receita por convênio.\n- FOLLOW-UP: Gere mensagens acolhedoras de pós-consulta focando no bem-estar do paciente.",

  "action_prompts": {
    "follow_up": "Gere uma mensagem de follow-up para este paciente. Seja acolhedor, pergunte sobre o bem-estar após o atendimento. Se houver retorno agendado, lembre gentilmente. NUNCA mencione diagnósticos ou resultados de exames.",
    "inbox_generate": "Analise este paciente e gere uma sugestão de ação prioritária. Considere: tempo desde última consulta, retornos pendentes, status de convênio. Priorize pela urgência temporal.",
    "reactivation": "Este paciente está inativo há mais de 6 meses. Gere uma mensagem de reativação acolhedora, convidando para um check-up. Referencie o último atendimento de forma genérica, sem dados clínicos.",
    "analysis": "Analise o histórico deste paciente no CRM e forneça insights: frequência de consultas, padrão de comparecimento, risco de churn, sugestões de ações."
  },

  "priority_weights": {
    "financial_value": 0.15,
    "idle_days": 0.25,
    "ai_probability": 0.15,
    "temporal_urgency": 0.35,
    "recurrence_retention": 0.10
  }
}
```

#### 5.2.2 Clínicas Odontológicas — ai_context

```json
{
  "system_prompt_vertical": "Você é o assistente de CRM especializado para clínicas odontológicas. Seu contexto:\n\n- NOMENCLATURA: Deals são Planos de Tratamento. Contacts são Pacientes. O pipeline é o Funil de Tratamento.\n- FOCO: Conversão de orçamentos, retenção de pacientes em tratamento, recorrência de manutenção.\n- TOM: Profissional, consultivo e persuasivo-sutil. Foque em benefícios de saúde bucal e estética.\n- PRIORIDADES: (1) Orçamentos enviados sem resposta > 3 dias, (2) Tratamentos com sessões atrasadas, (3) Pacientes sem manutenção > 6 meses.\n- NEGOCIAÇÃO: Ao sugerir follow-up de orçamento, use argumentos de saúde + facilidade de pagamento. Nunca desvalorize o procedimento.\n- MÉTRICAS: Priorize taxa de conversão de orçamento, ticket médio, taxa de abandono de tratamento.\n- PARCELAMENTO: Quando relevante, mencione opções de parcelamento como argumento.",

  "action_prompts": {
    "follow_up": "Gere uma mensagem de follow-up para este orçamento/tratamento. Se orçamento pendente: reforce benefícios + facilidades de pagamento. Se tratamento em andamento: celebre progresso e reforce compromisso.",
    "inbox_generate": "Analise este Plano de Tratamento e gere uma sugestão de ação. Considere: dias desde último contato, status do orçamento, progresso de sessões, score de conversão.",
    "budget_followup": "Este orçamento está parado há mais de 3 dias. Gere uma mensagem persuasiva-sutil focando nos benefícios de saúde do procedimento e nas facilidades de pagamento. Contextualize ao tipo de tratamento.",
    "abandonment_alert": "Este paciente não comparece há 15+ dias com tratamento em andamento. Gere uma mensagem de reengajamento focando nos riscos de interromper o tratamento e no investimento já realizado.",
    "analysis": "Analise este paciente: score de conversão, histórico de tratamentos, padrão de comparecimento, valor total investido, risco de abandono."
  },

  "priority_weights": {
    "financial_value": 0.30,
    "idle_days": 0.25,
    "ai_probability": 0.25,
    "temporal_urgency": 0.10,
    "recurrence_retention": 0.10
  }
}
```

#### 5.2.3 Imobiliárias — ai_context

```json
{
  "system_prompt_vertical": "Você é o assistente de CRM especializado para imobiliárias. Seu contexto:\n\n- NOMENCLATURA: Deals são Negociações. Contacts são Clientes. O pipeline é o Funil de Vendas/Locação.\n- FOCO: Match cliente↔imóvel, conversão de visitas em propostas, gestão de corretores.\n- TOM: Profissional e consultivo. Use linguagem de mercado imobiliário. Seja específico sobre características dos imóveis.\n- PRIORIDADES: (1) Clientes qualificados sem visita agendada, (2) Visitas realizadas sem proposta, (3) Propostas sem resposta > 2 dias.\n- MATCH: Ao sugerir imóveis, cruze: tipo desejado, região de interesse, faixa de orçamento, nº quartos. Gere score de compatibilidade.\n- MÉTRICAS: Priorize taxa de conversão visita→proposta, tempo médio de fechamento, volume por corretor.\n- FOLLOW-UP: Pós-visita, referencie características específicas do imóvel visitado e o feedback registrado.",

  "action_prompts": {
    "follow_up": "Gere uma mensagem de follow-up para esta negociação. Se pós-visita: referencie o imóvel visitado e o feedback. Se proposta pendente: crie senso de urgência sutil.",
    "inbox_generate": "Analise esta negociação e gere uma sugestão de ação. Considere: dias desde último contato, stage atual, feedback de visitas, status de proposta.",
    "property_match": "Cruze as preferências deste cliente (tipo, região, orçamento, quartos) com os imóveis disponíveis. Retorne os top 5 matches com score de compatibilidade (0-100) e justificativa.",
    "visit_followup": "Visita realizada ao imóvel. Gere mensagem personalizada referenciando: endereço/bairro, características destacadas, e o feedback registrado. Se feedback negativo, sugira alternativas.",
    "analysis": "Analise este cliente: perfil de compra, histórico de visitas, propostas enviadas, tempo no funil, probabilidade de fechamento."
  },

  "priority_weights": {
    "financial_value": 0.35,
    "idle_days": 0.25,
    "ai_probability": 0.20,
    "temporal_urgency": 0.10,
    "recurrence_retention": 0.10
  }
}
```

### 5.3 Templates de Action Items por Vertical

A Inbox Inteligente 2.0 **já existente** gera action items contextualizados automaticamente. Cada vertical define templates específicos que a IA usa como base para gerar sugestões personalizadas. Os action items são inseridos na tabela `inbox_action_items` existente.

#### 5.3.1 Clínicas Médicas — Action Item Templates

| Trigger | Título do Action Item | IA Gera |
|---|---|---|
| Paciente sem consulta > 6 meses | Reativação de paciente inativo | Mensagem acolhedora convidando para check-up. Referencia último atendimento sem citar diagnóstico. |
| Agendamento em 24h | Confirmação de consulta | Mensagem de confirmação com data/hora, nome do médico e orientações de preparo (se aplicável). |
| Pós-consulta (stage changed) | Follow-up pós-atendimento | Mensagem de acompanhamento perguntando sobre bem-estar e lembrando do retorno agendado. |
| Autorização convênio pendente > 5 dias | Cobrança de autorização | Alerta para equipe entrar em contato com convênio. Inclui dados do paciente e procedimento. |
| Absenteísmo > 30% | Alerta de absenteísmo alto | Análise de padrão: dias da semana, horários, convênios com mais faltas. Sugere ações. |

#### 5.3.2 Clínicas Odontológicas — Action Item Templates

| Trigger | Título do Action Item | IA Gera |
|---|---|---|
| Orçamento enviado sem resposta > 3 dias | Follow-up de orçamento | Mensagem consultiva: reforça benefícios do tratamento + facilidades de pagamento. Contextualizada ao tipo de procedimento. |
| Tratamento sem sessão > 15 dias | Abandono de tratamento | Alerta crítico + mensagem de reengajamento focando nos riscos de interromper o tratamento. |
| Última manutenção > 6 meses | Reativação de manutenção | Convite para manutenção semestral. Tom: cuidado preventivo, não comercial. |
| Orçamento recusado | Reabordagem de orçamento | Após 30 dias, IA sugere nova abordagem: desconto, parcelamento diferenciado, ou procedimento alternativo. |
| Sessão concluída (Y de X) | Progresso de tratamento | Mensagem celebrando progresso: X% concluído. Reforça compromisso. |

#### 5.3.3 Imobiliárias — Action Item Templates

| Trigger | Título do Action Item | IA Gera |
|---|---|---|
| Novo lead captado | Match de imóveis | Lista top 5 imóveis compatíveis com score. Gera mensagem de apresentação com destaques de cada imóvel. |
| Visita realizada sem proposta > 2 dias | Follow-up pós-visita | Mensagem referenciando imóvel visitado + feedback registrado. Se negativo, sugere alternativas. |
| Proposta sem resposta > 2 dias | Follow-up de proposta | Mensagem de acompanhamento com senso de urgência sutil (outros interessados, mercado em alta, etc). |
| Imóvel novo cadastrado | Notificação de match | Cruza com todos clientes ativos. Gera lista de clientes compatíveis para o corretor contatar. |
| Cliente sem interação > 7 dias | Reengajamento de cliente | Mensagem com novos imóveis na região de interesse. Tom: curadoria exclusiva. |

### 5.4 API de IA — Endpoint Unificado

Todos os pedidos de IA passam pelo endpoint unificado `/api/ai/generate` que automaticamente compõe o prompt baseado na vertical da organização do usuário. Este endpoint **estende** a AI Central V1 existente.

```typescript
// app/api/ai/generate/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { composePrompt } from '@/lib/ai/prompt-composer';
import { checkAiQuota, logAiUsage } from '@/lib/ai/governance'; // AI Governance existente

export async function POST(req: Request) {
  const { action, entity_type, entity_id, user_message, extra_context } = await req.json();

  // 1. Auth + org context
  const { user, organizationId } = await getAuthContext(req);

  // 2. AI Governance: verificar quota (existente)
  await checkAiQuota(organizationId); // Throws 429 se excedeu

  // 3. Compor prompt verticalizado
  const { systemPrompt, entityContext } = await composePrompt(
    organizationId,
    entity_type,
    entity_id,
    action
  );

  // 4. Montar mensagens
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${entityContext}\n\n${user_message ?? `Execute a ação: ${action}`}` },
  ];

  // 5. Stream response
  const result = await streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    onFinish: async (completion) => {
      // 6. Log usage (AI Governance existente)
      await logAiUsage({
        organization_id: organizationId,
        user_id: user.id,
        action,
        entity_type,
        entity_id,
        model: 'claude-sonnet-4-20250514',
        tokens_input: completion.usage.promptTokens,
        tokens_output: completion.usage.completionTokens,
        cost_usd: calculateCost(completion.usage),
        vertical: await getBusinessType(organizationId),
      });
    },
  });

  return result.toDataStreamResponse();
}
```

### 5.5 Priority Score Ajustado por Vertical

O Priority Score do Inbox Inteligente 2.0 **já existente** recebe pesos diferentes por vertical para refletir as prioridades operacionais de cada nicho. Os pesos são armazenados em `ai_context.priority_weights` da `vertical_configs`.

| Fator | Genérico | Clínica Médica | Clínica Odontológica | Imobiliária |
|---|---|---|---|---|
| Valor financeiro | 30% | 15% | 30% | 35% |
| Dias ociosos | 30% | 25% | 25% | 25% |
| Probabilidade (IA) | 20% | 15% | 25% | 20% |
| Urgência temporal | 10% | **35% (agenda!)** | 10% | 10% |
| Recorrência/Retenção | 10% | 10% | 10% (manutenção) | 10% |

Na vertical de clínicas médicas, a **urgência temporal** recebe peso desproporcional (35%) porque agendamentos são tempo-sensíveis: um paciente que não confirma em 2h tem alta probabilidade de absenteísmo. Na vertical odontológica, a **probabilidade via IA** é elevada (25%) porque o score de conversão de orçamento é crítico para o negócio.

```typescript
// lib/ai/priority-score.ts
// Estende o cálculo existente do Priority Score
export function calculatePriorityScore(
  deal: Deal,
  verticalConfig: VerticalConfig
): number {
  const weights = verticalConfig.ai_context.priority_weights;

  const financialScore = normalizeFinancial(deal.value);
  const idleScore = normalizeIdleDays(deal.last_activity_at);
  const probabilityScore = deal.ai_probability ?? 0.5;
  const urgencyScore = calculateTemporalUrgency(deal, verticalConfig);
  const retentionScore = calculateRetentionRisk(deal, verticalConfig);

  return (
    financialScore * weights.financial_value +
    idleScore * weights.idle_days +
    probabilityScore * weights.ai_probability +
    urgencyScore * weights.temporal_urgency +
    retentionScore * weights.recurrence_retention
  ) * 100;
}
```

---

## 6. Dashboard Widgets por Vertical

### 6.1 Clínicas Médicas

| Widget | Tipo | Dados |
|---|---|---|
| Taxa de Absenteísmo | KPI Card | `(não compareceram / agendados) × 100` — últimos 30 dias |
| Agenda de Hoje | Lista | Próximos atendimentos com status de confirmação |
| Receita por Convênio | Donut Chart | Distribuição: convênio X vs. Y vs. particular |
| Pacientes para Reativação | KPI + Lista | Total com última consulta > 6 meses + top 10 |
| Autorizações Pendentes | KPI Card | Total de orçamentos aguardando convênio |
| Retornos Agendados | Timeline | Próximos retornos da semana |

### 6.2 Clínicas Odontológicas

| Widget | Tipo | Dados |
|---|---|---|
| Taxa de Conversão de Orçamento | KPI Card | `(aprovados / enviados) × 100` — últimos 30 dias |
| Ticket Médio por Tratamento | KPI Card | Média de valor dos Planos aprovados |
| Orçamentos Pendentes | Lista Priorizada | Top 10 por valor, ordenados por dias sem resposta |
| Tratamentos em Andamento | Progress Bars | Cada tratamento com sessões X/Y realizadas |
| Abandono de Tratamento | KPI + Alerta | Tratamentos sem sessão > 15 dias |
| Manutenções Vencidas | KPI + Lista | Pacientes com última manutenção > 6 meses |

### 6.3 Imobiliárias

| Widget | Tipo | Dados |
|---|---|---|
| Negociações por Corretor | Bar Chart | Volume por corretor no período |
| Conversão Visita → Proposta | KPI Card | `(propostas / visitas) × 100` |
| Comissões do Mês | KPI + Breakdown | Total por corretor: a receber vs. recebida |
| Imóveis Disponíveis | KPI Card | Por tipo (venda/locação) e status |
| Matches Pendentes | Lista | Clientes com matches de IA não contatados |
| Tempo Médio de Fechamento | KPI Card | Dias médios do Lead Captado ao Contrato |

---

## 7. Feature Flags por Vertical

Feature flags controlam quais funcionalidades estão visíveis e ativas para cada vertical. Armazenadas no campo `feature_flags` da `vertical_configs` e mergeadas no cache da organização durante o onboarding.

| Feature Flag | Genérico | Médica | Odontológica | Imobiliária |
|---|---|---|---|---|
| `pipeline_kanban` | ✅ | ✅ | ✅ | ✅ |
| `contacts_management` | ✅ | ✅ | ✅ | ✅ |
| `inbox_intelligent` | ✅ | ✅ | ✅ | ✅ |
| `ai_central` | ✅ | ✅ | ✅ | ✅ |
| `custom_fields` | ✅ | ✅ | ✅ | ✅ |
| `scheduling_calendar` | ❌ | ✅ | ✅ | ❌ |
| `absenteeism_tracking` | ❌ | ✅ | ❌ | ❌ |
| `insurance_management` | ❌ | ✅ | ❌ | ❌ |
| `budget_pipeline` | ❌ | ❌ | ✅ | ❌ |
| `installment_tracking` | ❌ | ❌ | ✅ | ❌ |
| `treatment_progress` | ❌ | ❌ | ✅ | ❌ |
| `maintenance_recurrence` | ❌ | ❌ | ✅ | ❌ |
| `property_management` | ❌ | ❌ | ❌ | ✅ |
| `client_property_match` | ❌ | ❌ | ❌ | ✅ |
| `visit_management` | ❌ | ❌ | ❌ | ✅ |
| `commission_tracking` | ❌ | ❌ | ❌ | ✅ |
| `broker_view` | ❌ | ❌ | ❌ | ✅ |

---

## 8. Automações Nativas por Vertical

### 8.1 Jobs pg_cron Verticalizados

Além dos webhooks **já existentes** (`deal.created`, `deal.won`, etc.), cada vertical ativa jobs pg_cron específicos que rodam automaticamente e geram action items na Inbox **existente** (`inbox_action_items`).

| Job | Vertical | Schedule | Ação |
|---|---|---|---|
| `check_appointment_reminders` | Médica | `*/15 * * * *` | Verifica agendamentos em 24h/2h sem confirmação → gera action item |
| `check_patient_reactivation` | Médica | `0 8 * * 1` | Segundas às 8h: pacientes com última consulta > 6 meses → Inbox |
| `check_absenteeism_alert` | Médica | `0 18 * * *` | Diário 18h: calcula taxa de absenteísmo do dia → alerta se > 20% |
| `check_budget_followup` | Odontológica | `0 9 * * *` | Diário 9h: orçamentos enviados > 3 dias sem resposta → Inbox |
| `check_treatment_abandonment` | Odontológica | `0 10 * * *` | Diário 10h: tratamentos sem sessão > 15 dias → action item crítico |
| `check_maintenance_due` | Odontológica | `0 8 * * 1` | Segundas: pacientes com manutenção vencida > 6 meses → Inbox |
| `check_visit_followup` | Imobiliária | `0 9 * * *` | Diário 9h: visitas realizadas > 2 dias sem proposta → Inbox |
| `check_proposal_followup` | Imobiliária | `0 9 * * *` | Diário 9h: propostas enviadas > 2 dias sem resposta → Inbox |
| `run_property_matching` | Imobiliária | `0 */4 * * *` | A cada 4h: cruza novos imóveis com clientes ativos → notifica corretor |

```sql
-- Migration: setup_vertical_cron_jobs
-- Exemplo: check_budget_followup (Odontológica)
SELECT cron.schedule(
  'check_budget_followup',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_budget_followup',
      'vertical', 'dental_clinic'
    )
  );
  $$
);
```

### 8.2 Webhook Events Expandidos

Os eventos de webhook **já existentes** (`deal.created`, `deal.won`, etc.) recebem comportamento adicional por vertical:

| Evento | Comportamento Genérico (existente) | Comportamento Verticalizado (novo) |
|---|---|---|
| `deal.stage_changed` | Log de atividade | **Médica:** Se stage = Agendamento, dispara lembretes. **Odonto:** Se stage = Orçamento Enviado, inicia timer de follow-up. |
| `deal.stagnant` | Action item genérico após 7 dias | **Médica:** 3 dias sem confirmação = crítico. **Odonto:** 15 dias em tratamento = abandono. **Imob:** 7 dias sem visita = reengajamento. |
| `contact.created` | Boas-vindas | **Imob:** Dispara match automático com imóveis. **Médica:** Verifica convênio e encaminha para agendamento. |
| `deal.won` | Parabéns + log | **Odonto:** Agenda primeira sessão de tratamento. **Imob:** Calcula comissão do corretor. **Médica:** Agenda retorno. |

### 8.3 Edge Function: vertical-automation

```typescript
// supabase/functions/vertical-automation/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { job, vertical } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar todas orgs desta vertical
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('business_type', vertical);

  for (const org of orgs ?? []) {
    switch (job) {
      case 'check_budget_followup':
        await checkBudgetFollowup(supabase, org.id);
        break;
      case 'check_treatment_abandonment':
        await checkTreatmentAbandonment(supabase, org.id);
        break;
      case 'check_visit_followup':
        await checkVisitFollowup(supabase, org.id);
        break;
      case 'run_property_matching':
        await runPropertyMatching(supabase, org.id);
        break;
      // ... demais jobs
    }
  }

  return new Response(JSON.stringify({ success: true, job, orgs_processed: orgs?.length }));
});

async function checkBudgetFollowup(supabase: any, orgId: string) {
  // Buscar deals no stage "Orçamento Enviado" com última atividade > 3 dias
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleBudgets } = await supabase
    .from('deals')
    .select('id, contact_id, title, value')
    .eq('organization_id', orgId)
    .eq('stage_name', 'Orçamento Enviado')
    .lt('updated_at', threeDaysAgo);

  for (const deal of staleBudgets ?? []) {
    // Inserir action item na Inbox existente
    await supabase.from('inbox_action_items').insert({
      organization_id: orgId,
      deal_id: deal.id,
      contact_id: deal.contact_id,
      title: `Follow-up de orçamento: ${deal.title}`,
      description: `Orçamento enviado há mais de 3 dias sem resposta. Valor: R$ ${deal.value}`,
      priority: 'high',
      action_type: 'budget_followup',
      status: 'pending',
      ai_generated: true,
    });
  }
}
```

---

## 9. Plano de Implementação

### 9.1 Fases de Entrega

| Fase | Escopo | Duração Est. | Dependências |
|---|---|---|---|
| **1 — Infraestrutura** | Enum `business_type`, tabela `vertical_configs`, `custom_field_values`, hook `useVerticalConfig()`, seed dos 3 nichos | 1 semana | Nenhuma |
| **2 — Onboarding** | Tela de seleção de vertical, processo de ativação automática, pipeline templates, nomenclaturas dinâmicas | 1 semana | Fase 1 |
| **3 — Campos Custom** | Renderização dinâmica de custom fields em Contact e Deal forms, armazenamento EAV, validação por schema | 1.5 semanas | Fase 1 |
| **4 — IA Contextual** | Composição de prompts por vertical, action item templates, Priority Score ajustado, endpoint unificado | 1.5 semanas | Fases 1-3 |
| **5 — Dashboards** | Widgets específicos por vertical, métricas calculadas, feature flags no frontend | 1 semana | Fases 1-3 |
| **6 — Automações** | Jobs pg_cron verticalizados, webhooks expandidos, lógica condicional por `business_type` | 1 semana | Fases 1-4 |
| **7 — Imobiliárias** | Tabela `vertical_properties`, cadastro de imóveis, match automático, comissões | 1.5 semanas | Fases 1-6 |
| **8 — Polish + QA** | Testes integrados, ajustes de UX, performance, documentação | 1 semana | Todas |

**Estimativa total:** 9.5 semanas (~2.5 meses) para entrega completa das 3 verticais. A Fase 1 já habilita o sistema de verticalização, permitindo releases incrementais por nicho.

### 9.2 Migrations Necessárias

| # | Migration | Descrição |
|---|---|---|
| 1 | `create_business_type_enum` | `CREATE TYPE business_type_enum` + `ALTER TABLE organizations` |
| 2 | `create_vertical_configs` | Tabela `vertical_configs` + seed dos 4 tipos (generic + 3 nichos) |
| 3 | `create_custom_field_values` | Tabela `custom_field_values` + RLS + índices |
| 4 | `create_vertical_properties` | Tabela `vertical_properties` (imobiliárias) + RLS + índices |
| 5 | `setup_vertical_cron_jobs` | Jobs pg_cron verticalizados (9 jobs conforme Seção 8.1) |
| 6 | `seed_vertical_configs` | INSERT dos `ai_context`, `display_config`, pipelines, `feature_flags` de cada vertical |

---

## 10. Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---|---|---|
| Time to First Value | < 5 minutos | Tempo entre criar conta e ter pipeline verticalizado pronto |
| Taxa de Ativação de Vertical | > 80% | % de novas orgs que selecionam vertical no onboarding (vs. genérico) |
| Engajamento na Inbox | > 60% ações/dia | % de action items gerados que são concluídos no mesmo dia |
| Retenção por Segmento | > 85% M3 | Retenção de 3 meses por vertical vs. genérico |
| NPS por Vertical | > 50 | Pesquisa NPS segmentada por `business_type` |
| Conversão Pipeline | +15% vs. genérico | Taxa de conversão média do pipeline verticalizado vs. genérico |

---

## 11. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Complexidade excessiva na implementação | Alta | Abordagem incremental: infraestrutura primeiro, verticais uma a uma. Feature flags permitem rollback instantâneo. |
| Manutenção de múltiplos fluxos | Média | Tudo é configuração (JSON), não código. Core Engine único. Novos nichos = novo registro em `vertical_configs`. |
| Confusão de UX | Média | Nomenclaturas consistentes via `useVerticalConfig()`. Feature flags escondem o que não pertence ao nicho. Zero UI genérica exposta. |
| Performance com custom fields EAV | Média | Índices compostos em `(entity_type, entity_id)` e `(organization_id, field_key)`. Cache agressivo no TanStack Query. |
| Escalabilidade de suporte | Baixa | Base de conhecimento segmentada por vertical. Chatbot de suporte recebe mesmo `ai_context` da vertical. |
| Conflito entre verticalização e personalização | Baixa | Vertical define defaults; usuário pode customizar campos, pipelines e automações sobre a base verticalizada. |

---

*NossoCRM — PRD Complementar: Verticalização Multi-Nicho v1.0*
*IntelliX.AI — Documento gerado em 24 de Fevereiro de 2026*
*Este PRD é um documento vivo e será atualizado conforme as fases de implementação avançarem.*
