'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const DecisionQueuePage = dynamic(
    () => import('@/features/decisions/DecisionQueuePage').then(m => ({ default: m.DecisionQueuePage })),
    { loading: () => <PageLoader />, ssr: false }
)

export default function Decisions() {
    return <DecisionQueuePage />
}
