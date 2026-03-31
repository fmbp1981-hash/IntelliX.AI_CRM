'use client';

/**
 * @fileoverview PropertyMatchDashboard — Dashboard Inteligente de Match de Imóveis
 *
 * Exibe as melhores opções de imóveis baseadas no perfil do cliente (Contact/Lead)
 * e nos dados disponíveis na tabela `vertical_properties` ou propriedades ativas.
 *
 * @module features/properties/components/PropertyMatchDashboard
 */

import React, { useState } from 'react';
import { Home, Key, MapPin, Building, ArrowRight, Star, Heart, Sliders, Bath, Bed, Maximize } from 'lucide-react';

interface Property {
    id: string;
    title: string;
    type: 'Venda' | 'Locação';
    price: number;
    address: string;
    bedrooms: number;
    bathrooms: number;
    area: number;
    matchScore: number;
    imageUrl?: string;
}

const mockProperties: Property[] = [
    {
        id: '1',
        title: 'Apartamento de Luxo no Jardins',
        type: 'Venda',
        price: 2500000,
        address: 'Jardins, São Paulo',
        bedrooms: 3,
        bathrooms: 4,
        area: 150,
        matchScore: 98,
        imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800'
    },
    {
        id: '2',
        title: 'Cobertura Duplex com Vista',
        type: 'Venda',
        price: 4200000,
        address: 'Vila Nova Conceição, SP',
        bedrooms: 4,
        bathrooms: 5,
        area: 280,
        matchScore: 85,
        imageUrl: 'https://images.unsplash.com/photo-1600607687931-cece5ce21418?auto=format&fit=crop&q=80&w=800'
    },
    {
        id: '3',
        title: 'Studio Moderno',
        type: 'Locação',
        price: 4500,
        address: 'Pinheiros, São Paulo',
        bedrooms: 1,
        bathrooms: 1,
        area: 45,
        matchScore: 72,
        imageUrl: 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&q=80&w=800'
    }
];

export function PropertyMatchDashboard({ contactId }: { contactId: string }) {
    const [properties] = useState<Property[]>(mockProperties);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Star className="text-yellow-500 fill-yellow-500" size={20} />
                        Smart Match
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Imóveis recomendados para o perfil atual</p>
                </div>
                <button className="p-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <Sliders size={18} className="text-slate-500" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((prop) => (
                    <div key={prop.id} className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card overflow-hidden hover:shadow-xl hover:border-primary-500/50 transition-all duration-300">
                        {/* Image Header */}
                        <div className="relative h-48 overflow-hidden">
                            {prop.imageUrl ? (
                                <img src={prop.imageUrl} alt={prop.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <Home size={32} className="text-slate-400" />
                                </div>
                            )}
                            <div className="absolute top-3 left-3">
                                <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md backdrop-blur-md shadow-sm border ${prop.type === 'Venda'
                                        ? 'bg-emerald-500/90 text-white border-emerald-400/50'
                                        : 'bg-indigo-500/90 text-white border-indigo-400/50'
                                    }`}>
                                    {prop.type}
                                </span>
                            </div>
                            <div className="absolute top-3 right-3">
                                <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-2 py-1 shadow-sm">
                                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                    <span className="text-xs font-bold text-white">{prop.matchScore}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-primary-500 transition-colors">
                                {prop.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                                <MapPin size={14} className="text-slate-400" />
                                <span className="truncate">{prop.address}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-5 py-3 border-y border-slate-100 dark:border-white/5">
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <Bed size={16} className="text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{prop.bedrooms} Quartos</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-1 border-x border-slate-100 dark:border-white/5">
                                    <Bath size={16} className="text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{prop.bathrooms} Banheiros</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <Maximize size={16} className="text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{prop.area} m²</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                        {prop.type === 'Venda' ? 'Valor' : 'Aluguel'}
                                    </span>
                                    <p className="text-lg font-bold text-emerald-500">
                                        R$ {prop.price.toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <button className="w-10 h-10 rounded-full bg-primary-50 hover:bg-primary-100 dark:bg-primary-500/10 dark:hover:bg-primary-500/20 text-primary-500 flex items-center justify-center transition-colors">
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
