'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBoards } from '@/lib/query/hooks/useBoardsQuery';

type Vertical = 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate';
type Step = 'vertical' | 'boards' | 'confirm' | 'done';

const VERTICALS: {
    id: Vertical;
    label: string;
    emoji: string;
    description: string;
    agents: string[];
    color: string;
}[] = [
    {
        id: 'generic',
        label: 'CRM Genérico',
        emoji: '🏢',
        description: 'Pipeline de vendas B2B/B2C com SDR, Closer e Reativação.',
        agents: ['SDR (BANT + FA)', 'Closer (SPIN + MEDDIC)', 'Reativação (FA)'],
        color: 'emerald',
    },
    {
        id: 'medical_clinic',
        label: 'Clínica Médica',
        emoji: '🏥',
        description: 'Recepção empática, conversão de consultas e recuperação de no-shows.',
        agents: ['Recepção Clínica', 'Conversão (SPIN + FA)', 'Recuperação No-show'],
        color: 'blue',
    },
    {
        id: 'dental_clinic',
        label: 'Clínica Odontológica',
        emoji: '🦷',
        description: 'Agendamento, conversão de tratamentos ortopédicos e recuperação de faltas.',
        agents: ['Recepção Odonto', 'Closer Ortho (SPIN + Neuro)', 'Recuperação No-show'],
        color: 'cyan',
    },
    {
        id: 'real_estate',
        label: 'Imobiliária',
        emoji: '🏠',
        description: 'Qualificação de perfil de comprador, negociação e reativação de leads frios.',
        agents: ['Qualificação (BANT + GPCT + FA)', 'Negociação (SPIN + MEDDIC)', 'Reativação (FA)'],
        color: 'violet',
    },
];

const COLOR_STYLES: Record<string, { border: string; bg: string; badge: string; btn: string }> = {
    emerald: {
        border: 'border-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        btn: 'bg-emerald-500 hover:bg-emerald-600',
    },
    blue: {
        border: 'border-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
        btn: 'bg-blue-500 hover:bg-blue-600',
    },
    cyan: {
        border: 'border-cyan-500',
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
        badge: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
        btn: 'bg-cyan-500 hover:bg-cyan-600',
    },
    violet: {
        border: 'border-violet-500',
        bg: 'bg-violet-50 dark:bg-violet-500/10',
        badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
        btn: 'bg-violet-500 hover:bg-violet-600',
    },
};

interface Props {
    onClose: () => void;
}

