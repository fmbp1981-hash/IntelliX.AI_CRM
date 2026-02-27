-- ===========================================================
-- Migration: setup_sequence_cron
-- Description: Creates a pg_cron job that triggers the 
--   `sequence-executor` Edge Function every hour to process 
--   active Activity Sequences and auto-create CRM Tasks.
-- ===========================================================

-- Ensure pg_cron and pg_net are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Every hour at minute 0: Run sequence executor
SELECT cron.schedule(
  'run_sequence_executor',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sequence-executor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
