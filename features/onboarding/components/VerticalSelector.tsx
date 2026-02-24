'use client';

/**
 * @fileoverview VerticalSelector — Onboarding component for choosing business vertical.
 *
 * Displays the available verticals as cards. When the user selects one,
 * calls POST /api/vertical/activate to provision the org.
 *
 * @module features/onboarding/components/VerticalSelector
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Stethoscope, Smile, Home } from 'lucide-react';
import type { BusinessType } from '@/types/vertical';
import { verticalConfigKeys } from '@/hooks/useVerticalConfig';

// ─── Vertical Definitions ────────────────────────────────────────────

interface VerticalOption {
    type: BusinessType;
    title: string;
    description: string;
    icon: typeof Building2;
    color: string;
    bgColor: string;
    features: string[];
}

const VERTICALS: VerticalOption[] = [
    {
        type: 'generic',
        title: 'CRM Genérico',
        description: 'Pipeline de vendas B2B tradicional',
        icon: Building2,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
        features: [
            'Pipeline Kanban personalizável',
            'Gestão de contatos e empresas',
            'Inbox Inteligente com IA',
            'Relatórios e dashboards',
        ],
    },
    {
        type: 'medical_clinic',
        title: 'Clínica Médica',
        description: 'Gestão de pacientes, agendamentos e convênios',
        icon: Stethoscope,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
        features: [
            'Jornada do Paciente (pipeline)',
            'Controle de agendamentos',
            'Gestão de convênios',
            'Reativação automática de inativos',
            'Taxa de absenteísmo',
        ],
    },
    {
        type: 'dental_clinic',
        title: 'Clínica Odontológica',
        description: 'Orçamentos, tratamentos e manutenção recorrente',
        icon: Smile,
        color: 'text-violet-600',
        bgColor: 'bg-violet-50 hover:bg-violet-100 border-violet-200',
        features: [
            'Funil de Tratamento (pipeline)',
            'Follow-up de orçamentos',
            'Controle de sessões',
            'Parcelamento e financeiro',
            'Manutenção semestral automática',
        ],
    },
    {
        type: 'real_estate',
        title: 'Imobiliária',
        description: 'Imóveis, visitas, propostas e comissões',
        icon: Home,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
        features: [
            'Funil de Vendas/Locação',
            'Cadastro de imóveis',
            'Match IA cliente↔imóvel',
            'Gestão de visitas',
            'Comissões por corretor',
        ],
    },
];

// ─── Component ───────────────────────────────────────────────────────

interface VerticalSelectorProps {
    onActivated?: (businessType: BusinessType) => void;
}

export function VerticalSelector({ onActivated }: VerticalSelectorProps) {
    const [selected, setSelected] = useState<BusinessType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    async function handleActivate() {
        if (!selected) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/vertical/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_type: selected }),
            });

            if (!res.ok) {
                const body = await res.json();
                throw new Error(body.error ?? 'Falha ao ativar vertical');
            }

            // Invalidate vertical config cache so hooks reload
            await queryClient.invalidateQueries({
                queryKey: verticalConfigKeys.all,
            });

            onActivated?.(selected);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                    Qual é o seu tipo de negócio?
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Vamos personalizar o CRM para a realidade do seu dia a dia. Tudo pode
                    ser ajustado depois.
                </p>
            </div>

            {/* Vertical Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {VERTICALS.map((v) => {
                    const Icon = v.icon;
                    const isSelected = selected === v.type;

                    return (
                        <button
                            key={v.type}
                            type="button"
                            onClick={() => setSelected(v.type)}
                            className={`
                relative flex flex-col rounded-xl border-2 p-5 text-left
                transition-all duration-200 ease-in-out
                ${v.bgColor}
                ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500 scale-[1.02]' : 'border-transparent'}
              `}
                        >
                            {/* Icon + Title */}
                            <div className="mb-3 flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 ${v.color}`}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {v.title}
                                    </h3>
                                    <p className="text-sm text-gray-600">{v.description}</p>
                                </div>
                            </div>

                            {/* Features */}
                            <ul className="ml-1 space-y-1">
                                {v.features.map((f) => (
                                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* Selected checkmark */}
                            {isSelected && (
                                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                                    ✓
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Error */}
            {error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* CTA */}
            <div className="mt-8 flex justify-center">
                <button
                    type="button"
                    onClick={handleActivate}
                    disabled={!selected || isLoading}
                    className={`
            rounded-lg px-8 py-3 text-base font-semibold text-white
            transition-all duration-200
            ${selected && !isLoading
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg cursor-pointer'
                            : 'bg-gray-300 cursor-not-allowed'
                        }
          `}
                >
                    {isLoading ? 'Configurando...' : 'Ativar e Continuar'}
                </button>
            </div>
        </div>
    );
}
