import { getCollection, getGlobal } from '@/lib/content'
import { Img } from '@/components/Img'

export default async function Benefits() {
  const c = await getGlobal('Benefits')
  const items = await getCollection('BenefitsItem')

  return (
    <section data-section="Benefits" id="benefits" className="px-6 py-16 lg:px-12 lg:py-24">
      <p className="font-mono text-caption text-text-captions">{c.eyebrow as string}</p>
      <h2 className="mt-6 font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
        {c.headline as string}
      </h2>
      <p className="mt-6 max-w-2xl font-sans text-paragraph text-text-paragraph">
        {c.subhead as string}
      </p>

      <ul className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
        {items.map((item) => (
          <li key={item.title as string} className="border-t border-divider-1 pt-8">
            <Img src={item.icon as string} alt="" aria-hidden="true" className="h-6 w-auto" />
            <h3 className="mt-8 font-display text-h3 text-text-headline">{item.title as string}</h3>
            <p className="mt-4 font-sans text-paragraph text-text-paragraph">
              {item.body as string}
            </p>
          </li>
        ))}
      </ul>

      <Img
        src={c.image as string}
        alt={c.imageAlt as string}
        className="mt-24 aspect-video w-full rounded-2xl object-cover"
      />
    </section>
  )
}
