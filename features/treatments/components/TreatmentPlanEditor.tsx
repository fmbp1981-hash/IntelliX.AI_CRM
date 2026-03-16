'use client';

/**
 * @fileoverview TreatmentPlanEditor — Editor de Planos de Tratamento.
 *
 * Componente para criar e gerenciar planos de tratamento (deals) em
 * clínicas médicas e odontológicas. Controle de sessões, orçamentos
 * e progresso do tratamento.
 *
 * @module features/treatments/components/TreatmentPlanEditor
 */

import React from 'react';
import {
    ClipboardList,
    DollarSign,
    Calendar,
    User,
    CheckCircle2,
    Circle,
    AlertCircle,
    TrendingUp,
} from 'lucide-react';
import type { CustomFieldMap } from '@/lib/supabase/custom-fields';

// ─── Types ───────────────────────────────────────────────────────────

interface TreatmentPlanEditorProps {
    dealTitle: string;
    dealValue?: number;
    customFields: CustomFieldMap;
    onFieldChange?: (key: string, value: unknown) => void;
    readOnly?: boolean;
    isDental?: boolean;
}

// ─── Progress Bar ────────────────────────────────────────────────────

function SessionProgress({
    previstas,
    realizadas,
}: {
    previstas: number;
    realizadas: number;
}) {
    const pct = previstas > 0 ? Math.min((realizadas / previstas) * 100, 100) : 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Progresso de Sessões</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                    {realizadas}/{previstas}
                </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-[11px] text-slate-400">{pct.toFixed(0)}% concluído</p>
        </div>
    );
}

// ─── Status Badge ────────────────────────────────────────────────────

function OrcamentoBadge({ status }: { status: string | undefined }) {
    const colors: Record<string, string> = {
        Elaborando: 'bg-slate-100 text-slate-600',
        Enviado: 'bg-sky-100 text-sky-700',
        Negociando: 'bg-amber-100 text-amber-700',
        Aprovado: 'bg-emerald-100 text-emerald-700',
        Recusado: 'bg-rose-100 text-rose-700',
    };

    const icons: Record<string, React.ElementType> = {
        Elaborando: Circle,
        Enviado: AlertCircle,
        Negociando: TrendingUp,
        Aprovado: CheckCircle2,
        Recusado: AlertCircle,
    };

    const label = status || 'N/D';
    const cls = colors[label] ?? 'bg-slate-100 text-slate-600';
    const Icon = icons[label] ?? Circle;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
            <Icon size={12} />
            {label}
        </span>
    );
}

// ─── Component ───────────────────────────────────────────────────────

export function TreatmentPlanEditor({
    dealTitle,
    dealValue,
    customFields,
    readOnly = true,
    isDental = false,
}: TreatmentPlanEditorProps) {
    const tipoProcedimento = customFields.tipo_procedimento as string | undefined;
    const statusOrcamento = customFields.status_orcamento as string | undefined;
    const faseTratamento = customFields.fase_tratamento as string | undefined;
    const dentistaResp = customFields.dentista_responsavel as string | undefined;
    const sessoesPrevistas = customFields.sessoes_previstas as number | undefined;
    const sessoesRealizadas = customFields.sessoes_realizadas as number | undefined;
    const valorTotal = customFields.valor_total as number | undefined;
    const valorEntrada = customFields.valor_entrada as number | undefined;
    const parcelamento = customFields.parcelamento as string | undefined;
    const autorizacaoConvenio = customFields.autorizacao_convenio as string | undefined;
    const statusAgendamento = customFields.status_agendamento as string | undefined;
    const compareceu = customFields.compareceu as boolean | undefined;
    const dataAgendamento = customFields.data_agendamento as string | undefined;

    const formatCurrency = (v: number | undefined) =>
        v !== undefined
            ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '—';

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {isDental ? 'Plano de Tratamento' : 'Atendimento'}
                        </span>
                        <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white font-display">
                            {dealTitle}
                        </h2>
                        {tipoProcedimento && (
                            <p className="mt-1 text-sm text-slate-500">{tipoProcedimento}</p>
                        )}
                    </div>
                    {isDental ? (
                        <OrcamentoBadge status={statusOrcamento} />
                    ) : (
                        <OrcamentoBadge status={statusAgendamento} />
                    )}
                </div>
            </div>

            {/* ── Grid de Detalhes ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DetailCard
                    icon={DollarSign}
                    label={isDental ? 'Valor Total' : 'Valor Estimado'}
                    value={formatCurrency(isDental ? valorTotal : dealValue)}
                    accent="emerald"
                />

                {isDental && (
                    <DetailCard
                        icon={DollarSign}
                        label="Entrada"
                        value={formatCurrency(valorEntrada)}
                        accent="sky"
                    />
                )}

                {isDental && parcelamento && (
                    <DetailCard
                        icon={ClipboardList}
                        label="Parcelamento"
                        value={parcelamento}
                        accent="amber"
                    />
                )}

                {!isDental && (
                    <DetailCard
                        icon={ClipboardList}
                        label="Autorização Convênio"
                        value={autorizacaoConvenio}
                        accent="sky"
                    />
                )}

                {dataAgendamento && (
                    <DetailCard
                        icon={Calendar}
                        label="Data Agendamento"
                        value={new Date(dataAgendamento).toLocaleString('pt-BR')}
                        accent="amber"
                    />
                )}

                {!!(dentistaResp || customFields.medico_responsavel) && (
                    <DetailCard
                        icon={User}
                        label={isDental ? 'Dentista' : 'Médico'}
                        value={String(dentistaResp || customFields.medico_responsavel || '')}
                        accent="slate"
                    />
                )}
            </div>

            {/* ── Progresso de Sessões (dental only) ── */}
            {isDental && sessoesPrevistas !== undefined && sessoesPrevistas > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
                    <SessionProgress
                        previstas={sessoesPrevistas}
                        realizadas={sessoesRealizadas ?? 0}
                    />
                </div>
            )}

            {/* ── Fase do Tratamento (dental) ── */}
            {isDental && faseTratamento && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Fase do Tratamento
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                        {['Planejamento', 'Em Andamento', 'Finalizado'].map((fase) => (
                            <span
                                key={fase}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${fase === faseTratamento
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                                    : 'bg-slate-50 text-slate-400 dark:bg-slate-800'
                                    }`}
                            >
                                {fase}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Comparecimento (médico) ── */}
            {!isDental && compareceu !== undefined && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4 flex items-center gap-3">
                    {compareceu ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : (
                        <AlertCircle size={20} className="text-rose-500" />
                    )}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {compareceu ? 'Paciente compareceu' : 'Paciente não compareceu'}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Detail Card ─────────────────────────────────────────────────────

function DetailCard({
    icon: Icon,
    label,
    value,
    accent = 'slate',
}: {
    icon: React.ElementType;
    label: string;
    value: string | undefined;
    accent?: string;
}) {
    const accentColors: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        slate: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };

    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${accentColors[accent] ?? accentColors.slate}`}>
                <Icon size={16} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
                {value || '—'}
            </p>
        </div>
    );
}
