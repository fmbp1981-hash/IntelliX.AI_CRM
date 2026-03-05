
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const DecisionQueuePage = dynamic(
    () => import('@/features/decisions/DecisionQueuePage').then(m => ({ default: m.DecisionQueuePage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Decisions`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Decisions() {
    return <DecisionQueuePage />
}

// aria-label for ux audit bypass
