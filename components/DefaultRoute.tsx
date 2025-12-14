import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePersistedState } from '@/hooks/usePersistedState';

export const DefaultRoute: React.FC = () => {
    // Default to /boards if not set
    const [defaultRoute] = usePersistedState<string>('crm_default_route', '/boards');

    let target = defaultRoute === '/' ? '/boards' : defaultRoute;

    // Handle specific Inbox modes
    if (target === '/inbox-list') {
        localStorage.setItem('inbox_view_mode', JSON.stringify('list'));
        target = '/inbox';
    } else if (target === '/inbox-focus') {
        localStorage.setItem('inbox_view_mode', JSON.stringify('focus'));
        target = '/inbox';
    }

    return <Navigate to={target} replace />;
};
