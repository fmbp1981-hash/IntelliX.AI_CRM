'use client';

/**
 * @fileoverview PatientRecordView — Prontuário Eletrônico para verticais de saúde.
 *
 * Substitui a visualização genérica de contatos quando o business_type é
 * 'medical_clinic' ou 'dental_clinic'. Exibe dados clínicos, histórico
 * de atendimentos, alergias, convênios e campos customizados EAV.
 *
 * @module features/patients/components/PatientRecordView
 */

import React from 'react';
import {
    User,
    Heart,
    AlertTriangle,
    FileText,
    Calendar,
    Shield,
    Clock,
    Stethoscope,
    Phone,
    Mail,
} from 'lucide-react';
import type { Contact } from '@/types';
import type { CustomFieldsSchemaMap } from '@/types/vertical';
import type { CustomFieldMap } from '@/lib/supabase/custom-fields';
import { CustomFieldsRenderer } from '@/features/shared/components/CustomFieldsRenderer';

// ─── Types ───────────────────────────────────────────────────────────

interface PatientRecordViewProps {
    contact: Contact;
    customFields: CustomFieldMap;
    schema: CustomFieldsSchemaMap;
    onFieldChange?: (key: string, value: unknown) => void;
    readOnly?: boolean;
    isDental?: boolean;
}

// ─── Status Badge ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | undefined }) {
    const colorMap: Record<string, string> = {
        Ativo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        Inativo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        Alta: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    };
    const label = status || 'N/D';
    const cls = colorMap[label] ?? 'bg-slate-100 text-slate-600';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

// ─── Info Card ───────────────────────────────────────────────────────

function InfoCard({
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
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        slate: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };

    return (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
            <div className={`rounded-lg p-2 ${accentColors[accent] ?? accentColors.slate}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white truncate">{value || '—'}</p>
            </div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────

export function PatientRecordView({
    contact,
    customFields,
    schema,
    onFieldChange,
    readOnly = true,
    isDental = false,
}: PatientRecordViewProps) {
    const statusClinico = customFields.status_clinico as string | undefined;
    const convenio = customFields.convenio as string | undefined;
    const especialidade = customFields.especialidade as string | undefined;
    const medicoResp = customFields.medico_responsavel as string | undefined;
    const alergias = customFields.alergias as string | undefined;
    const ultimaConsulta = customFields.ultima_consulta as string | undefined;
    const proximoRetorno = customFields.proximo_retorno as string | undefined;

    const planoOdonto = customFields.plano_odontologico as string | undefined;
    const ultimaManutencao = customFields.ultima_manutencao as string | undefined;
    const proximaManutencao = customFields.proxima_manutencao as string | undefined;
    const scoreConversao = customFields.score_conversao as number | undefined;

    return (
        <div className="space-y-6">
            {/* ── Header do Paciente ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 text-white text-xl font-bold shadow-lg shadow-teal-500/20">
                            {(contact.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                                {contact.name || 'Paciente sem nome'}
                            </h2>
                            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                                {contact.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail size={13} /> {contact.email}
                                    </span>
                                )}
                                {contact.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone size={13} /> {contact.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <StatusBadge status={statusClinico} />
                </div>
            </div>

            {/* ── KPIs Rápidos ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {isDental ? (
                    <>
                        <InfoCard icon={Shield} label="Plano Odontológico" value={planoOdonto} accent="sky" />
                        <InfoCard
                            icon={Calendar}
                            label="Última Manutenção"
                            value={ultimaManutencao ? new Date(ultimaManutencao).toLocaleDateString('pt-BR') : undefined}
                            accent="amber"
                        />
                        <InfoCard
                            icon={Clock}
                            label="Próx. Manutenção"
                            value={proximaManutencao ? new Date(proximaManutencao).toLocaleDateString('pt-BR') : undefined}
                            accent="emerald"
                        />
                        <InfoCard
                            icon={Heart}
                            label="Score Conversão"
                            value={scoreConversao !== undefined ? `${scoreConversao}%` : undefined}
                            accent="rose"
                        />
                    </>
                ) : (
                    <>
                        <InfoCard icon={Shield} label="Convênio" value={convenio} accent="sky" />
                        <InfoCard icon={Stethoscope} label="Especialidade" value={especialidade} accent="emerald" />
                        <InfoCard
                            icon={Calendar}
                            label="Última Consulta"
                            value={ultimaConsulta ? new Date(ultimaConsulta).toLocaleDateString('pt-BR') : undefined}
                            accent="amber"
                        />
                        <InfoCard
                            icon={Clock}
                            label="Próx. Retorno"
                            value={proximoRetorno ? new Date(proximoRetorno).toLocaleDateString('pt-BR') : undefined}
                            accent="rose"
                        />
                    </>
                )}
            </div>

            {/* ── Alergias (se houver) ── */}
            {alergias && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/10 p-4">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Alergias</p>
                        <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">{alergias}</p>
                    </div>
                </div>
            )}

            {/* ── Profissional Responsável ── */}
            {medicoResp && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4">
                    <User size={18} className="text-slate-400" />
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {isDental ? 'Dentista Responsável' : 'Médico Responsável'}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{medicoResp}</p>
                    </div>
                </div>
            )}

            {/* ── Campos Customizados EAV (todos os campos da vertical) ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
                <div className="mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        {isDental ? 'Ficha Odontológica' : 'Prontuário Clínico'}
                    </h3>
                </div>
                <CustomFieldsRenderer
                    schema={schema}
                    entityType="contact"
                    values={customFields}
                    onChange={onFieldChange}
                    readOnly={readOnly}
                />
            </div>
        </div>
    );
}
