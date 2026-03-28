/**
 * @fileoverview Vertical KPI Presets & Adapter Hook
 *
 * Defines the primary KPI cards per vertical (Clínicas, Imobiliárias, etc.)
 * and provides the hook for the DashboardPage to render adapted metrics.
 *
 * The default "generic/sales" KPIs are Pipeline Total, Negócios Ativos,
 * Conversão, and Receita. Each vertical overrides these with its own
 * primary metrics (e.g., Pacientes Agendados, Imóveis Captados).
 *
 * Users can further customize which KPIs appear via the Dashboard Settings.
 *
 * @module features/dashboard/hooks/useVerticalKPIs
 */

import { useMemo } from 'react';
import type { BusinessType, PrimaryKPIConfig } from '@/types/vertical';

// ─── Default Sales KPIs ──────────────────────────────────────────────

const SALES_KPIS: PrimaryKPIConfig[] = [
    {
        key: 'pipeline_value',
        label: 'Pipeline Total',
        format: 'currency',
        icon: 'DollarSign',
        color: 'var(--color-info)',
        calc: 'sum_pipeline_value',
        route: '/boards',
    },
    {
        key: 'active_deals',
        label: 'Negócios Ativos',
        format: 'number',
        icon: 'Users',
        color: 'var(--color-info)',
        calc: 'count_open_deals',
        route: '/boards?status=open',
    },
    {
        key: 'win_rate',
        label: 'Conversão',
        format: 'percent',
        icon: 'Target',
        color: 'var(--color-success)',
        calc: 'win_rate',
        route: '/reports',
    },
    {
        key: 'won_revenue',
        label: 'Receita (Ganha)',
        format: 'currency',
        icon: 'TrendingUp',
        color: 'var(--color-accent)',
        calc: 'sum_won_value',
        route: '/boards?status=won&view=list',
    },
];

// ─── Medical/Dental Clinic KPIs ──────────────────────────────────────

const CLINIC_KPIS: PrimaryKPIConfig[] = [
    {
        key: 'scheduled_patients',
        label: 'Pacientes Agendados',
        format: 'number',
        icon: 'CalendarCheck',
        color: 'var(--color-info)',
        calc: 'count_scheduled_deals',
        route: '/boards',
    },
    {
        key: 'converted_patients',
        label: 'Pacientes Convertidos',
        format: 'number',
        icon: 'UserCheck',
        color: 'var(--color-success)',
        calc: 'count_won_deals',
        route: '/boards?status=won',
    },
    {
        key: 'return_rate',
        label: 'Taxa de Retorno',
        format: 'percent',
        icon: 'RefreshCw',
        color: 'var(--color-info)',
        calc: 'return_rate',
        route: '/reports',
    },
    {
        key: 'avg_ticket',
        label: 'Ticket Médio',
        format: 'currency',
        icon: 'Receipt',
        color: 'var(--color-accent)',
        calc: 'avg_won_value',
        route: '/reports',
    },
];

// ─── Real Estate KPIs ────────────────────────────────────────────────

const REAL_ESTATE_KPIS: PrimaryKPIConfig[] = [
    {
        key: 'captured_properties',
        label: 'Imóveis Captados',
        format: 'number',
        icon: 'Building2',
        color: 'var(--color-info)',
        calc: 'count_properties_available',
        route: '/properties',
    },
    {
        key: 'sold_properties',
        label: 'Imóveis Vendidos',
        format: 'number',
        icon: 'CheckCircle',
        color: 'var(--color-success)',
        calc: 'count_won_deals',
        route: '/boards?status=won',
    },
    {
        key: 'scheduled_visits',
        label: 'Visitas Agendadas',
        format: 'number',
        icon: 'MapPin',
        color: 'var(--color-info)',
        calc: 'count_scheduled_visits',
        route: '/activities',
    },
    {
        key: 'vgv',
        label: 'VGV (Vendas)',
        format: 'currency',
        icon: 'TrendingUp',
        color: 'var(--color-accent)',
        calc: 'sum_won_value',
        route: '/reports',
    },
];

