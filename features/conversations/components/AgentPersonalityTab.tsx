'use client';

import React, { useState, useEffect } from 'react';
import {
    useAgentPersonalization,
    useUpdateAgentPersonalization,
} from '@/hooks/useAgentMethodology';
import type { TonePreset, FewShotExample } from '@/types/agent';

const TONE_PRESETS: { value: TonePreset; label: string; emoji: string; description: string }[] = [
    { value: 'formal', label: 'Formal', emoji: '🎩', description: 'Tom sério e técnico, adequado para B2B e advocacia.' },
    { value: 'profissional', label: 'Profissional', emoji: '💼', description: 'Equilibrado — sério mas acessível.' },
    { value: 'consultivo', label: 'Consultivo', emoji: '🤝', description: 'Foco em entender o problema antes de falar da solução.' },
    { value: 'empático', label: 'Empático', emoji: '💙', description: 'Acolhedor e cuidadoso — ideal para clínicas e saúde.' },
    { value: 'casual', label: 'Casual', emoji: '😊', description: 'Descontraído e próximo — ideal para varejo e moda.' },
    { value: 'técnico', label: 'Técnico', emoji: '⚙️', description: 'Preciso e orientado a dados — ideal para SaaS e TI.' },
    { value: 'inspirador', label: 'Inspirador', emoji: '✨', description: 'Motivacional e energético — ideal para educação e coaching.' },
];

const FORMALITY_OPTS = ['muito_informal', 'informal', 'neutro', 'formal', 'muito_formal'];
const ENERGY_OPTS = ['calmo', 'moderado', 'energético', 'muito_energético'];
const EMPATHY_OPTS = ['baixa', 'média', 'alta', 'muito_alta'];

