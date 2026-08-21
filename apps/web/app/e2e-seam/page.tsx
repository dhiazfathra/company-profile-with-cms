import { notFound } from 'next/navigation'
import { getGlobal } from '@/lib/content'

export default async function SeamPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>
}) {
  if (process.env.E2E !== '1') {
    notFound()
  }

  const { locale } = await searchParams
  const data = await getGlobal('Sample', locale || 'en', 'tests/fixtures/content')

  return (
    <div>
      <p data-testid="headline">{String(data.headline)}</p>
      <p data-testid="ctaHref">{String(data.ctaHref)}</p>
    </div>
  )
}
