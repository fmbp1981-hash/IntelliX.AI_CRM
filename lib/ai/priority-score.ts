/**
 * @fileoverview Priority Score Calculator with Vertical Weights
 *
 * Extends the Inbox 2.0 Priority Score calculation with vertical-specific
 * weights from `ai_context.priority_weights` in the vertical config.
 *
 * Factors:
 *  1. Financial Value   — normalized deal value
 *  2. Idle Days         — days since last activity
 *  3. AI Probability    — deal.probability or estimated conversion
 *  4. Temporal Urgency  — time-sensitive items (appointments, deadlines)
 *  5. Recurrence/Retain — retention risk or maintenance cycles
 *
 * @module lib/ai/priority-score
 */

import type { VerticalConfig, PriorityWeights } from '@/types/vertical';

// ─── Types ───────────────────────────────────────────────────────────

export interface DealForScoring {
    id: string;
    value: number;
    probability?: number;
    updated_at: string;
    created_at: string;
    last_activity_at?: string;
    /** Custom fields may include scheduling dates, maintenance dates, etc. */
    customFields?: Record<string, unknown>;
}

export interface PriorityScoreResult {
    score: number;         // 0-100
    breakdown: {
        financial: number;
        idle: number;
        probability: number;
        urgency: number;
        retention: number;
    };
}

// ─── Default Weights (Generic) ───────────────────────────────────────

const DEFAULT_WEIGHTS: PriorityWeights = {
    financial_value: 0.30,
    idle_days: 0.30,
    ai_probability: 0.20,
    temporal_urgency: 0.10,
    recurrence_retention: 0.10,
};

// ─── Calculator ──────────────────────────────────────────────────────

/**
 * Calculates the Priority Score for a deal, using vertical-specific weights.
 *
 * @param deal            - The deal data
 * @param verticalConfig  - The vertical config (for weights); can be null for generic
 * @param avgDealValue    - Average deal value in this org (for normalization)
 *
 * @returns Score 0-100 with breakdown per factor
 */
export function calculatePriorityScore(
    deal: DealForScoring,
    verticalConfig?: VerticalConfig | null,
    avgDealValue: number = 1000,
): PriorityScoreResult {
    const weights =
        verticalConfig?.ai_context?.priority_weights ?? DEFAULT_WEIGHTS;

    // 1. Financial value (normalized 0-1)
    const financial = normalizeFinancial(deal.value, avgDealValue);

    // 2. Idle days (normalized 0-1)
    const lastActivity = deal.last_activity_at ?? deal.updated_at;
    const idle = normalizeIdleDays(lastActivity);

    // 3. AI probability (already 0-1 if present)
    const probability = deal.probability ?? 0.5;

    // 4. Temporal urgency
    const urgency = calculateTemporalUrgency(deal, verticalConfig);

    // 5. Retention risk
    const retention = calculateRetentionRisk(deal, verticalConfig);

    // Weighted sum
    const rawScore =
        financial * weights.financial_value +
        idle * weights.idle_days +
        probability * weights.ai_probability +
        urgency * weights.temporal_urgency +
        retention * weights.recurrence_retention;

    const score = Math.round(Math.min(rawScore * 100, 100));

    return {
        score,
        breakdown: {
            financial: Math.round(financial * 100),
            idle: Math.round(idle * 100),
            probability: Math.round(probability * 100),
            urgency: Math.round(urgency * 100),
            retention: Math.round(retention * 100),
        },
    };
}

// ─── Normalization Functions ─────────────────────────────────────────

/**
 * Normalizes deal value relative to average. Returns 0-1.
 * A deal worth 2x the average = 1.0 (capped).
 */
function normalizeFinancial(value: number, avgValue: number): number {
    if (avgValue <= 0) return 0.5;
    return Math.min(value / (avgValue * 2), 1);
}

/**
 * Normalizes idle days. Returns 0-1.
 * 0 days idle = 0.0, 14+ days idle = 1.0
 */
