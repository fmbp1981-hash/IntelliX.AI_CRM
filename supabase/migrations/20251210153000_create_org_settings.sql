-- Migration: Create Organization Settings (Global AI Config)
-- Timestamp: 20251210153000

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.organization_settings (
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
    ai_provider text DEFAULT 'google',
    ai_model text DEFAULT 'gemini-2.5-flash',
    ai_google_key text,
    ai_openai_key text,
    ai_anthropic_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage org settings"
    ON public.organization_settings
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE organization_id = organization_settings.organization_id 
            AND role = 'admin'
        )
    );

-- Regular users can VIEW settings (to know if AI is active, but maybe not read keys directly? 
-- Actually for Frontend to show "Key Configured" we might need read access.
-- But safest is Backend read only. Let's allow READ for members.)
CREATE POLICY "Members can view org settings"
    ON public.organization_settings
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE organization_id = organization_settings.organization_id
        )
    );

-- 4. Auto-create settings for existing organizations
INSERT INTO public.organization_settings (organization_id)
SELECT id FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.organization_settings);

-- 5. Trigger to create settings for NEW organizations
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.organization_settings (organization_id)
    VALUES (new.id);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger (assuming organizations table exists, trigger might need to be on insert)
DROP TRIGGER IF EXISTS on_org_created ON public.organizations;
CREATE TRIGGER on_org_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();
