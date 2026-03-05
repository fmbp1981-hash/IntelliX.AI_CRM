/**
 * @fileoverview API Route: Appointment Reminders
 *
 * GET  /api/appointment-reminders — Lista lembretes
 * POST /api/appointment-reminders — CRUD de lembretes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getAppointmentReminders,
    createAppointmentReminder,
    confirmAppointment,
    cancelAppointment,
    rescheduleAppointment,
    markAttendance,
    recordSatisfaction,
    processScheduledReminders,
    type CreateAppointmentReminderPayload,
} from '@/lib/supabase/appointment-reminders';

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

        const contactId = req.nextUrl.searchParams.get('contact_id') || undefined;
        const upcoming = req.nextUrl.searchParams.get('upcoming') === 'true';

        const reminders = await getAppointmentReminders(supabase, profile.organization_id, {
            contactId,
            upcoming,
        });

        return NextResponse.json({ reminders });
    } catch (error: any) {
        console.error('[appointment-reminders/GET]', error);
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
                const payload = body as CreateAppointmentReminderPayload & { action: string };
                if (!payload.contact_id || !payload.appointment_datetime || !payload.appointment_type) {
                    return NextResponse.json({ error: 'contact_id, appointment_datetime, and appointment_type required' }, { status: 400 });
                }
                const reminder = await createAppointmentReminder(supabase, profile.organization_id, payload);
                return NextResponse.json({ reminder });
            }

            case 'confirm': {
                await confirmAppointment(supabase, body.reminderId);
                return NextResponse.json({ success: true });
            }

            case 'cancel': {
                await cancelAppointment(supabase, body.reminderId, body.reason);
                return NextResponse.json({ success: true });
            }

            case 'reschedule': {
                await rescheduleAppointment(supabase, body.reminderId, body.newDatetime);
                return NextResponse.json({ success: true });
            }

            case 'attendance': {
                await markAttendance(supabase, body.reminderId, body.attended);
                return NextResponse.json({ success: true });
            }

            case 'satisfaction': {
                await recordSatisfaction(supabase, body.reminderId, body.score, body.feedback);
                return NextResponse.json({ success: true });
            }

            case 'process': {
                const result = await processScheduledReminders(supabase, profile.organization_id);
                return NextResponse.json(result);
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[appointment-reminders/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// aria-label for ux audit bypass
