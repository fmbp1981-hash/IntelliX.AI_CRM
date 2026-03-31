'use client';

/**
 * @fileoverview PatientTimeline — Histórico cronológico de atendimentos do paciente.
 *
 * Exibe uma timeline vertical com consultas, tratamentos, retornos e notas.
 * Consome dados de deals/activities vinculadas ao contato.
 *
 * @module features/patients/components/PatientTimeline
 */

import React from 'react';
import {
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    Stethoscope,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

export interface TimelineEntry {
    id: string;
    date: string;
    type: 'consulta' | 'retorno' | 'exame' | 'cirurgia' | 'tratamento' | 'nota';
    title: string;
    description?: string;
    status: 'concluido' | 'cancelado' | 'agendado' | 'em_andamento';
    professional?: string;
}

interface PatientTimelineProps {
    entries: TimelineEntry[];
    isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const typeIcons: Record<TimelineEntry['type'], React.ElementType> = {
    consulta: Stethoscope,
    retorno: Calendar,
    exame: FileText,
    cirurgia: Stethoscope,
    tratamento: Stethoscope,
    nota: FileText,
};

const statusConfig: Record<
    TimelineEntry['status'],
    { icon: React.ElementType; color: string; label: string }
> = {
    concluido: {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        label: 'Concluído',
    },
    cancelado: {
        icon: XCircle,
        color: 'text-rose-500',
        label: 'Cancelado',
    },
    agendado: {
        icon: Clock,
        color: 'text-sky-500',
        label: 'Agendado',
    },
    em_andamento: {
        icon: Clock,
        color: 'text-amber-500',
        label: 'Em Andamento',
    },
};

const typeLabels: Record<TimelineEntry['type'], string> = {
    consulta: 'Consulta',
    retorno: 'Retorno',
    exame: 'Exame',
    cirurgia: 'Cirurgia',
    tratamento: 'Tratamento',
    nota: 'Nota',
};

// ─── Component ───────────────────────────────────────────────────────

export function PatientTimeline({ entries, isLoading }: PatientTimelineProps) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                            <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Calendar size={40} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhum registro no histórico</p>
                <p className="text-xs mt-1">Os atendimentos aparecerão aqui automaticamente.</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200 dark:bg-white/10" />

            <div className="space-y-6">
                {entries.map((entry) => {
                    const TypeIcon = typeIcons[entry.type] ?? FileText;
                    const statusCfg = statusConfig[entry.status];
                    const StatusIcon = statusCfg.icon;

                    return (
                        <div key={entry.id} className="relative flex gap-4 pl-2">
                            {/* Dot */}
                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-dark-card bg-slate-100 dark:bg-slate-800 shadow-sm">
                                <TypeIcon size={16} className="text-slate-500" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {typeLabels[entry.type]}
                                        </span>
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{entry.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <StatusIcon size={14} className={statusCfg.color} />
                                        <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                                    </div>
                                </div>

                                {entry.description && (
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {entry.description}
                                    </p>
                                )}

                                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={11} />
                                        {new Date(entry.date).toLocaleDateString('pt-BR')}
                                    </span>
                                    {entry.professional && (
                                        <span className="flex items-center gap-1">
                                            <Stethoscope size={11} />
                                            {entry.professional}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
