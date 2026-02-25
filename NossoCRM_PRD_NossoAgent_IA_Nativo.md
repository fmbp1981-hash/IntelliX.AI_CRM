# NossoCRM — PRD Complementar: Agente de IA Nativo (NossoAgent)

> **Versão:** 1.0 — 24 de Fevereiro de 2026
> **Status:** Draft — Para Implementação
> **Tipo:** PRD Complementar (estende Core + PRDs Complementares existentes)
> **Confidencialidade:** Interno — IntelliX.AI

---

## IMPORTANTE: Contexto de Implementação

Este PRD é **complementar** ao core e aos PRDs anteriores. **Não redefine nem duplica** funcionalidades existentes. Assume como pré-requisitos operacionais:

**Core (branch `main`):**
- Pipeline Kanban, Contatos, Deals, Atividades, Auth, Relatórios, AI Central V1, Onboarding
- Multi-tenancy com isolamento por `organization_id`
- SSOT no cache TanStack Query

**PRD Complementar 1 — Inbox & Automações:**
- Inbox Inteligente 2.0 (Priority Score, Action Items via `inbox_action_items`, Streaks)
- AI Governance (quotas, `ai_usage_logs`, bloqueio 429)
- Webhook Events Expansion (`deal.created`, `deal.won`, `deal.lost`, `deal.stagnant`, `contact.created`, `contact.stage_changed`, `activity.completed`) via pg_net + pg_cron

**PRD Complementar 2 — Verticalização Multi-Nicho:**
- Business Profile Layer (`business_type` enum, `vertical_configs`, `custom_field_values` EAV)
- IA Contextual por Vertical (system prompts, action item templates, Priority Score ajustado)
- Feature Flags por vertical
- Tabela `vertical_properties` (imobiliárias)

**Stack:**
- Next.js 16 (App Router), React 19, TypeScript 5.x, Tailwind CSS v4, Radix UI/Shadcn, Framer Motion
- TanStack Query v5 (SSOT no cache) + Zustand
- Supabase (PostgreSQL 15+, RLS, Realtime, Edge Functions)
- Vercel AI SDK v6 (Claude, Gemini, GPT-4o)
- Deploy: Vercel (frontend/APIs Edge) + Supabase (persistência)
- Automações: pg_net + pg_cron (nativo no banco)

Este PRD **estende** essa base adicionando o Agente de IA Nativo. Nenhuma reescrita do core — apenas extensão por módulo.

---

## 1. Sumário Executivo

### 1.1 O Problema

Hoje, empresas que usam CRMs precisam de ferramentas externas para automatizar o atendimento a leads via WhatsApp. A stack típica envolve: GPT Maker ou Botpress ou Typebot para o agente de IA, n8n ou Make para orquestração de fluxos, Evolution API ou Z-API para conexão com WhatsApp, e finalmente uma integração via API ou MCP para sincronizar tudo com o CRM. Isso resulta em:

- **5+ ferramentas** para um único fluxo de atendimento
- **Custo acumulado** de assinaturas (R$200-500/mês por ferramenta)
- **Fragilidade:** Quebra em qualquer ponto da cadeia interrompe todo o fluxo
- **Contexto perdido:** O agente externo não tem acesso nativo ao histórico do CRM
- **Latência:** Cada hop entre ferramentas adiciona 200-500ms de atraso
- **Manutenção complexa:** Cada integração é um ponto de falha a ser monitorado

### 1.2 A Solução: NossoAgent

O NossoAgent é um **agente de IA nativo** dentro do NossoCRM que elimina toda a stack externa. Ele é simultaneamente:

- **Atendente de WhatsApp:** Recebe e responde mensagens em tempo real via WhatsApp Business Cloud API ou Evolution API
- **Qualificador de leads:** Coleta informações, qualifica e classifica leads automaticamente
- **Operador de CRM:** Cria contatos, move deals no pipeline, registra atividades, atualiza campos — tudo autonomamente
- **Agente conversacional:** Mantém contexto completo da conversa + histórico do CRM + configuração da vertical
- **Transferidor inteligente:** Detecta quando precisa de humano e transfere com contexto completo

Tudo isso com **zero ferramentas externas**, dentro do mesmo banco de dados, com o mesmo sistema de permissões, a mesma IA governada, e o mesmo contexto vertical.

### 1.3 Posicionamento Estratégico

| Aspecto | Stack Externa (n8n + GPT Maker + Evolution) | NossoAgent (Nativo) |
|---|---|---|
| Ferramentas necessárias | 5+ | 1 (NossoCRM) |
| Custo mensal estimado | R$400-800 | Incluído no plano |
| Tempo de setup | Dias/semanas | Minutos (onboarding) |
| Contexto do CRM | Parcial (via API) | Completo (nativo) |
| Latência de resposta | 1-3 segundos | < 500ms |
| Pontos de falha | 5+ | 1 |
| Verticalização | Manual por fluxo | Automática (Business Profile Layer) |
| Governança de IA | Sem controle | Quotas + logs nativos |

### 1.4 O Que o NossoAgent Substitui

O NossoAgent substitui, dentro do ecossistema NossoCRM, a necessidade de:

- **GPT Maker / Botpress / Typebot / Dify:** Construção e execução do agente conversacional
- **n8n / Make / Zapier:** Orquestração dos fluxos entre ferramentas
- **Evolution API / Z-API / Twilio:** Conexão com WhatsApp (mantém como provider configurável)
- **Webhook routers:** Roteamento de eventos entre sistemas
- **Integrações MCP:** Pontes entre agente e CRM

---

## 2. Arquitetura Técnica

### 2.1 Princípio Fundamental

> **REGRA DE OURO:** O NossoAgent NÃO é um chatbot separado que se integra ao CRM. Ele É o CRM conversando. Compartilha o mesmo banco, as mesmas tabelas, o mesmo RLS, o mesmo ai_context vertical, o mesmo AI Governance. O agente é uma interface conversacional do CRM, não uma ferramenta acoplada a ele.

### 2.2 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NossoCRM Platform                            │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────────┐ │
│  │ Frontend  │    │  NossoAgent  │    │    WhatsApp Provider      │ │
│  │ Dashboard │◄──►│   Engine     │◄──►│  (Cloud API / Evolution)  │ │
│  │ Chat View │    │              │    └───────────────────────────┘ │
│  └──────────┘    │  ┌────────┐  │                                  │
│                  │  │ Router │  │    ┌───────────────────────────┐ │
│  ┌──────────┐   │  │ Agent  │  │    │   Supabase Realtime       │ │
│  │ Pipeline │◄──►│  │ Tools  │  │◄──►│   (live chat updates)     │ │
│  │ Kanban   │    │  │ Memory │  │    └───────────────────────────┘ │
│  └──────────┘    │  └────────┘  │                                  │
│                  └──────────────┘                                   │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────────┐ │
│  │ Contacts │◄──►│  AI Engine   │◄──►│  Vercel AI SDK v6         │ │
│  │ Deals    │    │  (existing)  │    │  (Claude/Gemini/GPT-4o)   │ │
│  │ Activities│   └──────────────┘    └───────────────────────────┘ │
│  └──────────┘                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Supabase PostgreSQL (shared database)            │  │
│  │  organizations | contacts | deals | activities | pipelines   │  │
│  │  conversations | messages | agent_configs | ai_usage_logs    │  │
│  │  vertical_configs | custom_field_values | inbox_action_items │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Modelo de Dados