export const AgentPersonalityTab: React.FC = () => {
    const { data: personalization, isLoading } = useAgentPersonalization();
    const updatePersonalization = useUpdateAgentPersonalization();

    // Persona state
    const [personaName, setPersonaName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [communicationStyle, setCommunicationStyle] = useState('');

    // Tone state
    const [tonePreset, setTonePreset] = useState<TonePreset>('profissional');
    const [formality, setFormality] = useState('neutro');
    const [energy, setEnergy] = useState('moderado');
    const [empathyLevel, setEmpathyLevel] = useState('média');
    const [useEmojis, setUseEmojis] = useState(true);
    const [wordsToUse, setWordsToUse] = useState<string[]>([]);
    const [wordsToAvoid, setWordsToAvoid] = useState<string[]>([]);
    const [wordInput, setWordInput] = useState('');
    const [avoidInput, setAvoidInput] = useState('');
    const [fewShots, setFewShots] = useState<FewShotExample[]>([]);

    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!personalization) return;
        const p = personalization.persona;
        const t = personalization.tone_of_voice;
        if (p) {
            setPersonaName(p.name ?? '');
            setRoleDescription(p.role_description ?? '');
            setCommunicationStyle(p.communication_style ?? '');
        }
        if (t) {
            setTonePreset(t.preset as TonePreset ?? 'profissional');
            const ls = t.language_style;
            if (ls) {
                setFormality(typeof ls.formality === 'number' ? 'neutro' : (ls.formality ?? 'neutro'));
                setEnergy(ls.energy ?? 'moderado');
                setEmpathyLevel(ls.empathy_level ?? 'média');
                setUseEmojis(ls.use_emojis ?? true);
            }
            setWordsToUse(t.words_to_use ?? []);
            setWordsToAvoid(t.words_to_avoid ?? []);
            setFewShots(t.few_shot_examples ?? []);
        }
    }, [personalization]);

    const mark = () => setIsDirty(true);

    const addWord = (list: 'use' | 'avoid') => {
        if (list === 'use' && wordInput.trim()) {
            setWordsToUse((p) => [...p, wordInput.trim()]);
            setWordInput('');
            mark();
        } else if (list === 'avoid' && avoidInput.trim()) {
            setWordsToAvoid((p) => [...p, avoidInput.trim()]);
            setAvoidInput('');
            mark();
        }
    };

    const addFewShot = () => {
        setFewShots((p) => [...p, { user_message: '', agent_response: '', rationale: '' }]);
        mark();
    };

    const updateFewShot = (idx: number, field: keyof FewShotExample, value: string) => {
        setFewShots((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
        mark();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePersonalization.mutateAsync({
                persona: {
                    name: personaName,
                    role_description: roleDescription,
                    communication_style: communicationStyle,
                },
                tone_of_voice: {
                    preset: tonePreset,
                    language_style: {
                        formality,
                        energy,
                        empathy_level: empathyLevel,
                        use_emojis: useEmojis,
                    },
                    words_to_use: wordsToUse,
                    words_to_avoid: wordsToAvoid,
                    few_shot_examples: fewShots.filter((f) => f.user_message && f.agent_response),
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

            {/* Persona */}
            <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Identidade do Agente</h3>
                <div className="space-y-3">
                    <Field label="Nome do Agente">
                        <input
                            value={personaName}
                            onChange={(e) => { setPersonaName(e.target.value); mark(); }}
                            placeholder="Ex: Sofia, Alex, NossoAgent..."
                            className="input-base"
                        />
                    </Field>
                    <Field label="Descrição do Papel">
                        <input
                            value={roleDescription}
                            onChange={(e) => { setRoleDescription(e.target.value); mark(); }}
                            placeholder="Ex: Consultora especialista em saúde estética da Clínica Vera..."
                            className="input-base"
                        />
                    </Field>
                    <Field label="Estilo de Comunicação">
                        <input
                            value={communicationStyle}
                            onChange={(e) => { setCommunicationStyle(e.target.value); mark(); }}
                            placeholder="Ex: Acolhedora, escuta ativa, usa linguagem simples sem jargões técnicos..."
                            className="input-base"
                        />
                    </Field>
                </div>
            </section>

            {/* Tone Preset */}
            <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Tom de Voz</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                    {TONE_PRESETS.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => { setTonePreset(t.value); mark(); }}
                            title={t.description}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${tonePreset === t.value
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                }`}
                        >
                            <span className="text-lg block mb-1">{t.emoji}</span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Language Style */}
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Formalidade">
                        <select value={formality} onChange={(e) => { setFormality(e.target.value); mark(); }} className="input-base">
                            {FORMALITY_OPTS.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                    </Field>
                    <Field label="Energia">
                        <select value={energy} onChange={(e) => { setEnergy(e.target.value); mark(); }} className="input-base">
                            {ENERGY_OPTS.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                    </Field>
                    <Field label="Empatia">
                        <select value={empathyLevel} onChange={(e) => { setEmpathyLevel(e.target.value); mark(); }} className="input-base">
                            {EMPATHY_OPTS.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                    </Field>
                    <Field label="Emojis nas respostas">
                        <div className="flex items-center gap-3 h-10">
                            <button
                                onClick={() => { setUseEmojis(!useEmojis); mark(); }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useEmojis ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useEmojis ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">{useEmojis ? 'Habilitado' : 'Desabilitado'}</span>
                        </div>
                    </Field>
                </div>
            </section>

            {/* Words to use/avoid */}
            <section>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">✅ Palavras para usar</h4>
                        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[36px]">
                            {wordsToUse.map((w) => (
                                <span key={w} className="flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                    {w}
                                    <button onClick={() => { setWordsToUse((p) => p.filter((x) => x !== w)); mark(); }} className="hover:text-red-500 ml-0.5">×</button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={wordInput}
                                onChange={(e) => setWordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addWord('use')}
                                placeholder="Adicionar palavra..."
                                className="input-base flex-1 text-xs"
                            />
                            <button onClick={() => addWord('use')} className="text-xs px-2 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">+</button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold text-red-500 dark:text-red-400 mb-2">❌ Palavras a evitar</h4>
                        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[36px]">
                            {wordsToAvoid.map((w) => (
                                <span key={w} className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full">
                                    {w}
                                    <button onClick={() => { setWordsToAvoid((p) => p.filter((x) => x !== w)); mark(); }} className="hover:text-red-700 ml-0.5">×</button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={avoidInput}
                                onChange={(e) => setAvoidInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addWord('avoid')}
                                placeholder="Adicionar palavra..."
                                className="input-base flex-1 text-xs"
                            />
                            <button onClick={() => addWord('avoid')} className="text-xs px-2 py-1 bg-red-400 text-white rounded-lg hover:bg-red-500">+</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Few-shot Examples */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exemplos de Conversa</h3>
                        <p className="text-xs text-slate-400">Mostre ao agente como você quer que ele responda em situações reais.</p>
                    </div>
                    <button onClick={addFewShot} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ Adicionar exemplo</button>
                </div>
                <div className="space-y-4">
                    {fewShots.map((ex, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500">Exemplo #{i + 1}</span>
                                <button onClick={() => { setFewShots((p) => p.filter((_, j) => j !== i)); mark(); }} className="text-xs text-red-400 hover:text-red-500">Remover</button>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-medium">Lead diz:</label>
                                <input
                                    value={ex.user_message}
                                    onChange={(e) => updateFewShot(i, 'user_message', e.target.value)}
                                    placeholder="Ex: Quanto custa o tratamento?"
                                    className="input-base mt-0.5"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-medium">Agente responde:</label>
                                <textarea
                                    value={ex.agent_response}
                                    onChange={(e) => updateFewShot(i, 'agent_response', e.target.value)}
                                    placeholder="Ex: Ótima pergunta! 😊 O valor varia de acordo com a avaliação do especialista..."
                                    rows={2}
                                    className="input-base mt-0.5 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-medium">Por quê (opcional):</label>
                                <input
                                    value={ex.rationale ?? ''}
                                    onChange={(e) => updateFewShot(i, 'rationale', e.target.value)}
                                    placeholder="Ex: Não citar preço antes da avaliação — priorizar consulta"
                                    className="input-base mt-0.5"
                                />
                            </div>
                        </div>
                    ))}
                    {fewShots.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                            Nenhum exemplo adicionado ainda. Exemplos melhoram muito a qualidade das respostas.
                        </p>
                    )}
                </div>
            </section>

            {/* Save */}
            {isDirty && (
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <button onClick={() => setIsDirty(false)} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors">
                        Descartar
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {saving ? 'Salvando...' : 'Salvar Personalidade'}
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

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
        {children}
    </div>
);

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
