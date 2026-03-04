/**
 * @fileoverview API Route: Follow-up Executions
 *
 * GET  /api/followups/executions — Lista execuções
 * POST /api/followups/executions — Cria/cancela/pausa/resume execuções
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getFollowupExecutions,
    createFollowupExecution,
    cancelExecution,
    pauseExecution,
    resumeExecution,
} from '@/lib/supabase/followups';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const status = req.nextUrl.searchParams.get('status') || undefined;
        const conversationId = req.nextUrl.searchParams.get('conversation_id') || undefined;
        const dealId = req.nextUrl.searchParams.get('deal_id') || undefined;
        const limit = req.nextUrl.searchParams.get('limit');

        const executions = await getFollowupExecutions(supabase, profile.organization_id, {
            status,
            conversationId,
            dealId,
            limit: limit ? parseInt(limit) : undefined,
        });

        return NextResponse.json({ executions });
    } catch (error: any) {
        console.error('[followups/executions/GET]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const body = await req.json();
        const action = body.action as string;

        switch (action) {
            case 'create': {
                const { sequence_id, conversation_id, contact_id, deal_id } = body;
                if (!sequence_id) return NextResponse.json({ error: 'sequence_id required' }, { status: 400 });
                const execution = await createFollowupExecution(supabase, profile.organization_id, {
                    sequence_id,
                    conversation_id,
                    contact_id,
                    deal_id,
                });
                return NextResponse.json({ execution });
            }

            case 'cancel': {
                const { executionId, reason } = body;
                if (!executionId) return NextResponse.json({ error: 'executionId required' }, { status: 400 });
                await cancelExecution(supabase, executionId, reason);
                return NextResponse.json({ success: true });
            }

            case 'pause': {
                const { executionId: pauseId } = body;
                if (!pauseId) return NextResponse.json({ error: 'executionId required' }, { status: 400 });
                await pauseExecution(supabase, pauseId);
                return NextResponse.json({ success: true });
            }

            case 'resume': {
                const { executionId: resumeId } = body;
                if (!resumeId) return NextResponse.json({ error: 'executionId required' }, { status: 400 });
                await resumeExecution(supabase, resumeId);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[followups/executions/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
