import { getGlobal } from '@/lib/content'

export default async function ShowcaseImage() {
  const c = await getGlobal('ShowcaseImage')

  return (
    // design/refs/ShowcaseImage.png is the whole section and the image fills it
    // corner to corner, rounded corners included, so this section is the image:
    // full-bleed, no padding of its own.
    <section data-section="ShowcaseImage">
      <img src={c.image as string} alt={c.imageAlt as string} className="w-full rounded-2xl" />
    </section>
  )
}
