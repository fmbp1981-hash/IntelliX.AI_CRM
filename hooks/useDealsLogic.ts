/**
 * @fileoverview Hook de Lógica de Negócios/Deals (Modo Offline)
 * 
 * Hook legado que gerencia deals usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useDealsLogic
 * @deprecated Preferir usar useDeals de @/context/deals para produção
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const { 
 *   rawDeals, 
 *   addDeal, 
 *   updateDealStatus,
 *   addItemToDeal 
 * } = useDealsLogic();
 * ```
 */

import { Deal, DealStatus, DealItem } from '../types';
import { INITIAL_DEALS } from '../services/mockData';
import { usePersistedState } from './usePersistedState';

/**
 * Hook para gerenciamento de deals em localStorage
 * 
 * Fornece CRUD de deals com persistência local para modo offline.
 * Inclui operações especializadas para itens de deal e mudança de status.
 * Em produção, usar o contexto de deals que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de deals
 * @returns {Deal[]} return.rawDeals - Lista de deals
 * @returns {React.Dispatch} return.setRawDeals - Setter direto do estado
 * @returns {(deal: Deal) => void} return.addDeal - Adiciona deal
 * @returns {(id: string, updates: Partial<Deal>) => void} return.updateDeal - Atualiza deal
 * @returns {(id: string, status: string, lossReason?: string) => void} return.updateDealStatus - Atualiza status
 * @returns {(id: string) => void} return.deleteDeal - Remove deal
 * @returns {(dealId: string, item: Omit<DealItem, 'id'>) => void} return.addItemToDeal - Adiciona item
 * @returns {(dealId: string, itemId: string) => void} return.removeItemFromDeal - Remove item
 */
export const useDealsLogic = () => {
  const [rawDeals, setRawDeals] = usePersistedState<Deal[]>('crm_deals', INITIAL_DEALS);

  const addDeal = (deal: Deal) => {
    setRawDeals(prev => [deal, ...prev]);
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setRawDeals(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)));
  };

  const updateDealStatus = (id: string, newStatus: string, lossReason?: string) => {
    setRawDeals(prev =>
      prev.map(l =>
        l.id === id
          ? {
            ...l,
            status: newStatus,
            lastStageChangeDate: new Date().toISOString(),
            lossReason: newStatus === DealStatus.CLOSED_LOST ? lossReason : undefined,
          }
          : l
      )
    );
  };

  const deleteDeal = (id: string) => {
    setRawDeals(prev => prev.filter(d => d.id !== id));
  };

  const addItemToDeal = (dealId: string, item: Omit<DealItem, 'id'>) => {
    const newItem: DealItem = { ...item, id: crypto.randomUUID() };
    setRawDeals(prev =>
      prev.map(deal => {
        if (deal.id === dealId) {
          const updatedItems = [...(deal.items || []), newItem];
          const newValue = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
          return { ...deal, items: updatedItems, value: newValue };
        }
        return deal;
      })
    );
  };

  const removeItemFromDeal = (dealId: string, itemId: string) => {
    setRawDeals(prev =>
      prev.map(deal => {
        if (deal.id === dealId) {
          const updatedItems = (deal.items || []).filter(i => i.id !== itemId);
          const newValue = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
          return { ...deal, items: updatedItems, value: newValue };
        }
        return deal;
      })
    );
  };

  return {
    rawDeals,
    setRawDeals,
    addDeal,
    updateDeal,
    updateDealStatus,
    deleteDeal,
    addItemToDeal,
    removeItemFromDeal,
  };
};
