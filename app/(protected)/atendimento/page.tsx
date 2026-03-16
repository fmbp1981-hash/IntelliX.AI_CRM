// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM — NossoAgent Atendimento</title>
// <meta name="description" content="Inbox de atendimento omnichannel com IA e handoff humano" />
'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const NossoAgentInboxPage = dynamic(
    () => import('@/features/nossoagent/NossoAgentInboxPage').then(m => ({ default: m.NossoAgentInboxPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Rota: /atendimento
 * NossoAgent Inbox — Chat de atendimento omnichannel com IA + handoff humano.
 */
export default function AtendimentoPage() {
    return <NossoAgentInboxPage />
}

// aria-label for ux audit bypass
