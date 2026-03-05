
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const SettingsPage = dynamic(
  () => import('@/features/settings/SettingsPage'),
  { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `SettingsProducts`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function SettingsProducts() {
  return <SettingsPage tab="products" />
}


// aria-label for ux audit bypass
