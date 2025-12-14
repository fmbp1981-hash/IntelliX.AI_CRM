/**
 * @fileoverview Componente de Rota Protegida
 * 
 * Higher-Order Component que protege rotas que requerem autenticação,
 * redirecionando para login ou setup conforme necessário.
 * 
 * @module components/ProtectedRoute
 * 
 * Fluxo de decisão:
 * 1. Se carregando → exibe PageLoader
 * 2. Se não inicializado → redireciona para /setup
 * 3. Se não autenticado → redireciona para /login
 * 4. Se autenticado → renderiza children
 * 
 * @example
 * ```tsx
 * <Route 
 *   path="/dashboard" 
 *   element={
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   } 
 * />
 * ```
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageLoader } from './PageLoader';

/**
 * Componente que protege rotas autenticadas
 * 
 * Verifica estado de autenticação e inicialização da instância
 * antes de renderizar o conteúdo protegido.
 * 
 * @param {Object} props - Props do componente
 * @param {React.ReactNode} props.children - Conteúdo a ser protegido
 * @returns {JSX.Element} Loader, redirect ou conteúdo protegido
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading, isInitialized } = useAuth();
    const location = useLocation();

    // Aguarda carregamento do estado de auth
    if (loading || isInitialized === null) {
        return <PageLoader />;
    }

    // Redireciona para setup se instância não inicializada
    if (!isInitialized) {
        return <Navigate to="/setup" replace />;
    }

    // Redireciona para login se não autenticado
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
