-- =============================================
-- COMPLEMENTARY FEATURES MIGRATION
-- PRD Complementar NossoCRM v1
-- Data: Janeiro 2026
-- =============================================

-- 1. AI GOVERNANCE TABLES
-- =============================================

-- ai_usage_logs: Append-only para métricas de uso de IA
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic'
  model TEXT NOT NULL,
  tool_name TEXT,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_usage_logs_org_date 
ON public.ai_usage_logs(organization_id, created_at DESC);

-- ai_quotas: Config de quota por organização
CREATE TABLE IF NOT EXISTS public.ai_quotas (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_token_limit BIGINT DEFAULT 1000000,
  tokens_used_this_month BIGINT DEFAULT 0,
  reset_day INT DEFAULT 1,
  alert_threshold_percent INT DEFAULT 80,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;

-- 2. NOTIFICATION PREFERENCES
-- =============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'push')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'stagnation', 'activity_reminder', 'daily_summary', 
    'win_loss', 'deal_created', 'deal_stage_changed'
  )),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, channel, event_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 3. DEAL TEMPLATES
-- =============================================

CREATE TABLE IF NOT EXISTS public.deal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.boards(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  defaults JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.deal_templates ENABLE ROW LEVEL SECURITY;

-- 4. ACTIVITY SEQUENCES
-- =============================================

CREATE TABLE IF NOT EXISTS public.activity_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  trigger_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_sequences ENABLE ROW LEVEL SECURITY;

-- deal_sequence_enrollments: Track de deals em sequências
CREATE TABLE IF NOT EXISTS public.deal_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.activity_sequences(id) ON DELETE CASCADE,
  current_step INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT now(),
  next_activity_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE(deal_id, sequence_id)
);

ALTER TABLE public.deal_sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- 5. INBOX ACTION ITEMS (para tracking de execução)
-- =============================================

CREATE TABLE IF NOT EXISTS public.inbox_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'move_stage', 'schedule_meeting', 'custom')),
  title TEXT NOT NULL,
  reason TEXT,
  priority INT DEFAULT 50, -- 1-100
  suggested_script TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inbox_action_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inbox_items_user_pending 
ON public.inbox_action_items(user_id, completed, dismissed, created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

-- ai_usage_logs: Org members can view
CREATE POLICY "Org members can view ai logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service can insert ai logs" ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ai_quotas: Admin only
CREATE POLICY "Admins manage ai quotas" ON public.ai_quotas
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- notification_preferences: Own preferences
CREATE POLICY "Users manage own notification prefs" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- deal_templates: Org members
CREATE POLICY "Org members manage deal templates" ON public.deal_templates
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- activity_sequences: Org members
CREATE POLICY "Org members manage sequences" ON public.activity_sequences
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- deal_sequence_enrollments: Via deal ownership
CREATE POLICY "Access via deal" ON public.deal_sequence_enrollments
  FOR ALL TO authenticated
  USING (
    deal_id IN (
      SELECT id FROM public.deals d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- inbox_action_items: Own items only
CREATE POLICY "Users manage own inbox items" ON public.inbox_action_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Função para incrementar tokens usados no mês
CREATE OR REPLACE FUNCTION public.increment_monthly_tokens(
  p_org_id UUID,
  p_tokens BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ai_quotas (organization_id, tokens_used_this_month)
  VALUES (p_org_id, p_tokens)
  ON CONFLICT (organization_id) DO UPDATE
  SET 
    tokens_used_this_month = ai_quotas.tokens_used_this_month + p_tokens,
    updated_at = now();
END;
$$;

-- Função para resetar tokens mensais (chamada por cron)
CREATE OR REPLACE FUNCTION public.reset_monthly_ai_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ai_quotas
  SET 
    tokens_used_this_month = 0,
    last_reset_at = now(),
    updated_at = now()
  WHERE reset_day = EXTRACT(DAY FROM now());
END;
$$;

-- =============================================
-- COMMENTS (documentação)
-- =============================================

COMMENT ON TABLE public.ai_usage_logs IS 'Logs de uso de IA para métricas e billing';
COMMENT ON TABLE public.ai_quotas IS 'Quotas mensais de tokens de IA por organização';
COMMENT ON TABLE public.notification_preferences IS 'Preferências de notificação por usuário e evento';
COMMENT ON TABLE public.deal_templates IS 'Templates reutilizáveis para criação de deals';
COMMENT ON TABLE public.activity_sequences IS 'Sequências de cadência de follow-up';
COMMENT ON TABLE public.deal_sequence_enrollments IS 'Tracking de deals inscritos em sequências';
COMMENT ON TABLE public.inbox_action_items IS 'Ações priorizadas do Inbox Inteligente 2.0';
