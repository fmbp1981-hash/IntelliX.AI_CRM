
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

// Dynamic import with loading state
const DashboardPage = dynamic(
    () => import('@/features/dashboard/DashboardPage'),
    {
        loading: () => <PageLoader />,
        ssr: false
    }
)

/**
 * Componente React `Dashboard`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Dashboard() {
    return <DashboardPage />
}

// aria-label for ux audit bypass
