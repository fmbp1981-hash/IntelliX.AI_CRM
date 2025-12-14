/**
 * @fileoverview Hook de Lógica de Contatos (Modo Offline)
 * 
 * Hook legado que gerencia contatos usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useContactsLogic
 * @deprecated Preferir usar useContacts de @/context/contacts para produção
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const { contacts, addContact, updateContact } = useContactsLogic();
 * ```
 */

import { Contact } from '../types';
import { INITIAL_CONTACTS } from '../services/mockData';
import { usePersistedState } from './usePersistedState';

/**
 * Hook para gerenciamento de contatos em localStorage
 * 
 * Fornece CRUD de contatos com persistência local para modo offline.
 * Em produção, usar o contexto de contatos que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de contatos
 * @returns {Contact[]} return.contacts - Lista de contatos
 * @returns {(contact: Contact) => void} return.addContact - Adiciona contato
 * @returns {(id: string, updates: Partial<Contact>) => void} return.updateContact - Atualiza contato
 * @returns {(id: string) => void} return.deleteContact - Remove contato
 * @returns {React.Dispatch} return.setContacts - Setter direto do estado
 */
export const useContactsLogic = () => {
  const [contacts, setContacts] = usePersistedState<Contact[]>('crm_contacts', INITIAL_CONTACTS);

  const addContact = (contact: Contact) => {
    setContacts(prev => [contact, ...prev]);
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  return {
    contacts,
    addContact,
    updateContact,
    deleteContact,
    setContacts,
  };
};