#### 2.3.1 Tabela: agent_configs

Configuração do agente por organização. Cada org tem um agente configurável.

```sql
-- Migration: create_agent_configs
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- WhatsApp Provider
  whatsapp_provider TEXT NOT NULL DEFAULT 'evolution_api',
  -- 'whatsapp_cloud_api' | 'evolution_api'
  whatsapp_config JSONB NOT NULL DEFAULT '{}',
  -- Cloud API: { phone_number_id, access_token, business_id, webhook_verify_token }
  -- Evolution: { instance_name, api_url, api_key, webhook_url }

  -- Behavior
  agent_name TEXT NOT NULL DEFAULT 'Assistente',
  welcome_message TEXT,
  farewell_message TEXT,
  transfer_message TEXT DEFAULT 'Vou transferir você para um de nossos especialistas. Um momento!',
  outside_hours_message TEXT DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos em breve!',
  
  -- Business Hours
  business_hours JSONB NOT NULL DEFAULT '{
    "monday": { "start": "08:00", "end": "18:00", "active": true },
    "tuesday": { "start": "08:00", "end": "18:00", "active": true },
    "wednesday": { "start": "08:00", "end": "18:00", "active": true },
    "thursday": { "start": "08:00", "end": "18:00", "active": true },
    "friday": { "start": "08:00", "end": "18:00", "active": true },
    "saturday": { "start": "09:00", "end": "13:00", "active": false },
    "sunday": { "start": null, "end": null, "active": false }
  }',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  attend_outside_hours BOOLEAN NOT NULL DEFAULT false,
  -- Se true, agente responde fora do horário. Se false, envia outside_hours_message.
  
  -- AI Config
  ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  ai_temperature DECIMAL(2,1) NOT NULL DEFAULT 0.7,
  max_tokens_per_response INT NOT NULL DEFAULT 500,
  system_prompt_override TEXT,
  -- Se preenchido, substitui o system_prompt_vertical. Senão, usa o da vertical.
  
  -- Qualification
  qualification_fields JSONB NOT NULL DEFAULT '[]',
  -- Campos que o agente deve coletar antes de qualificar
  -- Ex: [{ "key": "nome", "question": "Qual seu nome completo?", "required": true }]
  auto_create_contact BOOLEAN NOT NULL DEFAULT true,
  auto_create_deal BOOLEAN NOT NULL DEFAULT true,
  default_pipeline_id UUID REFERENCES pipelines(id),
  default_stage_id UUID REFERENCES pipeline_stages(id),
  
  -- Transfer Rules
  transfer_rules JSONB NOT NULL DEFAULT '[]',
  -- [{ "condition": "intent:pricing", "transfer_to": "user_id", "message": "..." }]
  max_messages_before_transfer INT DEFAULT 20,
  -- Se conversa exceder N mensagens sem resolução, sugere transferência
  
  -- Rate Limiting
  max_conversations_simultaneous INT NOT NULL DEFAULT 50,
  cooldown_after_transfer_minutes INT NOT NULL DEFAULT 5,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON agent_configs
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
```

#### 2.3.2 Tabela: conversations

Cada conversa com um lead/contato via WhatsApp.

```sql
-- Migration: create_conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- WhatsApp
  whatsapp_number TEXT NOT NULL,
  -- Número do lead no formato E.164: +5511999999999
  whatsapp_name TEXT,
  -- Nome do perfil do WhatsApp (push name)
  whatsapp_profile_pic_url TEXT,
  
  -- CRM Link
  contact_id UUID REFERENCES contacts(id),
  -- Null até o agente criar/vincular o contato
  deal_id UUID REFERENCES deals(id),
  -- Null até o agente criar/vincular o deal
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'waiting_human' | 'human_active' | 'closed' | 'archived'
  assigned_agent TEXT NOT NULL DEFAULT 'ai',
  -- 'ai' | UUID do usuário humano
  
  -- Qualification
  qualification_data JSONB NOT NULL DEFAULT '{}',
  -- Dados coletados durante qualificação: { nome: "João", email: "...", interesse: "..." }
  qualification_status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'qualified' | 'unqualified'
  qualification_score INT,
  -- 0-100, calculado pela IA
  
  -- Context
  summary TEXT,
  -- Resumo gerado por IA da conversa (atualizado periodicamente)
  tags JSONB DEFAULT '[]',
  -- Tags detectadas pela IA: ["interessado_implante", "urgente", "preço_sensível"]
  detected_intent TEXT,
  -- Intenção principal: "pricing", "scheduling", "support", "complaint", "general"
  sentiment TEXT DEFAULT 'neutral',
  -- 'positive' | 'neutral' | 'negative'
  
  -- Timestamps
  last_message_at TIMESTAMPTZ,
  last_ai_response_at TIMESTAMPTZ,
  first_response_time_ms INT,
  -- Tempo em ms entre primeira mensagem do lead e primeira resposta do agente
  transferred_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON conversations
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_conv_org_status ON conversations(organization_id, status);
CREATE INDEX idx_conv_whatsapp ON conversations(organization_id, whatsapp_number);
CREATE INDEX idx_conv_contact ON conversations(contact_id);
CREATE INDEX idx_conv_deal ON conversations(deal_id);
CREATE INDEX idx_conv_last_msg ON conversations(organization_id, last_message_at DESC);
```

#### 2.3.3 Tabela: messages

Cada mensagem individual dentro de uma conversa.

```sql
-- Migration: create_messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Sender
  role TEXT NOT NULL,
  -- 'lead' | 'ai' | 'human' | 'system'
  sender_id UUID,
  -- Null para lead, user UUID para human, null para ai/system
  sender_name TEXT,
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'
  media_url TEXT,
  media_mime_type TEXT,
  
  -- WhatsApp
  whatsapp_message_id TEXT,
  -- ID da mensagem no WhatsApp (para tracking de delivery/read)
  whatsapp_status TEXT,
  -- 'sent' | 'delivered' | 'read' | 'failed'
  whatsapp_timestamp TIMESTAMPTZ,
  
  -- AI Metadata
  ai_model TEXT,
  -- Modelo usado (se role = 'ai')
  ai_tokens_input INT,
  ai_tokens_output INT,
  ai_cost_usd DECIMAL(10,6),
  ai_tools_used JSONB DEFAULT '[]',
  -- Tools que a IA usou nesta resposta: ["create_contact", "move_deal", "schedule_activity"]
  ai_reasoning TEXT,
  -- Raciocínio interno da IA (não visível ao lead, visível ao operador)
  
  -- System
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  -- Notas internas visíveis apenas para operadores humanos
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON messages
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_msg_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_org ON messages(organization_id, created_at DESC);
CREATE INDEX idx_msg_whatsapp_id ON messages(whatsapp_message_id);

-- Habilitar Realtime para live chat
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
```

#### 2.3.4 Tabela: agent_tools_log

