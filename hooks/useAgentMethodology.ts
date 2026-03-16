/**
 * @fileoverview Hooks: Agent Methodology System
 *
 * TanStack Query hooks para templates de metodologia, configurações
 * por board/estágio e personalização profunda do agente.
 * Padrão SSOT: setQueryData > invalidateQueries.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
    listMethodologyTemplates,
    getMethodologyTemplate,
    getAgentBoardConfig,
    listAgentBoardConfigs,
    upsertAgentBoardConfig,
    getAgentStageConfig,
    listAgentStageConfigsByBoard,
    upsertAgentStageConfig,
    getAgentPersonalization,
    updateAgentPersonalizationBulk,
    type PersonalizationSection,
    type PersonalizationPayload,
} from '@/lib/supabase/agent-methodology';
import type {
    AgentMethodologyTemplate,
    AgentBoardConfig,
    AgentStageConfig,
} from '@/types/agent';

// ─── Query Keys ───────────────────────────────────────────────────────────────

const methodologyKeys = {
    templates: ['methodology-templates'] as const,
    templatesList: (vertical?: string | null, role?: string) =>
        [...methodologyKeys.templates, 'list', vertical, role] as const,
    template: (id: string) => [...methodologyKeys.templates, 'detail', id] as const,

    boardConfigs: ['agent-board-configs'] as const,
    boardConfigsList: (orgId: string) =>
        [...methodologyKeys.boardConfigs, 'list', orgId] as const,
    boardConfig: (orgId: string, boardId: string) =>
        [...methodologyKeys.boardConfigs, 'detail', orgId, boardId] as const,

    stageConfigs: ['agent-stage-configs'] as const,
    stageConfigsByBoard: (orgId: string, boardId: string) =>
        [...methodologyKeys.stageConfigs, 'board', orgId, boardId] as const,
    stageConfig: (orgId: string, stageId: string) =>
        [...methodologyKeys.stageConfigs, 'detail', orgId, stageId] as const,

    personalization: (orgId: string) => ['agent-personalization', orgId] as const,
};

// ─── Methodology Templates ────────────────────────────────────────────────────

export function useMethodologyTemplates(options?: {
    vertical?: string | null;
    agent_role?: string;
}) {
    const supabase = createBrowserClient();

    return useQuery<AgentMethodologyTemplate[]>({
        queryKey: methodologyKeys.templatesList(options?.vertical, options?.agent_role),
        queryFn: () => listMethodologyTemplates(supabase, options),
        staleTime: 10 * 60 * 1000, // templates rarely change
    });
}

export function useMethodologyTemplate(templateId: string | null) {
    const supabase = createBrowserClient();

    return useQuery<AgentMethodologyTemplate | null>({
        queryKey: methodologyKeys.template(templateId ?? ''),
        queryFn: () => getMethodologyTemplate(supabase, templateId!),
        enabled: !!templateId,
        staleTime: 10 * 60 * 1000,
    });
}

// ─── Board Configs ────────────────────────────────────────────────────────────

export function useAgentBoardConfigs() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<AgentBoardConfig[]>({
        queryKey: methodologyKeys.boardConfigsList(organizationId ?? ''),
        queryFn: () => listAgentBoardConfigs(supabase, organizationId!),
        enabled: !!organizationId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useAgentBoardConfig(boardId: string | null) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<AgentBoardConfig | null>({
        queryKey: methodologyKeys.boardConfig(organizationId ?? '', boardId ?? ''),
        queryFn: () => getAgentBoardConfig(supabase, organizationId!, boardId!),
        enabled: !!organizationId && !!boardId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useUpsertAgentBoardConfig() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            boardId,
            config,
        }: {
            boardId: string;
            config: Partial<AgentBoardConfig>;
        }) => upsertAgentBoardConfig(supabase, organizationId!, boardId, config),
        onSuccess: (updated) => {
            queryClient.setQueryData(
                methodologyKeys.boardConfig(organizationId!, updated.board_id),
                updated
            );
            queryClient.invalidateQueries({
                queryKey: methodologyKeys.boardConfigsList(organizationId!),
            });
        },
    });
}

// ─── Stage Configs ────────────────────────────────────────────────────────────

export function useAgentStageConfigs(boardId: string | null) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<AgentStageConfig[]>({
        queryKey: methodologyKeys.stageConfigsByBoard(organizationId ?? '', boardId ?? ''),
        queryFn: () =>
            listAgentStageConfigsByBoard(supabase, organizationId!, boardId!),
        enabled: !!organizationId && !!boardId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useAgentStageConfig(stageId: string | null) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<AgentStageConfig | null>({
        queryKey: methodologyKeys.stageConfig(organizationId ?? '', stageId ?? ''),
        queryFn: () => getAgentStageConfig(supabase, organizationId!, stageId!),
        enabled: !!organizationId && !!stageId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useUpsertAgentStageConfig() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            boardId,
            stageId,
            config,
        }: {
            boardId: string;
            stageId: string;
            config: Partial<AgentStageConfig>;
        }) =>
            upsertAgentStageConfig(supabase, organizationId!, boardId, stageId, config),
        onSuccess: (updated) => {
            queryClient.setQueryData(
                methodologyKeys.stageConfig(organizationId!, updated.stage_id),
                updated
            );
            queryClient.invalidateQueries({
                queryKey: methodologyKeys.stageConfigsByBoard(
                    organizationId!,
                    updated.board_id
                ),
            });
        },
    });
}

// ─── Personalization ──────────────────────────────────────────────────────────

export function useAgentPersonalization() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<PersonalizationPayload | null>({
        queryKey: methodologyKeys.personalization(organizationId ?? ''),
        queryFn: () => getAgentPersonalization(supabase, organizationId!),
        enabled: !!organizationId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useUpdateAgentPersonalization() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: Partial<PersonalizationPayload>) =>
            updateAgentPersonalizationBulk(supabase, organizationId!, payload),
        onSuccess: (updated) => {
            // SSOT: merge updated fields into cached personalization
            queryClient.setQueryData(
                methodologyKeys.personalization(organizationId!),
                (old: PersonalizationPayload | null | undefined) => ({
                    ...old,
                    persona: updated.persona,
                    tone_of_voice: updated.tone_of_voice,
                    sales_methodology: updated.sales_methodology,
                    knowledge_base_config: updated.knowledge_base_config,
                    business_context_extended: updated.business_context_extended,
                    behavioral_training: updated.behavioral_training,
                    follow_up_config: updated.follow_up_config,
                })
            );
        },
    });
}
