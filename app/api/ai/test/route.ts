// Test route for AI tools - bypasses auth for development testing
// DELETE THIS FILE BEFORE PRODUCTION!

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CRMCallOptions } from '@/types/ai';

export const maxDuration = 60;

// Test configuration - uses service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
    console.log('[TEST] 🧪 Test endpoint called');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    const organizationId: unknown = body.organizationId;
    if (typeof organizationId !== 'string' || !organizationId) {
        return NextResponse.json({ error: 'Missing organizationId (dev test route requires it)' }, { status: 400 });
    }

    const rawContext: Record<string, unknown> = (body.context && typeof body.context === 'object') ? body.context : {};
    const context: CRMCallOptions = {
        organizationId,
        boardId: typeof rawContext.boardId === 'string' ? rawContext.boardId : undefined,
        dealId: typeof rawContext.dealId === 'string' ? rawContext.dealId : undefined,
        contactId: typeof rawContext.contactId === 'string' ? rawContext.contactId : undefined,
        boardName: typeof rawContext.boardName === 'string' ? rawContext.boardName : undefined,
        stages: Array.isArray(rawContext.stages)
            ? (rawContext.stages as unknown as Array<{ id: string; name: string }>)
            : undefined,
        dealCount: typeof rawContext.dealCount === 'number' ? rawContext.dealCount : undefined,
        pipelineValue: typeof rawContext.pipelineValue === 'number' ? rawContext.pipelineValue : undefined,
        stagnantDeals: typeof rawContext.stagnantDeals === 'number' ? rawContext.stagnantDeals : undefined,
        overdueDeals: typeof rawContext.overdueDeals === 'number' ? rawContext.overdueDeals : undefined,
        wonStage: typeof rawContext.wonStage === 'string' ? rawContext.wonStage : undefined,
        lostStage: typeof rawContext.lostStage === 'string' ? rawContext.lostStage : undefined,
        userId: typeof rawContext.userId === 'string' ? rawContext.userId : undefined,
        userName: typeof rawContext.userName === 'string' ? rawContext.userName : undefined,
    };
    const toolName = body.tool || 'listDealsByStage';
    const toolArgs = body.args || {};

    console.log('[TEST] Context:', context);
    console.log('[TEST] Tool:', toolName, 'Args:', toolArgs);

    // Simulate what the tools do
    const targetBoardId = toolArgs.boardId || context.boardId;
    const stageName = toolArgs.stageName || 'Proposta';

    console.log('[TEST] Target Board ID:', targetBoardId);

    if (!targetBoardId) {
        return NextResponse.json({ error: 'No boardId provided in context or args' });
    }

    // Test: Find stage
    const { data: stages, error: stageError } = await supabase
        .from('board_stages')
        .select('id, name, label')
        .eq('organization_id', context.organizationId)
        .eq('board_id', targetBoardId)
        .or(`name.ilike.%${stageName}%,label.ilike.%${stageName}%`);

    console.log('[TEST] Stage search:', { stages, stageError });

    if (!stages || stages.length === 0) {
        return NextResponse.json({
            error: `Stage "${stageName}" not found`,
            boardId: targetBoardId
        });
    }

    const stageId = stages[0].id;

    // Test: Find deals
    const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, value')
        .eq('organization_id', context.organizationId)
        .eq('board_id', targetBoardId)
        .eq('stage_id', stageId)
        .eq('is_won', false)
        .eq('is_lost', false)
        .order('value', { ascending: false })
        .limit(10);

    console.log('[TEST] Deals query:', { deals, dealsError });

    return NextResponse.json({
        success: true,
        tool: toolName,
        context: { boardId: targetBoardId, stageName },
        stage: stages[0],
        dealsCount: deals?.length || 0,
        deals: deals || []
    });
}