Log detalhado de cada ação que o agente executou no CRM.

```sql
-- Migration: create_agent_tools_log
CREATE TABLE agent_tools_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  
  tool_name TEXT NOT NULL,
  -- 'create_contact' | 'update_contact' | 'create_deal' | 'move_deal' |
  -- 'create_activity' | 'update_custom_field' | 'transfer_to_human' |
  -- 'qualify_lead' | 'search_contacts' | 'search_deals' | 'property_match'
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_tools_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON agent_tools_log
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_atl_conv ON agent_tools_log(conversation_id, created_at);
```

### 2.4 Supabase Realtime

O chat em tempo real utiliza o Supabase Realtime **já configurado** no projeto. As tabelas `messages` e `conversations` são adicionadas à publicação Realtime para que o frontend receba atualizações instantâneas.

```typescript
// hooks/useConversationRealtime.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useConversationRealtime(conversationId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Adicionar nova mensagem ao cache SSOT
          queryClient.setQueryData(
            ['messages', conversationId],
            (old: any[]) => [...(old ?? []), payload.new]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          // Atualizar status da conversa
          queryClient.setQueryData(
            ['conversation', conversationId],
            payload.new
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);
}
```

---

## 3. NossoAgent Engine — O Cérebro

### 3.1 Visão Geral

O NossoAgent Engine é uma Edge Function do Supabase que recebe mensagens do WhatsApp via webhook, processa com IA, executa ações no CRM via tools, e responde ao lead. Ele opera como um **agente com ferramentas (tool-calling)** usando o Vercel AI SDK v6.

### 3.2 Fluxo de Processamento

```
1. WEBHOOK RECEBE MENSAGEM DO WHATSAPP
   ↓
2. IDENTIFICAÇÃO
   - Busca conversa existente por whatsapp_number + organization_id
   - Se não existe: cria nova conversa (status: active, assigned: ai)
   - Se existe e status = human_active: encaminha para painel do humano, NÃO responde
   ↓
3. VERIFICAÇÃO DE HORÁRIO
   - Verifica business_hours do agent_configs
   - Se fora do horário e attend_outside_hours = false: envia outside_hours_message, PARA
   ↓
4. SALVA MENSAGEM DO LEAD
   - INSERT em messages (role: 'lead')
   - UPDATE conversations.last_message_at
   ↓
5. COMPOSIÇÃO DE CONTEXTO
   - system_prompt_base (identidade NossoAgent)
   - system_prompt_vertical (ai_context da vertical_configs, se verticalizada)
   - system_prompt_agent (agent_configs.system_prompt_override OU template padrão)
   - conversation_history (últimas N mensagens da conversa)
   - entity_context (dados do contato/deal vinculado, se houver)
   - qualification_context (campos pendentes de coleta)
   - available_tools (lista de tools que o agente pode usar)
   ↓
6. CHAMADA AO MODELO DE IA (com tool-calling)
   - Vercel AI SDK v6 com streaming
   - AI Governance: checkAiQuota() antes da chamada
   - Modelo executa raciocínio + decide se usa tools
   ↓
7. EXECUÇÃO DE TOOLS (se necessário)
   - IA decide: criar contato? mover deal? agendar atividade?
   - Cada tool é executada diretamente no banco (mesmo RLS)
   - Log em agent_tools_log
   ↓
8. RESPOSTA AO LEAD
   - Salva mensagem em messages (role: 'ai')
   - Envia via WhatsApp API (Cloud API ou Evolution)
   - Log em ai_usage_logs (AI Governance existente)
   ↓
9. PÓS-PROCESSAMENTO
   - Atualiza conversation.summary periodicamente (a cada 5 msgs)
   - Detecta sentiment e intent
   - Verifica regras de transferência
   - Se qualificação completa: auto_create_contact + auto_create_deal
```

### 3.3 System Prompt do Agente

```typescript
// lib/ai/agent-prompts.ts

export const AGENT_SYSTEM_PROMPT_BASE = `Você é o NossoAgent, o assistente de atendimento inteligente do NossoCRM.

## IDENTIDADE
- Você é um atendente profissional que representa a empresa do cliente.
- Use o nome configurado em agent_name como sua identidade.
- Nunca revele que é uma IA, a menos que perguntado diretamente (nesse caso, seja honesto).

## REGRAS DE OURO
1. NUNCA invente informações. Se não sabe, diga que vai verificar ou transfira para um humano.
2. NUNCA prometa preços, prazos ou condições sem dados concretos do CRM.
3. SEMPRE respeite o tom da vertical (saúde = empático, imobiliária = consultivo, etc.).
4. SEMPRE colete as informações de qualificação antes de avançar no pipeline.
5. Use ferramentas (tools) proativamente: crie contatos, mova deals, registre atividades.
6. Se o lead pedir algo que você não pode resolver, transfira para um humano com contexto completo.
7. Respostas devem ser concisas (máximo 3 parágrafos). WhatsApp não é email.
8. Use emojis com moderação — 1-2 por mensagem no máximo.
9. LGPD: nunca compartilhe dados de outros clientes ou informações sensíveis.

## QUALIFICAÇÃO
Quando um novo lead chegar, seu objetivo é:
1. Cumprimentar de forma acolhedora
2. Coletar os campos de qualificação configurados (qualification_fields)
3. Criar o contato no CRM quando tiver dados suficientes (use create_contact)
4. Criar o deal no pipeline quando entender o interesse (use create_deal)
5. Mover o deal conforme a conversa evolui (use move_deal)

## TRANSFERÊNCIA PARA HUMANO
Transfira quando:
- O lead pedir explicitamente para falar com uma pessoa
- Você não conseguir resolver a demanda após 3 tentativas
- Detectar reclamação séria ou situação delicada
- As regras de transferência configuradas forem ativadas
Ao transferir: use transfer_to_human com um resumo completo da conversa.

## FORMATO
- Responda em português brasileiro
- Mensagens curtas e diretas (estilo WhatsApp)
- Use parágrafos curtos, não listas longas
- Quebre mensagens longas em múltiplas mensagens menores`;
```

### 3.4 Agent Tools (Tool-Calling)

O agente possui um conjunto de ferramentas que pode invocar autonomamente durante a conversa. Cada tool opera diretamente no banco de dados do CRM com o mesmo RLS.

