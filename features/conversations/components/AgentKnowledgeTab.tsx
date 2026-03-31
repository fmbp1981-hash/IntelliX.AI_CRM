'use client';

import React, { useState, useEffect } from 'react';
import {
    useAgentPersonalization,
    useUpdateAgentPersonalization,
} from '@/hooks/useAgentMethodology';
import type { KnowledgeSource } from '@/types/agent';

const SOURCE_TYPES = [
    { value: 'document', label: 'Documento / PDF' },
    { value: 'url', label: 'URL / Página web' },
    { value: 'faq', label: 'FAQ manual' },
    { value: 'product_catalog', label: 'Catálogo de produtos' },
    { value: 'policy', label: 'Política / Regras' },
    { value: 'custom', label: 'Personalizado' },
];

const emptySource = (): KnowledgeSource => ({
    id: crypto.randomUUID(),
    name: '',
    type: 'document',
    reference: '',
    description: '',
    content_summary: '',
    priority: 0,
    is_active: true,
});

export const AgentKnowledgeTab: React.FC = () => {
    const { data: personalization, isLoading } = useAgentPersonalization();
    const updatePersonalization = useUpdateAgentPersonalization();

    const [alwaysSearch, setAlwaysSearch] = useState(true);
    const [threshold, setThreshold] = useState(0.7);
    const [maxResults, setMaxResults] = useState(3);
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const kb = personalization?.knowledge_base_config;
        if (!kb) return;
        setAlwaysSearch(kb.always_search_before_respond ?? true);
        setThreshold(kb.search_threshold ?? 0.7);
        setMaxResults(kb.max_results_per_query ?? 3);
        setSources(kb.sources ?? []);
    }, [personalization]);

    const mark = () => setIsDirty(true);

    const addSource = () => {
        setSources((p) => [...p, emptySource()]);
        mark();
    };

    const updateSource = (id: string, field: keyof KnowledgeSource, value: unknown) => {
        setSources((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
        mark();
    };

    const removeSource = (id: string) => {
        setSources((p) => p.filter((s) => s.id !== id));
        mark();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePersonalization.mutateAsync({
                knowledge_base_config: {
                    always_search_before_respond: alwaysSearch,
                    search_threshold: threshold,
                    max_results_per_query: maxResults,
                    sources,
                },
            });
            setIsDirty(false);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="space-y-8">

            {/* Search behavior */}
            <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Comportamento de Busca</h3>

                <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-white/10 mb-4">
                    <button
                        onClick={() => { setAlwaysSearch(!alwaysSearch); mark(); }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 mt-0.5 items-center rounded-full transition-colors ${alwaysSearch ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${alwaysSearch ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Pesquisar base antes de responder
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Recomendado. O agente consulta a base de conhecimento antes de qualquer resposta sobre produtos, preços, políticas e horários.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Limiar de Relevância
                            <span className="ml-1 font-mono text-emerald-600">{threshold.toFixed(1)}</span>
                        </label>
                        <input
                            type="range"
                            min="0.3"
                            max="0.95"
                            step="0.05"
                            value={threshold}
                            onChange={(e) => { setThreshold(parseFloat(e.target.value)); mark(); }}
                            className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                            <span>0.3 (mais resultados)</span>
                            <span>0.95 (mais preciso)</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Máximo de Resultados por Busca
                        </label>
                        <select
                            value={maxResults}
                            onChange={(e) => { setMaxResults(parseInt(e.target.value)); mark(); }}
                            className="input-base"
                        >
                            {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n} resultado{n > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* Sources */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fontes de Conhecimento</h3>
                        <p className="text-xs text-slate-400">Defina de onde o agente buscará informações.</p>
                    </div>
                    <button onClick={addSource} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 transition-colors">
                        + Adicionar fonte
                    </button>
                </div>

                {sources.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                        <p className="text-2xl mb-2">📚</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma fonte configurada</p>
                        <p className="text-xs text-slate-400 mt-1">Adicione FAQs, documentos de políticas, catálogos de produtos e mais.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sources.map((src) => (
                            <div key={src.id} className={`p-4 rounded-xl border-2 transition-all ${src.is_active
                                ? 'border-slate-200 dark:border-white/10'
                                : 'border-slate-100 dark:border-white/5 opacity-60'
                                }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <select
                                        value={src.type}
                                        onChange={(e) => updateSource(src.id, 'type', e.target.value)}
                                        className="text-xs bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg border-0 focus:outline-none"
                                    >
                                        {SOURCE_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => updateSource(src.id, 'is_active', !src.is_active)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${src.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${src.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                        <button onClick={() => removeSource(src.id)} className="text-xs text-red-400 hover:text-red-500">Remover</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-medium">Nome</label>
                                        <input
                                            value={src.name}
                                            onChange={(e) => updateSource(src.id, 'name', e.target.value)}
                                            placeholder="Ex: Tabela de preços 2026"
                                            className="input-base mt-0.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-medium">Referência (URL ou ID)</label>
                                        <input
                                            value={src.reference ?? ''}
                                            onChange={(e) => updateSource(src.id, 'reference', e.target.value)}
                                            placeholder="https://... ou ID do documento"
                                            className="input-base mt-0.5"
                                        />
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <label className="text-[10px] text-slate-400 font-medium">Descrição (quando usar esta fonte)</label>
                                    <input
                                        value={src.description ?? ''}
                                        onChange={(e) => updateSource(src.id, 'description', e.target.value)}
                                        placeholder="Ex: Use para responder perguntas sobre preços e procedimentos"
                                        className="input-base mt-0.5"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Save */}
            {isDirty && (
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <button onClick={() => setIsDirty(false)} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors">
                        Descartar
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {saving ? 'Salvando...' : 'Salvar Conhecimento'}
                    </button>
                </div>
            )}

            <style>{`
        .input-base {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          color: rgb(15 23 42);
        }
        .dark .input-base {
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .input-base:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(16 185 129 / 0.4);
        }
      `}</style>
        </div>
    );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