export const VerticalPackWizard: React.FC<Props> = ({ onClose }) => {
    const queryClient = useQueryClient();
    const { data: boards } = useBoards();

    const [step, setStep] = useState<Step>('vertical');
    const [selectedVertical, setSelectedVertical] = useState<Vertical | null>(null);
    const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
    const [overwrite, setOverwrite] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const verticalInfo = VERTICALS.find((v) => v.id === selectedVertical);
    const colors = verticalInfo ? COLOR_STYLES[verticalInfo.color] : COLOR_STYLES.emerald;

    const toggleBoard = (id: string) =>
        setSelectedBoardIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const handleActivate = async () => {
        if (!selectedVertical || !selectedBoardIds.length) return;
        setLoading(true);
        try {
            const res = await fetch('/api/agent/activate-vertical-pack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vertical: selectedVertical,
                    boardIds: selectedBoardIds,
                    overwrite,
                }),
            });
            const data = await res.json();
            setResult(data);
            setStep('done');

            // Invalidate board configs cache
            queryClient.invalidateQueries({ queryKey: ['agent-board-configs'] });
            queryClient.invalidateQueries({ queryKey: ['agent-personalization'] });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            ✨ Ativar Vertical Pack
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Configure o agente para seu nicho em 3 passos
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                </div>

                {/* Step indicator */}
                {step !== 'done' && (
                    <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 dark:border-white/5">
                        {(['vertical', 'boards', 'confirm'] as Step[]).map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`flex items-center gap-1.5 text-xs font-medium ${step === s
                                    ? 'text-violet-600 dark:text-violet-400'
                                    : ['vertical', 'boards', 'confirm'].indexOf(step) > i
                                        ? 'text-slate-400 line-through'
                                        : 'text-slate-300 dark:text-slate-600'
                                    }`}>
                                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${step === s
                                        ? 'bg-violet-500 text-white'
                                        : ['vertical', 'boards', 'confirm'].indexOf(step) > i
                                            ? 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                            : 'border border-slate-200 dark:border-white/20 text-slate-400'
                                        }`}>
                                        {i + 1}
                                    </span>
                                    {s === 'vertical' ? 'Vertical' : s === 'boards' ? 'Pipelines' : 'Confirmar'}
                                </div>
                                {i < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <div className="p-5">

                    {/* Step 1: Select vertical */}
                    {step === 'vertical' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Escolha o nicho do seu negócio. Vamos pré-configurar agentes, tom de voz e regras específicas.
                            </p>
                            {VERTICALS.map((v) => {
                                const c = COLOR_STYLES[v.color];
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVertical(v.id)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedVertical === v.id
                                            ? `${c.border} ${c.bg}`
                                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{v.emoji}</span>
                                            <div className="flex-1">
                                                <span className="text-sm font-semibold text-slate-800 dark:text-white block">
                                                    {v.label}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                                                    {v.description}
                                                </span>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {v.agents.map((a) => (
                                                        <span key={a} className={`text-[10px] px-2 py-0.5 rounded-full ${c.badge}`}>
                                                            {a}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {selectedVertical === v.id && (
                                                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] flex-shrink-0">✓</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Step 2: Select boards */}
                    {step === 'boards' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Selecione os pipelines que receberão a configuração do pack <strong>{verticalInfo?.label}</strong>.
                            </p>
                            {!boards?.length ? (
                                <p className="text-sm text-slate-400 text-center py-6">Nenhum pipeline encontrado.</p>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setSelectedBoardIds(
                                            selectedBoardIds.length === boards.length ? [] : boards.map((b: any) => b.id)
                                        )}
                                        className="text-xs text-violet-600 hover:text-violet-700 font-medium mb-1"
                                    >
                                        {selectedBoardIds.length === boards.length ? 'Desmarcar todos' : 'Selecionar todos'}
                                    </button>
                                    {boards.map((board: any) => (
                                        <button
                                            key={board.id}
                                            onClick={() => toggleBoard(board.id)}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedBoardIds.includes(board.id)
                                                ? `${colors.border} ${colors.bg}`
                                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                                }`}
                                        >
                                            <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${selectedBoardIds.includes(board.id)
                                                ? 'bg-emerald-500 border-emerald-500 text-white text-[10px]'
                                                : 'border-slate-300 dark:border-white/30'
                                                }`}>
                                                {selectedBoardIds.includes(board.id) && '✓'}
                                            </span>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {board.name}
                                            </span>
                                        </button>
                                    ))}
                                </>
                            )}

                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                                <input
                                    type="checkbox"
                                    id="overwrite"
                                    checked={overwrite}
                                    onChange={(e) => setOverwrite(e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                                <label htmlFor="overwrite" className="text-xs text-slate-500 cursor-pointer">
                                    Sobrescrever configurações existentes
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 'confirm' && verticalInfo && (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl">{verticalInfo.emoji}</span>
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-white">{verticalInfo.label}</p>
                                        <p className="text-xs text-slate-500">{selectedBoardIds.length} pipeline(s) selecionado(s)</p>
                                    </div>
                                </div>
                                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <p>✅ Templates de metodologia configurados nos pipelines</p>
                                    <p>✅ Tom de voz padrão: <strong>{VERTICALS.find(v => v.id === selectedVertical)?.id === 'medical_clinic' || selectedVertical === 'dental_clinic' ? 'Empático' : selectedVertical === 'real_estate' ? 'Consultivo' : 'Profissional'}</strong></p>
                                    <p>✅ Regras de negócio e compliance aplicados</p>
                                    <p>✅ Listas SEMPRE/NUNCA configuradas</p>
                                    <p>✅ Gatilhos de escalação para humano</p>
                                    {overwrite && <p className="text-amber-600 dark:text-amber-400">⚠️ Configurações existentes serão sobrescritas</p>}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">
                                Você pode personalizar qualquer detalhe depois nas abas Personalidade, Conhecimento e Treinamento.
                            </p>
                        </div>
                    )}

                    {/* Done */}
                    {step === 'done' && result && (
                        <div className="text-center space-y-4">
                            <div className="text-5xl">🎉</div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pack Ativado!</h3>
                            <p className="text-sm text-slate-500">
                                {result.boards_configured?.filter((b: any) => b.status === 'configured').length ?? 0} pipeline(s) configurado(s) com sucesso.
                            </p>
                            {result.boards_configured?.some((b: any) => b.status === 'skipped_existing') && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {result.boards_configured.filter((b: any) => b.status === 'skipped_existing').length} pipeline(s) já configurado(s) foram mantidos (use "sobrescrever" para atualizar).
                                </p>
                            )}
                            <div className="text-xs text-slate-400 text-left bg-slate-50 dark:bg-white/5 rounded-xl p-3 space-y-1">
                                <p className="font-medium text-slate-600 dark:text-slate-300 mb-2">Próximos passos sugeridos:</p>
                                <p>1. Aba <strong>Personalidade</strong> → adicione o nome do seu agente e exemplos de conversa</p>
                                <p>2. Aba <strong>Conhecimento</strong> → adicione FAQ, tabela de preços e políticas</p>
                                <p>3. Aba <strong>Treinamento</strong> → personalize as regras com casos reais do seu negócio</p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-white/10">
                    {step === 'done' ? (
                        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
                            Concluir
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => step === 'vertical' ? onClose() : setStep(step === 'confirm' ? 'boards' : 'vertical')}
                                className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                {step === 'vertical' ? 'Cancelar' : 'Voltar'}
                            </button>
                            <button
                                onClick={() => {
                                    if (step === 'vertical' && selectedVertical) setStep('boards');
                                    else if (step === 'boards' && selectedBoardIds.length > 0) setStep('confirm');
                                    else if (step === 'confirm') handleActivate();
                                }}
                                disabled={
                                    loading ||
                                    (step === 'vertical' && !selectedVertical) ||
                                    (step === 'boards' && selectedBoardIds.length === 0)
                                }
                                className={`px-6 py-2 text-sm rounded-xl text-white font-medium transition-colors disabled:opacity-40 ${colors.btn}`}
                            >
                                {loading ? 'Ativando...' : step === 'confirm' ? 'Ativar Pack' : 'Continuar'}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};
