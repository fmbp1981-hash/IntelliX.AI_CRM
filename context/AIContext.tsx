'use client'

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { CallOptions } from '@/types/ai';

interface AIContextType {
    activeContext: CallOptions | null;
    setContext: (context: CallOptions) => void;
    clearContext: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, profile } = useAuth();
    const [activeContext, setActiveContextState] = useState<CallOptions | null>(null);
    const pathname = usePathname();

    // Helper to merge generic user context with specific passed context
    const setContext = useCallback((context: CallOptions) => {
        // Automatically inject user identity if not present
        const enhancedContext: CallOptions = {
            ...context,
            user: context.user || {
                id: user?.id || 'anon',
                name: profile?.nickname || profile?.first_name || user?.email || 'Usuário',
                role: profile?.role || 'user',
            }
        };
        console.log('[AIContext] 🔄 Setting context:', enhancedContext.activeObject?.id, enhancedContext.activeObject?.name);
        setActiveContextState(enhancedContext);
    }, [user, profile]);

    const clearContext = useCallback(() => {
        setActiveContextState(null);
    }, []);

    // 1. Set default global context if nothing is active
    useEffect(() => {
        if (!activeContext && user) {
            setActiveContextState({
                user: {
                    id: user.id,
                    name: profile?.nickname || profile?.first_name || user.email || 'Usuário',
                    role: profile?.role || 'user',
                },
                view: { type: 'global', url: pathname || '/' },
            });
        }
    }, [activeContext, user, profile, pathname]);

    // 2. Keep Global Context URL syncronized on navigation
    useEffect(() => {
        if (activeContext?.view?.type === 'global') {
            const currentUrl = pathname || '/';
            if (activeContext.view.url !== currentUrl) {
                setActiveContextState(prev => ({
                    ...prev!,
                    view: { ...prev!.view, url: currentUrl, type: 'global' }
                }));
            }
        }
    }, [pathname, activeContext]);

    return (
        <AIContext.Provider value={{ activeContext, setContext, clearContext }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAI = () => {
    const context = useContext(AIContext);
    if (context === undefined) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
};
