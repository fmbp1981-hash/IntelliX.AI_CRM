-- =============================================
-- AI GOVERNANCE DATABASE SUPPORT
-- Funções de suporte para o sistema de governança de IA
-- =============================================

-- Função para incrementar o uso de tokens na quota
CREATE OR REPLACE FUNCTION public.increment_ai_quota_usage(
  p_organization_id UUID,
  p_tokens INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ai_quotas
  SET tokens_used_current_month = COALESCE(tokens_used_current_month, 0) + p_tokens,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  -- Se não existe quota, não faz nada (organização sem limites)
END;
$$;

-- Função para reset mensal de quotas (chamada pelo pg_cron)
CREATE OR REPLACE FUNCTION public.reset_monthly_ai_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ai_quotas
  SET tokens_used_current_month = 0,
      updated_at = now()
  WHERE reset_day = EXTRACT(DAY FROM now())::INT;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.increment_ai_quota_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_ai_quotas TO authenticated;
