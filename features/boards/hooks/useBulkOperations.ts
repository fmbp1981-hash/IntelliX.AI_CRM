/**
 * @fileoverview React Hooks: Bulk Operations
 * 
 * Hooks para operações em massa em deals.
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';

type BulkOperation = 'move_stage' | 'assign' | 'add_tag' | 'remove_tag' | 'delete' | 'export_csv';

interface BulkActionParams {
    dealIds: string[];
    operation: BulkOperation;
    params?: Record<string, any>;
}

interface BulkActionResult {
    success: boolean;
    operation: string;
    affected: number;
}

/**
 * Hook para executar ação em massa em deals.
 */
export function useBulkDealAction() {
    const queryClient = useQueryClient();

    return useMutation<BulkActionResult | Blob, Error, BulkActionParams>({
        mutationFn: async ({ dealIds, operation, params }) => {
            const res = await fetch('/api/deals/bulk', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealIds, operation, params }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || 'Bulk operation failed');
            }

            // Handle CSV export
            if (operation === 'export_csv') {
                const blob = await res.blob();
                // Trigger download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `deals_export_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                return blob;
            }

            return res.json();
        },
        onSuccess: (_data, variables) => {
            if (variables.operation !== 'export_csv') {
                queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
            }
        },
    });
}

/**
 * Hook para bulk move stage.
 */
export function useBulkMoveStage() {
    const bulk = useBulkDealAction();
    return {
        ...bulk,
        moveStage: (dealIds: string[], stageId: string) =>
            bulk.mutate({ dealIds, operation: 'move_stage', params: { stage_id: stageId } }),
    };
}

/**
 * Hook para bulk assign.
 */
export function useBulkAssign() {
    const bulk = useBulkDealAction();
    return {
        ...bulk,
        assign: (dealIds: string[], ownerId: string) =>
            bulk.mutate({ dealIds, operation: 'assign', params: { owner_id: ownerId } }),
    };
}

/**
 * Hook para bulk add tag.
 */
export function useBulkAddTag() {
    const bulk = useBulkDealAction();
    return {
        ...bulk,
        addTag: (dealIds: string[], tagId: string) =>
            bulk.mutate({ dealIds, operation: 'add_tag', params: { tag_id: tagId } }),
    };
}

/**
 * Hook para bulk delete.
 */
export function useBulkDelete() {
    const bulk = useBulkDealAction();
    return {
        ...bulk,
        deleteBulk: (dealIds: string[]) =>
            bulk.mutate({ dealIds, operation: 'delete' }),
    };
}

/**
 * Hook para bulk export CSV.
 */
export function useBulkExport() {
    const bulk = useBulkDealAction();
    return {
        ...bulk,
        exportCsv: (dealIds: string[]) =>
            bulk.mutate({ dealIds, operation: 'export_csv' }),
    };
}
