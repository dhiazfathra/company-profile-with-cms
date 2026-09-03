import Cta from '@/components/Cta'
import { getGlobal } from '@/lib/content'

export default async function CenteredCta() {
  const c = await getGlobal('CenteredCta')

  return (
    <section
      data-section="CenteredCta"
      id="contact"
      className="px-6 py-20 text-center lg:px-12 lg:py-32"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
          {c.headline as string}
        </h2>
        <p className="mt-6 font-sans text-paragraph text-text-paragraph">{c.body as string}</p>
        <div className="mt-10 [&>a]:flex [&>a]:w-full [&>a]:justify-center">
          <Cta label={c.ctaLabel as string} href={c.ctaHref as string} variant="solid" />
        </div>
      </div>
    </section>
  )
}
