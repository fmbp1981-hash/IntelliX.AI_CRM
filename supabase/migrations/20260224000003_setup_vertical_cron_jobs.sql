-- ===========================================================
-- Migration: setup_vertical_cron_jobs
-- Description: Creates 9 pg_cron jobs for vertical automations.
--   Each job calls the `vertical-automation` Edge Function
--   via pg_net with the appropriate job name and vertical type.
-- ===========================================================

-- Ensure pg_cron and pg_net are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Medical Clinic Jobs ─────────────────────────────────────

-- Every 15 minutes: Check appointment reminders (24h/2h before)
SELECT cron.schedule(
  'check_appointment_reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_appointment_reminders',
      'vertical', 'medical_clinic'
    )
  );
  $$
);

-- Mondays at 8am: Check patient reactivation (>6 months)
SELECT cron.schedule(
  'check_patient_reactivation',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_patient_reactivation',
      'vertical', 'medical_clinic'
    )
  );
  $$
);

-- Daily at 6pm: Check absenteeism alert
SELECT cron.schedule(
  'check_absenteeism_alert',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_absenteeism_alert',
      'vertical', 'medical_clinic'
    )
  );
  $$
);

-- ─── Dental Clinic Jobs ──────────────────────────────────────

-- Daily at 9am: Check budget followup (>3 days without response)
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

-- Daily at 10am: Check treatment abandonment (>15 days inactive)
SELECT cron.schedule(
  'check_treatment_abandonment',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_treatment_abandonment',
      'vertical', 'dental_clinic'
    )
  );
  $$
);

-- Mondays at 8am: Check overdue maintenance (>6 months)
SELECT cron.schedule(
  'check_maintenance_due',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_maintenance_due',
      'vertical', 'dental_clinic'
    )
  );
  $$
);

-- ─── Real Estate Jobs ────────────────────────────────────────

-- Daily at 9am: Check visit followup (>2 days without proposal)
SELECT cron.schedule(
  'check_visit_followup',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_visit_followup',
      'vertical', 'real_estate'
    )
  );
  $$
);

-- Daily at 9am: Check proposal followup (>2 days pending)
SELECT cron.schedule(
  'check_proposal_followup',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'check_proposal_followup',
      'vertical', 'real_estate'
    )
  );
  $$
);

-- Every 4 hours: Run property matching
SELECT cron.schedule(
  'run_property_matching',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vertical-automation',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'job', 'run_property_matching',
      'vertical', 'real_estate'
    )
  );
  $$
);
