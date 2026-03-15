'use client';

import React, { useState, useEffect } from 'react';
import {
    useAgentPersonalization,
    useUpdateAgentPersonalization,
} from '@/hooks/useAgentMethodology';

export const AgentTrainingTab: React.FC = () => {
    const { data: personalization, isLoading } = useAgentPersonalization();
    const updatePersonalization = useUpdateAgentPersonalization();

    // Behavioral training
    const [doList, setDoList] = useState<string[]>([]);
    const [dontList, setDontList] = useState<string[]>([]);
    const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);
    const [conversationStarters, setConversationStarters] = useState<string[]>([]);

    // Follow-up
    const [cacZeroScript, setCacZeroScript] = useState('');

    // Input buffers
    const [doInput, setDoInput] = useState('');
    const [dontInput, setDontInput] = useState('');
    const [escalationInput, setEscalationInput] = useState('');
    const [starterInput, setStarterInput] = useState('');

    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const bt = personalization?.behavioral_training;
        const fu = personalization?.follow_up_config;
        if (bt) {
            setDoList(bt.do_list ?? []);
            setDontList(bt.dont_list ?? []);
            setEscalationTriggers(bt.escalation_triggers ?? []);
            setConversationStarters(bt.conversation_starters ?? []);
        }
        if (fu) {
            setCacZeroScript(fu.cac_zero_script ?? '');
        }
    }, [personalization]);

    const mark = () => setIsDirty(true);

    const addToList = (
        list: string[],
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        input: string,
        clearInput: () => void
    ) => {
        const trimmed = input.trim();
        if (!trimmed || list.includes(trimmed)) return;
        setter((p) => [...p, trimmed]);
        clearInput();
        mark();
    };

    const removeFromList = (
        setter: React.Dispatch<React.SetStateAction<string[]>>,
        item: string
    ) => {
        setter((p) => p.filter((x) => x !== item));
        mark();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePersonalization.mutateAsync({
                behavioral_training: {
                    do_list: doList,
                    dont_list: dontList,
                    escalation_triggers: escalationTriggers,
                    conversation_starters: conversationStarters,
                    success_stories: [],
                },
                follow_up_config: {
                    sequences: personalization?.follow_up_config?.sequences ?? [],
                    cac_zero_script: cacZeroScript,
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

            {/* Do list */}
            <ListEditor
                title="✅ SEMPRE fazer"
                description="Comportamentos obrigatórios — o agente seguirá sempre."
                color="emerald"
                items={doList}
                inputValue={doInput}
                onInputChange={setDoInput}
                onAdd={() => addToList(doList, setDoList, doInput, () => setDoInput(''))}
                onRemove={(item) => removeFromList(setDoList, item)}
                placeholder="Ex: Confirmar o nome do lead antes de avançar..."
            />

            {/* Dont list */}
            <ListEditor
                title="❌ NUNCA fazer"
                description="Comportamentos proibidos — violações serão evitadas a qualquer custo."
                color="red"
                items={dontList}
                inputValue={dontInput}
                onInputChange={setDontInput}
                onAdd={() => addToList(dontList, setDontList, dontInput, () => setDontInput(''))}
                onRemove={(item) => removeFromList(setDontList, item)}
                placeholder="Ex: Prometer descontos sem aprovação do gerente..."
            />

            {/* Escalation triggers */}
            <ListEditor
                title="🔁 Transferir para humano quando"
                description="O agente aciona o handover automaticamente nesses casos."
                color="amber"
                items={escalationTriggers}
                inputValue={escalationInput}
                onInputChange={setEscalationInput}
                onAdd={() => addToList(escalationTriggers, setEscalationTriggers, escalationInput, () => setEscalationInput(''))}
                onRemove={(item) => removeFromList(setEscalationTriggers, item)}
                placeholder="Ex: Lead demonstra frustração ou raiva..."
            />

            {/* Conversation starters */}
            <ListEditor
                title="💬 Abordagens de abertura"
                description="Opções de mensagens iniciais — o agente escolhe a mais adequada ao contexto."
                color="violet"
                items={conversationStarters}
                inputValue={starterInput}
                onInputChange={setStarterInput}
                onAdd={() => addToList(conversationStarters, setConversationStarters, starterInput, () => setStarterInput(''))}
                onRemove={(item) => removeFromList(setConversationStarters, item)}
                placeholder="Ex: Olá! 👋 Vi que você se interessou pelo nosso serviço. Como posso ajudar?"
            />

            {/* CAC Zero script */}
            <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Script CAC Zero (Reativação)
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                    Mensagem para reativar leads inativos — metodologia Flávio Augusto: custo de reativação é zero. Use <code className="bg-slate-100 dark:bg-white/10 px-1 rounded">{'{{nome}}'}</code> para o nome do lead.
                </p>
                <textarea
                    value={cacZeroScript}
                    onChange={(e) => { setCacZeroScript(e.target.value); mark(); }}
                    rows={4}
                    placeholder="Ex: Oi {{nome}}, tudo bem? 😊 Há um tempo que não nos falamos. Lembro que você tinha interesse no nosso serviço de [X]. Temos novidades que podem te interessar — posso te contar em 2 minutos?"
                    className="w-full p-3 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
            </section>

            {/* Save */}
            {isDirty && (
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <button onClick={() => setIsDirty(false)} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors">
                        Descartar
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {saving ? 'Salvando...' : 'Salvar Treinamento'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Reusable list editor ──────────────────────────────────────────────────────

type Color = 'emerald' | 'red' | 'amber' | 'violet';

const COLOR_MAP: Record<Color, { badge: string; addBtn: string; input: string }> = {
    emerald: {
        badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        addBtn: 'bg-emerald-500 hover:bg-emerald-600',
        input: 'focus:ring-emerald-500/40',
    },
    red: {
        badge: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300',
        addBtn: 'bg-red-400 hover:bg-red-500',
        input: 'focus:ring-red-500/40',
    },
    amber: {
        badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
        addBtn: 'bg-amber-500 hover:bg-amber-600',
        input: 'focus:ring-amber-500/40',
    },
    violet: {
        badge: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300',
        addBtn: 'bg-violet-500 hover:bg-violet-600',
        input: 'focus:ring-violet-500/40',
    },
};

interface ListEditorProps {
    title: string;
    description: string;
    color: Color;
    items: string[];
    inputValue: string;
    onInputChange: (v: string) => void;
    onAdd: () => void;
    onRemove: (item: string) => void;
    placeholder: string;
}

const ListEditor: React.FC<ListEditorProps> = ({
    title, description, color, items, inputValue, onInputChange, onAdd, onRemove, placeholder,
}) => {
    const c = COLOR_MAP[color];

    return (
        <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{title}</h3>
            <p className="text-xs text-slate-400 mb-3">{description}</p>

            {items.length > 0 && (
                <div className="space-y-1.5 mb-3">
                    {items.map((item) => (
                        <div key={item} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${c.badge}`}>
                            <span className="text-xs flex-1">{item}</span>
                            <button onClick={() => onRemove(item)} className="flex-shrink-0 opacity-60 hover:opacity-100 text-xs">×</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <input
                    value={inputValue}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                    placeholder={placeholder}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${c.input}`}
                />
                <button
                    onClick={onAdd}
                    className={`px-3 py-2 text-sm text-white rounded-lg ${c.addBtn} transition-colors`}
                >
                    Adicionar
                </button>
            </div>

            {items.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1.5 italic">Nenhum item adicionado.</p>
            )}
        </section>
    );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
