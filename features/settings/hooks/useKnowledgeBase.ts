import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';

export interface KnowledgeDocument {
    id: string;
    title: string;
    source_type: string;
    created_at: string;
    is_active: boolean;
}

export function useKnowledgeBase() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const query = useQuery<{ data: KnowledgeDocument[] }>({
        queryKey: ['knowledge-docs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/knowledge');
            if (!res.ok) throw new Error('Falha ao carregar base de conhecimento');
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (doc: { title: string; content: string; source_type?: string }) => {
            const res = await fetch('/api/settings/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doc),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Falha ao criar documento');
            }

            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] });
            showToast('Documento adicionado e processado com sucesso!', 'success');
        },
        onError: (error: Error) => {
            showToast(error.message, 'error');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/knowledge?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao remover documento');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] });
            showToast('Documento removido da base', 'success');
        },
        onError: (error: Error) => {
            showToast(error.message, 'error');
        },
    });

    return {
        documents: query.data?.data || [],
        isLoading: query.isLoading,
        isError: query.isError,
        addDocument: createMutation.mutateAsync,
        isAdding: createMutation.isPending,
        removeDocument: deleteMutation.mutate,
    };
}
