/**
 * @fileoverview Hook to check vertical feature flags.
 *
 * Wraps `useVerticalConfig` to provide a simple boolean check for
 * whether a specific feature is enabled for the current vertical.
 *
 * @module hooks/useFeatureFlag
 */

import { useVerticalConfig } from './useVerticalConfig';
import type { BusinessType, VerticalFeatureFlags } from '@/types/vertical';

/**
 * Hook that returns whether a feature flag is enabled for the current vertical.
 *
 * @param businessType - The `business_type` of the organization.
 * @param flag - The feature flag key to check.
 * @returns `true` if the flag is enabled, `false` otherwise (default).
 *
 * @example
 * ```tsx
 * const hasPropertyManagement = useFeatureFlag(org.business_type, 'property_management');
 * if (!hasPropertyManagement) return null; // hide section
 * ```
 */
export function useFeatureFlag(
    businessType: BusinessType | undefined,
    flag: keyof VerticalFeatureFlags,
): boolean {
    const { data: config } = useVerticalConfig(businessType);
    return config?.feature_flags?.[flag] ?? false;
}

/**
 * Hook that returns all feature flags for the current vertical.
 *
 * @param businessType - The `business_type` of the organization.
 * @returns The full `VerticalFeatureFlags` object, or `undefined` if loading.
 *
 * @example
 * ```tsx
 * const flags = useAllFeatureFlags(org.business_type);
 * if (flags?.scheduling_calendar) { ... }
 * ```
 */
export function useAllFeatureFlags(
    businessType: BusinessType | undefined,
): VerticalFeatureFlags | undefined {
    const { data: config } = useVerticalConfig(businessType);
    return config?.feature_flags;
}
