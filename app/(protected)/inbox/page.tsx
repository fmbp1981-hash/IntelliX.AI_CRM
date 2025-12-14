'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const InboxPage = dynamic(
    () => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })),
    { loading: () => <PageLoader />, ssr: false }
)

export default function Inbox() {
    return <InboxPage />
}
