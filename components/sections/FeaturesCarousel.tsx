import Cta from '@/components/Cta'
import { getCollection, getGlobal } from '@/lib/content'
import { ordinal } from '@/lib/ordinal'

export default async function FeaturesCarousel() {
  const c = await getGlobal('FeaturesCarousel')
  const items = await getCollection('FeaturesCarouselItem')

  return (
    <section data-section="FeaturesCarousel" className="grid items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:px-12 lg:py-24">
      <div>
        <h2 className="font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
          {c.headline as string}
        </h2>
        <p className="mt-6 max-w-md font-sans text-paragraph text-text-paragraph">
          {c.subhead as string}
        </p>

        <ol className="mt-10 border-t border-divider-1">
          {items.map((item, index) => (
            <li
              key={item.label as string}
              className="flex gap-6 border-b border-divider-1 py-5"
            >
              <span aria-hidden="true" className="font-sans text-paragraph text-accent-6">
                {ordinal(index)}
              </span>
              <span className="font-sans text-paragraph text-text-headline">
                {item.label as string}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Cta label={c.ctaLabel as string} href={c.ctaHref as string} />
        </div>
      </div>

      <img
        src={c.image as string}
        alt={c.imageAlt as string}
        className="w-full rounded-2xl"
      />
    </section>
  )
}
