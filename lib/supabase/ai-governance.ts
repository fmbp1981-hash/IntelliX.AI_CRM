/**
 * @fileoverview AI Governance Service
 * 
 * Gerencia quotas de uso de IA, logging de consumo, e cálculo de custos.
 * Integra-se com a tabela `ai_usage_logs` e `ai_quotas` do banco de dados.
 *
 * ## Funções principais:
 * - `checkQuota()`: Verifica se a organização atingiu o limite mensal
 * - `logAIUsage()`: Registra cada chamada de IA com tokens e custo estimado
 * - `getUsageStats()`: Retorna métricas de uso agregadas por período
 * - `getQuotaStatus()`: Retorna status atual da quota (usado/total/%)
 * 
 * ## Tabelas utilizadas:
 * - `ai_usage_logs`: Registro individual de cada chamada
 * - `ai_quotas`: Limites configurados por organização
 * 
 * @module lib/supabase/ai-governance
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────

export interface AIUsageEntry {
    organization_id: string;
    user_id: string;
    action: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    duration_ms: number;
    success: boolean;
    error_message?: string;
}

export interface AIQuotaStatus {
    organization_id: string;
    monthly_limit_tokens: number;
    tokens_used_this_month: number;
    percentage_used: number;
    reset_day: number;
    is_over_limit: boolean;
    alert_threshold_pct: number;
    is_near_limit: boolean;
}

export interface AIUsageStats {
    period: string;
    total_tokens: number;
    total_cost_usd: number;
    total_requests: number;
    success_count: number;
    error_count: number;
    by_provider: Record<string, { tokens: number; cost: number; count: number }>;
    by_action: Record<string, { tokens: number; cost: number; count: number }>;
    by_model: Record<string, { tokens: number; cost: number; count: number }>;
}

// ─── Custo estimado por 1K tokens (preços aproximados, fev/2026) ────

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
    // Google Gemini
    'gemini-2.0-flash': { input: 0.00010, output: 0.00040 },
    'gemini-2.0-pro': { input: 0.00125, output: 0.00500 },
    'gemini-1.5-flash': { input: 0.00008, output: 0.00030 },
    // OpenAI
    'gpt-4o': { input: 0.00250, output: 0.01000 },
    'gpt-4o-mini': { input: 0.00015, output: 0.00060 },
    'gpt-4-turbo': { input: 0.01000, output: 0.03000 },
    // Anthropic
    'claude-3.5-sonnet': { input: 0.00300, output: 0.01500 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = COST_PER_1K_TOKENS[model] ?? { input: 0.001, output: 0.003 };
    return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
}

// ─── Check Quota ─────────────────────────────────────────────────────

/**
 * Verifica se a organização ainda tem quota de IA disponível.
 * Retorna `{ allowed: true }` se pode prosseguir, ou
 * `{ allowed: false, reason: string }` caso contrário.
 */
export async function checkQuota(
    supabase: SupabaseClient,
    organizationId: string
): Promise<{ allowed: boolean; reason?: string; quotaStatus?: AIQuotaStatus }> {
    const status = await getQuotaStatus(supabase, organizationId);

    if (!status) {
        // Sem quota configurada = sem limite (free tier)
        return { allowed: true };
    }

    if (status.is_over_limit) {
        return {
            allowed: false,
            reason: `Quota mensal de IA atingida (${status.tokens_used_this_month.toLocaleString()}/${status.monthly_limit_tokens.toLocaleString()} tokens). Resets no dia ${status.reset_day}.`,
            quotaStatus: status,
        };
    }

    return { allowed: true, quotaStatus: status };
}

// ─── Get Quota Status ────────────────────────────────────────────────

/**
 * Retorna o status atual da quota de IA para a organização.
 */
