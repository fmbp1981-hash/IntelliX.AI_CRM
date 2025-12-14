/**
 * @fileoverview Hook de Lógica de Empresas (Modo Offline)
 * 
 * Hook legado que gerencia empresas usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useCompaniesLogic
 * @deprecated Preferir usar context de empresas com Supabase para produção
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const { companies, addCompany } = useCompaniesLogic();
 * ```
 */

import { Company } from '../types';
import { INITIAL_COMPANIES } from '../services/mockData';
import { usePersistedState } from './usePersistedState';

/**
 * Hook para gerenciamento de empresas em localStorage
 * 
 * Fornece operações básicas de empresas com persistência local para modo offline.
 * Em produção, usar o serviço de empresas que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de empresas
 * @returns {Company[]} return.companies - Lista de empresas
 * @returns {(company: Company) => void} return.addCompany - Adiciona empresa
 * @returns {React.Dispatch} return.setCompanies - Setter direto do estado
 */
export const useCompaniesLogic = () => {
    const [companies, setCompanies] = usePersistedState<Company[]>('crm_companies', []);

    const addCompany = (company: Company) => {
        setCompanies(prev => [...prev, company]);
    };

    return {
        companies,
        addCompany,
        setCompanies
    };
};
