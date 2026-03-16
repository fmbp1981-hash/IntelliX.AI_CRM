'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ClientRadarPage = dynamic(
    () => import('@/features/client-radar/ClientRadarPage'),
    {
        loading: () => <PageLoader />,
        ssr: false
    }
)

export default function Radar() {
    return <ClientRadarPage />
}