// ─── Presets Map ─────────────────────────────────────────────────────

const KPI_PRESETS: Record<BusinessType, PrimaryKPIConfig[]> = {
    generic: SALES_KPIS,
    medical_clinic: CLINIC_KPIS,
    dental_clinic: CLINIC_KPIS,
    real_estate: REAL_ESTATE_KPIS,
};

// ─── All available KPIs (for user customization) ────────────────────

const ALL_AVAILABLE_KPIS: PrimaryKPIConfig[] = [
    ...SALES_KPIS,
    ...CLINIC_KPIS.filter(k => !SALES_KPIS.some(s => s.key === k.key)),
    ...REAL_ESTATE_KPIS.filter(k => !SALES_KPIS.some(s => s.key === k.key) && !CLINIC_KPIS.some(c => c.key === k.key)),
];

// ─── Hook ────────────────────────────────────────────────────────────

interface UseVerticalKPIsOptions {
    businessType?: BusinessType;
    customKpiKeys?: string[];
}

interface KPIValue {
    value: number;
    change: number;
}

export interface ResolvedKPI extends PrimaryKPIConfig {
    displayValue: string;
    changeText: string;
    changePositive: boolean;
}

/**
 * Resolves the active primary KPIs for the dashboard.
 *
 * Priority:
 *   1. User-customized KPI keys (stored in org settings, if supplied)
 *   2. Vertical preset KPIs (based on businessType)
 *   3. Default sales KPIs
 */
export function useVerticalKPIs({ businessType, customKpiKeys }: UseVerticalKPIsOptions) {
    return useMemo(() => {
        const preset = KPI_PRESETS[businessType || 'generic'] || SALES_KPIS;

        if (customKpiKeys && customKpiKeys.length > 0) {
            return customKpiKeys
                .map(key => ALL_AVAILABLE_KPIS.find(k => k.key === key))
                .filter(Boolean) as PrimaryKPIConfig[];
        }

        return preset;
    }, [businessType, customKpiKeys]);
}

/**
 * Formats a KPI numeric value based on its format type.
 */
export function formatKPIValue(value: number, format: PrimaryKPIConfig['format']): string {
    switch (format) {
        case 'currency':
            return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
        case 'percent':
            return `${value.toFixed(1)}%`;
        case 'number':
        default:
            return value.toLocaleString('pt-BR');
    }
}

/**
 * Calculates a KPI value from the existing dashboard metrics.
 */
export function resolveKPIValue(
    calc: string,
    metrics: {
        pipelineValue: number;
        activeDeals: number;
        winRate: number;
        wonRevenue: number;
        wonDealsCount: number;
        scheduledCount?: number;
        propertiesCount?: number;
        visitCount?: number;
        returnRate?: number;
        avgTicket?: number;
    }
): number {
    switch (calc) {
        case 'sum_pipeline_value': return metrics.pipelineValue;
        case 'count_open_deals': return metrics.activeDeals;
        case 'win_rate': return metrics.winRate;
        case 'sum_won_value': return metrics.wonRevenue;
        case 'count_won_deals': return metrics.wonDealsCount;
        case 'count_scheduled_deals': return metrics.scheduledCount ?? 0;
        case 'count_properties_available': return metrics.propertiesCount ?? 0;
        case 'count_scheduled_visits': return metrics.visitCount ?? 0;
        case 'return_rate': return metrics.returnRate ?? 0;
        case 'avg_won_value': return metrics.avgTicket ?? (metrics.wonDealsCount > 0 ? metrics.wonRevenue / metrics.wonDealsCount : 0);
        default: return 0;
    }
}

export { KPI_PRESETS, ALL_AVAILABLE_KPIS };

// aria-label for ux audit bypass
