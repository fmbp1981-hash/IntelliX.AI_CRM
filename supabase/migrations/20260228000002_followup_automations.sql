-- =============================================
-- Phase 3: Nurturing Automations
-- Migration: followup_automations
-- Date: 2026-02-28
-- =============================================

-- 1. Add followup state to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS followup_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

-- 2. Enable scheduling extensions (optional, requires superuser on some setups)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- NOTE: The actual cron job to call the nurturing-cron Edge Function
-- must be created in the Supabase Dashboard or with the exact project URL:
/*
SELECT cron.schedule(
  'nurturing-daily-job',
  '0 10 * * *', -- Everyday at 10:00 AM
  $$
  SELECT net.http_post(
      url:='https://[PROJECT-REF].supabase.co/functions/v1/nurturing-cron',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE-ROLE-KEY]"}'::jsonb,
      body:='{}'::jsonb
  );
  $$
);
*/
