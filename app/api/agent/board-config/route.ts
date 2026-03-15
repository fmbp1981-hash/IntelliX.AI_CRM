/**
 * GET  /api/agent/board-config?boardId=xxx  — configuração do agente para um board
 * POST /api/agent/board-config               — cria/atualiza configuração por board
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getAgentBoardConfig,
    listAgentBoardConfigs,
    upsertAgentBoardConfig,
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

        const boardId = new URL(req.url).searchParams.get('boardId');

        if (boardId) {
            const config = await getAgentBoardConfig(supabase, orgId, boardId);
            return NextResponse.json({ config });
        }

        const configs = await listAgentBoardConfigs(supabase, orgId);
        return NextResponse.json({ configs });
    } catch (err) {
        console.error('[board-config] GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { boardId, ...config } = body;

        if (!boardId) {
            return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const updated = await upsertAgentBoardConfig(supabase, orgId, boardId, config);
        return NextResponse.json({ config: updated });
    } catch (err) {
        console.error('[board-config] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
