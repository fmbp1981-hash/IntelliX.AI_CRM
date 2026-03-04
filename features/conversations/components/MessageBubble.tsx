import React, { useState, useEffect } from 'react';

interface MessageBubbleProps {
    role: 'lead' | 'ai' | 'human' | 'system';
    content: string;
    timestamp: string;
    senderName?: string;
    isInternalNote?: boolean;
    aiToolsUsed?: string[];
}

const ROLE_STYLES: Record<string, { bg: string; align: string; label: string }> = {
    lead: {
        bg: 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-slate-100',
        align: 'justify-start',
        label: 'Lead',
    },
    ai: {
        bg: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-slate-900 dark:text-slate-100',
        align: 'justify-end',
        label: '🤖 NossoAgent',
    },
    human: {
        bg: 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-slate-900 dark:text-slate-100',
        align: 'justify-end',
        label: '👤 Atendente',
    },
    system: {
        bg: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300',
        align: 'justify-center',
        label: '⚙️ Sistema',
    },
};

function formatTime(ts: string): string {
    try {
        return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

// Helper to chunk long messages nicely
function chunkMessage(text: string): string[] {
    if (!text) return [];
    // Split by double newline first (paragraphs)
    let chunks = text.split(/\n\n+/).filter(c => c.trim().length > 0);

    // If a paragraph is still too large (e.g., > 300 chars), we could split by single newline or sentences, 
    // but paragraph splitting is usually natural enough for AI responses.
    return chunks;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    role,
    content,
    timestamp,
    senderName,
    isInternalNote,
    aiToolsUsed,
}) => {
    const style = ROLE_STYLES[role] ?? ROLE_STYLES.system;

    // Chunking and typing state (only for AI)
    const isAi = role === 'ai';
    const chunks = isAi ? chunkMessage(content) : [content];

    // If it's an old message (from history), we just show all chunks immediately. 
    // To distinguish new vs old, we use a simple heuristic: if it was created more than 1 min ago, it's old.
    // However, since we don't have access to "current time" robustly without re-renders,
    // we assume the parent handles the "isNew" prop. For now, we simulate typing if timestamp is very recent.
    const isLikelyNew = isAi && (new Date().getTime() - new Date(timestamp).getTime() < 60000);

    const [visibleChunks, setVisibleChunks] = useState<number>(isLikelyNew ? 0 : chunks.length);
    const [isTyping, setIsTyping] = useState<boolean>(isLikelyNew);

    useEffect(() => {
        if (!isLikelyNew) return;

        let currentChunk = 0;
        let timeoutId: NodeJS.Timeout;

        const showNextChunk = () => {
            if (currentChunk < chunks.length) {
                setIsTyping(true);
                // Simulate typing delay: 500ms base + 20ms per character of the next chunk
                const delay = 500 + (chunks[currentChunk].length * 20);

                timeoutId = setTimeout(() => {
                    setIsTyping(false);
                    setVisibleChunks(prev => prev + 1);
                    currentChunk++;
                    if (currentChunk < chunks.length) {
                        // Small pause before starting to type the next chunk
                        timeoutId = setTimeout(showNextChunk, 800);
                    }
                }, Math.min(delay, 2500)); // Cap the typing indicator to 2.5s maximum per chunk
            }
        };

        if (chunks.length > 0) {
            showNextChunk();
        } else {
            setIsTyping(false);
            setVisibleChunks(1);
        }

        return () => clearTimeout(timeoutId);
    }, [content, isLikelyNew, chunks.length]);

    if (isInternalNote) {
        return (
            <div className="flex justify-center my-2">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 max-w-md text-center">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">📝 Nota interna</span>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{content}</p>
                </div>
            </div>
        );
    }

    if (role === 'system') {
        return (
            <div className="flex justify-center my-2">
                <div className={`${style.bg} rounded-lg px-4 py-2 max-w-md text-center`}>
                    <p className="text-xs">{content}</p>
                </div>
            </div>
        );
    }

    // Render each visible chunk as a separate bubble if it's the AI, else just one bubble
    const chunksToRender = chunks.slice(0, visibleChunks);

    return (
        <div className="flex flex-col gap-2 w-full">
            {chunksToRender.map((chunk, index) => (
                <div key={index} className={`flex ${style.align} my-1 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`${style.bg} rounded-2xl px-4 py-2.5 max-w-[75%] min-w-[80px]`}>
                        {index === 0 && (
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-semibold opacity-60">
                                    {senderName ?? style.label}
                                </span>
                            </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{chunk}</p>

                        {/* Only show metadata on the last chunk */}
                        {index === chunksToRender.length - 1 && index === chunks.length - 1 && (
                            <div className="flex items-center justify-end gap-2 mt-1">
                                {aiToolsUsed && aiToolsUsed.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                        {aiToolsUsed.map((tool) => (
                                            <span
                                                key={tool}
                                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono"
                                            >
                                                {tool}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <span className="text-[10px] opacity-40">{formatTime(timestamp)}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {isTyping && (
                <div className={`flex ${style.align} my-1 animate-in fade-in`}>
                    <div className={`${style.bg} rounded-2xl px-4 py-3 max-w-[75%] opacity-70`}>
                        <div className="flex gap-1 items-center h-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
