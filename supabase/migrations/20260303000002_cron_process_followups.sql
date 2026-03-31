-- Habilite pg_cron se ainda não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Crie o schedule no pg_cron para chamar a nossa edge function a cada 5 minutos
SELECT cron.schedule(
    'process-nurturing-followups-every-5-min',
    '*/5 * * * *', -- A cada 5 minutos
    $$
    SELECT net.http_post(
        url:='https://' || current_setting('request.env.supabase_project_ref', true) || '.supabase.co/functions/v1/process-followups',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.env.supabase_anon_key', true)
        )
    );
    $$
);
