/**
 * @fileoverview Appointment Reminders Service (Clinics)
 *
 * Manages the full patient journey: scheduling → prep → reminders → post-care → satisfaction → return.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface ReminderConfig {
    type: string;
    days_before?: number;
    hours_before?: number;
    sent: boolean;
    sent_at: string | null;
}

export interface PreparationInstruction {
    type: string;
    description: string;
    hours_before?: number;
}

export interface AppointmentReminder {
    id: string;
    organization_id: string;
    deal_id: string | null;
    contact_id: string;
    conversation_id: string | null;
    appointment_id: string | null;
    appointment_datetime: string;
    appointment_type: 'consulta' | 'exame' | 'cirurgia' | 'retorno' | 'avaliacao' | 'manutencao';
    professional_name: string | null;
    location_info: string | null;
    preparation_instructions: PreparationInstruction[];
    required_documents: string[];
    reminders_config: ReminderConfig[];
    confirmed: boolean;
    confirmed_at: string | null;
    cancelled: boolean;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    rescheduled_to: string | null;
    attended: boolean | null;
    satisfaction_survey_sent: boolean;
    satisfaction_score: number | null;
    satisfaction_feedback: string | null;
    post_care_instructions_sent: boolean;
    return_recommended: boolean;
    return_date: string | null;
    return_reminder_sent: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateAppointmentReminderPayload {
    contact_id: string;
    deal_id?: string;
    conversation_id?: string;
    appointment_id?: string;
    appointment_datetime: string;
    appointment_type: AppointmentReminder['appointment_type'];
    professional_name?: string;
    location_info?: string;
    preparation_instructions?: PreparationInstruction[];
    required_documents?: string[];
    return_recommended?: boolean;
    return_date?: string;
}

// =============================================
// CRUD
// =============================================

export async function getAppointmentReminders(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { contactId?: string; upcoming?: boolean; limit?: number }
): Promise<AppointmentReminder[]> {
    let query = supabase
        .from('appointment_reminders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('appointment_datetime', { ascending: true });

    if (options?.contactId) query = query.eq('contact_id', options.contactId);
    if (options?.upcoming) {
        query = query
            .gte('appointment_datetime', new Date().toISOString())
            .eq('cancelled', false);
    }
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createAppointmentReminder(
    supabase: SupabaseClient,
    organizationId: string,
    payload: CreateAppointmentReminderPayload
): Promise<AppointmentReminder> {
    const { data, error } = await supabase
        .from('appointment_reminders')
        .insert({
            organization_id: organizationId,
            contact_id: payload.contact_id,
            deal_id: payload.deal_id || null,
            conversation_id: payload.conversation_id || null,
            appointment_id: payload.appointment_id || null,
            appointment_datetime: payload.appointment_datetime,
            appointment_type: payload.appointment_type,
            professional_name: payload.professional_name || null,
            location_info: payload.location_info || null,
            preparation_instructions: payload.preparation_instructions || [],
            required_documents: payload.required_documents || [],
            return_recommended: payload.return_recommended || false,
            return_date: payload.return_date || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function confirmAppointment(
    supabase: SupabaseClient,
    reminderId: string
): Promise<void> {
    const { error } = await supabase
        .from('appointment_reminders')
        .update({
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

    if (error) throw error;
}

export async function cancelAppointment(
    supabase: SupabaseClient,
    reminderId: string,
    reason?: string
): Promise<void> {
    const { error } = await supabase
        .from('appointment_reminders')
        .update({
            cancelled: true,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

    if (error) throw error;
}

export async function rescheduleAppointment(
    supabase: SupabaseClient,
    reminderId: string,
    newDatetime: string
): Promise<void> {
    // Reset reminders config for new date
    const defaultReminders: ReminderConfig[] = [
        { type: '7d', days_before: 7, sent: false, sent_at: null },
        { type: '2d', days_before: 2, sent: false, sent_at: null },
        { type: '1d', days_before: 1, sent: false, sent_at: null },
        { type: '1h', days_before: 0, hours_before: 1, sent: false, sent_at: null },
        { type: 'day', days_before: 0, hours_before: 3, sent: false, sent_at: null },
    ];

    const { error } = await supabase
        .from('appointment_reminders')
        .update({
            rescheduled_to: newDatetime,
            appointment_datetime: newDatetime,
            reminders_config: defaultReminders,
            confirmed: false,
            confirmed_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

    if (error) throw error;
}

export async function markAttendance(
    supabase: SupabaseClient,
    reminderId: string,
    attended: boolean
): Promise<void> {
    const { error } = await supabase
        .from('appointment_reminders')
        .update({
            attended,
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

    if (error) throw error;
}

export async function recordSatisfaction(
    supabase: SupabaseClient,
    reminderId: string,
    score: number,
    feedback?: string
): Promise<void> {
    const { error } = await supabase
        .from('appointment_reminders')
        .update({
            satisfaction_score: score,
            satisfaction_feedback: feedback || null,
            satisfaction_survey_sent: true,
            satisfaction_survey_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

    if (error) throw error;
}

// =============================================
// Scheduler: Process Due Reminders
// =============================================

export async function processScheduledReminders(
    supabase: SupabaseClient,
    organizationId: string
): Promise<{ sent: number }> {
    const { data: reminders, error } = await supabase
        .from('appointment_reminders')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('cancelled', false)
        .is('attended', null)
        .gte('appointment_datetime', new Date().toISOString());

    if (error) throw error;
    if (!reminders?.length) return { sent: 0 };

    let sent = 0;

    for (const reminder of reminders) {
        const config = reminder.reminders_config as ReminderConfig[];
        const appointmentTime = new Date(reminder.appointment_datetime).getTime();
        const now = Date.now();

        for (const step of config) {
            if (step.sent) continue;

            const targetMs = (step.days_before || 0) * 86400000 + (step.hours_before || 0) * 3600000;
            const sendAt = appointmentTime - targetMs;

            if (now >= sendAt) {
                step.sent = true;
                step.sent_at = new Date().toISOString();
                sent++;
            }
        }

        // Update config if any reminders were sent
        if (sent > 0) {
            await supabase
                .from('appointment_reminders')
                .update({
                    reminders_config: config,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', reminder.id);
        }
    }

    return { sent };
}
