-- =============================================
-- FIX: SYSTEM NOTIFICATIONS RLS POLICY
-- =============================================
-- Data: Fevereiro 2026
-- Objetivo: Restringir acesso de leitura às notificações do sistema (system_notifications)
-- para que os usuários só possam ler as notificações da sua própria organização.
-- A política anterior ("Enable all access for authenticated users", USING true)
-- permitia acesso cross-tenant inseguro.

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.system_notifications;

CREATE POLICY "Users can view org notifications"
    ON public.system_notifications
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update org notifications"
    ON public.system_notifications
    FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- As a trigger or an edge function is inserting these, the service role bypasses RLS,
-- but we'll add an INSERT policy just in case the backend API inserts them as the user.
CREATE POLICY "Users can insert org notifications"
    ON public.system_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Enable realtime for system_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;
