/**
 * @fileoverview API Route: Notifications
 * 
 * GET  /api/notifications        — Lista notificações (in-app)
 * GET  /api/notifications?view=summary — Resumo para badge
 * POST /api/notifications/read   — Marca como lida
 * POST /api/notifications/read-all — Marca todas como lidas
 * POST /api/notifications/generate — Gera notificações (stagnation + reminders)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getNotifications,
    getNotificationSummary,
    markNotificationRead,
    markAllNotificationsRead,
    generateStagnationNotifications,
    generateActivityReminders,
} from '@/lib/supabase/notifications';

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

        const view = req.nextUrl.searchParams.get('view');
        const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

        if (view === 'summary') {
            const summary = await getNotificationSummary(supabase, profile.organization_id);
            return NextResponse.json({ summary });
        }

        const notifications = await getNotifications(supabase, profile.organization_id, {
            unreadOnly,
            limit: Math.min(limit, 100),
        });

        return NextResponse.json({ notifications });
    } catch (error: any) {
        console.error('[notifications/GET]', error);
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
            case 'read': {
                if (!body.notificationId) {
                    return NextResponse.json({ error: 'notificationId required' }, { status: 400 });
                }
                await markNotificationRead(supabase, body.notificationId);
                return NextResponse.json({ success: true });
            }

            case 'read-all': {
                await markAllNotificationsRead(supabase, profile.organization_id);
                return NextResponse.json({ success: true });
            }

            case 'generate': {
                const stagnation = await generateStagnationNotifications(supabase, profile.organization_id);
                const reminders = await generateActivityReminders(supabase, profile.organization_id);
                return NextResponse.json({
                    generated: stagnation + reminders,
                    details: { stagnation, reminders },
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[notifications/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
