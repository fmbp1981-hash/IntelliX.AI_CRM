'use client';

/**
 * @fileoverview PropertyMatchList — Shows matched properties for a client
 *
 * Displays the top property matches for a given contact based on the
 * AI matching algorithm (budget, type, bedrooms, region scoring).
 *
 * @module features/properties/components/PropertyMatchList
 */

import { Sparkles, Loader2 } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { usePropertyMatches } from '@/hooks/useVerticalProperties';
import type { VerticalProperty } from '@/lib/supabase/vertical-properties';

interface PropertyMatchListProps {
    contactId: string;
    contactName?: string;
    onPropertyClick?: (property: VerticalProperty) => void;
}

export function PropertyMatchList({
    contactId,
    contactName,
    onPropertyClick,
}: PropertyMatchListProps) {
    const { data: matches, isLoading, error } = usePropertyMatches(contactId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Buscando imóveis compatíveis...
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-4 text-center text-sm text-red-500">
                Erro ao buscar matches. Tente novamente.
            </div>
        );
    }

    if (!matches || matches.length === 0) {
        return (
            <div className="py-8 text-center">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">Nenhum imóvel compatível encontrado.</p>
                <p className="text-xs text-gray-400 mt-1">
                    Verifique as preferências do cliente.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    Imóveis Compatíveis{contactName ? ` para ${contactName}` : ''}
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {matches.length} match{matches.length !== 1 ? 'es' : ''}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {matches.map((match) => (
                    <PropertyCard
                        key={match.property.id}
                        property={match.property}
                        matchScore={match.score}
                        matchReasons={match.matchReasons}
                        onClick={onPropertyClick}
                    />
                ))}
            </div>
        </div>
    );
}
