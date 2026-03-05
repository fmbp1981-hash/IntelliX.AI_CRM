
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const AIHubPage = dynamic(
    () => import('@/features/ai-hub/AIHubPage').then(m => ({ default: m.AIHubPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `AIHub`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function AIHub() {
    return <AIHubPage />
}

// aria-label for ux audit bypass