```typescript
// lib/ai/agent-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

export const agentTools = {
  // ── CONTATOS ──
  create_contact: tool({
    description: 'Cria um novo contato no CRM com os dados coletados do lead. Use quando tiver pelo menos nome e telefone.',
    parameters: z.object({
      name: z.string().describe('Nome completo do contato'),
      email: z.string().email().optional().describe('Email do contato'),
      phone: z.string().describe('Telefone no formato E.164'),
      company: z.string().optional().describe('Empresa do contato'),
      notes: z.string().optional().describe('Observações relevantes da conversa'),
      custom_fields: z.record(z.any()).optional().describe('Campos customizados da vertical'),
    }),
    execute: async (params, { organizationId, conversationId }) => {
      // INSERT em contacts + custom_field_values
      // UPDATE conversations SET contact_id = new_contact.id
      // Log em agent_tools_log
      // Dispara webhook contact.created (existente)
    },
  }),

  search_contacts: tool({
    description: 'Busca contatos existentes no CRM por nome, email ou telefone. Use antes de criar duplicatas.',
    parameters: z.object({
      query: z.string().describe('Termo de busca: nome, email ou telefone'),
    }),
    execute: async (params, { organizationId }) => {
      // SELECT de contacts com ILIKE
    },
  }),

  update_contact: tool({
    description: 'Atualiza dados de um contato existente.',
    parameters: z.object({
      contact_id: z.string().uuid(),
      updates: z.record(z.any()).describe('Campos a atualizar'),
    }),
    execute: async (params, { organizationId }) => {
      // UPDATE contacts + custom_field_values
    },
  }),

  // ── DEALS ──
  create_deal: tool({
    description: 'Cria um novo deal/negociação no pipeline do CRM. Use quando o lead demonstrar interesse claro em um produto ou serviço.',
    parameters: z.object({
      title: z.string().describe('Título do deal (ex: "Implante dentário - João Silva")'),
      value: z.number().optional().describe('Valor estimado em BRL'),
      contact_id: z.string().uuid().describe('ID do contato vinculado'),
      pipeline_id: z.string().uuid().optional().describe('Pipeline específico (usa default se omitido)'),
      stage_id: z.string().uuid().optional().describe('Stage inicial (usa default se omitido)'),
      custom_fields: z.record(z.any()).optional().describe('Campos customizados da vertical'),
    }),
    execute: async (params, { organizationId, conversationId, agentConfig }) => {
      // INSERT em deals (usa default_pipeline_id e default_stage_id do agent_configs se não fornecido)
      // UPDATE conversations SET deal_id = new_deal.id
      // Dispara webhook deal.created (existente)
    },
  }),

  move_deal: tool({
    description: 'Move um deal para outro stage do pipeline. Use conforme a conversa evolui (ex: de "Primeiro Contato" para "Agendamento").',
    parameters: z.object({
      deal_id: z.string().uuid(),
      stage_id: z.string().uuid().describe('ID do novo stage'),
      reason: z.string().optional().describe('Motivo da movimentação'),
    }),
    execute: async (params, { organizationId }) => {
      // UPDATE deals SET stage_id
      // INSERT activity (log de movimentação)
      // Dispara webhook deal.stage_changed (existente)
    },
  }),

  search_deals: tool({
    description: 'Busca deals existentes vinculados a um contato ou por título.',
    parameters: z.object({
      contact_id: z.string().uuid().optional(),
      query: z.string().optional(),
    }),
    execute: async (params, { organizationId }) => {
      // SELECT de deals com filtros
    },
  }),

  // ── ATIVIDADES ──
  create_activity: tool({
    description: 'Registra uma atividade/interação no CRM. Use para agendar follow-ups, registrar informações importantes, ou marcar compromissos.',
    parameters: z.object({
      title: z.string().describe('Título da atividade'),
      description: z.string().optional(),
      activity_type: z.enum(['call', 'meeting', 'task', 'note', 'whatsapp']),
      contact_id: z.string().uuid().optional(),
      deal_id: z.string().uuid().optional(),
      due_date: z.string().datetime().optional().describe('Data de vencimento (ISO 8601)'),
    }),
    execute: async (params, { organizationId }) => {
      // INSERT em activities
      // Dispara webhook activity.completed se aplicável
    },
  }),

  // ── QUALIFICAÇÃO ──
  qualify_lead: tool({
    description: 'Marca o lead como qualificado ou não qualificado com base nos dados coletados.',
    parameters: z.object({
      qualified: z.boolean(),
      score: z.number().min(0).max(100).describe('Score de qualificação (0-100)'),
      reason: z.string().describe('Justificativa da qualificação'),
      collected_data: z.record(z.any()).describe('Dados coletados na qualificação'),
    }),
    execute: async (params, { organizationId, conversationId }) => {
      // UPDATE conversations SET qualification_status, qualification_score, qualification_data
      // Se qualified e auto_create_contact: chama create_contact
      // Se qualified e auto_create_deal: chama create_deal
      // Gera action_item na Inbox (existente) para follow-up humano
    },
  }),

  // ── TRANSFERÊNCIA ──
  transfer_to_human: tool({
    description: 'Transfere a conversa para um atendente humano. Use quando não conseguir resolver a demanda ou quando o lead pedir.',
    parameters: z.object({
      reason: z.string().describe('Motivo da transferência'),
      summary: z.string().describe('Resumo completo da conversa para o humano'),
      transfer_to: z.string().uuid().optional().describe('ID do usuário específico (opcional)'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    }),
    execute: async (params, { organizationId, conversationId }) => {
      // UPDATE conversations SET status = 'waiting_human', assigned_agent = transfer_to
      // INSERT message (role: 'system', content: "Conversa transferida: {reason}")
      // Envia transfer_message ao lead via WhatsApp
      // Gera action_item CRÍTICO na Inbox (existente)
      // Notifica humano via Supabase Realtime
    },
  }),

  // ── VERTICAIS ESPECÍFICAS ──
  property_match: tool({
    description: '[IMOBILIÁRIA] Busca imóveis compatíveis com as preferências do cliente.',
    parameters: z.object({
      property_type: z.string().optional(),
      transaction_type: z.enum(['venda', 'locacao']).optional(),
      min_value: z.number().optional(),
      max_value: z.number().optional(),
      bedrooms: z.number().optional(),
      region: z.string().optional(),
    }),
    execute: async (params, { organizationId }) => {
      // SELECT de vertical_properties com filtros
      // Calcula score de compatibilidade
      // Retorna top 5 matches
    },
  }),

  check_availability: tool({
    description: '[CLÍNICAS] Verifica disponibilidade de horários para agendamento.',
    parameters: z.object({
      professional_id: z.string().uuid().optional().describe('ID do profissional'),
      date: z.string().describe('Data desejada (YYYY-MM-DD)'),
      period: z.enum(['manha', 'tarde', 'qualquer']).default('qualquer'),
    }),
    execute: async (params, { organizationId }) => {
      // Consulta agenda (deals com data_agendamento no dia)
      // Retorna horários disponíveis
    },
  }),

  update_custom_field: tool({
    description: 'Atualiza um campo customizado da vertical em um contato ou deal.',
    parameters: z.object({
      entity_type: z.enum(['contact', 'deal']),
      entity_id: z.string().uuid(),
      field_key: z.string(),
      field_value: z.any(),
    }),
    execute: async (params, { organizationId }) => {
      // UPSERT em custom_field_values
    },
  }),
};
```

### 3.5 Contexto Vertical do Agente

O NossoAgent herda automaticamente o contexto da vertical ativa. Isso significa que o mesmo engine se comporta de maneira completamente diferente dependendo do `business_type`.

```typescript
// lib/ai/agent-vertical-context.ts

export const AGENT_VERTICAL_PROMPTS = {
  medical_clinic: `
