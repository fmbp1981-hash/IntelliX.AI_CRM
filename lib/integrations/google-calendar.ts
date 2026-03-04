import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function getCalendarClient(organizationId: string) {
    const supabase = await createClient();
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('google_calendar_access_token, google_calendar_refresh_token, google_calendar_expires_at')
        .eq('organization_id', organizationId)
        .single();

    if (!orgSettings?.google_calendar_access_token) {
        throw new Error('Google Calendar não está configurado para esta organização.');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI // ex: /api/auth/google/callback
    );

    oauth2Client.setCredentials({
        access_token: orgSettings.google_calendar_access_token,
        refresh_token: orgSettings.google_calendar_refresh_token,
        expiry_date: orgSettings.google_calendar_expires_at ? new Date(orgSettings.google_calendar_expires_at).getTime() : undefined
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function checkAvailability(organizationId: string, timeMin: string, timeMax: string) {
    const calendar = await getCalendarClient(organizationId);

    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin,
            timeMax,
            items: [{ id: 'primary' }],
        },
    });

    return response.data.calendars?.primary?.busy || [];
}

export async function scheduleAppointment(organizationId: string, eventDetails: any) {
    const calendar = await getCalendarClient(organizationId);

    const event = {
        summary: eventDetails.title,
        description: eventDetails.description,
        start: { dateTime: eventDetails.start_time },
        end: { dateTime: eventDetails.end_time },
        attendees: eventDetails.attendees ? eventDetails.attendees.map((a: string) => ({ email: a })) : [],
    };

    const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all',
    });

    return response.data;
}

export async function cancelAppointment(organizationId: string, eventId: string) {
    const calendar = await getCalendarClient(organizationId);

    await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
    });

    return true;
}
