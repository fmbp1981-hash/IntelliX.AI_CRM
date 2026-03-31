-- =============================================
-- AGENT SUMMARY CRON JOB
-- Fase 8.2: NossoAgent IA Nativo
-- Data: Fevereiro 2026
-- =============================================
-- Objetivo:
--   Agendar a chamada para a Edge Function `agent-summary` a cada hora.
--   A edge function se encarrega de ler as conversas recentes e sumarizar com IA.
--
-- Dependências:
--   - Extensão: pg_cron
--   - Extensão: pg_net
-- =============================================

-- Assegurar extensões (deveriam estar ativas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar a function wrapper que invoca a API do Supabase localmente (via pg_net)
CREATE OR REPLACE FUNCTION public.invoke_agent_summary_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_id BIGINT;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- A URL da edge function em produção na nuvem da Vercel/Supabase
  -- Lembre-se que dentro do banco, podemos invocar o localhost se estiver em dev, 
  -- Mas o padrão para o serviço hospedado é usar current_setting com fallback
  
  -- Nota: Em um ambiente real, pegamos via Vault ou secrets preenchidos manually.
  -- Usaremos a URL padrão do projeto baseada na env var (que precisa estar presente)
  
  edge_function_url := current_setting('custom.agent_summary_url', true);
  service_role_key := current_setting('custom.service_role_key', true);

  -- Fallback de segurança caso não configurem (evitar crash do cron)
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    RAISE NOTICE 'Skipping agent_summary cron: custom.agent_summary_url is not set.';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', ('Bearer ' || service_role_key)
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RAISE NOTICE 'Invoked agent-summary Edge Function. Request ID: %', req_id;
END;
$$;

-- Agendar a function para rodar a cada hora no pg_cron
-- (No minuto 30 de cada hora)
SELECT cron.schedule(
  'agent-summary-hourly',
  '30 * * * *',  -- Executa no minuto 30 de cada hora
  $$SELECT public.invoke_agent_summary_cron()$$
);

-- Conceder permissão ao postgres (ou anon, dependendo do security)
GRANT EXECUTE ON FUNCTION public.invoke_agent_summary_cron TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_agent_summary_cron TO service_role;
