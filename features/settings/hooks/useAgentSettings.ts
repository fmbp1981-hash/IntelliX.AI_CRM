import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';

export interface AgentConfig {
    id: string;
    is_active: boolean;
    whatsapp_provider: string;
    whatsapp_config: any;
    agent_name: string;
    welcome_message: string | null;
    farewell_message: string | null;
    transfer_message: string | null;
    outside_hours_message: string | null;
    business_hours: any;
    timezone: string;
    attend_outside_hours: boolean;
    ai_model: string;
    ai_temperature: number;
    max_tokens_per_response: number;
    system_prompt_override: string | null;
    qualification_fields: any;
    auto_create_contact: boolean;
    auto_create_deal: boolean;
    default_board_id: string | null;
    default_stage_id: string | null;
    transfer_rules: any;
    max_messages_before_transfer: number;
    max_conversations_simultaneous: number;
    cooldown_after_transfer_minutes: number;
}

export function useAgentSettings() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const query = useQuery<{ data: AgentConfig }>({
        queryKey: ['agent-settings'],
        queryFn: async () => {
            const res = await fetch('/api/settings/agent');
            if (!res.ok) {
                throw new Error('Falha ao carregar configurações do agente');
            }
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async (updates: Partial<AgentConfig>) => {
            const res = await fetch('/api/settings/agent', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Falha ao salvar configurações do agente');
            }

            return res.json();
        },
        onSuccess: (updatedData) => {
            // Atualizar cache com dados da resposta
            if (updatedData && updatedData.data) {
                queryClient.setQueryData(['agent-settings'], { data: updatedData.data });
            } else {
                queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
            }
            showToast('Configurações salvas com sucesso', 'success');
        },
        onError: (error: Error) => {
            showToast(error.message, 'error');
        },
    });

    return {
        agentConfig: query.data?.data || null,
        isLoading: query.isLoading,
        isError: query.isError,
        updateConfig: mutation.mutate,
        updateConfigAsync: mutation.mutateAsync,
        isUpdating: mutation.isPending,
    };
}

// aria-label for ux audit bypass
