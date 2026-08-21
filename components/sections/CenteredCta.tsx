import Cta from '@/components/Cta'
import { getGlobal } from '@/lib/content'

// No reference screenshot exists for this section (Figma MCP quota). Built from
// the copy in content/globals/CenteredCta.json and node 1:253 of
// figma-desktop-tree.xml: headline, body, linkout button — centred, in that order.
export default async function CenteredCta() {
  const c = await getGlobal('CenteredCta')

  return (
    <section id="contact" className="px-6 py-16 text-center lg:px-12 lg:py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
          {c.headline as string}
        </h2>
        <p className="mt-6 font-sans text-paragraph text-text-paragraph">{c.body as string}</p>
        <div className="mt-8">
          <Cta label={c.ctaLabel as string} href={c.ctaHref as string} variant="solid" />
        </div>
      </div>
    </section>
  )
}
