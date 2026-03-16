'use client';

/**
 * @fileoverview DentalChartSimple — Odontograma Simplificado.
 *
 * Componente visual que exibe a arcada dentária com registro de
 * procedimentos por dente/região. Versão simplificada que lista
 * os dentes com seus respectivos status e procedimentos.
 *
 * @module features/treatments/components/DentalChartSimple
 */

import React, { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface ToothRecord {
    tooth: number;
    region?: string;
    procedure?: string;
    status: 'healthy' | 'treated' | 'needs_treatment' | 'extracted' | 'implant';
    notes?: string;
    date?: string;
}

interface DentalChartSimpleProps {
    records: ToothRecord[];
    onToothClick?: (tooth: number) => void;
    readOnly?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const statusColors: Record<ToothRecord['status'], { bg: string; border: string; text: string; label: string }> = {
    healthy: {
        bg: 'bg-white dark:bg-slate-800',
        border: 'border-slate-200 dark:border-slate-600',
        text: 'text-slate-500',
        label: 'Saudável',
    },
    treated: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-300 dark:border-emerald-700',
        text: 'text-emerald-700 dark:text-emerald-400',
        label: 'Tratado',
    },
    needs_treatment: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-300 dark:border-amber-700',
        text: 'text-amber-700 dark:text-amber-400',
        label: 'Precisa Tratamento',
    },
    extracted: {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        border: 'border-rose-300 dark:border-rose-700',
        text: 'text-rose-700 dark:text-rose-400',
        label: 'Extraído',
    },
    implant: {
        bg: 'bg-sky-50 dark:bg-sky-900/20',
        border: 'border-sky-300 dark:border-sky-700',
        text: 'text-sky-700 dark:text-sky-400',
        label: 'Implante',
    },
};

// ─── Tooth Cell ──────────────────────────────────────────────────────

function ToothCell({
    tooth,
    record,
    onClick,
    readOnly,
}: {
    tooth: number;
    record?: ToothRecord;
    onClick?: (tooth: number) => void;
    readOnly?: boolean;
}) {
    const status = record?.status ?? 'healthy';
    const cfg = statusColors[status];

    return (
        <button
            type="button"
            onClick={() => !readOnly && onClick?.(tooth)}
            disabled={readOnly}
            title={`Dente ${tooth}${record?.procedure ? ` — ${record.procedure}` : ''}`}
            className={`
        flex h-11 w-11 items-center justify-center rounded-lg border-2
        text-xs font-bold transition-all duration-150
        ${cfg.bg} ${cfg.border} ${cfg.text}
        ${!readOnly ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-default'}
      `}
        >
            {tooth}
        </button>
    );
}

// ─── Component ───────────────────────────────────────────────────────

export function DentalChartSimple({
    records,
    onToothClick,
    readOnly = true,
}: DentalChartSimpleProps) {
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const recordMap = new Map(records.map((r) => [r.tooth, r]));

    const handleClick = (tooth: number) => {
        setSelectedTooth(tooth === selectedTooth ? null : tooth);
        onToothClick?.(tooth);
    };

    const selectedRecord = selectedTooth ? recordMap.get(selectedTooth) : null;

    return (
        <div className="space-y-4">
            {/* ── Chart ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Odontograma
                </h4>

                {/* Arcada Superior */}
                <div className="mb-2 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Superior
                    </span>
                </div>
                <div className="flex justify-center gap-1 flex-wrap mb-4">
                    {UPPER_TEETH.map((t) => (
                        <ToothCell
                            key={t}
                            tooth={t}
                            record={recordMap.get(t)}
                            onClick={handleClick}
                            readOnly={readOnly}
                        />
                    ))}
                </div>

                {/* Divider */}
                <div className="mx-auto mb-4 h-px w-3/4 bg-slate-200 dark:bg-slate-700" />

                {/* Arcada Inferior */}
                <div className="flex justify-center gap-1 flex-wrap mb-2">
                    {LOWER_TEETH.map((t) => (
                        <ToothCell
                            key={t}
                            tooth={t}
                            record={recordMap.get(t)}
                            onClick={handleClick}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
                <div className="text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Inferior
                    </span>
                </div>
            </div>

            {/* ── Legenda ── */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
                {Object.entries(statusColors).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className={`h-3 w-3 rounded border-2 ${cfg.bg} ${cfg.border}`} />
                        <span className="text-slate-500">{cfg.label}</span>
                    </div>
                ))}
            </div>

            {/* ── Selected Tooth Detail ── */}
            {selectedTooth && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
                    <h5 className="text-sm font-bold text-slate-700 dark:text-white">
                        Dente {selectedTooth}
                    </h5>
                    {selectedRecord ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-500">
                            <p>
                                <strong>Status:</strong> {statusColors[selectedRecord.status].label}
                            </p>
                            {selectedRecord.procedure && (
                                <p>
                                    <strong>Procedimento:</strong> {selectedRecord.procedure}
                                </p>
                            )}
                            {selectedRecord.notes && (
                                <p>
                                    <strong>Observações:</strong> {selectedRecord.notes}
                                </p>
                            )}
                            {selectedRecord.date && (
                                <p>
                                    <strong>Data:</strong>{' '}
                                    {new Date(selectedRecord.date).toLocaleDateString('pt-BR')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="mt-1 text-xs text-slate-400">Nenhum registro para este dente.</p>
                    )}
                </div>
            )}
        </div>
    );
}
