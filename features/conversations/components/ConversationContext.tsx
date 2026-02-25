'use client';

import React from 'react';

interface ConversationContextProps {
    contact: { id: string; name: string; email?: string; phone?: string; company_name?: string } | null;
    deal: { id: string; title: string; value?: number; stage_id?: string } | null;
    qualificationStatus: string;
    qualificationScore: number | null;
    qualificationData: Record<string, unknown>;
    qualificationFields: Array<{ key: string; question: string; required: boolean }>;
    toolsLog: Array<{ tool_name: string; success: boolean; created_at: string }>;
    detectedIntent: string | null;
    detectedSentiment: string | null;
}

const SENTIMENT_ICONS: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😞',
    angry: '😡',
};

export const ConversationContext: React.FC<ConversationContextProps> = ({
    contact,
    deal,
    qualificationStatus,
    qualificationScore,
    qualificationData,
    qualificationFields,
    toolsLog,
    detectedIntent,
    detectedSentiment,
}) => {
    const collectedCount = Object.keys(qualificationData ?? {}).length;
    const totalFields = qualificationFields.length;
    const progressPct = totalFields > 0 ? Math.round((collectedCount / totalFields) * 100) : 0;

    return (
        <div className="flex flex-col h-full overflow-y-auto border-l border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="p-4 space-y-4">
                {/* Header */}
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Contexto CRM
                </h3>

                {/* Sentiment + Intent */}
                {(detectedSentiment || detectedIntent) && (
                    <div className="flex gap-2">
                        {detectedSentiment && (
                            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5">
                                {SENTIMENT_ICONS[detectedSentiment] ?? '🤔'} {detectedSentiment}
                            </span>
                        )}
                        {detectedIntent && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                🎯 {detectedIntent}
                            </span>
                        )}
                    </div>
                )}

                {/* Contact Card */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Contato</h4>
                    {contact ? (
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{contact.name}</p>
                            {contact.phone && <p className="text-xs text-slate-500">📱 {contact.phone}</p>}
                            {contact.email && <p className="text-xs text-slate-500">✉️ {contact.email}</p>}
                            {contact.company_name && <p className="text-xs text-slate-500">🏢 {contact.company_name}</p>}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Ainda não vinculado</p>
                    )}
                </div>

                {/* Deal Card */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Deal</h4>
                    {deal ? (
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{deal.title}</p>
                            {deal.value != null && deal.value > 0 && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                    R$ {deal.value.toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Nenhum deal vinculado</p>
                    )}
                </div>

                {/* Qualification Progress */}
                {totalFields > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Qualificação</h4>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                                {collectedCount}/{totalFields}
                            </span>
                        </div>
                        {qualificationScore != null && (
                            <p className="text-xs text-slate-500 mb-2">Score: <span className="font-bold">{qualificationScore}/100</span></p>
                        )}
                        <div className="space-y-1">
                            {qualificationFields.map((field) => {
                                const collected = !!(qualificationData ?? {})[field.key];
                                return (
                                    <div key={field.key} className="flex items-center gap-1.5">
                                        <span className={`text-xs ${collected ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            {collected ? '✅' : '⬜'}
                                        </span>
                                        <span className={`text-xs ${collected ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                                            {field.key}
                                        </span>
                                        {field.required && !collected && (
                                            <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 text-red-500">obrigatório</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tools Log */}
                {toolsLog.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                            Tools Log ({toolsLog.length})
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {toolsLog.slice(0, 10).map((log, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <span className="text-[10px]">{log.success ? '✅' : '❌'}</span>
                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                        {log.tool_name}
                                    </span>
                                    <span className="text-[9px] text-slate-400 ml-auto">
                                        {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
