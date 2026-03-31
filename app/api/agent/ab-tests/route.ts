/**
 * /api/agent/ab-tests
 *
 * GET  — lista os testes A/B da organização
 * POST — cria um novo teste
 * PATCH — atualiza status (start / pause / stop)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── GET /api/agent/ab-tests ──────────────────────────────────────────
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return new NextResponse('No org', { status: 404 });

    const { data, error } = await supabase
        .from('agent_ab_tests')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}

// ── POST /api/agent/ab-tests ─────────────────────────────────────────
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return new NextResponse('No org', { status: 404 });

    const body = await req.json();
    const {
        name,
        description,
        board_id,
        variant_a_methodology,
        variant_a_label,
        variant_b_methodology,
        variant_b_label,
        traffic_split_a = 50,
    } = body;

    if (!name || !variant_a_methodology || !variant_b_methodology) {
        return NextResponse.json(
            { error: 'name, variant_a_methodology, variant_b_methodology são obrigatórios' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('agent_ab_tests')
        .insert({
            organization_id: profile.organization_id,
            board_id: board_id ?? null,
            name,
            description: description ?? null,
            variant_a_methodology,
            variant_a_label: variant_a_label ?? 'Variante A',
            variant_b_methodology,
            variant_b_label: variant_b_label ?? 'Variante B',
            traffic_split_a,
            status: 'draft',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}

// ── PATCH /api/agent/ab-tests ─────────────────────────────────────────
// Body: { id, action: 'start' | 'pause' | 'stop' }
export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const { id, action } = body as { id: string; action: 'start' | 'pause' | 'stop' };

    if (!id || !action) {
        return NextResponse.json({ error: 'id e action são obrigatórios' }, { status: 400 });
    }

    const statusMap = { start: 'running', pause: 'paused', stop: 'completed' } as const;
    const newStatus = statusMap[action];
    if (!newStatus) {
        return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }

    const extra: Record<string, unknown> = {};
    if (action === 'start') extra.started_at = new Date().toISOString();
    if (action === 'stop') extra.ended_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('agent_ab_tests')
        .update({ status: newStatus, ...extra })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
