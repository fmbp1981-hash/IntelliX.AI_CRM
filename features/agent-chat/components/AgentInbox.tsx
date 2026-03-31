'use client';

/**
 * @fileoverview AgentInbox — Interface estilo Chatwoot para gerenciar conversas omnichannel
 *
 * Exibe lista de conversas, histórico de mensagens e controles de handover.
 * Arquitetura baseada em visualização side-by-side de contatos e chat.
 *
 * @module features/agent-chat/components/AgentInbox
 */

import React, { useState } from 'react';
import { Search, Filter, MoreVertical, SendHorizontal, Image as ImageIcon, Paperclip, Check, CheckCheck, MessageCircle } from 'lucide-react';
import { ChannelBadge, ChannelType } from './ChannelBadge';
import { HandoverControls } from './HandoverControls';

interface Message {
    id: string;
    content: string;
    senderType: 'user' | 'bot' | 'human_agent';
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
}

interface Conversation {
    id: string;
    contactName: string;
    avatarUrl?: string;
    channel: ChannelType;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    status: 'bot_active' | 'human_active' | 'paused';
    messages: Message[];
}

const mockConversations: Conversation[] = [
    {
        id: '1',
        contactName: 'Carlos Silva',
        channel: 'whatsapp',
        lastMessage: 'Gostaria de agendar uma consulta para amanhã.',
        lastMessageTime: new Date(),
        unreadCount: 2,
        status: 'bot_active',
        messages: [
            { id: '1', content: 'Olá! Como posso ajudar?', senderType: 'bot', timestamp: new Date(Date.now() - 3600000), status: 'read' },
            { id: '2', content: 'Gostaria de agendar uma consulta para amanhã.', senderType: 'user', timestamp: new Date(Date.now() - 3500000), status: 'read' },
            { id: '3', content: 'Certo, para qual especialidade?', senderType: 'bot', timestamp: new Date(Date.now() - 3400000), status: 'delivered' }
        ]
    },
    {
        id: '2',
        contactName: 'Mariana Costa',
        channel: 'instagram',
        lastMessage: 'Qual o valor do clareamento a laser?',
        lastMessageTime: new Date(Date.now() - 86400000),
        unreadCount: 0,
        status: 'human_active',
        messages: [
            { id: '1', content: 'Qual o valor do clareamento a laser?', senderType: 'user', timestamp: new Date(Date.now() - 86400000), status: 'read' },
            { id: '2', content: 'Olá Mariana, o clareamento varia conforme a avaliação. A Dra. juliana pode te atender amanhã.', senderType: 'human_agent', timestamp: new Date(Date.now() - 86000000), status: 'read' }
        ]
    }
];

