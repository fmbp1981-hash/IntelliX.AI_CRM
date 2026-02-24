/**
 * @fileoverview Inbox Action Items Service
 * 
 * Gerencia os action items do Inbox Inteligente 2.0.
 * Cada action item representa uma ação sugerida ao vendedor baseada em:
 * - Deals estagnados (sem atividade há X dias)
 * - Atividades vencidas (overdue)
 * - Deals sem follow-up recente
 * - Deals com probabilidade declinante
 * 
 * ## Algoritmo de Priorização:
 * priority = (dealValue / avgDealValue) * stagnationDays * probabilityDecayFactor
 * 
 * ## Tipos de ação:
 * - CALL, EMAIL, WHATSAPP, MEETING, TASK, MOVE_STAGE
 * 
 * @module lib/supabase/inbox-actions
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────

export type ActionItemStatus = 'pending' | 'completed' | 'dismissed' | 'snoozed';
export type ActionItemType = 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'TASK' | 'MOVE_STAGE';
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionItem {
    id: string;
    organization_id: string;
    user_id: string;
    deal_id?: string;
    contact_id?: string;
    title: string;
    reason: string;
    action_type: ActionItemType;
    priority: ActionPriority;
    priority_score: number;
    suggested_script?: string;
    status: ActionItemStatus;
    snoozed_until?: string;
    completed_at?: string;
    dismissed_at?: string;
    created_at: string;
    // Joined fields
    deal?: { id: string; title: string; value: number; board_id: string };
    contact?: { id: string; name: string; phone: string; email: string };
}

export interface CreateActionItemPayload {
    deal_id?: string;
    contact_id?: string;
    title: string;
    reason: string;
    action_type: ActionItemType;
    priority: ActionPriority;
    priority_score: number;
    suggested_script?: string;
}

// ─── CRUD Operations ─────────────────────────────────────────────────

/**
 * Busca action items do inbox para o usuário autenticado.
 * Filtra por status e ordena por prioridade (score decrescente).
 */
