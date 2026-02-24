/**
 * @fileoverview Activity Sequences Service
 * 
 * Módulo 6 do PRD Complementar — Cadência de Follow-up.
 * Gerencia sequências de atividades, enrollment de deals, e avanço de steps.
 * 
 * Sequence steps format (JSONB):
 * [{ action_type, title, delay_days, template?, notes? }, ...]
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface SequenceStep {
    action_type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'task';
    title: string;
    delay_days: number;
    template?: string;
    notes?: string;
}

export interface ActivitySequence {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    steps: SequenceStep[];
    trigger_stage_id: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface DealEnrollment {
    id: string;
    deal_id: string;
    sequence_id: string;
    current_step: number;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    started_at: string;
    next_activity_date: string | null;
    completed_at: string | null;
    // Joined
    deal?: { id: string; title: string; value?: number };
    sequence?: { id: string; name: string; steps: SequenceStep[] };
}

export interface CreateSequencePayload {
    name: string;
    description?: string;
    steps: SequenceStep[];
    trigger_stage_id?: string;
    is_active?: boolean;
}

// =============================================
// Sequences CRUD
// =============================================

/**
 * Busca todas as sequências da organização.
 */
export async function getSequences(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { activeOnly?: boolean }
): Promise<ActivitySequence[]> {
    let query = supabase
        .from('activity_sequences')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (options?.activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Busca uma sequência por ID.
 */
export async function getSequenceById(
    supabase: SupabaseClient,
    sequenceId: string
): Promise<ActivitySequence | null> {
    const { data, error } = await supabase
        .from('activity_sequences')
        .select('*')
        .eq('id', sequenceId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Cria uma nova sequência.
 */
export async function createSequence(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    payload: CreateSequencePayload
): Promise<ActivitySequence> {
    const { data, error } = await supabase
        .from('activity_sequences')
        .insert({
            organization_id: organizationId,
            name: payload.name,
            description: payload.description || null,
            steps: payload.steps,
            trigger_stage_id: payload.trigger_stage_id || null,
            is_active: payload.is_active ?? true,
            created_by: userId,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Atualiza uma sequência.
 */
export async function updateSequence(
    supabase: SupabaseClient,
    sequenceId: string,
    payload: Partial<CreateSequencePayload>
): Promise<ActivitySequence> {
    const { data, error } = await supabase
        .from('activity_sequences')
        .update({
            ...payload,
            updated_at: new Date().toISOString(),
        })
        .eq('id', sequenceId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Deleta uma sequência (cancela enrollments ativos).
 */
export async function deleteSequence(
    supabase: SupabaseClient,
    sequenceId: string
): Promise<void> {
    // Cancel active enrollments first
    await supabase
        .from('deal_sequence_enrollments')
        .update({ status: 'cancelled' })
        .eq('sequence_id', sequenceId)
        .eq('status', 'active');

    const { error } = await supabase
        .from('activity_sequences')
        .delete()
        .eq('id', sequenceId);

    if (error) throw error;
}

// =============================================
// Enrollment
// =============================================

/**
 * Inscreve um deal em uma sequência.
 */
export async function enrollDealInSequence(
    supabase: SupabaseClient,
    dealId: string,
    sequenceId: string
): Promise<DealEnrollment> {
    // Get sequence to calculate first next_activity_date
    const seq = await getSequenceById(supabase, sequenceId);
    if (!seq) throw new Error('Sequence not found');
    if (!seq.steps.length) throw new Error('Sequence has no steps');

    const firstStep = seq.steps[0];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + firstStep.delay_days);

    const { data, error } = await supabase
        .from('deal_sequence_enrollments')
        .upsert(
            {
                deal_id: dealId,
                sequence_id: sequenceId,
                current_step: 0,
                status: 'active',
                started_at: new Date().toISOString(),
                next_activity_date: nextDate.toISOString(),
                completed_at: null,
            },
            { onConflict: 'deal_id,sequence_id' }
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Avança um enrollment para o próximo step.
 * Se era o último step, marca como completed.
 */
export async function advanceEnrollmentStep(
    supabase: SupabaseClient,
    enrollmentId: string
): Promise<DealEnrollment> {
    // Get current enrollment with sequence
    const { data: enrollment, error: enrollError } = await supabase
        .from('deal_sequence_enrollments')
        .select('*, sequence:activity_sequences(*)')
        .eq('id', enrollmentId)
        .single();

    if (enrollError || !enrollment) throw new Error('Enrollment not found');

    const sequence = enrollment.sequence as ActivitySequence;
    const nextStep = enrollment.current_step + 1;

    if (nextStep >= sequence.steps.length) {
        // Sequence complete
        const { data, error } = await supabase
            .from('deal_sequence_enrollments')
            .update({
                current_step: nextStep,
                status: 'completed',
                completed_at: new Date().toISOString(),
                next_activity_date: null,
            })
            .eq('id', enrollmentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Calculate next activity date
    const nextStepConfig = sequence.steps[nextStep];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextStepConfig.delay_days);

    const { data, error } = await supabase
        .from('deal_sequence_enrollments')
        .update({
            current_step: nextStep,
            next_activity_date: nextDate.toISOString(),
        })
        .eq('id', enrollmentId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Busca enrollments de um deal.
 */
export async function getDealEnrollments(
    supabase: SupabaseClient,
    dealId: string
): Promise<DealEnrollment[]> {
    const { data, error } = await supabase
        .from('deal_sequence_enrollments')
        .select('*, sequence:activity_sequences(id, name, steps)')
        .eq('deal_id', dealId)
        .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Busca todos os enrollments ativos de uma organização.
 */
export async function getActiveEnrollments(
    supabase: SupabaseClient,
    organizationId: string
): Promise<DealEnrollment[]> {
    const { data, error } = await supabase
        .from('deal_sequence_enrollments')
        .select(`
      *,
      deal:deals(id, title, value),
      sequence:activity_sequences!inner(id, name, steps, organization_id)
    `)
        .eq('status', 'active')
        .eq('sequence.organization_id', organizationId)
        .order('next_activity_date');

    if (error) throw error;
    return data || [];
}

/**
 * Cancela um enrollment.
 */
export async function cancelEnrollment(
    supabase: SupabaseClient,
    enrollmentId: string
): Promise<void> {
    const { error } = await supabase
        .from('deal_sequence_enrollments')
        .update({ status: 'cancelled' })
        .eq('id', enrollmentId);

    if (error) throw error;
}

/**
 * Pausa um enrollment.
 */
export async function pauseEnrollment(
    supabase: SupabaseClient,
    enrollmentId: string
): Promise<void> {
    const { error } = await supabase
        .from('deal_sequence_enrollments')
        .update({ status: 'paused' })
        .eq('id', enrollmentId);

    if (error) throw error;
}

/**
 * Resume um enrollment pausado.
 */
export async function resumeEnrollment(
    supabase: SupabaseClient,
    enrollmentId: string
): Promise<void> {
    const { error } = await supabase
        .from('deal_sequence_enrollments')
        .update({ status: 'active' })
        .eq('id', enrollmentId);

    if (error) throw error;
}

// =============================================
// Scheduler Logic (called by pg_cron or API)
// =============================================

/**
 * Processa enrollments cujo next_activity_date já passou.
 * Cria atividades e avança steps.
 */
export async function processScheduledSteps(
    supabase: SupabaseClient,
    organizationId: string
): Promise<{ processed: number; errors: string[] }> {
    const now = new Date().toISOString();

    // Get due enrollments
    const { data: dueEnrollments, error } = await supabase
        .from('deal_sequence_enrollments')
        .select(`
      *,
      deal:deals(id, title, owner_id),
      sequence:activity_sequences!inner(id, name, steps, organization_id)
    `)
        .eq('status', 'active')
        .eq('sequence.organization_id', organizationId)
        .lte('next_activity_date', now);

    if (error || !dueEnrollments?.length) return { processed: 0, errors: [] };

    let processed = 0;
    const errors: string[] = [];

    for (const enrollment of dueEnrollments) {
        try {
            const sequence = enrollment.sequence as ActivitySequence;
            const step = sequence.steps[enrollment.current_step] as SequenceStep;

            if (!step) {
                await advanceEnrollmentStep(supabase, enrollment.id);
                continue;
            }

            // Create the activity
            const activityTypeMap: Record<string, string> = {
                call: 'CALL',
                email: 'EMAIL',
                whatsapp: 'WHATSAPP',
                meeting: 'MEETING',
                task: 'TASK',
            };

            const { error: createError } = await supabase
                .from('activities')
                .insert({
                    organization_id: organizationId,
                    deal_id: enrollment.deal_id,
                    user_id: enrollment.deal?.owner_id || enrollment.deal?.owner_id,
                    type: activityTypeMap[step.action_type] || 'TASK',
                    title: `[Sequência] ${step.title}`,
                    notes: step.notes || `Gerado pela sequência "${sequence.name}" (Step ${enrollment.current_step + 1}/${sequence.steps.length})`,
                    scheduled_date: new Date().toISOString(),
                    status: 'scheduled',
                });

            if (createError) {
                errors.push(`Enrollment ${enrollment.id}: ${createError.message}`);
                continue;
            }

            // Advance to next step
            await advanceEnrollmentStep(supabase, enrollment.id);
            processed++;
        } catch (err: any) {
            errors.push(`Enrollment ${enrollment.id}: ${err.message}`);
        }
    }

    return { processed, errors };
}
