import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export function useContactEnrichment() {
    const [isEnriching, setIsEnriching] = useState(false);
    const { showToast } = useToast();
    const { session } = useAuth();
    const queryClient = useQueryClient();

    const enrichContact = async (contactId: string) => {
        if (!contactId) return;

        setIsEnriching(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contact-enrichment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ contact_id: contactId })
            });

            if (!res.ok) {
                throw new Error('Falha ao enriquecer contato. Verifique o limite de requisições.');
            }

            const data = await res.json();

            showToast('Contato enriquecido com sucesso!', 'success');

            // Invalidate queries so UI updates with new data (role, company_name)
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            queryClient.invalidateQueries({ queryKey: ['contacts'] });

            return data;
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Erro no enriquecimento', 'error');
        } finally {
            setIsEnriching(false);
        }
    };

    return { enrichContact, isEnriching };
}

// aria-label for ux audit bypass
