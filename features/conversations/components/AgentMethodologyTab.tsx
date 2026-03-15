'use client';

import React, { useState, useEffect } from 'react';
import {
    useMethodologyTemplates,
    useAgentPersonalization,
    useUpdateAgentPersonalization,
} from '@/hooks/useAgentMethodology';
import { VerticalPackWizard } from './VerticalPackWizard';
import { AgentLearnModePanel } from './AgentLearnModePanel';
import type { AgentMode, SalesMethodology } from '@/types/agent';

const AGENT_MODES: { id: AgentMode; label: string; icon: string; description: string }[] = [
    {
        id: 'auto',
        label: 'Automático',
        icon: '⚡',
        description: 'O NossoAgent escolhe a melhor abordagem baseado no contexto do lead.',
    },
    {
        id: 'template',
        label: 'Templates',
        icon: '📋',
        description: 'Use um template pré-configurado para seu nicho de mercado.',
    },
    {
        id: 'learn',
        label: 'Aprender',
        icon: '🧪',
        description: 'O agente aprende com as conversas e ajusta automaticamente (Beta).',
    },
    {
        id: 'advanced',
        label: 'Avançado',
        icon: '🎛️',
        description: 'Configure manualmente metodologia, tom e abordagem de vendas.',
    },
];

const METHODOLOGIES: { value: SalesMethodology; label: string; badge: string }[] = [
    { value: 'bant', label: 'BANT', badge: 'Clássico' },
    { value: 'spin', label: 'SPIN Selling', badge: 'Consultivo' },
    { value: 'meddic', label: 'MEDDIC/MEDDICC', badge: 'B2B Enterprise' },
    { value: 'gpct', label: 'GPCT', badge: 'Inbound' },
    { value: 'flavio_augusto', label: 'Flávio Augusto', badge: 'Wiser' },
    { value: 'neurovendas', label: 'Neurovendas', badge: 'Neuro' },
    { value: 'consultivo', label: 'Venda Consultiva', badge: 'Especialista' },
    { value: 'hybrid', label: 'Híbrida', badge: 'Multi' },
    { value: 'custom', label: 'Personalizada', badge: 'Custom' },
];

export const AgentMethodologyTab: React.FC = () => {
    const { data: personalization, isLoading } = useAgentPersonalization();
    const { data: templates } = useMethodologyTemplates();
    const updatePersonalization = useUpdateAgentPersonalization();

    const [agentMode, setAgentMode] = useState<AgentMode>('auto');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [primary, setPrimary] = useState<SalesMethodology>('bant');
    const [secondary, setSecondary] = useState<SalesMethodology[]>([]);
    const [customApproach, setCustomApproach] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        if (!personalization) return;
        const sm = personalization.sales_methodology;
        if (sm?.primary) setPrimary(sm.primary as SalesMethodology);
        if (sm?.secondary) setSecondary(Array.isArray(sm.secondary) ? sm.secondary as SalesMethodology[] : []);
        if (sm?.custom_approach) setCustomApproach(sm.custom_approach);
    }, [personalization]);

    const toggleSecondary = (m: SalesMethodology) => {
        setSecondary((prev) =>
            prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
        );
        setIsDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePersonalization.mutateAsync({
                sales_methodology: {
                    primary,
                    secondary: secondary as SalesMethodology[],
                    custom_approach: customApproach || undefined,
                },
            });
            setIsDirty(false);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <>
        {showWizard && <VerticalPackWizard onClose={() => setShowWizard(false)} />}

        <div className="space-y-8">

            {/* Vertical Pack CTA */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-50 to-emerald-50 dark:from-violet-500/10 dark:to-emerald-500/10 border border-violet-200 dark:border-violet-500/20">
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">Configuração rápida por vertical</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Aplique um pack completo de agentes, tom e regras para o seu nicho em 3 cliques.
                    </p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className="flex-shrink-0 ml-4 px-4 py-2 text-sm rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors whitespace-nowrap"
                >
                    ✨ Ativar Pack
                </button>
            </div>

            {/* Agent Mode */}
            <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Modo de Operação
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {AGENT_MODES.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => { setAgentMode(mode.id); setIsDirty(true); }}
                            className={`relative text-left p-4 rounded-xl border-2 transition-all ${agentMode === mode.id
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                }`}
                        >
                            <span className="text-xl mb-2 block">{mode.icon}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-white block">
                                {mode.label}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block leading-snug">
                                {mode.description}
                            </span>
                            {mode.id === 'learn' && (
                                <span className="absolute top-2 right-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Beta
                                </span>
                            )}
                            {agentMode === mode.id && (
                                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px]">
                                    ✓
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            {/* Template Selector */}
            {agentMode === 'template' && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                        Escolha um Template
                    </h3>
                    {!templates?.length ? (
                        <p className="text-sm text-slate-400">Nenhum template disponível.</p>
                    ) : (
                        <div className="space-y-2">
                            {templates.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    onClick={() => { setSelectedTemplate(tpl.id); setIsDirty(true); }}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedTemplate === tpl.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-800 dark:text-white">
                                            {tpl.display_name}
                                        </span>
                                        <span className="text-[10px] bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                            {tpl.agent_role}
                                        </span>
                                    </div>
                                    {tpl.description && (
                                        <p className="text-xs text-slate-400 mt-0.5">{tpl.description}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Learn Mode: A/B testing panel */}
            {agentMode === 'learn' && (
                <section>
                    <AgentLearnModePanel />
                </section>
            )}

            {/* Advanced: Methodology selectors */}
            {agentMode === 'advanced' && (
                <>
                    <section>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Metodologia Principal
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">
                            Guia o comportamento do agente em toda a conversa.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {METHODOLOGIES.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => { setPrimary(m.value); setIsDirty(true); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${primary === m.value
                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                        }`}
                                >
                                    {m.label}
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${primary === m.value
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-white/10 text-slate-400'
                                        }`}>
                                        {m.badge}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Metodologias Secundárias
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">
                            Complementam a principal em etapas específicas.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {METHODOLOGIES.filter((m) => m.value !== primary).map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => toggleSecondary(m.value)}
                                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${secondary.includes(m.value)
                                        ? 'bg-violet-500 text-white border-violet-500'
                                        : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-violet-400'
                                        }`}
                                >
                                    {secondary.includes(m.value) ? '✓ ' : ''}{m.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Abordagem Customizada
                        </h3>
                        <textarea
                            value={customApproach}
                            onChange={(e) => { setCustomApproach(e.target.value); setIsDirty(true); }}
                            rows={4}
                            placeholder="Descreva instruções adicionais de abordagem. Ex: 'Sempre inicie com uma história de sucesso de cliente similar. Nunca cite preço antes de entender a dor...'"
                            className="w-full p-3 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                        />
                    </section>
                </>
            )}

            {/* Save */}
            {isDirty && (
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setIsDirty(false)}
                        className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        Descartar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Salvando...' : 'Salvar Metodologia'}
                    </button>
                </div>
            )}
        </div>
        </>
    );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
