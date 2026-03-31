'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const NurturingDashboardPage = dynamic(
  () => import('@/features/customer-intelligence/NurturingDashboardPage').then((m) => ({ default: m.NurturingDashboardPage })),
  {
    loading: () => <PageLoader />,
    ssr: false,
  }
)

export default function Nutricao() {
  return <NurturingDashboardPage />
}
