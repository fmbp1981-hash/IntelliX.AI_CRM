/**
 * @fileoverview API Route: Follow-up Sequences
 *
 * GET  /api/followups — Lista sequências
 * POST /api/followups — Cria sequência, processa scheduled, ou deleta
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getFollowupSequences,
    createFollowupSequence,
    updateFollowupSequence,
    deleteFollowupSequence,
    processScheduledFollowups,
    type CreateSequencePayload,
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

        const type = req.nextUrl.searchParams.get('type') || undefined;
        const vertical = req.nextUrl.searchParams.get('vertical') || undefined;
        const activeOnly = req.nextUrl.searchParams.get('active') === 'true';

        const sequences = await getFollowupSequences(supabase, profile.organization_id, {
            type,
            vertical,
            activeOnly,
        });

        return NextResponse.json({ sequences });
    } catch (error: any) {
        console.error('[followups/GET]', error);
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
                const payload = body as CreateSequencePayload & { action: string };
                if (!payload.name || !payload.sequence_type || !payload.steps?.length) {
                    return NextResponse.json({ error: 'name, sequence_type, and steps required' }, { status: 400 });
                }
                const sequence = await createFollowupSequence(supabase, profile.organization_id, payload);
                return NextResponse.json({ sequence });
            }

            case 'update': {
                const { sequenceId, ...updates } = body;
                if (!sequenceId) return NextResponse.json({ error: 'sequenceId required' }, { status: 400 });
                const sequence = await updateFollowupSequence(supabase, sequenceId, updates);
                return NextResponse.json({ sequence });
            }

            case 'delete': {
                const { sequenceId: delId } = body;
                if (!delId) return NextResponse.json({ error: 'sequenceId required' }, { status: 400 });
                await deleteFollowupSequence(supabase, delId);
                return NextResponse.json({ success: true });
            }

            case 'process': {
                const result = await processScheduledFollowups(supabase);
                return NextResponse.json(result);
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[followups/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
