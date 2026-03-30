-- ============================================================
-- Migration: Customer Intelligence Schema
-- Date: 2026-03-29
-- Description: contact_behavioral_profile table (RFM, churn risk,
--              AI insights), deals extensions (product_name,
--              product_category, closing_probability, closing_factors),
--              conversations extensions (sentiment_score,
--              sentiment_history).
-- Note: conversations.sentiment (TEXT) already exists — skipping
--       current_sentiment to avoid conflict. Only sentiment_score
--       and sentiment_history are added as net-new columns.
-- ============================================================

-- ── 1. contact_behavioral_profile ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_behavioral_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),

  -- Ticket e receita
  avg_ticket            NUMERIC(12,2) DEFAULT 0,
  total_revenue         NUMERIC(12,2) DEFAULT 0,
  deals_won_count       INT DEFAULT 0,

  -- Produtos e categorias
  preferred_products    JSONB DEFAULT '[]',
  preferred_categories  JSONB DEFAULT '[]',

  -- Sazonalidade
  peak_months           JSONB DEFAULT '[]',

  -- RFM Score
  rfm_recency           INT DEFAULT 1 CHECK (rfm_recency BETWEEN 1 AND 5),
  rfm_frequency         INT DEFAULT 1 CHECK (rfm_frequency BETWEEN 1 AND 5),
  rfm_monetary          INT DEFAULT 1 CHECK (rfm_monetary BETWEEN 1 AND 5),
  rfm_score             INT GENERATED ALWAYS AS (rfm_recency + rfm_frequency + rfm_monetary) STORED,

  -- Risco de churn
  churn_risk            TEXT DEFAULT 'unknown'
                          CHECK (churn_risk IN ('low', 'medium', 'high', 'churned', 'unknown')),
  days_since_last_purchase INT DEFAULT 0,
  last_purchase_date    TIMESTAMPTZ,

  -- Melhor horário de contato
  best_contact_days     INT[] DEFAULT '{}',
  best_contact_hours    INT[] DEFAULT '{}',
  response_rate         NUMERIC(5,2) DEFAULT 0,

  -- Insights IA
  ai_insights           JSONB DEFAULT '{}',

  -- Metadata
  last_computed_at      TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(contact_id)
);

ALTER TABLE public.contact_behavioral_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.contact_behavioral_profile
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_cbp_org
  ON public.contact_behavioral_profile(organization_id);

CREATE INDEX IF NOT EXISTS idx_cbp_rfm
  ON public.contact_behavioral_profile(organization_id, rfm_score DESC);

CREATE INDEX IF NOT EXISTS idx_cbp_churn
  ON public.contact_behavioral_profile(organization_id, churn_risk);

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION update_contact_behavioral_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cbp_updated_at
  BEFORE UPDATE ON public.contact_behavioral_profile
  FOR EACH ROW EXECUTE FUNCTION update_contact_behavioral_profile_updated_at();

-- ── 2. Extend deals table ──────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS product_name          TEXT,
  ADD COLUMN IF NOT EXISTS product_category      TEXT,
  ADD COLUMN IF NOT EXISTS closing_probability   INT DEFAULT 0
    CHECK (closing_probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS closing_factors       JSONB DEFAULT '{}';

-- ── 3. Extend conversations table ─────────────────────────────────────────
-- NOTE: conversations.sentiment (TEXT) already exists (added in
-- 20260225000001_create_agent_tables.sql). Only sentiment_score and
-- sentiment_history are added here as new columns.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sentiment_score    INT DEFAULT 0
    CHECK (sentiment_score BETWEEN -100 AND 100),
  ADD COLUMN IF NOT EXISTS sentiment_history  JSONB DEFAULT '[]';

-- ── 4. pg_cron setup note ─────────────────────────────────────────────────
-- The compute-contact-profiles edge function should be scheduled via
-- Supabase dashboard or the edge function deployment script using:
--
--   SELECT cron.schedule(
--     'compute-contact-profiles',
--     '0 3 * * *',  -- daily at 03:00 UTC
--     $$
--       SELECT net.http_post(
--         url := (SELECT 'https://' || value FROM vault.secrets
--                  WHERE name = 'supabase_project_url' LIMIT 1)
--              || '/functions/v1/compute-contact-profiles',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || (
--             SELECT value FROM vault.secrets
--              WHERE name = 'supabase_service_role_key' LIMIT 1
--           )
--         ),
--         body := '{}'::jsonb
--       )
--     $$
--   );
--
-- This is intentionally NOT executed in this migration to avoid
-- dependency on vault.secrets being pre-configured in all environments.