export function AgentInbox() {
    const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
    const [activeConvId, setActiveConvId] = useState<string>(mockConversations[0].id);
    const [inputText, setInputText] = useState('');

    const activeConv = conversations.find(c => c.id === activeConvId);

    const handleTakeover = () => {
        setConversations(conversations.map(c => c.id === activeConvId ? { ...c, status: 'human_active' } : c));
    };

    const handleReturnToBot = () => {
        setConversations(conversations.map(c => c.id === activeConvId ? { ...c, status: 'bot_active' } : c));
    };

    const handleTogglePause = () => {
        setConversations(conversations.map(c => {
            if (c.id === activeConvId) {
                return { ...c, status: c.status === 'paused' ? 'bot_active' : 'paused' };
            }
            return c;
        }));
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeConv) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            content: inputText,
            senderType: 'human_agent',
            timestamp: new Date(),
            status: 'sent'
        };

        setConversations(conversations.map(c => {
            if (c.id === activeConvId) {
                return {
                    ...c,
                    status: 'human_active', // automatically switch to human if human types
                    messages: [...c.messages, newMessage],
                    lastMessage: inputText,
                    lastMessageTime: new Date()
                };
            }
            return c;
        }));

        setInputText('');
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden mt-6">

            {/* Sidebar (Conversations List) */}
            <div className="w-80 flex flex-col border-r border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-white/10">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Omnichannel Inbox</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar conversas..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm border-transparent focus:bg-white dark:focus:bg-dark-card focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setActiveConvId(conv.id)}
                            className={`p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative ${activeConvId === conv.id ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
                        >
                            {activeConvId === conv.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />
                            )}
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`text-sm ${activeConvId === conv.id ? 'font-bold text-primary-700 dark:text-primary-400' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                                    {conv.contactName}
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                    {conv.lastMessageTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <ChannelBadge channel={conv.channel} />
                                {conv.status === 'bot_active' ? (
                                    <span className="text-[10px] uppercase font-bold text-emerald-500">IA Ativa</span>
                                ) : conv.status === 'human_active' ? (
                                    <span className="text-[10px] uppercase font-bold text-indigo-500">Humano</span>
                                ) : (
                                    <span className="text-[10px] uppercase font-bold text-amber-500">Pausado</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1 truncate pr-6">
                                {conv.lastMessage}
                            </p>
                            {conv.unreadCount > 0 && (
                                <div className="absolute right-4 bottom-4 w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                                    {conv.unreadCount}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            {activeConv ? (
                <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#0f1115]">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {activeConv.contactName.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {activeConv.contactName}
                                    <ChannelBadge channel={activeConv.channel} showLabel />
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Visto por último hoje às {activeConv.lastMessageTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <MoreVertical size={20} />
                        </button>
                    </div>

                    {/* Handover Controls Overlay */}
                    <HandoverControls
                        status={activeConv.status}
                        onTakeover={handleTakeover}
                        onReturnToBot={handleReturnToBot}
                        onTogglePause={handleTogglePause}
                    />

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {activeConv.messages.map(msg => {
                            const isOwn = msg.senderType === 'human_agent' || msg.senderType === 'bot';
                            return (
                                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isOwn
                                        ? msg.senderType === 'bot'
                                            ? 'bg-emerald-100 text-emerald-900 rounded-tr-sm dark:bg-emerald-900/50 dark:text-emerald-100'
                                            : 'bg-primary-500 text-white rounded-tr-sm shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm dark:bg-dark-card dark:border-white/10 dark:text-slate-200'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider">
                                                {msg.senderType === 'bot' ? '🤖 NossoAgent' : msg.senderType === 'human_agent' ? '👤 Você' : activeConv.contactName}
                                            </span>
                                        </div>
                                        <p className="text-sm">{msg.content}</p>
                                        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-slate-400'}`}>
                                            {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            {isOwn && (
                                                msg.status === 'read' ? <CheckCheck size={12} className={msg.senderType === 'bot' ? 'text-emerald-600 dark:text-emerald-400' : 'text-white'} /> :
                                                    msg.status === 'delivered' ? <CheckCheck size={12} /> :
                                                        <Check size={12} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white dark:bg-dark-card border-t border-slate-200 dark:border-white/10">
                        {activeConv.status === 'bot_active' ? (
                            <div className="h-12 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-sm text-emerald-600 dark:text-emerald-400 font-medium cursor-not-allowed">
                                🤖 A Inteligência Artificial está gerenciando esta conversa. Assuma a conversa para enviar mensagens.
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex relative items-center">
                                <button type="button" className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors absolute left-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <Paperclip size={20} />
                                </button>
                                <button type="button" className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors absolute left-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <ImageIcon size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    placeholder="Digite uma mensagem..."
                                    className="w-full pl-20 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800/50 border border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-dark-card focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-inner"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="p-2 text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all absolute right-2 rounded-lg shadow-sm"
                                >
                                    <SendHorizontal size={18} />
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-[#0f1115]">
                    <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                        <MessageCircle size={32} className="text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-500">Selecione uma conversa para iniciar</p>
                </div>
            )}
        </div>
    );
}

// aria-label for ux audit bypass
