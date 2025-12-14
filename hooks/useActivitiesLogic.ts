/**
 * @fileoverview Hook de Lógica de Atividades (Modo Offline)
 * 
 * Hook legado que gerencia atividades usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useActivitiesLogic
 * @deprecated Preferir usar useActivities de @/context/activities para produção
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const {
 *   activities,
 *   addActivity,
 *   toggleActivityCompletion
 * } = useActivitiesLogic();
 * ```
 */

import { Activity } from '../types';
import { INITIAL_ACTIVITIES } from '../services/mockData';
import { usePersistedState } from './usePersistedState';

/**
 * Hook para gerenciamento de atividades em localStorage
 * 
 * Fornece CRUD de atividades com persistência local para modo offline.
 * Em produção, usar o contexto de atividades que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de atividades
 * @returns {Activity[]} return.activities - Lista de atividades
 * @returns {(activity: Activity) => void} return.addActivity - Adiciona atividade
 * @returns {(id: string, updates: Partial<Activity>) => void} return.updateActivity - Atualiza atividade
 * @returns {(id: string) => void} return.deleteActivity - Remove atividade
 * @returns {(id: string) => void} return.toggleActivityCompletion - Alterna status de conclusão
 * @returns {React.Dispatch} return.setActivities - Setter direto do estado
 */
export const useActivitiesLogic = () => {
  const [activities, setActivities] = usePersistedState<Activity[]>(
    'crm_activities',
    INITIAL_ACTIVITIES
  );

  const addActivity = (activity: Activity) => {
    setActivities(prev => [activity, ...prev]);
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const deleteActivity = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  const toggleActivityCompletion = (id: string) => {
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, completed: !a.completed } : a)));
  };

  return {
    activities,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleActivityCompletion,
    setActivities,
  };
};
