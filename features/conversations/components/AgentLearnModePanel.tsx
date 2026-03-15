'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed';

interface ABTest {
    id: string;
    name: string;
    description?: string;
    status: ABTestStatus;
    variant_a_methodology: string;
    variant_a_label: string;
    variant_b_methodology: string;
    variant_b_label: string;
    traffic_split_a: number;
    variant_a_conversations: number;
    variant_b_conversations: number;
    variant_a_conversions: number;
    variant_b_conversions: number;
    variant_a_avg_msgs: number;
    variant_b_avg_msgs: number;
    winner?: 'a' | 'b' | 'tie';
    confidence_pct?: number;
    started_at?: string;
    created_at: string;
}

const METHODOLOGY_LABELS: Record<string, string> = {
    bant: 'BANT',
    spin: 'SPIN Selling',
    meddic: 'MEDDIC',
    gpct: 'GPCT',
    flavio_augusto: 'Flávio Augusto',
    neurovendas: 'Neurovendas',
    consultivo: 'Venda Consultiva',
    hybrid: 'Híbrida',
    custom: 'Personalizada',
};

const STATUS_CONFIG: Record<ABTestStatus, { label: string; color: string; dot: string }> = {
    draft:     { label: 'Rascunho',   color: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400', dot: 'bg-slate-400' },
    running:   { label: 'Rodando',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', dot: 'bg-emerald-500 animate-pulse' },
    paused:    { label: 'Pausado',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
    completed: { label: 'Concluído',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', dot: 'bg-blue-500' },
};

function conversionRate(conversions: number, total: number) {
    if (!total) return '—';
    return `${((conversions / total) * 100).toFixed(1)}%`;
}

// ── Sub-component: New test form ──────────────────────────────────────
function NewTestForm({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [varA, setVarA] = useState('spin');
    const [varB, setVarB] = useState('bant');
    const [split, setSplit] = useState(50);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const methodologies = Object.entries(METHODOLOGY_LABELS);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (varA === varB) { setErr('As variantes devem ser metodologias diferentes.'); return; }
        setSaving(true);
        setErr('');
        try {
            const res = await fetch('/api/agent/ab-tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: desc || undefined,
                    variant_a_methodology: varA,
                    variant_a_label: `Variante A — ${METHODOLOGY_LABELS[varA]}`,
                    variant_b_methodology: varB,
                    variant_b_label: `Variante B — ${METHODOLOGY_LABELS[varB]}`,
                    traffic_split_a: split,
                }),
            });
            if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Erro ao criar teste'); return; }
            await qc.invalidateQueries({ queryKey: ['ab-tests'] });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Novo Teste A/B</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Nome do teste *</label>
                        <input
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: SPIN vs BANT — Funil Médico"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Descrição (opcional)</label>
                        <input
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder="Objetivo do teste..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Variante A</label>
                            <select
                                value={varA}
                                onChange={e => setVarA(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none"
                            >
                                {methodologies.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Variante B</label>
                            <select
                                value={varB}
                                onChange={e => setVarB(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none"
                            >
                                {methodologies.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                            Distribuição de tráfego — A: {split}% / B: {100 - split}%
                        </label>
                        <input
                            type="range"
                            min={10} max={90} step={5}
                            value={split}
                            onChange={e => setSplit(Number(e.target.value))}
                            className="w-full accent-violet-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>10% A</span><span>50/50</span><span>90% A</span>
                        </div>
                    </div>

                    {err && <p className="text-xs text-red-500">{err}</p>}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2 text-sm rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Criando...' : 'Criar Teste'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Sub-component: Test card ──────────────────────────────────────────
function TestCard({ test }: { test: ABTest }) {
    const qc = useQueryClient();
    const [loading, setLoading] = useState(false);

    const totalA = test.variant_a_conversations;
    const totalB = test.variant_b_conversations;
    const rateA = totalA ? (test.variant_a_conversions / totalA) * 100 : 0;
    const rateB = totalB ? (test.variant_b_conversions / totalB) * 100 : 0;
    const winnerIsA = test.winner === 'a';
    const winnerIsB = test.winner === 'b';

    const statusCfg = STATUS_CONFIG[test.status];

    const action = async (act: 'start' | 'pause' | 'stop') => {
        setLoading(true);
        try {
            await fetch('/api/agent/ab-tests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: test.id, action: act }),
            });
            await qc.invalidateQueries({ queryKey: ['ab-tests'] });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{test.name}</p>
                    {test.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{test.description}</p>
                    )}
                </div>
                <span className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                </span>
            </div>

            {/* Variants bar */}
            <div className="space-y-2">
                {[
                    { label: test.variant_a_label, rate: rateA, total: totalA, avg: test.variant_a_avg_msgs, isWinner: winnerIsA, color: 'bg-violet-500' },
                    { label: test.variant_b_label, rate: rateB, total: totalB, avg: test.variant_b_avg_msgs, isWinner: winnerIsB, color: 'bg-emerald-500' },
                ].map(v => (
                    <div key={v.label}>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${v.color}`} />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{v.label}</span>
                                {v.isWinner && test.status === 'completed' && (
                                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">🏆 Vencedor</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>{v.total} conv.</span>
                                <span className="font-medium text-slate-600 dark:text-slate-300">{conversionRate(0, v.total) === '—' ? '—' : `${v.rate.toFixed(1)}%`}</span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 rounded-full transition-all duration-700 ${v.color}`}
                                style={{ width: `${Math.min(100, v.rate * 3)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Split info */}
            <p className="text-[10px] text-slate-400">
                Split: {test.traffic_split_a}% A · {100 - test.traffic_split_a}% B
                {test.confidence_pct ? ` · Confiança: ${test.confidence_pct}%` : ''}
            </p>

            {/* Actions */}
            {test.status !== 'completed' && (
                <div className="flex gap-2 pt-1">
                    {test.status === 'draft' && (
                        <button
                            onClick={() => action('start')}
                            disabled={loading}
                            className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                            ▶ Iniciar
                        </button>
                    )}
                    {test.status === 'running' && (
                        <button
                            onClick={() => action('pause')}
                            disabled={loading}
                            className="flex-1 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                        >
                            ⏸ Pausar
                        </button>
                    )}
                    {test.status === 'paused' && (
                        <button
                            onClick={() => action('start')}
                            disabled={loading}
                            className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                            ▶ Retomar
                        </button>
                    )}
                    {(test.status === 'running' || test.status === 'paused') && (
                        <button
                            onClick={() => action('stop')}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                        >
                            Encerrar
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────
export const AgentLearnModePanel: React.FC = () => {
    const [showForm, setShowForm] = useState(false);

    const { data: tests = [], isLoading } = useQuery<ABTest[]>({
        queryKey: ['ab-tests'],
        queryFn: () => fetch('/api/agent/ab-tests').then(r => r.json()),
        staleTime: 30_000,
    });

    const running = tests.filter(t => t.status === 'running');
    const draft = tests.filter(t => t.status === 'draft');
    const done = tests.filter(t => t.status === 'completed' || t.status === 'paused');

    return (
        <>
            {showForm && <NewTestForm onClose={() => setShowForm(false)} />}

            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            🧪 Testes A/B de Metodologia
                            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">Beta</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Compare duas metodologias em conversas reais. O agente aprende qual converte mais.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex-shrink-0 ml-4 px-3 py-1.5 text-xs rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors"
                    >
                        + Novo teste
                    </button>
                </div>

                {/* How it works */}
                <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-violet-700 dark:text-violet-400">Como funciona: </span>
                    O NossoAgent divide automaticamente as novas conversas entre as variantes conforme o split configurado.
                    Ao atingir significância estatística, o teste se encerra e o vencedor é declarado.
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : tests.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                        <p className="text-3xl mb-2">🧬</p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum teste criado</p>
                        <p className="text-xs text-slate-400 mt-1">Crie seu primeiro A/B test para otimizar a conversão</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {running.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Rodando agora</p>
                                <div className="space-y-3">
                                    {running.map(t => <TestCard key={t.id} test={t} />)}
                                </div>
                            </div>
                        )}
                        {draft.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Rascunhos</p>
                                <div className="space-y-3">
                                    {draft.map(t => <TestCard key={t.id} test={t} />)}
                                </div>
                            </div>
                        )}
                        {done.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Histórico</p>
                                <div className="space-y-3">
                                    {done.map(t => <TestCard key={t.id} test={t} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};
