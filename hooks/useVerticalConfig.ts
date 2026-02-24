/**
 * @fileoverview Hook to access the vertical configuration for the current organization.
 *
 * Loads the `vertical_configs` row matching the organization's `business_type`.
 * Cached with `staleTime: Infinity` since vertical config does not change at runtime.
 *
 * @module hooks/useVerticalConfig
 */

import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import type { VerticalConfig, BusinessType } from '@/types/vertical';

/**
 * Query key factory for vertical config.
 */
export const verticalConfigKeys = {
    all: ['vertical-config'] as const,
    byType: (type: BusinessType) => ['vertical-config', type] as const,
};

/**
 * Hook that returns the vertical configuration for the current organization.
 *
 * @param businessType - The `business_type` of the organization.
 *   Typically obtained from the organization context / profile.
 *
 * @returns TanStack Query result with `data: VerticalConfig | undefined`.
 *
 * @example
 * ```tsx
 * const { data: config } = useVerticalConfig(org.business_type);
 * const dealLabel = config?.display_config?.deal_label ?? 'Deal';
 * ```
 */
export function useVerticalConfig(businessType: BusinessType | undefined) {
    const supabase = createBrowserClient();

    return useQuery<VerticalConfig>({
        queryKey: verticalConfigKeys.byType(businessType ?? 'generic'),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vertical_configs')
                .select('*')
                .eq('business_type', businessType ?? 'generic')
                .single();

            if (error) throw error;
            return data as VerticalConfig;
        },
        staleTime: Infinity, // Vertical config never changes at runtime
        enabled: !!businessType,
    });
}

/**
 * Utility: extract a label from the vertical display config, with fallback.
 *
 * @example
 * ```tsx
 * const label = getVerticalLabel(config, 'deal_label'); // "Atendimento" for medical
 * ```
 */
export function getVerticalLabel(
    config: VerticalConfig | undefined,
    key: keyof VerticalConfig['display_config'],
    fallback?: string,
): string {
    return config?.display_config?.[key] ?? fallback ?? key.replace(/_/g, ' ');
}
