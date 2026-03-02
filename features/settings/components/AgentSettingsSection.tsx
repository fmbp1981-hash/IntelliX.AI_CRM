import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Settings2, Shield, ThermometerSun, AlertCircle } from 'lucide-react';
import { useAgentSettings } from '../hooks/useAgentSettings';

export const AgentSettingsSection: React.FC = () => {
    const { agentConfig, isLoading, updateConfig, isUpdating } = useAgentSettings();

    // Local state for edits
    const [name, setName] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [systemPrompt, setSystemPrompt] = useState('');

    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [farewellMessage, setFarewellMessage] = useState('');
    const [transferMessage, setTransferMessage] = useState('');
    const [outsideHoursMessage, setOutsideHoursMessage] = useState('');

    // Sync from API
    useEffect(() => {
        if (agentConfig) {
            setName(agentConfig.agent_name || 'Assistente');
            setTemperature(agentConfig.ai_temperature || 0.7);
            setSystemPrompt(agentConfig.system_prompt_override || '');

            setWelcomeMessage(agentConfig.welcome_message || '');
            setFarewellMessage(agentConfig.farewell_message || '');
            setTransferMessage(agentConfig.transfer_message || '');
            setOutsideHoursMessage(agentConfig.outside_hours_message || '');
        }
    }, [agentConfig]);

    const handleSavePersona = () => {
        updateConfig({
            agent_name: name,
            ai_temperature: temperature,
            system_prompt_override: systemPrompt,
        });
    };

    const handleSaveRouting = () => {
        updateConfig({
            welcome_message: welcomeMessage,
            farewell_message: farewellMessage,
            transfer_message: transferMessage,
            outside_hours_message: outsideHoursMessage,
        });
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Carregando configurações do Agente...</div>;
    }

    if (!agentConfig) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                Erro ao carregar configurações do agente.
            </div>
        );
    }

    return (
        <div id="agent-config" className="mt-6 border-t border-slate-200 dark:border-white/10 pt-6 scroll-mt-8 space-y-8">

            <div className="flex items-center gap-3 mb-4">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <Bot size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Personalidade e Roteamento (GPT Maker)</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Configure como o agente se comporta, seu objetivo e mensagens padrão.</p>
                </div>
            </div>

            {/* Persona Settings */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl p-6 shadow-sm space-y-6">
                <h3 className="text-md font-semibold font-display text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Shield size={18} className="text-purple-500" />
                    Identidade & Instruções (Prompt)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome do Assistente</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Assistente Virtual, Maria, Bot"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            Criatividade (Temperatura: {temperature}) <ThermometerSun size={14} className="text-amber-500" />
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0.0 (Preciso / Rígido)</span>
                            <span>1.0 (Criativo / Inventivo)</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Instruções Customizadas (System Prompt Override)</label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Por padrão o agente já sabe que é um assistente de CRM, que responde WhatsApp e que tenta coletar interesse.
                        Escreva aqui as <strong>regras específicas da sua empresa</strong>, objeções, e como ele deve persuadir o lead.
                    </p>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Ex: Você é um vendedor da clínica X. O foco é marcar agendamento. Nunca prometa descontos sem pedir autorização. Siga o método SPIN na qualificação."
                        rows={6}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-y"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSavePersona}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isUpdating ? 'Salvando...' : 'Salvar Identidade'}
                    </button>
                </div>
            </div>

            {/* Routing Messages */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl p-6 shadow-sm space-y-6">
                <h3 className="text-md font-semibold font-display text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <MessageSquare size={18} className="text-blue-500" />
                    Mensagens Padrão e Fluxo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensagem de Boas-vindas (Ativo no Primeiro Contato)</label>
                        <textarea
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            placeholder="Ex: Olá! Sou o assistente virtual da [Sua Empresa]. Como posso ajudar?"
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensagem de Transferência (Para Humano)</label>
                        <textarea
                            value={transferMessage}
                            onChange={(e) => setTransferMessage(e.target.value)}
                            placeholder="Ex: Só um minuto! Vou transferir você para um especialista do nosso time."
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensagem Fora de Horário</label>
                        <textarea
                            value={outsideHoursMessage}
                            onChange={(e) => setOutsideHoursMessage(e.target.value)}
                            placeholder="Ex: Nosso horário é de seg a sex, das 8h às 18h. Deixe sua mensagem!"
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSaveRouting}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isUpdating ? 'Salvando...' : 'Salvar Roteamento'}
                    </button>
                </div>
            </div>

        </div>
    );
};
