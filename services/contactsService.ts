/**
 * @fileoverview Serviço de gerenciamento de contatos do CRM.
 * 
 * Este serviço fornece operações CRUD para contatos usando localStorage
 * como armazenamento temporário (para desenvolvimento/demo).
 * Em produção, os dados são gerenciados via Supabase.
 * 
 * @module services/contactsService
 */

import { Contact } from '@/types';
import { INITIAL_CONTACTS } from '@/services/mockData';

/**
 * Simula latência de rede para operações assíncronas.
 * 
 * @param ms - Tempo de delay em milissegundos.
 * @returns Promise que resolve após o delay especificado.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Serviço de contatos do CRM.
 * 
 * Fornece métodos para buscar e salvar contatos.
 * Utiliza localStorage para persistência local durante desenvolvimento.
 * 
 * @example
 * ```typescript
 * // Buscar todos os contatos
 * const contacts = await contactsService.getAll();
 * 
 * // Salvar um novo contato
 * const newContact = await contactsService.save({
 *   id: 'uuid',
 *   name: 'João Silva',
 *   email: 'joao@empresa.com'
 * });
 * ```
 */
export const contactsService = {
  /**
   * Busca todos os contatos do CRM.
   * 
   * Primeiro tenta recuperar do localStorage, caso não encontre,
   * retorna os contatos iniciais de demonstração.
   * 
   * @returns Promise com array de todos os contatos.
   */
  getAll: async (): Promise<Contact[]> => {
    await delay(500);
    const stored = localStorage.getItem('crm_contacts');
    return stored ? JSON.parse(stored) : INITIAL_CONTACTS;
  },

  /**
   * Salva ou atualiza um contato.
   * 
   * @param contact - Objeto do contato a ser salvo.
   * @returns Promise com o contato salvo.
   * 
   * @remarks
   * Em uma aplicação real, isso enviaria para a API.
   * Atualmente apenas retorna o contato para simular persistência.
   */
  save: async (contact: Contact): Promise<Contact> => {
    await delay(500);
    // In a real app: axios.post('/api/contacts', contact)
    return contact;
  }
};
