'use client';

import { useState, useRef, useEffect, FormEvent, ReactNode } from 'react';
import { submitUserMessage } from '@/lib/ai/actions';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';

/**
 * Message interface for chat UI
 */
interface UIMessage {
    id: string;
    role: 'user' | 'assistant';
    display: ReactNode;
}

/**
 * RSC Chat Component using AI SDK v6 streamUI
 * 
 * This component uses Server Actions with streamUI to stream
 * React components as AI responses, enabling generative UI.
 */
export function RSCChat() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userInput = input.trim();
        setInput('');
        setIsLoading(true);

        // Add user message to UI
        const userMessage: UIMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            display: (
                <div className="flex items-start gap-3 justify-end">
                    <div className="bg-primary-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%]">
                        {userInput}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-primary-600 dark:text-primary-400" />
                    </div>
                </div>
            ),
        };

        setMessages(prev => [...prev, userMessage]);

        try {
            // Call server action directly and get streaming React component
            const response = await submitUserMessage(userInput);

            // Add AI response to UI
            const assistantMessage: UIMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                display: (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                            {response}
                        </div>
                    </div>
                ),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: UIMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                display: (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-red-600 dark:text-red-400" />
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-2xl rounded-tl-sm">
                            Erro ao processar sua mensagem. Tente novamente.
                        </div>
                    </div>
                ),
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                            <Sparkles size={32} className="text-white" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2 text-slate-700 dark:text-slate-200">
                            NossoCRM AI
                        </h3>
                        <p className="text-sm max-w-xs">
                            Pergunte sobre seus deals, crie tarefas, ou peça uma análise do seu pipeline.
                        </p>

                        {/* Quick Actions */}
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            {[
                                '📊 Analise meu pipeline',
                                '🔍 Buscar deals',
                                '✅ Criar tarefa',
                            ].map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map(message => (
                        <div key={message.id}>{message.display}</div>
                    ))
                )}

                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Loader2 size={16} className="text-white animate-spin" />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="animate-pulse">Pensando</span>
                                <span className="flex gap-1">
                                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Pergunte algo ao assistente..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default RSCChat;