## CONTEXTO DE VERTICAL: CLÍNICA MÉDICA
- Você atende PACIENTES (não "clientes")
- Deals são ATENDIMENTOS
- Tom: empático, acolhedor, nunca comercial agressivo
- PRIORIDADE: agendar consulta o mais rápido possível
- QUALIFICAÇÃO: nome, convênio, especialidade desejada, urgência
- LGPD CRÍTICA: nunca peça ou mencione diagnósticos, exames ou dados clínicos por WhatsApp
- TOOLS PRIORITÁRIOS: check_availability, create_contact, create_deal (como Atendimento)
- Ao agendar: confirme data, hora, médico, e orientações de preparo
- Se urgência médica: oriente a ir ao pronto-socorro IMEDIATAMENTE e transfira`,

  dental_clinic: `
## CONTEXTO DE VERTICAL: CLÍNICA ODONTOLÓGICA
- Você atende PACIENTES interessados em tratamentos
- Deals são PLANOS DE TRATAMENTO
- Tom: consultivo, profissional, foco em benefícios de saúde + estética
- PRIORIDADE: apresentar opções de tratamento e facilitar aprovação de orçamento
- QUALIFICAÇÃO: nome, tipo de tratamento desejado, tem plano odontológico?, disponibilidade
- Ao falar de valores: sempre mencione opções de parcelamento
- TOOLS PRIORITÁRIOS: create_contact, create_deal (como Plano de Tratamento), check_availability
- Se orçamento solicitado: crie deal e transfira para dentista preparar orçamento detalhado`,

  real_estate: `
## CONTEXTO DE VERTICAL: IMOBILIÁRIA
- Você atende CLIENTES interessados em imóveis
- Deals são NEGOCIAÇÕES
- Tom: consultivo, profissional, conhecedor do mercado
- PRIORIDADE: entender preferências e fazer match com imóveis disponíveis
- QUALIFICAÇÃO: nome, tipo de imóvel, região, faixa de orçamento, quartos, financiamento
- TOOLS PRIORITÁRIOS: property_match, create_contact, create_deal (como Negociação)
- Ao sugerir imóveis: seja específico (endereço, m², valor, destaques)
- Ofereça agendamento de visita proativamente
- Após visita: colete feedback e sugira alternativas se necessário`,

  generic: `
## CONTEXTO DE VERTICAL: GENÉRICO (B2B)
- Atendimento profissional padrão B2B
- QUALIFICAÇÃO: nome, empresa, cargo, interesse, orçamento estimado
- TOOLS PRIORITÁRIOS: create_contact, create_deal, qualify_lead
- Foco em entender a necessidade e encaminhar para o vendedor certo`,
};
```

---

## 4. Integração WhatsApp

### 4.1 Providers Suportados

O NossoAgent suporta dois providers de WhatsApp, configuráveis por organização:

| Provider | Tipo | Custo | Setup | Recomendado Para |
|---|---|---|---|---|
| **WhatsApp Cloud API** | Oficial Meta | Por mensagem (~$0.01-0.05) | Complexo (Meta Business Manager + verificação) | Empresas maiores, alto volume |
| **Evolution API** | Open-source | Self-hosted (grátis) ou cloud | Simples (QR Code ou token) | PMEs, MVP, testes |

### 4.2 Edge Function: agent-webhook

Endpoint que recebe todas as mensagens do WhatsApp (de qualquer provider) e roteia para o NossoAgent Engine.

```typescript
// supabase/functions/agent-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('org');
  const provider = url.searchParams.get('provider'); // 'cloud_api' | 'evolution'

  // GET = Webhook verification (Cloud API)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Verificar token contra agent_configs.whatsapp_config.webhook_verify_token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: config } = await supabase
      .from('agent_configs')
      .select('whatsapp_config')
      .eq('organization_id', orgId)
      .single();

    if (mode === 'subscribe' && token === config?.whatsapp_config?.webhook_verify_token) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST = Incoming message
  const body = await req.json();

  // Normalizar payload (abstrair diferenças entre providers)
  const normalized = normalizeWebhookPayload(body, provider);
  
  if (!normalized || !normalized.message) {
    return new Response('OK', { status: 200 }); // Acknowledge status updates
  }

  // Encaminhar para o Agent Engine
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-engine`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization_id: orgId,
        whatsapp_number: normalized.from,
        whatsapp_name: normalized.pushName,
        message_content: normalized.message,
        content_type: normalized.type,
        media_url: normalized.mediaUrl,
        whatsapp_message_id: normalized.messageId,
        whatsapp_timestamp: normalized.timestamp,
      }),
    }
  );

  return new Response('OK', { status: 200 });
});

function normalizeWebhookPayload(body: any, provider: string) {
  if (provider === 'cloud_api') {
    // Meta Cloud API format
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null;

    return {
      from: msg.from,
      pushName: value?.contacts?.[0]?.profile?.name,
      message: msg.text?.body ?? msg.caption ?? '[mídia]',
      type: msg.type, // text, image, audio, video, document, etc.
      mediaUrl: msg.image?.id ?? msg.audio?.id ?? msg.video?.id ?? msg.document?.id,
      messageId: msg.id,
      timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
    };
  }

  if (provider === 'evolution') {
    // Evolution API v2 format
    const data = body?.data;
    if (!data?.message) return null;

    return {
      from: data.key?.remoteJid?.replace('@s.whatsapp.net', ''),
      pushName: data.pushName,
      message: data.message?.conversation
        ?? data.message?.extendedTextMessage?.text
        ?? data.message?.imageMessage?.caption
        ?? '[mídia]',
      type: data.messageType ?? 'text',
      mediaUrl: data.message?.imageMessage?.url
        ?? data.message?.audioMessage?.url
        ?? data.message?.videoMessage?.url,
      messageId: data.key?.id,
      timestamp: new Date(data.messageTimestamp * 1000).toISOString(),
    };
  }

  return null;
}
```

### 4.3 Edge Function: agent-send-message

Envia mensagens de volta ao lead via WhatsApp.

```typescript
// supabase/functions/agent-send-message/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { organization_id, to, message, provider, config } = await req.json();

  let result;

  if (provider === 'whatsapp_cloud_api') {
    // Meta Cloud API
    result = await fetch(
      `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
  }

  if (provider === 'evolution_api') {
    // Evolution API v2
    result = await fetch(
      `${config.api_url}/message/sendText/${config.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': config.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: to,
          text: message,
        }),
      }
    );
  }

  const data = await result.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 4.4 Edge Function: agent-engine

O coração do sistema — processa mensagens e gera respostas via IA com tool-calling.

