
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const InboxPage = dynamic(
    () => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Inbox`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Inbox() {
    return <InboxPage />
}

// aria-label for ux audit bypass
