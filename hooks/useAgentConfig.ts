// hooks/useAgentConfig.ts — Agent configuration hook

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getAgentConfig, upsertAgentConfig } from '@/lib/supabase/agent';
import type { AgentConfig } from '@/types/agent';

const AGENT_CONFIG_KEY = ['agent-config'] as const;

export function useAgentConfig() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<AgentConfig | null>({
        queryKey: [...AGENT_CONFIG_KEY, organizationId],
        queryFn: () => getAgentConfig(supabase, organizationId!),
        enabled: !!organizationId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useUpdateAgentConfig() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (config: Partial<AgentConfig>) =>
            upsertAgentConfig(supabase, organizationId!, config),
        onSuccess: (updated) => {
            queryClient.setQueryData(
                [...AGENT_CONFIG_KEY, organizationId],
                updated
            );
        },
    });
}