export async function getQuotaStatus(
    supabase: SupabaseClient,
    organizationId: string
): Promise<AIQuotaStatus | null> {
    const { data: quota } = await supabase
        .from('ai_quotas')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

    if (!quota) return null;

    const monthlyLimit = quota.monthly_token_limit || 0;
    if (monthlyLimit === 0) return null; // 0 = sem limite

    const tokensUsed = quota.tokens_used_current_month || 0;
    const percentage = monthlyLimit > 0 ? (tokensUsed / monthlyLimit) * 100 : 0;
    const alertThreshold = quota.alert_threshold_pct || 80;

    return {
        organization_id: organizationId,
        monthly_limit_tokens: monthlyLimit,
        tokens_used_this_month: tokensUsed,
        percentage_used: Math.round(percentage * 100) / 100,
        reset_day: quota.reset_day || 1,
        is_over_limit: tokensUsed >= monthlyLimit,
        alert_threshold_pct: alertThreshold,
        is_near_limit: percentage >= alertThreshold,
    };
}

// ─── Log AI Usage ────────────────────────────────────────────────────

/**
 * Registra uma chamada de IA no log de uso e atualiza o contador da quota.
 */
export async function logAIUsage(
    supabase: SupabaseClient,
    entry: AIUsageEntry
): Promise<void> {
    // 1. Inserir log individual
    await supabase.from('ai_usage_logs').insert({
        organization_id: entry.organization_id,
        user_id: entry.user_id,
        action: entry.action,
        provider: entry.provider,
        model: entry.model,
        input_tokens: entry.input_tokens,
        output_tokens: entry.output_tokens,
        total_tokens: entry.total_tokens,
        estimated_cost_usd: entry.estimated_cost_usd,
        duration_ms: entry.duration_ms,
        success: entry.success,
        error_message: entry.error_message,
    });

    // 2. Incrementar contador de tokens no quota (se existir)
    if (entry.success && entry.total_tokens > 0) {
        await supabase.rpc('increment_ai_quota_usage', {
            p_organization_id: entry.organization_id,
            p_tokens: entry.total_tokens,
        });
    }
}

// ─── Get Usage Stats ─────────────────────────────────────────────────

/**
 * Retorna estatísticas de uso de IA agregadas por período.
 * 
 * @param period - 'day' | 'week' | 'month' | 'all'
 */
export async function getUsageStats(
    supabase: SupabaseClient,
    organizationId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'month'
): Promise<AIUsageStats> {
    let query = supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    // Filtro de período
    const now = new Date();
    if (period === 'day') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        query = query.gte('created_at', start.toISOString());
    } else if (period === 'week') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        query = query.gte('created_at', start.toISOString());
    } else if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', start.toISOString());
    }

    const { data: logs } = await query;

    const stats: AIUsageStats = {
        period,
        total_tokens: 0,
        total_cost_usd: 0,
        total_requests: 0,
        success_count: 0,
        error_count: 0,
        by_provider: {},
        by_action: {},
        by_model: {},
    };

    if (!logs) return stats;

    for (const log of logs) {
        stats.total_tokens += log.total_tokens || 0;
        stats.total_cost_usd += log.estimated_cost_usd || 0;
        stats.total_requests += 1;
        if (log.success) stats.success_count++;
        else stats.error_count++;

        // Agrupa por provider
        const provider = log.provider || 'unknown';
        if (!stats.by_provider[provider]) stats.by_provider[provider] = { tokens: 0, cost: 0, count: 0 };
        stats.by_provider[provider].tokens += log.total_tokens || 0;
        stats.by_provider[provider].cost += log.estimated_cost_usd || 0;
        stats.by_provider[provider].count += 1;

        // Agrupa por action
        const action = log.action || 'unknown';
        if (!stats.by_action[action]) stats.by_action[action] = { tokens: 0, cost: 0, count: 0 };
        stats.by_action[action].tokens += log.total_tokens || 0;
        stats.by_action[action].cost += log.estimated_cost_usd || 0;
        stats.by_action[action].count += 1;

        // Agrupa por model
        const model = log.model || 'unknown';
        if (!stats.by_model[model]) stats.by_model[model] = { tokens: 0, cost: 0, count: 0 };
        stats.by_model[model].tokens += log.total_tokens || 0;
        stats.by_model[model].cost += log.estimated_cost_usd || 0;
        stats.by_model[model].count += 1;
    }

    stats.total_cost_usd = Math.round(stats.total_cost_usd * 100000) / 100000;

    return stats;
}

// ─── Exports utilitários ─────────────────────────────────────────────

export { estimateCost };
