/**
 * @fileoverview Serviço de gerenciamento de negócios (deals) do CRM.
 * 
 * Este serviço fornece operações CRUD para deals/negócios usando localStorage
 * como armazenamento temporário (para desenvolvimento/demo).
 * Em produção, os dados são gerenciados via Supabase.
 * 
 * @module services/dealsService
 */

import { Deal } from '@/types';
import { INITIAL_DEALS } from '@/services/mockData';

/**
 * Simula latência de rede para operações assíncronas.
 * 
 * @param ms - Tempo de delay em milissegundos.
 * @returns Promise que resolve após o delay especificado.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Serviço de negócios/deals do CRM.
 * 
 * Fornece métodos para buscar e salvar deals no sistema.
 * Deals representam oportunidades de venda em diferentes estágios do funil.
 * 
 * @example
 * ```typescript
 * // Buscar todos os deals
 * const deals = await dealsService.getAll();
 * 
 * // Salvar um novo deal
 * const newDeal = await dealsService.save({
 *   id: 'uuid',
 *   title: 'Contrato Anual',
 *   value: 50000,
 *   status: 'NEGOTIATING'
 * });
 * ```
 */
export const dealsService = {
  /**
   * Busca todos os deals do CRM.
   * 
   * Primeiro tenta recuperar do localStorage, caso não encontre,
   * retorna os deals iniciais de demonstração.
   * 
   * @returns Promise com array de todos os deals.
   */
  getAll: async (): Promise<Deal[]> => {
    await delay(500);
    const stored = localStorage.getItem('crm_deals');
    return stored ? JSON.parse(stored) : INITIAL_DEALS;
  },

  /**
   * Salva ou atualiza um deal.
   * 
   * @param deal - Objeto do deal a ser salvo.
   * @returns Promise com o deal salvo.
   * 
   * @remarks
   * Em uma aplicação real, isso enviaria para a API.
   * Atualmente apenas retorna o deal para simular persistência.
   */
  save: async (deal: Deal): Promise<Deal> => {
    await delay(500);
    // In a real app: axios.post('/api/deals', deal)
    return deal;
  }
};
