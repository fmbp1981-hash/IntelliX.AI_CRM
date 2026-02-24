/**
 * @fileoverview API Route: Notification Preferences
 * 
 * GET  /api/notifications/preferences — Lista preferências do usuário
 * POST /api/notifications/preferences — Atualiza preferência (upsert)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getNotificationPreferences,
    upsertNotificationPreference,
    initializeDefaultPreferences,
} from '@/lib/supabase/notifications';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let preferences = await getNotificationPreferences(supabase, user.id);

        // If no preferences exist, initialize defaults
        if (preferences.length === 0) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (profile) {
                await initializeDefaultPreferences(supabase, user.id, profile.organization_id);
                preferences = await getNotificationPreferences(supabase, user.id);
            }
        }

        return NextResponse.json({ preferences });
    } catch (error: any) {
        console.error('[notification-preferences/GET]', error);
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
        const { channel, event_type, enabled, config } = body;

        if (!channel || !event_type) {
            return NextResponse.json(
                { error: 'channel and event_type required' },
                { status: 400 }
            );
        }

        const preference = await upsertNotificationPreference(
            supabase,
            user.id,
            profile.organization_id,
            { channel, event_type, enabled, config }
        );

        return NextResponse.json({ preference });
    } catch (error: any) {
        console.error('[notification-preferences/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
