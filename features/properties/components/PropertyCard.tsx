'use client';

/**
 * @fileoverview PropertyCard — Displays a single property listing
 *
 * Used in the real estate vertical for displaying property details:
 * type, location, value, bedrooms, area, status, and assigned broker.
 *
 * @module features/properties/components/PropertyCard
 */

import { Home, MapPin, Bed, Maximize, Tag } from 'lucide-react';
import type { VerticalProperty } from '@/lib/supabase/vertical-properties';

interface PropertyCardProps {
    property: VerticalProperty;
    onClick?: (property: VerticalProperty) => void;
    matchScore?: number;
    matchReasons?: string[];
}

const STATUS_COLORS: Record<string, string> = {
    disponivel: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    reservado: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    vendido: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    locado: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const STATUS_LABELS: Record<string, string> = {
    disponivel: 'Disponível',
    reservado: 'Reservado',
    vendido: 'Vendido',
    locado: 'Locado',
};

const TYPE_LABELS: Record<string, string> = {
    apartamento: 'Apartamento',
    casa: 'Casa',
    comercial: 'Comercial',
    terreno: 'Terreno',
};

const TRANSACTION_LABELS: Record<string, string> = {
    venda: 'Venda',
    locacao: 'Locação',
    venda_e_locacao: 'Venda / Locação',
};

export function PropertyCard({ property, onClick, matchScore, matchReasons }: PropertyCardProps) {
    const address = property.address_json;
    const addressStr = [address?.rua, address?.numero, address?.bairro, address?.cidade]
        .filter(Boolean)
        .join(', ');

    return (
        <div
            className={`
        rounded-xl border bg-white dark:bg-gray-900 p-4 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700' : ''}
        ${matchScore ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}
      `}
            onClick={() => onClick?.(property)}
        >
            {/* Header: Type + Status + Match Score */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {TYPE_LABELS[property.property_type] ?? property.property_type}
                    </span>
                    <span className="text-xs text-gray-500">
                        ({TRANSACTION_LABELS[property.transaction_type] ?? property.transaction_type})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {matchScore !== undefined && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {matchScore}% match
                        </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[property.status] ?? ''}`}>
                        {STATUS_LABELS[property.status] ?? property.status}
                    </span>
                </div>
            </div>

            {/* Value */}
            {property.value && (
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    R$ {Number(property.value).toLocaleString('pt-BR')}
                </p>
            )}

            {/* Address */}
            {addressStr && (
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{addressStr}</span>
                </div>
            )}

            {/* Details row */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {property.bedrooms && (
                    <div className="flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5" />
                        <span>{property.bedrooms} quarto{property.bedrooms > 1 ? 's' : ''}</span>
                    </div>
                )}
                {property.area_m2 && (
                    <div className="flex items-center gap-1">
                        <Maximize className="h-3.5 w-3.5" />
                        <span>{Number(property.area_m2).toLocaleString('pt-BR')} m²</span>
                    </div>
                )}
                {property.features_json && property.features_json.length > 0 && (
                    <div className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        <span>{property.features_json.length} extra{property.features_json.length > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* Match reasons */}
            {matchReasons && matchReasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                    {matchReasons.map((reason, i) => (
                        <span
                            key={i}
                            className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        >
                            ✓ {reason}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
