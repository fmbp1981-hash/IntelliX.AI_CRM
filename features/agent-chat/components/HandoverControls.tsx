import React from 'react';
import { Bot, UserSquare2, RefreshCcw, PauseCircle, PlayCircle } from 'lucide-react';

interface HandoverControlsProps {
    status: 'bot_active' | 'human_active' | 'paused';
    onTakeover: () => void;
    onReturnToBot: () => void;
    onTogglePause: () => void;
}

export function HandoverControls({ status, onTakeover, onReturnToBot, onTogglePause }: HandoverControlsProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between p-3 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/10">
            {/* Current Status Indicator */}
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <div className="relative">
                    <span className="absolute -inset-1 rounded-full animate-pulse bg-current opacity-20"
                        style={{ color: status === 'bot_active' ? '#10b981' : status === 'human_active' ? '#6366f1' : '#f59e0b' }}
                    />
                    {status === 'bot_active' ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center relative z-10 border border-emerald-200 dark:border-emerald-800/50">
                            <Bot size={20} />
                        </div>
                    ) : status === 'human_active' ? (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center relative z-10 border border-indigo-200 dark:border-indigo-800/50">
                            <UserSquare2 size={20} />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center relative z-10 border border-amber-200 dark:border-amber-800/50">
                            <PauseCircle size={20} />
                        </div>
                    )}
                </div>
                <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
                        Status do Atendimento
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {status === 'bot_active' ? 'Inteligência Artificial (Ativa)' :
                            status === 'human_active' ? 'Atendimento Humano' :
                                'Agente Pausado'}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {status === 'bot_active' && (
                    <button
                        onClick={onTakeover}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-500/30 transition-colors"
                    >
                        <UserSquare2 size={16} />
                        Assumir Conversa
                    </button>
                )}

                {status === 'human_active' && (
                    <button
                        onClick={onReturnToBot}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                    >
                        <RefreshCcw size={16} />
                        Devolver p/ IA
                    </button>
                )}

                <button
                    onClick={onTogglePause}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                >
                    {status === 'paused' ? (
                        <>
                            <PlayCircle size={16} className="text-emerald-500" />
                            Retomar IA
                        </>
                    ) : (
                        <>
                            <PauseCircle size={16} className="text-amber-500" />
                            Pausar IA
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
