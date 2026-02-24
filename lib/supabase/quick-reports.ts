/**
 * @fileoverview Quick Reports Service
 * 
 * Módulo 8 do PRD Complementar — Relatórios Rápidos.
 * Gera relatórios on-demand a partir de dados do CRM.
 * 
 * Tipos: sales_summary, pipeline_health, team_performance, activity_report.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export type ReportType = 'sales_summary' | 'pipeline_health' | 'team_performance' | 'activity_report';

export interface ReportFilters {
    start_date: string;      // ISO 8601
    end_date: string;        // ISO 8601
    board_id?: string;
    owner_id?: string;
}

export interface SalesSummaryReport {
    total_won: number;
    total_lost: number;
    total_open: number;
    won_value: number;
    lost_value: number;
    open_value: number;
    win_rate: number;
    avg_deal_value: number;
    avg_close_days: number;
    deals_by_month: { month: string; won: number; lost: number; value: number }[];
}

export interface PipelineHealthReport {
    stages: {
        id: string;
        name: string;
        deals_count: number;
        total_value: number;
        avg_days_in_stage: number;
        stagnant_count: number;
    }[];
    conversion_rates: { from_stage: string; to_stage: string; rate: number }[];
    bottleneck_stage: string | null;
    total_pipeline_value: number;
}

export interface TeamPerformanceReport {
    members: {
        id: string;
        name: string;
        deals_won: number;
        deals_lost: number;
        value_won: number;
        win_rate: number;
        activities_completed: number;
        avg_response_time_hours: number;
    }[];
    top_performer: string | null;
    team_win_rate: number;
}

export interface ActivityReport {
    total_activities: number;
    completed: number;
    overdue: number;
    by_type: { type: string; count: number }[];
    by_day: { date: string; count: number }[];
    completion_rate: number;
}

export type ReportResult =
    | { type: 'sales_summary'; data: SalesSummaryReport }
    | { type: 'pipeline_health'; data: PipelineHealthReport }
    | { type: 'team_performance'; data: TeamPerformanceReport }
    | { type: 'activity_report'; data: ActivityReport };

// =============================================
// Report Generation
// =============================================

/**
 * Gera relatório de resumo de vendas.
 */
