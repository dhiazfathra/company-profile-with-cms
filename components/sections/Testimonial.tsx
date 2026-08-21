import { getGlobal } from '@/lib/content'

export default async function Testimonial() {
  const c = await getGlobal('Testimonial')

  return (
    <section data-section="Testimonial" className="grid items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:px-12 lg:py-24">
      <img src={c.image as string} alt={c.imageAlt as string} className="w-full rounded-2xl" />

      <figure>
        <blockquote className="font-display text-3xl leading-tight tracking-[-0.02em] text-text-headline lg:text-h2">
          {c.quote as string}
        </blockquote>
        <figcaption className="mt-10">
          <p className="font-sans text-paragraph text-text-headline">{c.authorName as string}</p>
          <p className="mt-1 font-mono text-caption text-text-captions">{c.authorRole as string}</p>
        </figcaption>
      </figure>
    </section>
  )
}
