-- ============================================================
-- Migration: Nurturing Suggestions + Pipeline Triggers
-- Date: 2026-03-29
-- Description: nurturing_suggestions table (AI-generated contact
--              nurturing actions), pipeline_triggers table (stage
--              entry/exit automation rules), and organizations
--              nurturing config extensions.
-- Note: Stage FK uses board_stages(id) — the project-wide table name.
--       pipeline_stages does NOT exist in this codebase.
-- ============================================================

-- ── 1. nurturing_suggestions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nurturing_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  deal_id         UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  type    TEXT NOT NULL CHECK (type IN (
            'reactivation', 'seasonal', 'upsell',
            'cross_sell', 'follow_up', 'sentiment_recovery'
          )),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN (
            'low', 'medium', 'high', 'critical'
          )),

  title             TEXT NOT NULL,
  reason            TEXT NOT NULL,
  suggested_message TEXT NOT NULL,
  channel           TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),

  auto_send    BOOLEAN NOT NULL DEFAULT false,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                 'pending', 'approved', 'sent', 'dismissed', 'snoozed'
               )),

  snoozed_until TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nurturing_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON public.nurturing_suggestions;
CREATE POLICY "org_isolation" ON public.nurturing_suggestions
  FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ns_org_status
  ON public.nurturing_suggestions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_ns_contact
  ON public.nurturing_suggestions(contact_id);

CREATE INDEX IF NOT EXISTS idx_ns_urgency
  ON public.nurturing_suggestions(organization_id, urgency, status);

DROP TRIGGER IF EXISTS trg_ns_updated_at ON public.nurturing_suggestions;
CREATE TRIGGER trg_ns_updated_at
  BEFORE UPDATE ON public.nurturing_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. pipeline_triggers ──────────────────────────────────────────────────
-- NOTE: Stage FK references board_stages(id) — the correct table name used
--       throughout this codebase. There is no pipeline_stages table.

CREATE TABLE IF NOT EXISTS public.pipeline_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  board_id        UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  stage_id        UUID NOT NULL REFERENCES public.board_stages(id) ON DELETE CASCADE,

  trigger_event TEXT NOT NULL DEFAULT 'on_enter' CHECK (trigger_event IN (
                  'on_enter', 'on_exit'
                )),

  actions JSONB NOT NULL DEFAULT '[]',

  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pipeline_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON public.pipeline_triggers;
CREATE POLICY "org_isolation" ON public.pipeline_triggers
  FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pt_board_stage
  ON public.pipeline_triggers(board_id, stage_id, trigger_event);

DROP TRIGGER IF EXISTS trg_pt_updated_at ON public.pipeline_triggers;
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON public.pipeline_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. Extend organizations table ─────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS nurturing_auto_mode       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nurturing_max_auto_per_day INT DEFAULT 2 CHECK (nurturing_max_auto_per_day >= 0);
