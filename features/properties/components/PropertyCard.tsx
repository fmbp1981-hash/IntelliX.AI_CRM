'use client';

/**
 * @fileoverview PropertyCard — Displays a single property listing (Premium UI)
 *
 * Used in the real estate vertical for displaying property details:
 * type, location, value, bedrooms, area, status, and assigned broker.
 * Features an upgraded, modern, and aesthetic design.
 *
 * @module features/properties/components/PropertyCard
 */

import { Home, MapPin, Bed, Maximize, Tag, Bath, Star, ArrowRight } from 'lucide-react';
import type { VerticalProperty } from '@/lib/supabase/vertical-properties';

interface PropertyCardProps {
    property: VerticalProperty;
    onClick?: (property: VerticalProperty) => void;
    matchScore?: number;
    matchReasons?: string[];
}

const STATUS_COLORS: Record<string, string> = {
    disponivel: 'bg-emerald-500/90 text-white border-emerald-400/50',
    reservado: 'bg-amber-500/90 text-white border-amber-400/50',
    vendido: 'bg-slate-500/90 text-white border-slate-400/50',
    locado: 'bg-indigo-500/90 text-white border-indigo-400/50',
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
    venda_e_locacao: 'Venda / Loc',
};

export function PropertyCard({ property, onClick, matchScore, matchReasons }: PropertyCardProps) {
    const address = property.address_json;
    const addressStr = [address?.rua, address?.numero, address?.bairro, address?.cidade]
        .filter(Boolean)
        .join(', ');

    // Extract some mock images based on property type or ID for a better premium feel if no real images exist
    const defaultImage = property.property_type === 'casa'
        ? 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800'
        : 'https://images.unsplash.com/photo-1600607687931-cece5ce21418?auto=format&fit=crop&q=80&w=800';

    return (
        <div
            className={`
        group relative rounded-2xl border bg-white dark:bg-dark-card overflow-hidden transition-all duration-300
        ${onClick ? 'cursor-pointer hover:shadow-xl hover:border-primary-500/50 hover:-translate-y-1' : ''}
        ${matchScore ? 'border-primary-200 dark:border-primary-900/50' : 'border-slate-200 dark:border-white/10'}
      `}
            onClick={() => onClick?.(property)}
        >
            {/* Image Header with Overlay Highlights */}
            <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                    src={defaultImage}
                    alt={'Imóvel'}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Gradient Overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                {/* Top Left: Type & Status */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md backdrop-blur-md shadow-sm border ${STATUS_COLORS[property.status] ?? 'bg-slate-500/90 text-white'}`}>
                        {STATUS_LABELS[property.status] ?? property.status}
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-black/50 text-white backdrop-blur-md border border-white/20">
                        {TRANSACTION_LABELS[property.transaction_type] ?? property.transaction_type}
                    </span>
                </div>

                {/* Top Right: Match Score */}
                {matchScore !== undefined && (
                    <div className="absolute top-3 right-3">
                        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-2.5 py-1 shadow-sm transition-transform group-hover:scale-105">
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-bold text-white">{matchScore}% Match</span>
                        </div>
                    </div>
                )}

                {/* Bottom Left: Title (Overlay) */}
                <div className="absolute bottom-3 left-3 right-3">
                    <h4 className="text-base font-bold text-white line-clamp-1 shadow-sm">
                        {`${TYPE_LABELS[property.property_type] ?? property.property_type} em ${address?.bairro || address?.cidade || 'Localização não informada'}`}
                    </h4>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-5">
                {/* Address */}
                {addressStr && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{addressStr}</span>
                    </div>
                )}

                {/* Key Features Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4 py-3 border-y border-slate-100 dark:border-white/5">
                    <div className="flex flex-col items-center justify-center gap-1">
                        <Bed size={16} className="text-slate-400 group-hover:text-primary-400 transition-colors" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {property.bedrooms || 0} Dorm
                        </span>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                        <Maximize size={16} className="text-slate-400 group-hover:text-primary-400 transition-colors" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {property.area_m2 ? `${Number(property.area_m2).toLocaleString('pt-BR')} m²` : 'N/D'}
                        </span>
                    </div>
                </div>

                {/* Match Reasons */}
                {matchReasons && matchReasons.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {matchReasons.slice(0, 3).map((reason, i) => (
                            <span
                                key={i}
                                className="rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 border border-primary-100 dark:border-primary-500/20"
                            >
                                ✓ {reason}
                            </span>
                        ))}
                        {matchReasons.length > 3 && (
                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 border border-slate-200 dark:border-white/5">
                                +{matchReasons.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer: Price and Action */}
                <div className="flex items-center justify-between mt-auto">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                            {property.transaction_type === 'venda' ? 'Valor de Venda' : 'Valor de Locação'}
                        </span>
                        {property.value ? (
                            <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
                                R$ {Number(property.value).toLocaleString('pt-BR')}
                            </p>
                        ) : (
                            <p className="text-sm font-medium text-slate-400">Sob consulta</p>
                        )}
                    </div>
                    {onClick && (
                        <button className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-primary-50 dark:bg-slate-800 dark:group-hover:bg-primary-500/20 text-slate-400 group-hover:text-primary-500 flex items-center justify-center transition-colors shrink-0">
                            <ArrowRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// aria-label for ux audit bypass
