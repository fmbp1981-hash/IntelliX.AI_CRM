/**
 * @fileoverview Hook de Lógica de Boards/Pipelines (Modo Offline)
 * 
 * Hook legado que gerencia boards kanban usando localStorage como fallback
 * quando a conexão com Supabase não está disponível.
 * 
 * @module hooks/useBoardsLogic
 * @deprecated Preferir usar useBoards de @/context/boards para produção
 * 
 * @remarks
 * Inclui lógica de migração automática para atualizar estrutura
 * de boards legados que usavam `linkedStage` ao invés de
 * `linkedLifecycleStage` nos estágios.
 * 
 * @example
 * ```tsx
 * // Para uso offline/demo apenas
 * const { 
 *   boards, 
 *   addBoard, 
 *   getDefaultBoard 
 * } = useBoardsLogic();
 * ```
 */

import { Board, DEFAULT_BOARD_STAGES, ContactStage } from '../types';
import { INITIAL_BOARDS } from '../services/mockData';
import { usePersistedState } from './usePersistedState';
import { useEffect } from 'react';

/** Board padrão de vendas criado automaticamente */
const DEFAULT_SALES_BOARD: Board = {
  id: 'default-sales',
  name: 'Pipeline de Vendas',
  description: 'Funil principal de oportunidades',
  stages: DEFAULT_BOARD_STAGES,
  isDefault: true,
  automationSuggestions: [
    'Enviar e-mail de boas-vindas ao mover para "Contatado"',
    'Criar tarefa de follow-up após 3 dias sem resposta',
    'Enviar pesquisa de satisfação ao mover para "Ganho"',
  ],
  createdAt: new Date().toISOString(),
};

/**
 * Hook para gerenciamento de boards em localStorage
 * 
 * Fornece CRUD de boards kanban com persistência local para modo offline.
 * Em produção, usar o contexto de boards que sincroniza com Supabase.
 * 
 * @returns {Object} Estado e operações de boards
 * @returns {Board[]} return.boards - Lista de boards
 * @returns {React.Dispatch} return.setBoards - Setter direto do estado
 * @returns {(board: Omit<Board, 'id' | 'createdAt'>) => Board} return.addBoard - Cria board
 * @returns {(id: string, updates: Partial<Board>) => void} return.updateBoard - Atualiza board
 * @returns {(id: string) => void} return.deleteBoard - Remove board (exceto default)
 * @returns {() => Board | undefined} return.getDefaultBoard - Retorna board padrão
 * @returns {(id: string) => Board | undefined} return.getBoardById - Busca board por ID
 */
export const useBoardsLogic = () => {
  const [boards, setBoards] = usePersistedState<Board[]>('crm_boards', INITIAL_BOARDS);

  // MIGRATION: Ensure Default Board has the new Linked Stages logic
  useEffect(() => {
    setBoards(prevBoards => {
      const defaultBoardIndex = prevBoards.findIndex(b => b.id === 'default-sales');
      if (defaultBoardIndex === -1) return prevBoards;

      const currentDefaultBoard = prevBoards[defaultBoardIndex];

      // Check if migration is needed:
      // 1. Has legacy linkedStage property
      // 2. Stages don't have linkedLifecycleStage (checking the Won stage)
      const hasLegacyProp = 'linkedStage' in currentDefaultBoard;
      const wonStage = currentDefaultBoard.stages.find(s => s.id === 'CLOSED_WON');
      const isMissingLinkedStage = wonStage && !wonStage.linkedLifecycleStage;

      if (hasLegacyProp || isMissingLinkedStage) {
        const updatedBoards = [...prevBoards];

        // Remove legacy prop and update stages
        const { linkedStage, ...rest } = currentDefaultBoard as Board & {
          linkedStage?: ContactStage;
        };
        updatedBoards[defaultBoardIndex] = {
          ...rest,
          stages: DEFAULT_BOARD_STAGES, // Force update stages to new definition
        };
        return updatedBoards;
      }

      return prevBoards;
    });
  }, []);

  const addBoard = (board: Omit<Board, 'id' | 'createdAt'>) => {
    const newBoard: Board = {
      ...board,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      // Explicitly ensure strategy fields are passed if present
      goal: board.goal,
      agentPersona: board.agentPersona,
      entryTrigger: board.entryTrigger,
    };
    setBoards(prev => [...prev, newBoard]);
    return newBoard;
  };

  const updateBoard = (id: string, updates: Partial<Board>) => {
    setBoards(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
  };

  const deleteBoard = (id: string) => {
    // Não permite deletar o board padrão
    setBoards(prev => prev.filter(b => b.id !== id || b.isDefault));
  };

  const getDefaultBoard = () => {
    return boards.find(b => b.isDefault) || boards[0];
  };

  const getBoardById = (id: string) => {
    return boards.find(b => b.id === id);
  };

  return {
    boards,
    setBoards,
    addBoard,
    updateBoard,
    deleteBoard,
    getDefaultBoard,
    getBoardById,
  };
};
