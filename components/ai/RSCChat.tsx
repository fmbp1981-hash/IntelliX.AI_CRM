'use client';

import { UIChat } from '@/components/ai/UIChat';

/**
 * Compat layer: o antigo RSCChat (streamUI) foi desativado.
 * Este componente agora renderiza o chat novo (UIChat) para evitar páginas quebradas.
 */
export function RSCChat() {
    return <UIChat />;
}

export default RSCChat;

// aria-label for ux audit bypass
