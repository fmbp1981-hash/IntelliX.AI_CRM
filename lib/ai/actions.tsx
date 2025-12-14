'use server';

import { streamUI } from '@ai-sdk/rsc';
import { z } from 'zod';
import { createProvider, DEFAULT_MODEL } from './provider';
import { createClient } from '@/lib/supabase/server';
import { ReactNode } from 'react';

// ==============================================
// Loading Component
// ==============================================
const Loading = () => (
    <div className="animate-pulse p-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Processando...
    </div>
);

// ==============================================
// Deal Card Component
// ==============================================
interface Deal {
    id: string;
    title: string;
    value: number;
    stage?: { name: string };
    contact?: { name: string };
}

const DealCard = ({ deal }: { deal: Deal }) => (
    <div className="p-4 border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-slate-900 dark:text-white">{deal.title}</h3>
            {deal.stage && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                    {deal.stage.name}
                </span>
            )}
        </div>
        <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            R$ {(deal.value || 0).toLocaleString('pt-BR')}
        </p>
        {deal.contact && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                👤 {deal.contact.name}
            </p>
        )}
    </div>
);

// ==============================================
// Task Created Component
// ==============================================
const TaskCreated = ({ title }: { title: string }) => (
    <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-r-lg">
        <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✅</span>
            <span className="font-medium text-green-800 dark:text-green-200">
                Tarefa criada: {title}
            </span>
        </div>
    </div>
);

// ==============================================
// Pipeline Summary Component
// ==============================================
interface PipelineSummaryProps {
    totalDeals: number;
    totalValue: number;
    stageBreakdown: { name: string; count: number }[];
}

