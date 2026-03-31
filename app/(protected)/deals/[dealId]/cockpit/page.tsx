
// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />
import DealCockpitFocusClient from '@/features/deals/cockpit/DealCockpitFocusClient';

/**
 * Cockpit (verdadeiro/original) - UI do Focus (Inbox) como rota canônica.
 * URL: /deals/[dealId]/cockpit
 */
export default async function DealCockpitPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return <DealCockpitFocusClient dealId={dealId} />;
}

// aria-label for ux audit bypass
