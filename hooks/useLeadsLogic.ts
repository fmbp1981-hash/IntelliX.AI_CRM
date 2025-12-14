/**
 * @fileoverview Hook de Lógica de Leads (Modo Offline)
 * 
 * Hook legado que gerencia leads usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useLeadsLogic
 * @deprecated Preferir usar context de deals/leads com Supabase para produção
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const { leads, addLead, discardLead } = useLeadsLogic();
 * ```
 */

import { Lead } from '../types';
import { INITIAL_LEADS } from '../services/mockData';
import { usePersistedState } from './usePersistedState';

/**
 * Hook para gerenciamento de leads em localStorage
 * 
 * Fornece CRUD de leads com persistência local para modo offline.
 * Em produção, usar o contexto de deals que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de leads
 * @returns {Lead[]} return.leads - Lista de leads
 * @returns {(lead: Lead) => void} return.addLead - Adiciona lead
 * @returns {(id: string, updates: Partial<Lead>) => void} return.updateLead - Atualiza lead
 * @returns {(leadId: string) => void} return.discardLead - Remove/descarta lead
 * @returns {React.Dispatch} return.setLeads - Setter direto do estado
 */
export const useLeadsLogic = () => {
    const [leads, setLeads] = usePersistedState<Lead[]>('crm_leads', []);

    const addLead = (lead: Lead) => {
        setLeads(prev => [lead, ...prev]);
    };

    const updateLead = (id: string, updates: Partial<Lead>) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const discardLead = (leadId: string) => {
        setLeads(prev => prev.filter(l => l.id !== leadId));
    };

    return {
        leads,
        addLead,
        updateLead,
        discardLead,
        setLeads
    };
};
