/**
 * @fileoverview API Route: Deal Templates
 * 
 * GET  /api/deal-templates — Lista templates
 * POST /api/deal-templates — Cria template ou aplica template
 * 
 * body for create: { action: 'create', name, description?, board_id?, defaults }
 * body for apply:  { action: 'apply', templateId, overrides? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getDealTemplates,
    createDealTemplate,
    deleteDealTemplate,
    applyTemplate,
    type CreateTemplatePayload,
} from '@/lib/supabase/deal-templates';

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

        const boardId = req.nextUrl.searchParams.get('board_id') || undefined;
        const activeOnly = req.nextUrl.searchParams.get('active') === 'true';

        const templates = await getDealTemplates(supabase, profile.organization_id, {
            boardId,
            activeOnly,
        });

        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('[deal-templates/GET]', error);
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
                const { name, description, board_id, defaults } = body as CreateTemplatePayload & { action: string };
                if (!name || !defaults) {
                    return NextResponse.json({ error: 'name and defaults required' }, { status: 400 });
                }
                const template = await createDealTemplate(
                    supabase,
                    profile.organization_id,
                    user.id,
                    { name, description, board_id, defaults }
                );
                return NextResponse.json({ template });
            }

            case 'apply': {
                const { templateId, overrides } = body;
                if (!templateId) {
                    return NextResponse.json({ error: 'templateId required' }, { status: 400 });
                }
                const deal = await applyTemplate(supabase, profile.organization_id, templateId, overrides);
                return NextResponse.json({ deal });
            }

            case 'delete': {
                const { templateId: delId } = body;
                if (!delId) {
                    return NextResponse.json({ error: 'templateId required' }, { status: 400 });
                }
                await deleteDealTemplate(supabase, delId);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[deal-templates/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
