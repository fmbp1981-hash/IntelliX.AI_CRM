/**
 * @fileoverview React hooks for vertical property management
 *
 * TanStack Query hooks for CRUD and matching operations on `vertical_properties`.
 * Only used by the real estate vertical (feature flag: `property_management`).
 *
 * @module hooks/useVerticalProperties
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
    listProperties,
    getProperty,
    createProperty,
    updateProperty,
    deleteProperty,
    matchPropertiesForClient,
    type PropertyFilters,
    type CreatePropertyInput,
    type VerticalProperty,
    type PropertyMatchScore,
} from '@/lib/supabase/vertical-properties';

const PROPERTIES_KEY = ['vertical-properties'] as const;

export function useProperties(filters?: PropertyFilters) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<VerticalProperty[]>({
        queryKey: [...PROPERTIES_KEY, 'list', filters],
        queryFn: () => listProperties(supabase, organizationId!, filters),
        enabled: !!organizationId,
    });
}

export function useProperty(propertyId: string | undefined) {
    const supabase = createBrowserClient();

    return useQuery<VerticalProperty>({
        queryKey: [...PROPERTIES_KEY, propertyId],
        queryFn: () => getProperty(supabase, propertyId!),
        enabled: !!propertyId,
    });
}

export function useCreateProperty() {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreatePropertyInput) =>
            createProperty(supabase, organizationId!, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROPERTIES_KEY });
        },
    });
}

export function useUpdateProperty() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<CreatePropertyInput> }) =>
            updateProperty(supabase, id, updates),
        onSuccess: (data) => {
            queryClient.setQueryData([...PROPERTIES_KEY, data.id], data);
            queryClient.invalidateQueries({ queryKey: [...PROPERTIES_KEY, 'list'] });
        },
    });
}

export function useDeleteProperty() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (propertyId: string) => deleteProperty(supabase, propertyId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROPERTIES_KEY });
        },
    });
}

export function usePropertyMatches(contactId: string | undefined) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<PropertyMatchScore[]>({
        queryKey: [...PROPERTIES_KEY, 'matches', contactId],
        queryFn: () => matchPropertiesForClient(supabase, organizationId!, contactId!),
        enabled: !!organizationId && !!contactId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}
