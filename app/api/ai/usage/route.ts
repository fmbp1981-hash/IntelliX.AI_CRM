/**
 * @fileoverview API Route: AI Usage Stats & Governance
 * 
 * Endpoints para consultar métricas de uso de IA e gerenciar quotas.
 * Usado pelo dashboard de governança (AIGovernanceDashboard).
 * 
 * ## Endpoints:
 * - GET /api/ai/usage — Retorna estatísticas de uso por período
 * - GET /api/ai/usage?view=quota — Retorna status da quota atual
 * 
 * ## Segurança:
 * - Requer autenticação (cookie-based)
 * - Apenas admins podem alterar quotas
 * 
 * @module app/api/ai/usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsageStats, getQuotaStatus } from '@/lib/supabase/ai-governance';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month' | 'all';

    if (view === 'quota') {
        const quota = await getQuotaStatus(supabase, profile.organization_id);
        return NextResponse.json({ quota });
    }

    const stats = await getUsageStats(supabase, profile.organization_id, period);
    return NextResponse.json({ stats });
}
