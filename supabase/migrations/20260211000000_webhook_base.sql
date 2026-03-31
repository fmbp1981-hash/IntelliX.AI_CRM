-- =============================================
-- WEBHOOK BASE TABLES
-- PRD Complementar
-- Data: Fevereiro 2026
-- =============================================

CREATE TABLE IF NOT EXISTS public.integration_outbound_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  description TEXT,
  events TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.integration_outbound_endpoints ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.webhook_events_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  from_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_events_out ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES public.integration_outbound_endpoints(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.webhook_events_out(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'delivered', 'failed')),
  request_id BIGINT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies

CREATE POLICY "Org members can manage webhooks endpoints" ON public.integration_outbound_endpoints
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can view webhook events" ON public.webhook_events_out
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can view webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );
