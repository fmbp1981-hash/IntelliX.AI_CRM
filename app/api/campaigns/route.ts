/**
 * @fileoverview API Route: Email Campaigns
 *
 * GET  /api/campaigns           — Lista campanhas (com filtro opcional de status)
 * POST /api/campaigns           — Cria nova campanha ou executa ação (create/update/delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getEmailCampaigns,
    createEmailCampaign,
    updateEmailCampaign,
    deleteEmailCampaign,
    type CreateCampaignPayload,
    type CampaignStatus,
} from '@/lib/supabase/email-campaigns';

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

        const status = req.nextUrl.searchParams.get('status') as CampaignStatus | null;

        const campaigns = await getEmailCampaigns(supabase, profile.organization_id, {
            status: status ?? undefined,
        });

        return NextResponse.json({ campaigns });
    } catch (error: any) {
        console.error('[campaigns/GET]', error);
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
                const payload = body as CreateCampaignPayload & { action: string };
                if (!payload.name) {
                    return NextResponse.json({ error: 'name is required' }, { status: 400 });
                }
                const campaign = await createEmailCampaign(
                    supabase,
                    profile.organization_id,
                    user.id,
                    payload
                );
                return NextResponse.json({ campaign });
            }

            case 'update': {
                const { campaignId, ...updates } = body;
                if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
                const campaign = await updateEmailCampaign(supabase, campaignId, updates);
                return NextResponse.json({ campaign });
            }

            case 'delete': {
                const { campaignId: delId } = body;
                if (!delId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
                await deleteEmailCampaign(supabase, delId);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[campaigns/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