```typescript
// supabase/functions/agent-engine/index.ts (estrutura simplificada)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

serve(async (req) => {
  const {
    organization_id, whatsapp_number, whatsapp_name,
    message_content, content_type, whatsapp_message_id,
  } = await req.json();

  const supabase = createClient(/* ... */);

  // 1. Buscar ou criar conversa
  let conversation = await findOrCreateConversation(
    supabase, organization_id, whatsapp_number, whatsapp_name
  );

  // 2. Verificar se é conversa com humano (não intervir)
  if (conversation.status === 'human_active') {
    await saveMessage(supabase, conversation.id, organization_id, {
      role: 'lead', content: message_content, content_type,
      whatsapp_message_id,
    });
    return new Response('OK'); // Humano verá via Realtime
  }

  // 3. Buscar config do agente
  const agentConfig = await getAgentConfig(supabase, organization_id);
  if (!agentConfig.is_active) return new Response('Agent disabled');

  // 4. Verificar horário comercial
  if (!isWithinBusinessHours(agentConfig) && !agentConfig.attend_outside_hours) {
    await sendWhatsAppMessage(agentConfig, whatsapp_number, agentConfig.outside_hours_message);
    return new Response('Outside hours');
  }

  // 5. Salvar mensagem do lead
  await saveMessage(supabase, conversation.id, organization_id, {
    role: 'lead', content: message_content, content_type,
    whatsapp_message_id,
  });

  // 6. Compor contexto
  const systemPrompt = await composeAgentPrompt(
    supabase, organization_id, agentConfig, conversation
  );
  const history = await getConversationHistory(supabase, conversation.id, 20);
  const tools = buildToolsForVertical(organization_id, conversation, agentConfig);

  // 7. AI Governance: check quota
  await checkAiQuota(supabase, organization_id);

  // 8. Gerar resposta com tool-calling
  const anthropic = createAnthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  const result = await generateText({
    model: anthropic(agentConfig.ai_model),
    system: systemPrompt,
    messages: history.map(m => ({
      role: m.role === 'lead' ? 'user' : 'assistant',
      content: m.content,
    })),
    tools,
    maxSteps: 5, // Permite até 5 tool calls em sequência
    temperature: agentConfig.ai_temperature,
    maxTokens: agentConfig.max_tokens_per_response,
  });

  // 9. Salvar resposta e enviar
  const aiResponse = result.text;
  await saveMessage(supabase, conversation.id, organization_id, {
    role: 'ai', content: aiResponse, content_type: 'text',
    ai_model: agentConfig.ai_model,
    ai_tokens_input: result.usage.promptTokens,
    ai_tokens_output: result.usage.completionTokens,
    ai_tools_used: result.toolCalls?.map(tc => tc.toolName) ?? [],
    ai_reasoning: result.reasoning,
  });

  await sendWhatsAppMessage(agentConfig, whatsapp_number, aiResponse);

  // 10. Log AI usage (governance existente)
  await logAiUsage(supabase, {
    organization_id,
    action: 'agent_response',
    model: agentConfig.ai_model,
    tokens_input: result.usage.promptTokens,
    tokens_output: result.usage.completionTokens,
  });

  // 11. Pós-processamento
  await postProcess(supabase, conversation, result);

  return new Response('OK');
});
```

---

## 5. Interface do Frontend — Chat Dashboard

### 5.1 Nova Rota: /conversas

O NossoAgent adiciona uma nova rota principal ao CRM:

| Rota | Arquivo | Descrição |
|---|---|---|
| `/conversas` | `src/pages/Conversations.tsx` | Dashboard de conversas em tempo real |
| `/conversas/:id` | `src/pages/ConversationDetail.tsx` | Detalhe de uma conversa com chat |
| `/configuracoes/agente` | `src/pages/AgentSettings.tsx` | Configuração do NossoAgent |

### 5.2 Layout do Chat Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ NossoCRM  │  🟢 NossoAgent Ativo  │  12 conversas ativas           │
├───────────┼────────────────────────────────────────┼────────────────┤
│ CONVERSAS │          CHAT                          │  CONTEXTO CRM  │
│           │                                        │                │
│ 🔴 João   │  João (Lead)            14:32          │ ┌────────────┐ │
│ Aguardand│  Olá, gostaria de saber │              │ │ CONTATO    │ │
│           │  sobre implantes        │              │ │ João Silva │ │
│ 🟢 Maria  │                         │              │ │ +5511...   │ │
│ IA atende│  NossoAgent             14:32          │ │ Conv: Unim │ │
│           │  Olá João! 😊 Que bom   │              │ └────────────┘ │
│ 🟡 Pedro  │  receber você! Sou a    │              │                │
│ Qualific.│  assistente da Clínica.  │              │ ┌────────────┐ │
│           │  Implantes é uma ótima  │              │ │ DEAL       │ │
│ 🔵 Ana    │  escolha! Antes de      │              │ │ Implante   │ │
│ Encerrada│  mais nada, pode me      │              │ │ R$ 5.000   │ │
│           │  dizer seu nome completo?│              │ │ Stage: Aval│ │
│           │                         │              │ └────────────┘ │
│           │  João                   14:33          │                │
│           │  João Silva             │              │ ┌────────────┐ │
│           │                         │              │ │ QUALIFICAÇÃ│ │
│           │  NossoAgent             14:33          │ │ ✅ Nome     │ │
│           │  Perfeito, João! Você   │              │ │ ⬜ Convênio │ │
│           │  possui algum convênio  │              │ │ ⬜ Urgência │ │
│           │  odontológico?          │              │ └────────────┘ │
│           │                         │              │                │
│           │ ┌─────────────────────┐ │              │ ┌────────────┐ │
│           │ │ Assumir │ Transferir│ │              │ │ TOOLS LOG  │ │
│           │ └─────────────────────┘ │              │ │ create_cont│ │
│           │ ┌─────────────────────┐ │              │ │ create_deal│ │
│           │ │ Digite uma nota...  │ │              │ │ move_deal  │ │
│           │ └─────────────────────┘ │              │ └────────────┘ │
└───────────┴────────────────────────────────────────┴────────────────┘
```

### 5.3 Componentes Principais

| Componente | Responsabilidade |
|---|---|
| `ConversationsList` | Lista de conversas com filtros por status, busca, ordenação por última mensagem |
| `ConversationChat` | Interface de chat em tempo real com scroll infinito e Supabase Realtime |
| `ConversationContext` | Painel lateral com dados do CRM: contato, deal, qualificação, tools log |
| `ConversationActions` | Botões de ação: Assumir (humano toma controle), Transferir, Encerrar, Reativar IA |
| `AgentConfigPanel` | Configuração completa do agente: provider, horários, prompts, qualificação |
| `ConversationFilters` | Filtros: status (ativo, aguardando humano, encerrado), assigned (IA, humano), qualificação |
| `MessageBubble` | Bolha de mensagem estilizada por role (lead, ai, human, system) |
| `ToolExecutionBadge` | Badge inline mostrando tools executados pela IA em cada resposta |
| `QualificationProgress` | Barra de progresso dos campos de qualificação coletados |

### 5.4 Estados de Conversa

```
                    ┌──────────┐
        Nova msg →  │  ACTIVE  │ ← IA respondendo automaticamente
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐  transfer_to_human()
        │ ACTIVE   │ │ ACTIVE   │       │
        │ (IA)     │ │ (IA)     │       ▼
        └──────────┘ └──────────┘ ┌──────────────┐
                                  │ WAITING_HUMAN │ ← Aguardando humano assumir
                                  └──────┬───────┘
                                         │
                                  Humano assume │
                                         ▼
                                  ┌──────────────┐
                                  │ HUMAN_ACTIVE  │ ← Humano no controle
                                  └──────┬───────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                   Devolver para IA   Encerrar    Continuar
                          │              │
                          ▼              ▼
                    ┌──────────┐   ┌──────────┐
                    │  ACTIVE  │   │  CLOSED  │
                    │  (IA)    │   └──────────┘
                    └──────────┘         │
                                        ▼
                                  ┌──────────┐
                                  │ ARCHIVED │ ← Após 30 dias sem atividade
                                  └──────────┘