const PipelineSummary = ({ totalDeals, totalValue, stageBreakdown }: PipelineSummaryProps) => (
    <div className="p-4 border rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            📊 Resumo do Pipeline
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{totalDeals}</p>
                <p className="text-xs text-slate-500">Deals</p>
            </div>
            <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">
                    R$ {totalValue.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500">Valor Total</p>
            </div>
        </div>
        {stageBreakdown.length > 0 && (
            <div className="space-y-1">
                <p className="text-xs text-slate-500 mb-2">Por Estágio:</p>
                {stageBreakdown.map(stage => (
                    <div key={stage.name} className="flex justify-between text-sm">
                        <span>{stage.name}</span>
                        <span className="font-medium">{stage.count}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// ==============================================
// Contact Card Component
// ==============================================
interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
}

const ContactCard = ({ contact }: { contact: Contact }) => (
    <div className="p-4 border rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">{contact.name}</h3>
        {contact.email && (
            <p className="text-sm text-slate-600 dark:text-slate-400">📧 {contact.email}</p>
        )}
        {contact.phone && (
            <p className="text-sm text-slate-600 dark:text-slate-400">📱 {contact.phone}</p>
        )}
        {contact.company && (
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">🏢 {contact.company}</p>
        )}
    </div>
);

// ==============================================
// Error Component
// ==============================================
const ErrorMessage = ({ message }: { message: string }) => (
    <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-lg">
        <span className="text-red-700 dark:text-red-300">❌ {message}</span>
    </div>
);

// ==============================================
// Main Server Action
// ==============================================
export async function submitUserMessage(userMessage: string): Promise<ReactNode> {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return <ErrorMessage message="Você precisa estar logado para usar o assistente." />;
    }

    // Buscar organization_id do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return <ErrorMessage message="Perfil não encontrado ou sem organização vinculada." />;
    }

    // Buscar API key das configurações da organização
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('ai_google_key, ai_model')
        .eq('organization_id', profile.organization_id)
        .single();

    if (!orgSettings?.ai_google_key) {
        return <ErrorMessage message="API key do Gemini não configurada. Vá em Configurações para adicionar." />;
    }

    const google = createProvider(orgSettings.ai_google_key);
    const modelToUse = orgSettings.ai_model || DEFAULT_MODEL;

    try {
        const result = await streamUI({
            model: google(modelToUse),
            system: `Você é um assistente de CRM inteligente chamado NossoCRM AI.

PERSONALIDADE:
- Profissional mas amigável
- Sempre responde em português brasileiro
- Usa emojis com moderação

CAPACIDADES (usando function calling):
- analyzePipeline: Analisar o pipeline de vendas
- searchDeals: Buscar deals por título
- searchContacts: Buscar contatos
- createTask: Criar tarefas

INSTRUÇÕES IMPORTANTES:
- Quando o usuário pedir análise do pipeline, CHAME a função analyzePipeline diretamente
- Para buscar deals, CHAME searchDeals
- Para buscar contatos, CHAME searchContacts
- Para criar tarefa, CHAME createTask
- NÃO descreva o que vai fazer em JSON, apenas EXECUTE a função
- Para perguntas gerais sem necessidade de dados, responda normalmente`,

            prompt: userMessage,

            // Force the model to ALWAYS use a tool
            toolChoice: 'required',

            // Renderiza texto padrão do modelo
            text: ({ content }) => (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{content}</p>
                </div>
            ),

            tools: {
                // ----- TOOL: Analisar Pipeline -----
                analyzePipeline: {
                    description: 'Analisa o pipeline de vendas do usuário, mostrando estatísticas e resumo',
                    inputSchema: z.object({}),
                    generate: async function* () {
                        console.log('[AI] 🚀 analyzePipeline GENERATE CALLED!');
                        yield <Loading />;

                        const { data: deals } = await supabase
                            .from('deals')
                            .select('*, stage:stages(name)')
                            .eq('user_id', user.id);

                        const totalValue = deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

                        // Agrupar por estágio
                        const stageMap = new Map<string, number>();
                        deals?.forEach(deal => {
                            const stageName = deal.stage?.name || 'Sem estágio';
                            stageMap.set(stageName, (stageMap.get(stageName) || 0) + 1);
                        });

                        const stageBreakdown = Array.from(stageMap.entries()).map(([name, count]) => ({
                            name,
                            count,
                        }));

                        return (
                            <PipelineSummary
                                totalDeals={deals?.length || 0}
                                totalValue={totalValue}
                                stageBreakdown={stageBreakdown}
                            />
                        );
                    },
                },

                // ----- TOOL: Criar Tarefa -----
                createTask: {
                    description: 'Cria uma nova tarefa ou atividade para acompanhamento',
                    inputSchema: z.object({
                        title: z.string().describe('Título da tarefa'),
                        description: z.string().optional().describe('Descrição detalhada'),
                        dueDate: z.string().optional().describe('Data de vencimento (formato ISO)'),
                        dealId: z.string().optional().describe('ID do deal relacionado'),
                        contactId: z.string().optional().describe('ID do contato relacionado'),
                    }),
                    generate: async function* ({ title, description, dueDate, dealId, contactId }) {
                        yield <Loading />;

                        const { error } = await supabase
                            .from('activities')
                            .insert({
                                title,
                                description,
                                due_date: dueDate,
                                deal_id: dealId,
                                contact_id: contactId,
                                type: 'task',
                                user_id: user.id,
                                completed: false,
                            });

                        if (error) {
                            return <ErrorMessage message={`Erro ao criar tarefa: ${error.message}`} />;
                        }

                        return <TaskCreated title={title} />;
                    },
                },

                // ----- TOOL: Buscar Deals -----
                searchDeals: {
                    description: 'Busca deals por título ou valor',
                    inputSchema: z.object({
                        query: z.string().optional().describe('Termo de busca no título'),
                        limit: z.number().optional().default(5).describe('Número máximo de resultados'),
                    }),
                    generate: async function* ({ query, limit = 5 }) {
                        yield <Loading />;

                        let queryBuilder = supabase
                            .from('deals')
                            .select('*, stage:stages(name), contact:contacts(name)')
                            .eq('user_id', user.id)
                            .limit(limit);

                        if (query) {
                            queryBuilder = queryBuilder.ilike('title', `%${query}%`);
                        }

                        const { data: deals, error } = await queryBuilder;

                        if (error) {
                            return <ErrorMessage message={`Erro na busca: ${error.message}`} />;
                        }

                        if (!deals || deals.length === 0) {
                            return (
                                <div className="p-4 text-slate-500 dark:text-slate-400 text-center">
                                    Nenhum deal encontrado.
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-500">
                                    Encontrados {deals.length} deal(s):
                                </p>
                                {deals.map(deal => (
                                    <DealCard key={deal.id} deal={deal as Deal} />
                                ))}
                            </div>
                        );
                    },
                },

                // ----- TOOL: Buscar Contato -----
                searchContacts: {
                    description: 'Busca contatos por nome ou email',
                    inputSchema: z.object({
                        query: z.string().describe('Termo de busca'),
                        limit: z.number().optional().default(5),
                    }),
                    generate: async function* ({ query, limit = 5 }) {
                        yield <Loading />;

                        const { data: contacts, error } = await supabase
                            .from('contacts')
                            .select('*')
                            .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                            .limit(limit);

                        if (error) {
                            return <ErrorMessage message={`Erro na busca: ${error.message}`} />;
                        }

                        if (!contacts || contacts.length === 0) {
                            return (
                                <div className="p-4 text-slate-500 dark:text-slate-400 text-center">
                                    Nenhum contato encontrado.
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-500">
                                    Encontrados {contacts.length} contato(s):
                                </p>
                                {contacts.map(contact => (
                                    <ContactCard key={contact.id} contact={contact as Contact} />
                                ))}
                            </div>
                        );
                    },
                },
            },
        });

        return result.value;
    } catch (error) {
        console.error('AI Error:', error);
        return <ErrorMessage message="Erro ao processar sua mensagem. Tente novamente." />;
    }
}
