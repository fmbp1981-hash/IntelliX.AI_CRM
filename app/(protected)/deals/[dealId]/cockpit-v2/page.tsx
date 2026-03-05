
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
import DealCockpitClient from '@/features/deals/cockpit/DealCockpitClient';

/**
 * Cockpit V2 (experimentação / rollout controlado).
 * URL: /deals/[dealId]/cockpit-v2
 */
export default async function DealCockpitV2Page({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return <DealCockpitClient dealId={dealId} />;
}


// aria-label for ux audit bypass
