'use client';

/**
 * @fileoverview Vertical Dashboard Widgets
 *
 * Renders the dashboard widgets defined in vertical_configs.dashboard_widgets.
 * Each widget type maps to a specific component:
 *   - kpi / kpi_alert / kpi_breakdown → VerticalKPICard
 *   - list / kpi_list → VerticalListWidget
 *   - donut / bar / progress / timeline → VerticalChartWidget
 *
 * @module features/dashboard/components/VerticalDashboardWidgets
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Users, DollarSign, Home, Calendar } from 'lucide-react';
import type { DashboardWidget, VerticalConfig } from '@/types/vertical';

// ─── Types ───────────────────────────────────────────────────────────

interface VerticalDashboardWidgetsProps {
    config: VerticalConfig;
    /** Widget data fetched from the server. Keys match widget.key */
    widgetData?: Record<string, WidgetDataPayload>;
}

export interface WidgetDataPayload {
    value?: number | string;
    previousValue?: number | string;
    items?: Array<{ id: string; label: string; sublabel?: string; value?: string }>;
    segments?: Array<{ label: string; value: number; color: string }>;
    progress?: Array<{ label: string; current: number; total: number }>;
}

// ─── Icon Map ────────────────────────────────────────────────────────

const WIDGET_ICONS: Record<string, typeof TrendingUp> = {
    absenteeism_rate: AlertTriangle,
    today_schedule: Calendar,
    revenue_by_insurance: DollarSign,
    reactivation_patients: Users,
    pending_authorizations: Clock,
    scheduled_returns: Calendar,
    budget_conversion_rate: TrendingUp,
    avg_ticket: DollarSign,
    pending_budgets: Clock,
    treatments_in_progress: TrendingUp,
    treatment_abandonment: AlertTriangle,
    maintenance_due: Clock,
    deals_by_broker: Users,
    visit_to_proposal_rate: TrendingUp,
    monthly_commissions: DollarSign,
    available_properties: Home,
    pending_matches: Users,
    avg_closing_time: Clock,
};

// ─── Main Component ──────────────────────────────────────────────────

export function VerticalDashboardWidgets({
    config,
    widgetData = {},
}: VerticalDashboardWidgetsProps) {
    const widgets = useMemo(
        () => config.dashboard_widgets ?? [],
        [config.dashboard_widgets],
    );

    if (widgets.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Métricas do Negócio
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {widgets.map((widget) => {
                    const data = widgetData[widget.key];
                    return (
                        <WidgetRenderer
                            key={widget.key}
                            widget={widget}
                            data={data}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ─── Widget Router ───────────────────────────────────────────────────

function WidgetRenderer({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    switch (widget.type) {
        case 'kpi':
        case 'kpi_alert':
        case 'kpi_breakdown':
            return <VerticalKPICard widget={widget} data={data} />;
        case 'list':
        case 'kpi_list':
            return <VerticalListWidget widget={widget} data={data} />;
        case 'donut':
        case 'bar':
            return <VerticalChartWidget widget={widget} data={data} />;
        case 'progress':
            return <VerticalProgressWidget widget={widget} data={data} />;
        case 'timeline':
            return <VerticalTimelineWidget widget={widget} data={data} />;
        default:
            return <VerticalKPICard widget={widget} data={data} />;
    }
}

// ─── KPI Card ────────────────────────────────────────────────────────

function VerticalKPICard({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    const Icon = WIDGET_ICONS[widget.key] ?? TrendingUp;
    const value = data?.value ?? '—';
    const prevValue = data?.previousValue;
    const isAlert = widget.type === 'kpi_alert';

    const trend = useMemo(() => {
        if (!prevValue || !data?.value) return null;
        const curr = Number(data.value);
        const prev = Number(prevValue);
        if (isNaN(curr) || isNaN(prev) || prev === 0) return null;
        return ((curr - prev) / prev) * 100;
    }, [data?.value, prevValue]);

    return (
        <div
            className={`
        rounded-xl border p-4 transition-shadow hover:shadow-md
        ${isAlert ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700'}
      `}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {widget.label}
                </span>
                <Icon className={`h-4 w-4 ${isAlert ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            <div className="mt-2 flex items-end gap-2">
                <span className={`text-2xl font-bold ${isAlert ? 'text-red-700' : 'text-gray-900 dark:text-gray-50'}`}>
                    {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </span>
                {trend !== null && (
                    <span
                        className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                    >
                        {trend >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                        ) : (
                            <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── List Widget ─────────────────────────────────────────────────────

function VerticalListWidget({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    const items = data?.items ?? [];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-900 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {widget.label}
                </span>
                {data?.value && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {data.value}
                    </span>
                )}
            </div>
            <div className="space-y-2">
                {items.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum item</p>
                ) : (
                    items.slice(0, 5).map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800"
                        >
                            <div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {item.label}
                                </span>
                                {item.sublabel && (
                                    <span className="ml-2 text-gray-500">{item.sublabel}</span>
                                )}
                            </div>
                            {item.value && (
                                <span className="text-xs font-medium text-gray-600">
                                    {item.value}
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Chart Widget (Donut / Bar) ──────────────────────────────────────

function VerticalChartWidget({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    const segments = data?.segments ?? [];
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-900 dark:border-gray-700">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {widget.label}
            </span>
            <div className="mt-3 space-y-2">
                {segments.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Sem dados</p>
                ) : (
                    segments.map((seg) => {
                        const pct = total > 0 ? (seg.value / total) * 100 : 0;
                        return (
                            <div key={seg.label} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">{seg.label}</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {pct.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, backgroundColor: seg.color }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─── Progress Widget ─────────────────────────────────────────────────

function VerticalProgressWidget({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    const items = data?.progress ?? [];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-900 dark:border-gray-700 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {widget.label}
            </span>
            <div className="mt-3 space-y-3">
                {items.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum tratamento</p>
                ) : (
                    items.slice(0, 6).map((item) => {
                        const pct = item.total > 0 ? (item.current / item.total) * 100 : 0;
                        return (
                            <div key={item.label} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {item.current}/{item.total}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                                    <div
                                        className="h-full rounded-full bg-violet-500 transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─── Timeline Widget ─────────────────────────────────────────────────

function VerticalTimelineWidget({
    widget,
    data,
}: {
    widget: DashboardWidget;
    data?: WidgetDataPayload;
}) {
    const items = data?.items ?? [];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-900 dark:border-gray-700">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {widget.label}
            </span>
            <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum evento</p>
                ) : (
                    items.slice(0, 5).map((item, i) => (
                        <div key={item.id} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                {i < items.length - 1 && (
                                    <div className="h-full w-px bg-gray-200 dark:bg-gray-700" />
                                )}
                            </div>
                            <div className="pb-3">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {item.label}
                                </span>
                                {item.sublabel && (
                                    <p className="text-xs text-gray-500">{item.sublabel}</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