export async function getActionItems(
    supabase: SupabaseClient,
    userId: string,
    options: {
        status?: ActionItemStatus;
        limit?: number;
        offset?: number;
    } = {}
) {
    const { status = 'pending', limit = 20, offset = 0 } = options;

    let query = supabase
        .from('inbox_action_items')
        .select('*')
        .eq('user_id', userId)
        .order('priority_score', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status === 'snoozed') {
        query = query
            .eq('status', 'snoozed')
            .gt('snoozed_until', new Date().toISOString());
    } else {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Cria um novo action item no inbox do usuário.
 */
export async function createActionItem(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string,
    payload: CreateActionItemPayload
) {
    const { data, error } = await supabase
        .from('inbox_action_items')
        .insert({
            user_id: userId,
            organization_id: organizationId,
            ...payload,
            status: 'pending' as ActionItemStatus,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Marca um action item como completado.
 */
export async function completeActionItem(
    supabase: SupabaseClient,
    itemId: string,
    userId: string
) {
    const { error } = await supabase
        .from('inbox_action_items')
        .update({
            status: 'completed' as ActionItemStatus,
            completed_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', userId);

    if (error) throw error;
}

/**
 * Descarta (dismissir) um action item.
 */
export async function dismissActionItem(
    supabase: SupabaseClient,
    itemId: string,
    userId: string
) {
    const { error } = await supabase
        .from('inbox_action_items')
        .update({
            status: 'dismissed' as ActionItemStatus,
            dismissed_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', userId);

    if (error) throw error;
}

/**
 * Adia um action item para uma data futura.
 */
export async function snoozeActionItem(
    supabase: SupabaseClient,
    itemId: string,
    userId: string,
    snoozeUntil: Date
) {
    const { error } = await supabase
        .from('inbox_action_items')
        .update({
            status: 'snoozed' as ActionItemStatus,
            snoozed_until: snoozeUntil.toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', userId);

    if (error) throw error;
}

// ─── Smart Generation ────────────────────────────────────────────────

/**
 * Gera action items inteligentes baseado na situação atual dos deals.
 * Analisa: deals estagnados, atividades vencidas, deals sem follow-up.
 * 
 * Retorna lista de items sugeridos (não salva automaticamente).
 */
export async function generateSmartActionItems(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string
): Promise<CreateActionItemPayload[]> {
    const items: CreateActionItemPayload[] = [];

    // 1. Deals estagnados (sem atividade há 5+ dias)
    const { data: stagnantDeals } = await supabase
        .from('deals')
        .select('id, title, value, contact_id, updated_at')
        .eq('organization_id', organizationId)
        .eq('owner_id', userId)
        .eq('is_won', false)
        .eq('is_lost', false)
        .is('closed_at', null)
        .lt('updated_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
        .order('value', { ascending: false })
        .limit(10);

    if (stagnantDeals) {
        // Calcular valor médio para score
        const avgValue = stagnantDeals.reduce((sum, d) => sum + (d.value || 0), 0) / (stagnantDeals.length || 1);

        for (const deal of stagnantDeals) {
            const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            const valueRatio = avgValue > 0 ? (deal.value || 0) / avgValue : 1;
            const score = Math.round(valueRatio * daysSinceUpdate * 10);

            items.push({
                deal_id: deal.id,
                contact_id: deal.contact_id,
                title: `Follow-up: ${deal.title}`,
                reason: `Sem atividade há ${daysSinceUpdate} dias. Valor: R$ ${(deal.value || 0).toLocaleString('pt-BR')}`,
                action_type: daysSinceUpdate > 10 ? 'CALL' : 'WHATSAPP',
                priority: score > 50 ? 'critical' : score > 30 ? 'high' : score > 15 ? 'medium' : 'low',
                priority_score: score,
            });
        }
    }

    // 2. Atividades vencidas (overdue)
    const { data: overdue } = await supabase
        .from('activities')
        .select('id, title, type, deal_id, contact_id, due_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(10);

    if (overdue) {
        for (const act of overdue) {
            const daysOverdue = Math.floor((Date.now() - new Date(act.due_date).getTime()) / (1000 * 60 * 60 * 24));
            const score = Math.round(daysOverdue * 20);

            items.push({
                deal_id: act.deal_id,
                contact_id: act.contact_id,
                title: `Atrasada: ${act.title}`,
                reason: `Atividade ${act.type} vencida há ${daysOverdue} dias`,
                action_type: (act.type as ActionItemType) || 'TASK',
                priority: daysOverdue > 5 ? 'critical' : daysOverdue > 2 ? 'high' : 'medium',
                priority_score: score,
            });
        }
    }

    // Ordenar por score decrescente
    items.sort((a, b) => b.priority_score - a.priority_score);

    return items.slice(0, 20);
}

// ─── Streak Counter ──────────────────────────────────────────────────

/**
 * Calcula o streak (dias consecutivos) do usuário completando todas as ações.
 */
export async function getUserStreak(
    supabase: SupabaseClient,
    userId: string
): Promise<{ streak: number; todayComplete: boolean }> {
    // Verificar se completou todas as ações de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: pendingToday } = await supabase
        .from('inbox_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', today.toISOString());

    const todayComplete = (pendingToday || 0) === 0;

    // Contar streak (simplificado: conta dias de completed consecutivos)
    const { data: completedActions } = await supabase
        .from('inbox_action_items')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(100);

    if (!completedActions || completedActions.length === 0) {
        return { streak: 0, todayComplete };
    }

    // Agrupar por dia e contar dias consecutivos
    const uniqueDays = new Set<string>();
    for (const a of completedActions) {
        if (a.completed_at) {
            uniqueDays.add(new Date(a.completed_at).toISOString().split('T')[0]);
        }
    }

    let streak = 0;
    const checkDate = new Date();

    for (let i = 0; i < 365; i++) {
        const dayStr = checkDate.toISOString().split('T')[0];
        if (uniqueDays.has(dayStr)) {
            streak++;
        } else if (i > 0) {
            break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return { streak, todayComplete };
}
