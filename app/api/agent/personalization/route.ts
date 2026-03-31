/**
 * GET  /api/agent/personalization  — busca configuração de personalização global
 * POST /api/agent/personalization  — atualiza campos de personalização (bulk)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getAgentPersonalization,
    updateAgentPersonalizationBulk,
    type PersonalizationPayload,
} from '@/lib/supabase/agent-methodology';

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

        const personalization = await getAgentPersonalization(supabase, orgId);
        return NextResponse.json({ personalization });
    } catch (err) {
        console.error('[personalization] GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload: Partial<PersonalizationPayload> = await req.json();

        const allowedKeys: (keyof PersonalizationPayload)[] = [
            'persona',
            'tone_of_voice',
            'sales_methodology',
            'knowledge_base_config',
            'business_context_extended',
            'behavioral_training',
            'follow_up_config',
        ];

        // Strip unexpected keys for safety
        const sanitized = Object.fromEntries(
            Object.entries(payload).filter(([k]) => allowedKeys.includes(k as keyof PersonalizationPayload))
        ) as Partial<PersonalizationPayload>;

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await updateAgentPersonalizationBulk(supabase, orgId, sanitized);
        return NextResponse.json({ personalization: updated });
    } catch (err) {
        console.error('[personalization] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
