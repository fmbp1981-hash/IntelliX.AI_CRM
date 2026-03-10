'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { VerticalSelector } from '@/features/onboarding/components/VerticalSelector';
import type { BusinessType } from '@/types/vertical';

/**
 * Página de Onboarding para seleção de Nicho (Vertical).
 * permite que o usuário ative funcionalidades específicas de nicho (como KPIs e Dashboard)
 * especialmente útil em ambientes de desenvolvimento onde o setup inicial é pulado.
 */
export default function NicheOnboardingPage() {
    const router = useRouter();

    const handleActivated = (businessType: BusinessType) => {
        console.log(`Vertical ${businessType} ativada com sucesso!`);
        // Redireciona para o dashboard para visualizar os novos widgets
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-12">
            <div className="max-w-4xl mx-auto">
                <VerticalSelector onActivated={handleActivated} />

                <div className="mt-8 text-center text-sm text-slate-500">
                    <p>Dica: Selecione "Clínica Médica" ou "Imobiliária" para ver os KPIs e widgets específicos no Dashboard.</p>
                </div>
            </div>
        </div>
    );
}
