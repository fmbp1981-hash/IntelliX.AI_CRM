/**
 * @fileoverview Hook for managing custom field values via TanStack Query.
 *
 * Provides read and write operations for the EAV custom fields,
 * integrated with the SSOT cache pattern.
 *
 * @module hooks/useCustomFields
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import {
    getCustomFields,
    saveCustomFields,
    type EntityType,
    type CustomFieldMap,
} from '@/lib/supabase/custom-fields';

/**
 * Query key factory for custom fields.
 */
export const customFieldKeys = {
    all: ['custom-fields'] as const,
    byEntity: (entityType: EntityType, entityId: string) =>
        ['custom-fields', entityType, entityId] as const,
};

/**
 * Hook to fetch custom field values for a specific entity.
 *
 * @param entityType - 'contact' | 'deal' | 'activity'
 * @param entityId   - UUID of the entity
 *
 * @returns TanStack Query result with `data: CustomFieldMap`
 *
 * @example
 * ```tsx
 * const { data: fields } = useCustomFields('contact', contact.id);
 * // fields?.convenio → "Unimed"
 * ```
 */
export function useCustomFields(
    entityType: EntityType,
    entityId: string | undefined,
) {
    const supabase = createBrowserClient();

    return useQuery<CustomFieldMap>({
        queryKey: customFieldKeys.byEntity(entityType, entityId ?? ''),
        queryFn: () => getCustomFields(supabase, entityType, entityId!),
        enabled: !!entityId,
        staleTime: 30_000, // 30s — custom fields rarely change externally
    });
}

/**
 * Mutation hook to save custom field values for an entity.
 * Invalidates the entity's cache on success for instant UI update.
 *
 * @example
 * ```tsx
 * const { mutate: save } = useSaveCustomFields();
 * save({ entityType: 'contact', entityId: id, fields: { convenio: 'Unimed' } });
 * ```
 */
export function useSaveCustomFields() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            entityType,
            entityId,
            fields,
        }: {
            organizationId: string;
            entityType: EntityType;
            entityId: string;
            fields: CustomFieldMap;
        }) => {
            await saveCustomFields(
                supabase,
                organizationId,
                entityType,
                entityId,
                fields,
            );
        },
        onSuccess: (_data, variables) => {
            // Invalidate the specific entity's custom fields cache
            queryClient.invalidateQueries({
                queryKey: customFieldKeys.byEntity(
                    variables.entityType,
                    variables.entityId,
                ),
            });
        },
    });
}
