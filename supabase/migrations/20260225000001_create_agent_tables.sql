-- =============================================
-- NossoAgent — Phase 1: Core Infrastructure
-- Migration: create_agent_tables
-- Date: 2026-02-25
-- Creates: agent_configs, conversations, messages, agent_tools_log
-- Enables: RLS, indexes, Realtime
-- =============================================

-- ============================================
-- 1. agent_configs
-- Per-org agent configuration (1:1 with organizations)
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,

  -- WhatsApp Provider
  whatsapp_provider TEXT NOT NULL DEFAULT 'evolution_api',
  whatsapp_config JSONB NOT NULL DEFAULT '{}',

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

  -- AI Config
  ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  ai_temperature DECIMAL(2,1) NOT NULL DEFAULT 0.7,
  max_tokens_per_response INT NOT NULL DEFAULT 500,
  system_prompt_override TEXT,

  -- Qualification
  qualification_fields JSONB NOT NULL DEFAULT '[]',
  auto_create_contact BOOLEAN NOT NULL DEFAULT true,
  auto_create_deal BOOLEAN NOT NULL DEFAULT true,
  default_board_id UUID REFERENCES boards(id),
  default_stage_id UUID REFERENCES board_stages(id),

  -- Transfer Rules
  transfer_rules JSONB NOT NULL DEFAULT '[]',
  max_messages_before_transfer INT DEFAULT 20,

  -- Rate Limiting
  max_conversations_simultaneous INT NOT NULL DEFAULT 50,
  cooldown_after_transfer_minutes INT NOT NULL DEFAULT 5,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_configs_tenant_isolation" ON agent_configs
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================
-- 2. conversations
-- WhatsApp conversations with leads/contacts
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- WhatsApp
  whatsapp_number TEXT NOT NULL,
  whatsapp_name TEXT,
  whatsapp_profile_pic_url TEXT,

  -- CRM Link
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),

  -- Status Machine
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'waiting_human' | 'human_active' | 'closed' | 'archived'
  assigned_agent TEXT NOT NULL DEFAULT 'ai',
  -- 'ai' | UUID of human user

  -- Qualification
  qualification_data JSONB NOT NULL DEFAULT '{}',
  qualification_status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'qualified' | 'unqualified'
  qualification_score INT,

  -- Context
  summary TEXT,
  tags JSONB DEFAULT '[]',
  detected_intent TEXT,
  sentiment TEXT DEFAULT 'neutral',
  -- 'positive' | 'neutral' | 'negative'

  -- Timestamps
  last_message_at TIMESTAMPTZ,
  last_ai_response_at TIMESTAMPTZ,
  first_response_time_ms INT,
  transferred_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_tenant_isolation" ON conversations
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_conv_org_status ON conversations(organization_id, status);
CREATE INDEX idx_conv_whatsapp ON conversations(organization_id, whatsapp_number);
CREATE INDEX idx_conv_contact ON conversations(contact_id);
CREATE INDEX idx_conv_deal ON conversations(deal_id);
CREATE INDEX idx_conv_last_msg ON conversations(organization_id, last_message_at DESC);

-- ============================================
-- 3. messages
-- Individual messages within conversations
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Sender
  role TEXT NOT NULL,
  -- 'lead' | 'ai' | 'human' | 'system'
  sender_id UUID,
  sender_name TEXT,

  -- Content
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'
  media_url TEXT,
  media_mime_type TEXT,

  -- WhatsApp
  whatsapp_message_id TEXT,
  whatsapp_status TEXT,
  -- 'sent' | 'delivered' | 'read' | 'failed'
  whatsapp_timestamp TIMESTAMPTZ,

  -- AI Metadata (populated when role = 'ai')
  ai_model TEXT,
  ai_tokens_input INT,
  ai_tokens_output INT,
  ai_cost_usd DECIMAL(10,6),
  ai_tools_used JSONB DEFAULT '[]',
  ai_reasoning TEXT,

  -- System
  is_internal_note BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_tenant_isolation" ON messages
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_msg_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_org ON messages(organization_id, created_at DESC);
CREATE INDEX idx_msg_whatsapp_id ON messages(whatsapp_message_id);

-- ============================================
-- 4. agent_tools_log
-- Audit trail of agent CRM actions
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_tools_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),

  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_tools_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_tools_log_tenant_isolation" ON agent_tools_log
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_atl_conv ON agent_tools_log(conversation_id, created_at);

-- ============================================
-- 5. Enable Supabase Realtime for live chat
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ============================================
-- 6. Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_configs_updated_at
  BEFORE UPDATE ON agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
