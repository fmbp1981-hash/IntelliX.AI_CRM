/**
 * GET  /api/agent/stage-config?stageId=xxx         — configuração de um estágio
 * GET  /api/agent/stage-config?boardId=xxx         — todas configurações de um board
 * POST /api/agent/stage-config                     — cria/atualiza configuração de estágio
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getAgentStageConfig,
    listAgentStageConfigsByBoard,
    upsertAgentStageConfig,
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

        const { searchParams } = new URL(req.url);
        const stageId = searchParams.get('stageId');
        const boardId = searchParams.get('boardId');

        if (stageId) {
            const config = await getAgentStageConfig(supabase, orgId, stageId);
            return NextResponse.json({ config });
        }

        if (boardId) {
            const configs = await listAgentStageConfigsByBoard(supabase, orgId, boardId);
            return NextResponse.json({ configs });
        }

        return NextResponse.json({ error: 'stageId or boardId is required' }, { status: 400 });
    } catch (err) {
        console.error('[stage-config] GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { boardId, stageId, ...config } = body;

        if (!boardId || !stageId) {
            return NextResponse.json({ error: 'boardId and stageId are required' }, { status: 400 });
        }

        const updated = await upsertAgentStageConfig(supabase, orgId, boardId, stageId, config);
        return NextResponse.json({ config: updated });
    } catch (err) {
        console.error('[stage-config] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