function normalizeIdleDays(lastActivityDate: string): number {
    const diffMs = Date.now() - new Date(lastActivityDate).getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    return Math.min(days / 14, 1);
}

/**
 * Calculates temporal urgency based on vertical context.
 *
 * - Medical: appointments within 24h without confirmation → high urgency
 * - Dental: budget older than 3 days → medium urgency
 * - Real estate: proposal pending 2+ days → medium urgency
 * - Generic: based on deal age alone
 */
function calculateTemporalUrgency(
    deal: DealForScoring,
    config?: VerticalConfig | null,
): number {
    const cf = deal.customFields ?? {};
    const businessType = config?.business_type;

    if (businessType === 'medical_clinic') {
        // Check scheduling date proximity
        const schedulingDate = cf['data_agendamento'] as string | undefined;
        if (schedulingDate) {
            const hoursUntil =
                (new Date(schedulingDate).getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursUntil <= 2) return 1.0;  // Within 2h — critical
            if (hoursUntil <= 24) return 0.8; // Within 24h — high
            if (hoursUntil <= 48) return 0.5; // Within 48h — medium
        }
        return 0.2;
    }

    if (businessType === 'dental_clinic') {
        const budgetStatus = cf['status_orcamento'] as string | undefined;
        if (budgetStatus === 'Enviado') {
            const lastUpdate = new Date(deal.updated_at);
            const daysSince =
                (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince >= 5) return 0.9;
            if (daysSince >= 3) return 0.7;
            return 0.3;
        }
        return 0.2;
    }

    if (businessType === 'real_estate') {
        const proposalStatus = cf['proposta_status'] as string | undefined;
        if (proposalStatus === 'Pendente') {
            const daysSince =
                (Date.now() - new Date(deal.updated_at).getTime()) /
                (1000 * 60 * 60 * 24);
            if (daysSince >= 3) return 0.9;
            if (daysSince >= 2) return 0.7;
            return 0.3;
        }
        return 0.2;
    }

    // Generic: based on deal age
    const dealAgeDays =
        (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return Math.min(dealAgeDays / 30, 1);
}

/**
 * Calculates retention/recurrence risk.
 *
 * - Medical: last consultation > 6 months → high risk
 * - Dental: last maintenance > 6 months → high risk
 * - Real estate: client without interaction > 7 days → medium risk
 * - Generic: based on idle time
 */
function calculateRetentionRisk(
    deal: DealForScoring,
    config?: VerticalConfig | null,
): number {
    const cf = deal.customFields ?? {};
    const businessType = config?.business_type;

    if (businessType === 'medical_clinic') {
        const lastConsulta = cf['ultima_consulta'] as string | undefined;
        if (lastConsulta) {
            const monthsSince =
                (Date.now() - new Date(lastConsulta).getTime()) /
                (1000 * 60 * 60 * 24 * 30);
            if (monthsSince >= 12) return 1.0;
            if (monthsSince >= 6) return 0.7;
            if (monthsSince >= 3) return 0.3;
            return 0.1;
        }
    }

    if (businessType === 'dental_clinic') {
        const lastMaintenance = cf['ultima_manutencao'] as string | undefined;
        if (lastMaintenance) {
            const monthsSince =
                (Date.now() - new Date(lastMaintenance).getTime()) /
                (1000 * 60 * 60 * 24 * 30);
            if (monthsSince >= 9) return 1.0;
            if (monthsSince >= 6) return 0.7;
            if (monthsSince >= 3) return 0.3;
            return 0.1;
        }
    }

    if (businessType === 'real_estate') {
        const lastActivity = deal.last_activity_at ?? deal.updated_at;
        const daysSince =
            (Date.now() - new Date(lastActivity).getTime()) /
            (1000 * 60 * 60 * 24);
        if (daysSince >= 14) return 1.0;
        if (daysSince >= 7) return 0.7;
        if (daysSince >= 3) return 0.3;
        return 0.1;
    }

    // Generic
    return normalizeIdleDays(deal.last_activity_at ?? deal.updated_at) * 0.5;
}
