/**
 * @fileoverview Hook for fetching vertical dashboard widget data
 *
 * Uses TanStack Query to fetch and cache widget data from the API.
 * Only fetches when the organization has a non-generic business type.
 *
 * @module features/dashboard/hooks/useVerticalWidgets
 */

import { useQuery } from '@tanstack/react-query';
import type { WidgetDataPayload } from '@/lib/supabase/vertical-widgets';
import type { BusinessType, VerticalConfig } from '@/types/vertical';

interface UseVerticalWidgetsOptions {
    businessType?: BusinessType;
    config?: VerticalConfig;
}

export function useVerticalWidgets({ businessType, config }: UseVerticalWidgetsOptions) {
    const hasVertical = !!businessType && businessType !== 'generic' && !!config;

    return useQuery<Record<string, WidgetDataPayload>>({
        queryKey: ['vertical-widgets', businessType],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/vertical-widgets');
            if (!res.ok) throw new Error('Failed to fetch widget data');
            const json = await res.json();
            return json.widgetData ?? {};
        },
        enabled: hasVertical,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });
}
