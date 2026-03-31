/**
 * @fileoverview Follow-up Sequences Service
 *
 * Core service for proactive follow-up sequences.
 * Manages sequence CRUD, execution lifecycle, scheduling, and stop conditions.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface FollowupStep {
    step_number: number;
    delay_minutes: number;
    message_type: 'ai_generated' | 'template' | 'template_with_ai';
    message_prompt: string;
    condition?: string;
    channel: 'whatsapp' | 'whatsapp_template';
    fallback_to_template: boolean;
    create_inbox_item: boolean;
    max_retry: number;
}

export interface FollowupSequence {
    id: string;
    organization_id: string;
    name: string;
    sequence_type: 'quick' | 'warm' | 'pipeline' | 'remarketing' | 'reactivation';
    vertical_type: 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate';
    is_active: boolean;
    steps: FollowupStep[];
    trigger_condition: Record<string, any>;
    stop_conditions: string[];
    max_messages_per_day: number;
    respect_business_hours: boolean;
    min_hours_between_messages: number;
    respect_24h_window: boolean;
    template_message_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface FollowupExecution {
    id: string;
    organization_id: string;
    sequence_id: string;
    conversation_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
    status: 'active' | 'paused' | 'completed' | 'cancelled' | 'stopped_by_reply';
    current_step: number;
    messages_sent: number;
    last_sent_at: string | null;
    next_scheduled_at: string | null;
    result: string | null;
    result_at: string | null;
    created_at: string;
    updated_at: string;
    sequence?: FollowupSequence;
}

export interface CreateSequencePayload {
    name: string;
    sequence_type: FollowupSequence['sequence_type'];
    vertical_type?: FollowupSequence['vertical_type'];
    steps: FollowupStep[];
    trigger_condition: Record<string, any>;
    stop_conditions?: string[];
    max_messages_per_day?: number;
    respect_business_hours?: boolean;
    min_hours_between_messages?: number;
    respect_24h_window?: boolean;
    template_message_id?: string;
}

export interface CreateExecutionPayload {
    sequence_id: string;
    conversation_id?: string;
    contact_id?: string;
    deal_id?: string;
}

// =============================================
// Sequences CRUD
// =============================================

export async function getFollowupSequences(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { type?: string; vertical?: string; activeOnly?: boolean }
): Promise<FollowupSequence[]> {
    let query = supabase
        .from('followup_sequences')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sequence_type')
        .order('name');

    if (options?.type) query = query.eq('sequence_type', options.type);
    if (options?.vertical) query = query.eq('vertical_type', options.vertical);
    if (options?.activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createFollowupSequence(
    supabase: SupabaseClient,
    organizationId: string,
    payload: CreateSequencePayload
): Promise<FollowupSequence> {
    const { data, error } = await supabase
        .from('followup_sequences')
        .insert({
            organization_id: organizationId,
            name: payload.name,
            sequence_type: payload.sequence_type,
            vertical_type: payload.vertical_type || 'generic',
            steps: payload.steps,
            trigger_condition: payload.trigger_condition,
            stop_conditions: payload.stop_conditions || ['lead_replied', 'deal_won', 'deal_lost', 'unsubscribed'],
            max_messages_per_day: payload.max_messages_per_day ?? 2,
            respect_business_hours: payload.respect_business_hours ?? true,
            min_hours_between_messages: payload.min_hours_between_messages ?? 4,
            respect_24h_window: payload.respect_24h_window ?? true,
            template_message_id: payload.template_message_id || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateFollowupSequence(
    supabase: SupabaseClient,
    sequenceId: string,
    payload: Partial<CreateSequencePayload> & { is_active?: boolean }
): Promise<FollowupSequence> {
    const { data, error } = await supabase
        .from('followup_sequences')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', sequenceId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteFollowupSequence(
    supabase: SupabaseClient,
    sequenceId: string
): Promise<void> {
    // Cancel active executions first
    await supabase
        .from('followup_executions')
        .update({ status: 'cancelled', result: 'manual_stop', result_at: new Date().toISOString() })
        .eq('sequence_id', sequenceId)
        .eq('status', 'active');

    const { error } = await supabase
        .from('followup_sequences')
        .delete()
        .eq('id', sequenceId);

    if (error) throw error;
}

// =============================================
// Executions CRUD
// =============================================

export async function getFollowupExecutions(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { status?: string; conversationId?: string; dealId?: string; limit?: number }
): Promise<FollowupExecution[]> {
    let query = supabase
        .from('followup_executions')
        .select('*, sequence:followup_sequences(*)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.conversationId) query = query.eq('conversation_id', options.conversationId);
    if (options?.dealId) query = query.eq('deal_id', options.dealId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createFollowupExecution(
    supabase: SupabaseClient,
    organizationId: string,
    payload: CreateExecutionPayload
): Promise<FollowupExecution> {
    // Get the sequence to calculate first step schedule
    const { data: sequence, error: seqErr } = await supabase
        .from('followup_sequences')
        .select('*')
        .eq('id', payload.sequence_id)
        .single();

    if (seqErr || !sequence) throw new Error('Sequence not found');
    if (!sequence.is_active) throw new Error('Sequence is inactive');

    const steps = sequence.steps as FollowupStep[];
    const firstStep = steps[0];
    if (!firstStep) throw new Error('Sequence has no steps');

    const nextScheduledAt = new Date(Date.now() + firstStep.delay_minutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('followup_executions')
        .insert({
            organization_id: organizationId,
            sequence_id: payload.sequence_id,
            conversation_id: payload.conversation_id || null,
            contact_id: payload.contact_id || null,
            deal_id: payload.deal_id || null,
            status: 'active',
            current_step: 0,
            next_scheduled_at: nextScheduledAt,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function cancelExecution(
    supabase: SupabaseClient,
    executionId: string,
    reason: string = 'manual_stop'
): Promise<void> {
    const { error } = await supabase
        .from('followup_executions')
        .update({
            status: 'cancelled',
            result: reason,
            result_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', executionId);

    if (error) throw error;
}

export async function pauseExecution(
    supabase: SupabaseClient,
    executionId: string
): Promise<void> {
    const { error } = await supabase
        .from('followup_executions')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', executionId);

    if (error) throw error;
}

export async function resumeExecution(
    supabase: SupabaseClient,
    executionId: string
): Promise<void> {
    const { error } = await supabase
        .from('followup_executions')
        .update({
            status: 'active',
            next_scheduled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', executionId);

    if (error) throw error;
}

// =============================================
// Scheduler: Process Scheduled Follow-ups
// =============================================

export async function advanceExecution(
    supabase: SupabaseClient,
    executionId: string
): Promise<{ completed: boolean; nextStep?: FollowupStep }> {
    // Get execution with sequence
    const { data: execution, error: execErr } = await supabase
        .from('followup_executions')
        .select('*, sequence:followup_sequences(*)')
        .eq('id', executionId)
        .single();

    if (execErr || !execution) throw new Error('Execution not found');
    if (execution.status !== 'active') throw new Error('Execution not active');

    const sequence = execution.sequence as FollowupSequence;
    const steps = sequence.steps as FollowupStep[];
    const nextStepIndex = execution.current_step + 1;

    if (nextStepIndex >= steps.length) {
        // Sequence completed
        await supabase
            .from('followup_executions')
            .update({
                status: 'completed',
                current_step: nextStepIndex,
                result: 'max_attempts',
                result_at: new Date().toISOString(),
                messages_sent: execution.messages_sent + 1,
                last_sent_at: new Date().toISOString(),
                next_scheduled_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', executionId);

        return { completed: true };
    }

    const nextStep = steps[nextStepIndex];
    const nextScheduledAt = new Date(Date.now() + nextStep.delay_minutes * 60 * 1000).toISOString();

    await supabase
        .from('followup_executions')
        .update({
            current_step: nextStepIndex,
            messages_sent: execution.messages_sent + 1,
            last_sent_at: new Date().toISOString(),
            next_scheduled_at: nextScheduledAt,
            updated_at: new Date().toISOString(),
        })
        .eq('id', executionId);

    return { completed: false, nextStep };
}

export async function processScheduledFollowups(
    supabase: SupabaseClient
): Promise<{ processed: number; errors: number }> {
    // Get all active executions whose next_scheduled_at has passed
    const { data: dueExecutions, error } = await supabase
        .from('followup_executions')
        .select('*, sequence:followup_sequences(*)')
        .eq('status', 'active')
        .lte('next_scheduled_at', new Date().toISOString())
        .order('next_scheduled_at')
        .limit(50);

    if (error) throw error;
    if (!dueExecutions?.length) return { processed: 0, errors: 0 };

    let processed = 0;
    let errors = 0;

    for (const execution of dueExecutions) {
        try {
            const sequence = execution.sequence as FollowupSequence;

            // Check rate limiting
            if (sequence.respect_business_hours && !isBusinessHours()) {
                continue; // Skip, will be picked up next run
            }

            if (execution.messages_sent >= sequence.max_messages_per_day) {
                continue; // Daily limit reached
            }

            if (execution.last_sent_at) {
                const hoursSinceLastSent = (Date.now() - new Date(execution.last_sent_at).getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastSent < sequence.min_hours_between_messages) {
                    continue; // Too soon since last message
                }
            }

            // Advance the execution
            await advanceExecution(supabase, execution.id);
            processed++;
        } catch (err) {
            console.error(`[followups] Error processing execution ${execution.id}:`, err);
            errors++;
        }
    }

    return { processed, errors };
}

export async function stopExecutionsByConversation(
    supabase: SupabaseClient,
    conversationId: string,
    reason: string = 'lead_replied'
): Promise<number> {
    const { data, error } = await supabase
        .from('followup_executions')
        .update({
            status: 'stopped_by_reply',
            result: reason,
            result_at: new Date().toISOString(),
            next_scheduled_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
        .select('id');

    if (error) throw error;
    return data?.length || 0;
}

// =============================================
// Helpers
// =============================================

function isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}
