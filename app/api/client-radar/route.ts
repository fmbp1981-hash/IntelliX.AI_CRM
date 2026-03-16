/**
 * GET /api/client-radar — Resumo do Radar de Clientes
 * GET /api/client-radar?scope=birthdays&days=30 — Aniversários
 * GET /api/client-radar?scope=vip&limit=20 — Clientes VIP
 * GET /api/client-radar?scope=rules — Regras de eventos
 * POST /api/client-radar — Upsert regra de evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getRadarSummary,
    getUpcomingBirthdays,
    getVIPClients,
    getEventRules,
    upsertEventRule,
    getUpcomingCommemorativeDates,
    type UpsertEventRuleInput,
} from '@/lib/supabase/client-radar';

export const dynamic = 'force-dynamic';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
    return data?.organization_id ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const scope = searchParams.get('scope') ?? 'summary';

        if (scope === 'birthdays') {
            const days = parseInt(searchParams.get('days') ?? '30');
            const birthdays = await getUpcomingBirthdays(supabase, orgId, days);
            return NextResponse.json({ birthdays });
        }

        if (scope === 'vip') {
            const limit = parseInt(searchParams.get('limit') ?? '20');
            const vipClients = await getVIPClients(supabase, orgId, limit);
            return NextResponse.json({ vipClients });
        }

        if (scope === 'rules') {
            const rules = await getEventRules(supabase, orgId);
            return NextResponse.json({ rules });
        }

        if (scope === 'commemorative') {
            const dates = getUpcomingCommemorativeDates();
            return NextResponse.json({ dates });
        }

        // Default: full summary
        const summary = await getRadarSummary(supabase, orgId);
        return NextResponse.json(summary);

    } catch (err) {
        console.error('[client-radar] GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json() as UpsertEventRuleInput;

        if (!body.event_type) {
            return NextResponse.json({ error: 'event_type é obrigatório' }, { status: 400 });
        }

        const rule = await upsertEventRule(supabase, orgId, body);
        return NextResponse.json({ rule }, { status: 201 });

    } catch (err) {
        console.error('[client-radar] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
