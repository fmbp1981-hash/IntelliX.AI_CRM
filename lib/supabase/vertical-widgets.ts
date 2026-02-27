/**
 * @fileoverview Vertical Dashboard Widget Data Service
 *
 * Fetches metric data for vertical-specific dashboard widgets.
 * Each vertical has different KPIs defined in vertical_configs.dashboard_widgets.
 * This service executes the appropriate queries per widget key and returns
 * a data payload matching the WidgetDataPayload interface.
 *
 * @module lib/supabase/vertical-widgets
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface WidgetDataPayload {
    value?: number | string;
    previousValue?: number | string;
    items?: Array<{ id: string; label: string; sublabel?: string; value?: string }>;
    segments?: Array<{ label: string; value: number; color: string }>;
    progress?: Array<{ label: string; current: number; total: number }>;
}

// ─── Main Entry Point ────────────────────────────────────────────────

export async function fetchWidgetData(
    supabase: SupabaseClient,
    organizationId: string,
    businessType: string,
    widgetKeys: string[]
): Promise<Record<string, WidgetDataPayload>> {
    const result: Record<string, WidgetDataPayload> = {};

    await Promise.all(
        widgetKeys.map(async (key) => {
            try {
                const fetcher = WIDGET_FETCHERS[key];
                if (fetcher) {
                    result[key] = await fetcher(supabase, organizationId);
                } else {
                    result[key] = { value: '—' };
                }
            } catch {
                result[key] = { value: '—' };
            }
        })
    );

    return result;
}

// ─── Widget Fetcher Registry ─────────────────────────────────────────

type WidgetFetcher = (
    supabase: SupabaseClient,
    orgId: string
) => Promise<WidgetDataPayload>;

const WIDGET_FETCHERS: Record<string, WidgetFetcher> = {
    // ── Medical Clinic ──
    absenteeism_rate: fetchAbsenteeismRate,
    today_schedule: fetchTodaySchedule,
    revenue_by_insurance: fetchRevenueByInsurance,
    reactivation_patients: fetchReactivationPatients,
    pending_authorizations: fetchPendingAuthorizations,
    scheduled_returns: fetchScheduledReturns,

    // ── Dental Clinic ──
    budget_conversion_rate: fetchBudgetConversionRate,
    avg_ticket: fetchAvgTicket,
    pending_budgets: fetchPendingBudgets,
    treatments_in_progress: fetchTreatmentsInProgress,
    treatment_abandonment: fetchTreatmentAbandonment,
    maintenance_due: fetchMaintenanceDue,

    // ── Real Estate ──
    deals_by_broker: fetchDealsByBroker,
    visit_to_proposal_rate: fetchVisitToProposalRate,
    monthly_commissions: fetchMonthlyCommissions,
    available_properties: fetchAvailableProperties,
    pending_matches: fetchPendingMatches,
    avg_closing_time: fetchAvgClosingTime,
};

// ─── Medical Clinic Fetchers ─────────────────────────────────────────

async function fetchAbsenteeismRate(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('organization_id', orgId)
        .gte('created_at', thirtyDaysAgo);

    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'compareceu')
        .in('entity_id', (deals ?? []).map(d => d.id));

    const total = cfValues?.length ?? 0;
    const absent = cfValues?.filter(cf => cf.field_value === false || cf.field_value === 'false').length ?? 0;
    const rate = total > 0 ? ((absent / total) * 100) : 0;

    return { value: `${rate.toFixed(1)}%` };
}

async function fetchTodaySchedule(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, contact_id')
        .eq('organization_id', orgId)
        .eq('is_won', false)
        .eq('is_lost', false)
        .order('created_at', { ascending: true })
        .limit(10);

    const items = (deals ?? []).slice(0, 5).map(d => ({
        id: d.id,
        label: d.title ?? 'Atendimento',
        sublabel: 'Hoje',
    }));

    return { value: items.length, items };
}

async function fetchRevenueByInsurance(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'contact')
        .eq('field_key', 'convenio');

    const counts: Record<string, number> = {};
    (cfValues ?? []).forEach(cf => {
        const val = String(cf.field_value ?? 'Particular');
        counts[val] = (counts[val] ?? 0) + 1;
    });

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#6366F1'];
    const segments = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value], i) => ({
            label,
            value,
            color: colors[i % colors.length],
        }));

    return { segments };
}

async function fetchReactivationPatients(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, updated_at')
        .eq('organization_id', orgId)
        .lt('updated_at', sixMonthsAgo)
        .order('updated_at', { ascending: true })
        .limit(10);

    const items = (contacts ?? []).map(c => ({
        id: c.id,
        label: c.name ?? 'Paciente',
        sublabel: c.email ?? '',
        value: `${Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)}d`,
    }));

    return { value: items.length, items };
}

async function fetchPendingAuthorizations(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'autorizacao_convenio')
        .eq('field_value', '"Pendente"');

    return { value: cfValues?.length ?? 0 };
}

async function fetchScheduledReturns(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const now = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();

    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'contact')
        .eq('field_key', 'proximo_retorno')
        .gte('field_value', `"${now}"`)
        .lte('field_value', `"${nextWeek}"`)
        .limit(10);

    const items = (cfValues ?? []).map(cf => ({
        id: cf.entity_id,
        label: 'Retorno agendado',
        sublabel: String(cf.field_value).replace(/"/g, ''),
    }));

    return { value: items.length, items };
}

// ─── Dental Clinic Fetchers ──────────────────────────────────────────

async function fetchBudgetConversionRate(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: sentBudgets } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'status_orcamento')
        .in('field_value', ['"Enviado"', '"Aprovado"', '"Negociando"', '"Recusado"']);

    const { data: approvedBudgets } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'status_orcamento')
        .eq('field_value', '"Aprovado"');

    const sent = sentBudgets?.length ?? 0;
    const approved = approvedBudgets?.length ?? 0;
    const rate = sent > 0 ? ((approved / sent) * 100) : 0;

    return { value: `${rate.toFixed(1)}%` };
}

async function fetchAvgTicket(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: deals } = await supabase
        .from('deals')
        .select('value')
        .eq('organization_id', orgId)
        .eq('is_won', true)
        .not('value', 'is', null);

    const values = (deals ?? []).map(d => Number(d.value)).filter(v => !isNaN(v) && v > 0);
    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;

    return { value: `R$ ${avg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` };
}

async function fetchPendingBudgets(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'status_orcamento')
        .in('field_value', ['"Enviado"', '"Negociando"']);

    const entityIds = (cfValues ?? []).map(cf => cf.entity_id);

    if (entityIds.length === 0) return { value: 0, items: [] };

    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, updated_at')
        .in('id', entityIds)
        .order('updated_at', { ascending: true })
        .limit(10);

    const items = (deals ?? []).map(d => ({
        id: d.id,
        label: d.title ?? 'Orçamento',
        sublabel: `${Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000)}d sem resposta`,
        value: d.value ? `R$ ${Number(d.value).toLocaleString('pt-BR')}` : undefined,
    }));

    return { value: entityIds.length, items };
}

async function fetchTreatmentsInProgress(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: cfPhase } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'fase_tratamento')
        .eq('field_value', '"Em Andamento"');

    const entityIds = (cfPhase ?? []).map(cf => cf.entity_id);
    if (entityIds.length === 0) return { value: 0, progress: [] };

    const { data: sessions } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_key, field_value')
        .in('entity_id', entityIds)
        .in('field_key', ['sessoes_previstas', 'sessoes_realizadas']);

    const { data: deals } = await supabase
        .from('deals')
        .select('id, title')
        .in('id', entityIds)
        .limit(6);

    const sessionMap: Record<string, { predicted: number; done: number }> = {};
    (sessions ?? []).forEach(s => {
        if (!sessionMap[s.entity_id]) sessionMap[s.entity_id] = { predicted: 0, done: 0 };
        if (s.field_key === 'sessoes_previstas') sessionMap[s.entity_id].predicted = Number(s.field_value) || 0;
        if (s.field_key === 'sessoes_realizadas') sessionMap[s.entity_id].done = Number(s.field_value) || 0;
    });

    const progress = (deals ?? []).map(d => ({
        label: d.title ?? 'Tratamento',
        current: sessionMap[d.id]?.done ?? 0,
        total: sessionMap[d.id]?.predicted ?? 1,
    }));

    return { value: entityIds.length, progress };
}

async function fetchTreatmentAbandonment(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();

    const { data: inProgress } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'fase_tratamento')
        .eq('field_value', '"Em Andamento"');

    const entityIds = (inProgress ?? []).map(cf => cf.entity_id);
    if (entityIds.length === 0) return { value: 0 };

    const { data: staleDeals } = await supabase
        .from('deals')
        .select('id')
        .in('id', entityIds)
        .lt('updated_at', fifteenDaysAgo);

    return { value: staleDeals?.length ?? 0 };
}

async function fetchMaintenanceDue(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'contact')
        .eq('field_key', 'ultima_manutencao')
        .lt('field_value', `"${sixMonthsAgo}"`);

    const entityIds = (cfValues ?? []).map(cf => cf.entity_id);
    if (entityIds.length === 0) return { value: 0, items: [] };

    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', entityIds.slice(0, 10));

    const items = (contacts ?? []).map(c => ({
        id: c.id,
        label: c.name ?? 'Paciente',
        sublabel: 'Manutenção vencida',
    }));

    return { value: entityIds.length, items };
}

// ─── Real Estate Fetchers ────────────────────────────────────────────

async function fetchDealsByBroker(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('field_value')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'corretor_responsavel');

    const counts: Record<string, number> = {};
    (cfValues ?? []).forEach(cf => {
        const broker = String(cf.field_value ?? 'Sem corretor');
        counts[broker] = (counts[broker] ?? 0) + 1;
    });

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
    const segments = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value], i) => ({
            label: label.replace(/"/g, ''),
            value,
            color: colors[i % colors.length],
        }));

    return { segments };
}

async function fetchVisitToProposalRate(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: visits } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'data_visita')
        .not('field_value', 'is', null);

    const { data: proposals } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'deal')
        .eq('field_key', 'proposta_valor')
        .not('field_value', 'is', null);

    const visitCount = visits?.length ?? 0;
    const proposalCount = proposals?.length ?? 0;
    const rate = visitCount > 0 ? ((proposalCount / visitCount) * 100) : 0;

    return { value: `${rate.toFixed(1)}%` };
}

async function fetchMonthlyCommissions(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: wonDeals } = await supabase
        .from('deals')
        .select('id, value')
        .eq('organization_id', orgId)
        .eq('is_won', true)
        .gte('updated_at', startOfMonth.toISOString());

    const dealIds = (wonDeals ?? []).map(d => d.id);
    if (dealIds.length === 0) return { value: 'R$ 0' };

    const { data: commissions } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_value')
        .in('entity_id', dealIds)
        .eq('field_key', 'comissao_percentual');

    let totalCommission = 0;
    const dealValueMap: Record<string, number> = {};
    (wonDeals ?? []).forEach(d => { dealValueMap[d.id] = Number(d.value) || 0; });

    (commissions ?? []).forEach(c => {
        const pct = Number(c.field_value) || 0;
        const dealValue = dealValueMap[c.entity_id] ?? 0;
        totalCommission += (dealValue * pct) / 100;
    });

    return {
        value: `R$ ${totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    };
}

async function fetchAvailableProperties(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { count } = await supabase
        .from('vertical_properties')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'disponivel');

    return { value: count ?? 0 };
}

async function fetchPendingMatches(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: clients } = await supabase
        .from('custom_field_values')
        .select('entity_id')
        .eq('organization_id', orgId)
        .eq('entity_type', 'contact')
        .eq('field_key', 'tipo_cliente')
        .in('field_value', ['"Comprador"', '"Locatário"', '"Investidor"']);

    return { value: clients?.length ?? 0 };
}

async function fetchAvgClosingTime(
    supabase: SupabaseClient,
    orgId: string
): Promise<WidgetDataPayload> {
    const { data: wonDeals } = await supabase
        .from('deals')
        .select('created_at, updated_at')
        .eq('organization_id', orgId)
        .eq('is_won', true)
        .limit(50);

    if (!wonDeals || wonDeals.length === 0) return { value: '—' };

    const days = wonDeals.map(d => {
        const created = new Date(d.created_at).getTime();
        const closed = new Date(d.updated_at).getTime();
        return Math.floor((closed - created) / 86400000);
    });

    const avg = days.reduce((s, d) => s + d, 0) / days.length;

    return { value: `${Math.round(avg)} dias` };
}