```

### 5.5 Ações do Operador Humano

| Ação | Comportamento |
|---|---|
| **Assumir Conversa** | Muda status para `human_active`. IA para de responder. Humano digita diretamente no chat. Mensagens vão via WhatsApp. |
| **Devolver para IA** | Muda status para `active`. IA retoma com contexto completo (incluindo mensagens do humano). |
| **Adicionar Nota Interna** | Insere mensagem com `is_internal_note = true`. Visível apenas no dashboard, não enviada ao lead. |
| **Transferir para Outro Humano** | Muda `assigned_agent` para outro user UUID. Notifica via Realtime. |
| **Encerrar Conversa** | Muda status para `closed`. Envia farewell_message ao lead. Gera resumo final via IA. |
| **Vincular a Contato Existente** | Associa `conversations.contact_id` a um contato já existente no CRM. |
| **Vincular a Deal Existente** | Associa `conversations.deal_id` a um deal já existente no CRM. |

---

## 6. Configuração do Agente (UI)

### 6.1 Página: /configuracoes/agente

Interface completa de configuração organizada em tabs:

#### Tab 1: Conexão WhatsApp

- Seleção de provider: Cloud API vs. Evolution API
- **Cloud API:** campos para Phone Number ID, Access Token, Business ID, Webhook Verify Token
- **Evolution API:** campos para Instance Name, API URL, API Key
- Botão "Testar Conexão" que verifica a conectividade
- Status do webhook: ativo/inativo com URL gerada automaticamente
- Formato da URL: `https://{SUPABASE_URL}/functions/v1/agent-webhook?org={ORG_ID}&provider={PROVIDER}`

#### Tab 2: Comportamento

- Nome do agente (texto)
- Mensagem de boas-vindas (textarea com variáveis: `{nome_lead}`, `{nome_empresa}`)
- Mensagem de despedida
- Mensagem de transferência
- Mensagem fora do horário
- Modelo de IA (select: Claude Sonnet 4, Claude Haiku, GPT-4o, Gemini)
- Temperatura (slider 0.0 - 1.0)
- System prompt customizado (textarea, override do vertical)

#### Tab 3: Horário Comercial

- Grid visual 7 dias × horário início/fim
- Toggle ativo/inativo por dia
- Toggle "Atender fora do horário" (agente responde mesmo fora)
- Seleção de timezone

#### Tab 4: Qualificação

- Lista de campos de qualificação (drag & drop para reordenar)
- Cada campo: key, pergunta, tipo (text, select, boolean), obrigatório
- Toggle: "Criar contato automaticamente após qualificação"
- Toggle: "Criar deal automaticamente após qualificação"
- Pipeline e stage padrão para novos deals (selects)

#### Tab 5: Transferência

- Regras de transferência (lista editável)
- Cada regra: condição (intent, keyword, sentiment), transferir para (user select), mensagem
- Limite de mensagens antes de sugerir transferência (number)
- Cooldown após transferência (minutes)

#### Tab 6: Métricas

- Conversas ativas / totais
- Tempo médio de primeira resposta
- Taxa de qualificação
- Taxa de transferência para humano
- Satisfação estimada (sentiment analysis)
- Tokens consumidos / custo (integrado com AI Governance existente)

---

## 7. Automações e Integração com CRM Existente

### 7.1 Integração com Inbox Inteligente 2.0

O NossoAgent gera action items na Inbox **existente** (`inbox_action_items`) automaticamente:

| Evento | Action Item Gerado | Prioridade |
|---|---|---|
| Nova conversa iniciada | "Novo lead via WhatsApp: {nome}" | Medium |
| Qualificação completa | "Lead qualificado: {nome} — Score: {score}" | High |
| Transferência para humano | "Conversa transferida: {motivo}" | Critical |
| Conversa sem resposta > 1h | "Lead aguardando: {nome} — última msg há {X}min" | High |
| Lead retorna após conversa fechada | "Lead reativado: {nome} — nova mensagem" | High |
| Sentiment negativo detectado | "Alerta: lead insatisfeito — {nome}" | Critical |

### 7.2 Integração com Webhook Events

Os webhooks **existentes** são disparados normalmente quando o agente executa ações:

| Ação do Agente | Webhook Disparado |
|---|---|
| `create_contact` | `contact.created` → Comportamento verticalizado ativo |
| `create_deal` | `deal.created` → Pipeline template verticalizado |
| `move_deal` | `deal.stage_changed` → Automações de stage ativas |
| `qualify_lead` + auto_create | `contact.created` + `deal.created` em sequência |

### 7.3 Integração com AI Governance

Toda chamada de IA do agente passa pelo AI Governance **existente**:

- `checkAiQuota()` antes de cada resposta
- `logAiUsage()` após cada resposta com modelo, tokens, custo
- Se quota excedida (HTTP 429): agente envia mensagem padrão "Nosso atendimento automático está temporariamente indisponível. Um de nossos atendentes entrará em contato em breve." e gera action item crítico na Inbox.

### 7.4 Integração com Verticalização

O agente carrega automaticamente:

- `ai_context.system_prompt_vertical` da `vertical_configs`
- `AGENT_VERTICAL_PROMPTS[business_type]` para comportamento específico
- Tools verticais específicos (ex: `property_match` só para imobiliárias, `check_availability` só para clínicas)
- Feature flags determinam quais tools estão disponíveis

---

## 8. Edge Functions Necessárias

| Função | Path | JWT | Descrição |
|---|---|---|---|
| `agent-webhook` | `functions/agent-webhook/` | false* | Recebe webhooks do WhatsApp. *JWT desabilitado pois Meta/Evolution enviam sem auth. Validação por verify_token. |
| `agent-engine` | `functions/agent-engine/` | true | Processa mensagem, gera resposta com IA, executa tools. Chamado internamente. |
| `agent-send-message` | `functions/agent-send-message/` | true | Envia mensagem via WhatsApp (Cloud API ou Evolution). |
| `agent-media-handler` | `functions/agent-media-handler/` | true | Processa mídia recebida (imagem, áudio, documento). Download + armazenamento + análise via IA Vision. |
| `agent-summary` | `functions/agent-summary/` | true | Gera/atualiza resumo da conversa periodicamente. Chamado por pg_cron. |

---

## 9. Migrations Necessárias

| # | Migration | Descrição |
|---|---|---|
| 1 | `create_agent_configs` | Tabela `agent_configs` + RLS + índice org_id |
| 2 | `create_conversations` | Tabela `conversations` + RLS + índices + Realtime |
| 3 | `create_messages` | Tabela `messages` + RLS + índices + Realtime |
| 4 | `create_agent_tools_log` | Tabela `agent_tools_log` + RLS + índice |
| 5 | `setup_agent_cron_jobs` | pg_cron: resumo periódico, cleanup de conversas arquivadas, alerta de conversas sem resposta |
| 6 | `add_sidebar_conversations` | Adiciona "Conversas" ao menu lateral do frontend |

