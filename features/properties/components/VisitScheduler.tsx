'use client';

/**
 * @fileoverview VisitScheduler — Relacionado à marcação de visitas.
 *
 * Exibe um calendário ou listagem para agendar visitas a imóveis, capturando chaves,
 * acompanhantes e status da visita.
 *
 * @module features/properties/components/VisitScheduler
 */

import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Key, User, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

interface Visit {
    id: string;
    propertyName: string;
    address: string;
    date: string;
    time: string;
    status: 'Agendada' | 'Realizada' | 'Cancelada';
    brokerName?: string;
    keysWith?: string;
}

const mockVisits: Visit[] = [
    {
        id: '1',
        propertyName: 'Apartamento Jardins',
        address: 'Rua Oscar Freire, 1000',
        date: new Date().toISOString().split('T')[0], // Today
        time: '14:30',
        status: 'Agendada',
        brokerName: 'João Silva',
        keysWith: 'Portaria'
    },
    {
        id: '2',
        propertyName: 'Studio Pinheiros',
        address: 'Rua dos Pinheiros, 500',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
        time: '10:00',
        status: 'Realizada',
        brokerName: 'Maria Souza',
    }
];

export function VisitScheduler({ dealId }: { dealId?: string }) {
    const [visits] = useState<Visit[]>(mockVisits);

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarIcon className="text-primary-500" size={18} />
                        Agenda de Visitas
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Gerencie chaves e acompanhamentos</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus size={14} />
                    Agendar Visita
                </button>
            </div>

            <div className="space-y-4">
                {visits.map((visit) => (
                    <div key={visit.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-primary-500/50 transition-colors gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                    {visit.propertyName}
                                </h4>
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${visit.status === 'Agendada' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        visit.status === 'Realizada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    }`}>
                                    {visit.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 mt-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <MapPin size={12} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{visit.address}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Clock size={12} className="text-slate-400 shrink-0" />
                                    <span>{new Date(visit.date).toLocaleDateString('pt-BR')} às {visit.time}</span>
                                </div>
                                {visit.keysWith && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Key size={12} className="text-amber-500 shrink-0" />
                                        <span>Chaves: {visit.keysWith}</span>
                                    </div>
                                )}
                                {visit.brokerName && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <User size={12} className="text-primary-500 shrink-0" />
                                        <span>Corretor: {visit.brokerName}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {visit.status === 'Agendada' && (
                            <div className="flex items-center gap-2 shrink-0">
                                <button className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Marcar como realizada">
                                    <CheckCircle2 size={18} />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="Cancelar visita">
                                    <AlertCircle size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {visits.length === 0 && (
                    <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <CalendarIcon size={24} className="mb-2 text-slate-400" />
                        <p className="text-sm">Nenhuma visita agendada</p>
                    </div>
                )}
            </div>
        </div>
    );
}