async function generateSalesSummary(
    supabase: SupabaseClient,
    organizationId: string,
    filters: ReportFilters
): Promise<SalesSummaryReport> {
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, value, status, created_at, updated_at')
        .eq('organization_id', organizationId)
        .gte('created_at', filters.start_date)
        .lte('created_at', filters.end_date);

    if (error) throw error;
    const allDeals = deals || [];

    const won = allDeals.filter(d => d.status === 'won');
    const lost = allDeals.filter(d => d.status === 'lost');
    const open = allDeals.filter(d => d.status === 'open');

    const wonValue = won.reduce((sum, d) => sum + (d.value || 0), 0);
    const lostValue = lost.reduce((sum, d) => sum + (d.value || 0), 0);
    const openValue = open.reduce((sum, d) => sum + (d.value || 0), 0);

    const closedDeals = [...won, ...lost];
    const winRate = closedDeals.length > 0 ? (won.length / closedDeals.length) * 100 : 0;
    const avgDealValue = won.length > 0 ? wonValue / won.length : 0;

    // Average days to close
    const closeDays = won.map(d => {
        const created = new Date(d.created_at);
        const updated = new Date(d.updated_at);
        return Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avgCloseDays = closeDays.length > 0
        ? closeDays.reduce((a, b) => a + b, 0) / closeDays.length
        : 0;

    // Group by month
    const monthMap = new Map<string, { won: number; lost: number; value: number }>();
    allDeals.forEach(d => {
        const month = d.created_at.substring(0, 7); // YYYY-MM
        const existing = monthMap.get(month) || { won: 0, lost: 0, value: 0 };
        if (d.status === 'won') {
            existing.won++;
            existing.value += d.value || 0;
        } else if (d.status === 'lost') {
            existing.lost++;
        }
        monthMap.set(month, existing);
    });

    return {
        total_won: won.length,
        total_lost: lost.length,
        total_open: open.length,
        won_value: wonValue,
        lost_value: lostValue,
        open_value: openValue,
        win_rate: Math.round(winRate * 10) / 10,
        avg_deal_value: Math.round(avgDealValue),
        avg_close_days: Math.round(avgCloseDays),
        deals_by_month: Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({ month, ...data })),
    };
}

/**
 * Gera relatório de saúde do pipeline.
 */
async function generatePipelineHealth(
    supabase: SupabaseClient,
    organizationId: string,
    filters: ReportFilters
): Promise<PipelineHealthReport> {
    const boardFilter = filters.board_id;

    let dealsQuery = supabase
        .from('deals')
        .select('id, value, status, stage_id, updated_at, stage:board_stages(id, name)')
        .eq('organization_id', organizationId)
        .eq('status', 'open');

    if (boardFilter) {
        dealsQuery = dealsQuery.eq('board_id', boardFilter);
    }

    const { data: deals, error } = await dealsQuery;
    if (error) throw error;

    const stageMap = new Map<string, {
        id: string;
        name: string;
        deals_count: number;
        total_value: number;
        days_sum: number;
        stagnant_count: number;
    }>();

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    (deals || []).forEach((d: any) => {
        const stageId = d.stage_id;
        const stageName = d.stage?.name || 'Unknown';

        const existing = stageMap.get(stageId) || {
            id: stageId,
            name: stageName,
            deals_count: 0,
            total_value: 0,
            days_sum: 0,
            stagnant_count: 0,
        };

        existing.deals_count++;
        existing.total_value += d.value || 0;

        const daysSinceUpdate = (now - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        existing.days_sum += daysSinceUpdate;

        if (now - new Date(d.updated_at).getTime() > sevenDays) {
            existing.stagnant_count++;
        }

        stageMap.set(stageId, existing);
    });

    const stages = Array.from(stageMap.values()).map(s => ({
        ...s,
        avg_days_in_stage: s.deals_count > 0 ? Math.round(s.days_sum / s.deals_count) : 0,
    }));

    // Find bottleneck (stage with most stagnant deals)
    const bottleneck = stages.reduce((max, s) =>
        s.stagnant_count > (max?.stagnant_count || 0) ? s : max, stages[0]);

    return {
        stages,
        conversion_rates: [], // Requires historical data
        bottleneck_stage: bottleneck?.stagnant_count > 0 ? bottleneck.name : null,
        total_pipeline_value: stages.reduce((sum, s) => sum + s.total_value, 0),
    };
}

/**
 * Gera relatório de performance da equipe.
 */
async function generateTeamPerformance(
    supabase: SupabaseClient,
    organizationId: string,
    filters: ReportFilters
): Promise<TeamPerformanceReport> {
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, value, status, owner_id, owner:profiles!deals_owner_id_fkey(id, full_name)')
        .eq('organization_id', organizationId)
        .in('status', ['won', 'lost'])
        .gte('updated_at', filters.start_date)
        .lte('updated_at', filters.end_date);

    if (error) throw error;

    const { data: activities, error: actErr } = await supabase
        .from('activities')
        .select('id, user_id, status')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .gte('completed_at', filters.start_date)
        .lte('completed_at', filters.end_date);

    if (actErr) throw actErr;

    const memberMap = new Map<string, {
        id: string;
        name: string;
        deals_won: number;
        deals_lost: number;
        value_won: number;
        activities_completed: number;
    }>();

    (deals || []).forEach((d: any) => {
        if (!d.owner_id) return;
        const existing = memberMap.get(d.owner_id) || {
            id: d.owner_id,
            name: d.owner?.full_name || 'Unknown',
            deals_won: 0,
            deals_lost: 0,
            value_won: 0,
            activities_completed: 0,
        };

        if (d.status === 'won') {
            existing.deals_won++;
            existing.value_won += d.value || 0;
        } else {
            existing.deals_lost++;
        }
        memberMap.set(d.owner_id, existing);
    });

    (activities || []).forEach((a: any) => {
        if (!a.user_id) return;
        const existing = memberMap.get(a.user_id);
        if (existing) {
            existing.activities_completed++;
        }
    });

    const members = Array.from(memberMap.values()).map(m => ({
        ...m,
        win_rate: (m.deals_won + m.deals_lost) > 0
            ? Math.round((m.deals_won / (m.deals_won + m.deals_lost)) * 1000) / 10
            : 0,
        avg_response_time_hours: 0, // Would need more data
    }));

    const topPerformer = members.reduce((max, m) =>
        m.value_won > (max?.value_won || 0) ? m : max, members[0]);

    const totalWon = members.reduce((sum, m) => sum + m.deals_won, 0);
    const totalClosed = members.reduce((sum, m) => sum + m.deals_won + m.deals_lost, 0);

    return {
        members: members.sort((a, b) => b.value_won - a.value_won),
        top_performer: topPerformer?.name || null,
        team_win_rate: totalClosed > 0 ? Math.round((totalWon / totalClosed) * 1000) / 10 : 0,
    };
}

/**
 * Gera relatório de atividades.
 */
async function generateActivityReport(
    supabase: SupabaseClient,
    organizationId: string,
    filters: ReportFilters
): Promise<ActivityReport> {
    const { data: activities, error } = await supabase
        .from('activities')
        .select('id, type, status, scheduled_date, completed_at')
        .eq('organization_id', organizationId)
        .gte('scheduled_date', filters.start_date)
        .lte('scheduled_date', filters.end_date);

    if (error) throw error;

    const all = activities || [];
    const completed = all.filter(a => a.status === 'completed');
    const overdue = all.filter(a =>
        a.status !== 'completed' && new Date(a.scheduled_date) < new Date()
    );

    // By type
    const typeMap = new Map<string, number>();
    all.forEach(a => {
        typeMap.set(a.type, (typeMap.get(a.type) || 0) + 1);
    });

    // By day
    const dayMap = new Map<string, number>();
    all.forEach(a => {
        const date = a.scheduled_date.substring(0, 10);
        dayMap.set(date, (dayMap.get(date) || 0) + 1);
    });

    return {
        total_activities: all.length,
        completed: completed.length,
        overdue: overdue.length,
        by_type: Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })),
        by_day: Array.from(dayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count })),
        completion_rate: all.length > 0 ? Math.round((completed.length / all.length) * 1000) / 10 : 0,
    };
}

// =============================================
// Main Entry Point
// =============================================

/**
 * Gera um relatório do tipo especificado.
 */
export async function generateReport(
    supabase: SupabaseClient,
    organizationId: string,
    reportType: ReportType,
    filters: ReportFilters
): Promise<ReportResult> {
    switch (reportType) {
        case 'sales_summary':
            return { type: 'sales_summary', data: await generateSalesSummary(supabase, organizationId, filters) };
        case 'pipeline_health':
            return { type: 'pipeline_health', data: await generatePipelineHealth(supabase, organizationId, filters) };
        case 'team_performance':
            return { type: 'team_performance', data: await generateTeamPerformance(supabase, organizationId, filters) };
        case 'activity_report':
            return { type: 'activity_report', data: await generateActivityReport(supabase, organizationId, filters) };
        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
}