---

## 10. Plano de Implementação

### 10.1 Fases de Entrega

| Fase | Escopo | Duração Est. | Dependências |
|---|---|---|---|
| **1 — Infraestrutura** | Tabelas (agent_configs, conversations, messages, agent_tools_log), migrations, RLS, Realtime | 1 semana | Nenhuma |
| **2 — Webhook + Provider** | Edge Functions agent-webhook e agent-send-message. Normalização Cloud API + Evolution. Teste de envio/recebimento. | 1 semana | Fase 1 |
| **3 — Agent Engine Core** | Edge Function agent-engine: composição de prompt, tool-calling básico (create_contact, create_deal, transfer), integração AI Governance. | 2 semanas | Fases 1-2 |
| **4 — Agent Tools Completo** | Todos os tools: move_deal, create_activity, search, qualify_lead, update_custom_field. Tools verticais (property_match, check_availability). | 1.5 semanas | Fase 3 |
| **5 — Frontend Chat** | Página /conversas, ConversationsList, ConversationChat com Realtime, ConversationContext, ações do operador. | 2 semanas | Fases 1-3 |
| **6 — Configuração UI** | Página /configuracoes/agente com todas as tabs. Teste de conexão. Qualificação configurável. | 1 semana | Fases 1-2 |
| **7 — Integrações CRM** | Integração completa com Inbox, Webhooks, AI Governance, Verticalização. Action items automáticos. | 1 semana | Fases 3-4 |
| **8 — Mídia + Extras** | Edge Function agent-media-handler (imagem, áudio, documento). Resumo automático. Métricas. | 1 semana | Fases 3-5 |
| **9 — Polish + QA** | Testes E2E, edge cases, performance, rate limiting, documentação. | 1 semana | Todas |

**Estimativa total:** 11.5 semanas (~3 meses) para entrega completa. A Fase 3 já entrega um agente funcional respondendo via WhatsApp.

### 10.2 MVP Mínimo (Fases 1-3)

Um MVP funcional pode ser entregue em **~4 semanas** com: recebimento de mensagens via WhatsApp, resposta via IA com contexto vertical, criação automática de contatos e deals, e transferência para humano. O frontend pode usar uma interface simplificada inicialmente.

---

## 11. Feature Flags

O NossoAgent é controlado por feature flags, permitindo ativação gradual:

| Feature Flag | Descrição | Default |
|---|---|---|
| `agent_enabled` | Habilita módulo NossoAgent na org | false |
| `agent_whatsapp_cloud_api` | Permite provider Cloud API | true |
| `agent_whatsapp_evolution` | Permite provider Evolution API | true |
| `agent_auto_qualify` | Qualificação automática pelo agente | true |
| `agent_auto_create_contact` | Criação automática de contato | true |
| `agent_auto_create_deal` | Criação automática de deal | true |
| `agent_media_support` | Suporte a mídia (imagem, áudio, doc) | false |
| `agent_human_takeover` | Permite humano assumir conversas | true |
| `agent_vertical_tools` | Habilita tools específicos da vertical | true |
| `agent_sentiment_analysis` | Análise de sentimento em tempo real | false |

---

## 12. Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---|---|---|
| Tempo de primeira resposta | < 3 segundos | `messages.created_at` (role=ai) - `messages.created_at` (role=lead, primeiro da conversa) |
| Taxa de qualificação automática | > 60% | Conversas com `qualification_status = 'qualified'` / total |
| Taxa de resolução sem humano | > 70% | Conversas que fecharam sem `status = 'human_active'` / total |
| Leads convertidos em contatos | > 80% | Conversas com `contact_id IS NOT NULL` / total |
| Leads convertidos em deals | > 50% | Conversas com `deal_id IS NOT NULL` / total |
| CSAT estimado | > 4.0/5.0 | Sentiment analysis das últimas mensagens do lead |
| Custo por conversa | < R$0.50 | `ai_usage_logs` filtrado por `action = 'agent_response'` / total conversas |
| Uptime do agente | > 99.5% | Monitoring do webhook endpoint |

---

## 13. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Agente responde incorretamente / alucina | Alta | System prompts rigorosos. Regra: "nunca invente informações". Transfer automático se incerteza > threshold. Log completo para auditoria. Temperature conservadora (0.7). |
| WhatsApp bloqueia número por spam | Alta | Rate limiting por lead (máx 3 msgs não respondidas). Respeito à janela de 24h. Não enviar mensagens proativas sem opt-in. Template messages para primeiro contato. |
| Latência alta na resposta (> 5s) | Média | Edge Functions com cold start < 500ms. Modelo otimizado (Sonnet/Haiku vs. Opus). Resposta em streaming quando possível. Queue de mensagens para picos. |
| Custo de IA alto em volume | Média | AI Governance com quotas por org. Default para Haiku (barato) com upgrade para Sonnet em conversas complexas. Cache de respostas frequentes. |
| LGPD: dados sensíveis no WhatsApp | Média | System prompt proíbe compartilhar dados clínicos/financeiros. Criptografia de campos sensíveis. Log de auditoria. Política de retenção (auto-archive após 90 dias). |
| Provider WhatsApp indisponível | Média | Suporte dual-provider. Se Cloud API cair, pode alternar para Evolution (e vice-versa). Fila de mensagens com retry. |
| Conversa "infinita" sem resolução | Baixa | `max_messages_before_transfer` (default: 20). Após N msgs, agente sugere transferência. Timeout de inatividade (30min). |
| Conflito humano/IA na mesma conversa | Baixa | Status machine rigoroso. Se `human_active`, IA não responde. Se `active`, humano não pode digitar sem "Assumir". |

---

## 14. Roadmap Futuro (Pós-MVP)

### Fase 2 — Inteligência Avançada

- Detecção de intenção com classificação automática (pricing, support, scheduling, complaint)
- Análise de sentimento em tempo real com alerta
- Respostas sugeridas para operador humano (copilot)
- Templates de mensagens rápidas para humanos
- FAQ automático: respostas instantâneas para perguntas frequentes sem chamar IA

### Fase 3 — Outbound

- Mensagens proativas para leads (respeitando opt-in e janela 24h)
- Campanhas de reativação via WhatsApp (integrado com Inbox)
- Template messages do WhatsApp (pré-aprovados pela Meta)
- Sequências automáticas de follow-up

### Fase 4 — Omnichannel

- Instagram Direct (usando Instagram Messaging API)
- Facebook Messenger
- Webchat embeddável (widget para site do cliente)
- Telegram Bot
- Email (via SMTP/IMAP)

### Fase 5 — Analytics

- Dashboard de analytics dedicado: volume, resolução, CSAT, custo
- Transcrição e análise de áudios via Whisper
- Relatório de perguntas mais frequentes
- A/B testing de system prompts
- Training loop: feedback humano melhora o agente

---

*NossoCRM — PRD Complementar: Agente de IA Nativo (NossoAgent) v1.0*
*IntelliX.AI — Documento gerado em 24 de Fevereiro de 2026*
*Este PRD é um documento vivo e será atualizado conforme as fases de implementação avançarem.*
