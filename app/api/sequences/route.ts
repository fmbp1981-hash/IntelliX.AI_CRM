/**
 * @fileoverview API Route: Activity Sequences
 * 
 * POST /api/sequences
 * body: { action: 'process' } — Processes scheduled steps (called by cron or manually)
 * GET  /api/sequences — List sequences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSequences, processScheduledSteps } from '@/lib/supabase/sequences';

export async function GET() {
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

        const sequences = await getSequences(supabase, profile.organization_id);
        return NextResponse.json({ sequences });
    } catch (error: any) {
        console.error('[sequences/GET]', error);
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
        const action = body.action;

        if (action === 'process') {
            const result = await processScheduledSteps(supabase, profile.organization_id);
            return NextResponse.json({ success: true, ...result });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('[sequences/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
