/**
 * @fileoverview Property Journey Service (Real Estate)
 *
 * Manages the full client journey: match → visit → feedback → proposal → documentation.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface VisitReminderConfig {
    type: string;
    days_before?: number;
    hours_before?: number;
    sent: boolean;
    sent_at: string | null;
}

export interface DocumentChecklistItem {
    item: string;
    status: 'pendente' | 'recebido' | 'rejeitado';
    rejection_reason?: string;
    received_at?: string;
}

export interface PropertyJourney {
    id: string;
    organization_id: string;
    deal_id: string | null;
    contact_id: string;
    conversation_id: string | null;
    property_id: string | null;
    visit_datetime: string | null;
    visit_type: 'presencial' | 'virtual' | 'video_call' | null;
    visit_reminders_config: VisitReminderConfig[];
    pre_visit_info_sent: boolean;
    property_highlights: string[];
    neighborhood_info: Record<string, any>;
    route_info: string | null;
    confirmed: boolean;
    confirmed_at: string | null;
    cancelled: boolean;
    rescheduled_to: string | null;
    visit_completed: boolean;
    feedback_collected: boolean;
    feedback_score: number | null;
    feedback_text: string | null;
    feedback_objections: string[];
    alternative_properties_sent: boolean;
    alternatives_sent_at: string | null;
    proposal_sent: boolean;
    proposal_value: number | null;
    proposal_sent_at: string | null;
    proposal_followup_count: number;
    documentation_checklist: DocumentChecklistItem[];
    documentation_reminder_sent: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreatePropertyJourneyPayload {
    contact_id: string;
    deal_id?: string;
    conversation_id?: string;
    property_id?: string;
    visit_datetime?: string;
    visit_type?: PropertyJourney['visit_type'];
}

// =============================================
// CRUD
// =============================================

export async function getPropertyJourneys(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { contactId?: string; upcoming?: boolean; limit?: number }
): Promise<PropertyJourney[]> {
    let query = supabase
        .from('property_journey')
        .select('*')
        .eq('organization_id', organizationId)
        .order('visit_datetime', { ascending: true });

    if (options?.contactId) query = query.eq('contact_id', options.contactId);
    if (options?.upcoming) {
        query = query
            .gte('visit_datetime', new Date().toISOString())
            .eq('cancelled', false)
            .eq('visit_completed', false);
    }
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createPropertyJourney(
    supabase: SupabaseClient,
    organizationId: string,
    payload: CreatePropertyJourneyPayload
): Promise<PropertyJourney> {
    const { data, error } = await supabase
        .from('property_journey')
        .insert({
            organization_id: organizationId,
            contact_id: payload.contact_id,
            deal_id: payload.deal_id || null,
            conversation_id: payload.conversation_id || null,
            property_id: payload.property_id || null,
            visit_datetime: payload.visit_datetime || null,
            visit_type: payload.visit_type || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function confirmVisit(
    supabase: SupabaseClient,
    journeyId: string
): Promise<void> {
    const { error } = await supabase
        .from('property_journey')
        .update({
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}

export async function completeVisit(
    supabase: SupabaseClient,
    journeyId: string
): Promise<void> {
    const { error } = await supabase
        .from('property_journey')
        .update({
            visit_completed: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}

export async function collectVisitFeedback(
    supabase: SupabaseClient,
    journeyId: string,
    score: number,
    text?: string,
    objections?: string[]
): Promise<void> {
    const { error } = await supabase
        .from('property_journey')
        .update({
            feedback_collected: true,
            feedback_score: score,
            feedback_text: text || null,
            feedback_objections: objections || [],
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}

export async function registerProposal(
    supabase: SupabaseClient,
    journeyId: string,
    value: number
): Promise<void> {
    const { error } = await supabase
        .from('property_journey')
        .update({
            proposal_sent: true,
            proposal_value: value,
            proposal_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}

export async function updateDocumentChecklist(
    supabase: SupabaseClient,
    journeyId: string,
    checklist: DocumentChecklistItem[]
): Promise<void> {
    const { error } = await supabase
        .from('property_journey')
        .update({
            documentation_checklist: checklist,
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}

export async function rescheduleVisit(
    supabase: SupabaseClient,
    journeyId: string,
    newDatetime: string
): Promise<void> {
    const defaultReminders: VisitReminderConfig[] = [
        { type: '2d', days_before: 2, sent: false, sent_at: null },
        { type: '1d', days_before: 1, sent: false, sent_at: null },
        { type: 'day', hours_before: 2, sent: false, sent_at: null },
    ];

    const { error } = await supabase
        .from('property_journey')
        .update({
            rescheduled_to: newDatetime,
            visit_datetime: newDatetime,
            visit_reminders_config: defaultReminders,
            confirmed: false,
            confirmed_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

    if (error) throw error;
}
