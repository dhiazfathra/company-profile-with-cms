import Cta from '@/components/Cta'
import { getCollection, getGlobal } from '@/lib/content'
import { ordinal } from '@/lib/ordinal'

export default async function HowItWorks() {
  const c = await getGlobal('HowItWorks')
  const steps = await getCollection('HowItWorksStep')

  return (
    <section data-section="HowItWorks" id="how-it-works" className="px-6 py-16 lg:px-12 lg:py-32">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <h2 className="font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
          {c.headline as string}
        </h2>
        <Cta label={c.ctaLabel as string} href={c.ctaHref as string} />
      </div>

      <ol className="mt-16 grid gap-10 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title as string} className="border-t border-divider-1 pt-10">
            <span aria-hidden="true" className="font-sans text-6xl text-accent-6 lg:text-stat">
              {ordinal(index)}
            </span>
            <h3 className="mt-16 font-display text-h3 text-text-headline">
              {step.title as string}
            </h3>
            <p className="mt-4 font-sans text-paragraph text-text-paragraph">
              {step.body as string}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
