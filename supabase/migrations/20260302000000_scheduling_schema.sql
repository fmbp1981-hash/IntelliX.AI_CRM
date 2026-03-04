-- Migration to add Master Calendar Google OAuth fields and Appointments tables

-- 1. Add Google Calendar OAuth tokens to organization_settings
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT;
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT;
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS google_calendar_expires_at TIMESTAMPTZ;
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;

-- 2. Create the unified appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    professional_name TEXT NOT NULL, 
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    google_event_id TEXT, 
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for appointments
CREATE POLICY "Admins and config can manage appointments" 
    ON public.appointments
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- Agent / Edge Functions need service_role access
CREATE POLICY "Service Role full access to appointments"
    ON public.appointments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
