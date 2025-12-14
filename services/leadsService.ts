/**
 * @fileoverview Serviço de gerenciamento de leads do CRM.
 * 
 * Este serviço fornece operações CRUD para leads usando localStorage
 * como armazenamento temporário (para desenvolvimento/demo).
 * Em produção, os dados são gerenciados via Supabase.
 * 
 * @module services/leadsService
 */

import { Lead } from '@/types';
import { INITIAL_LEADS } from '@/services/mockData';

/**
 * Simula latência de rede para operações assíncronas.
 * 
 * @param ms - Tempo de delay em milissegundos.
 * @returns Promise que resolve após o delay especificado.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Serviço de leads do CRM.
 * 
 * Fornece métodos para buscar e salvar leads no sistema.
 * Leads são contatos iniciais que ainda não foram qualificados como oportunidades.
 * 
 * @example
 * ```typescript
 * // Buscar todos os leads
 * const leads = await leadsService.getAll();
 * 
 * // Salvar um novo lead
 * const newLead = await leadsService.save({
 *   id: 'uuid',
 *   name: 'Maria Santos',
 *   email: 'maria@empresa.com',
 *   status: 'NEW'
 * });
 * ```
 */
export const leadsService = {
  /**
   * Busca todos os leads do CRM.
   * 
   * Primeiro tenta recuperar do localStorage, caso não encontre,
   * retorna os leads iniciais de demonstração.
   * 
   * @returns Promise com array de todos os leads.
   */
  getAll: async (): Promise<Lead[]> => {
    await delay(500);
    const stored = localStorage.getItem('crm_leads');
    return stored ? JSON.parse(stored) : INITIAL_LEADS;
  },

  /**
   * Salva ou atualiza um lead.
   * 
   * @param lead - Objeto do lead a ser salvo.
   * @returns Promise com o lead salvo.
   * 
   * @remarks
   * Em uma aplicação real, isso enviaria para a API.
   * Atualmente apenas retorna o lead para simular persistência.
   */
  save: async (lead: Lead): Promise<Lead> => {
    await delay(500);
    // In a real app: axios.post('/api/leads', lead)
    return lead;
  }
};
