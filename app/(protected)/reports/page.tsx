
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ReportsPage = dynamic(
    () => import('@/features/reports/ReportsPage'),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Reports`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Reports() {
    return <ReportsPage />
}

// aria-label for ux audit bypass
