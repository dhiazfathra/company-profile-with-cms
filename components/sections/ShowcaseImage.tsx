import { getGlobal } from '@/lib/content'

export default async function ShowcaseImage() {
  const c = await getGlobal('ShowcaseImage')

  return (
    <section className="px-6 py-16 lg:px-12 lg:py-24">
      <img src={c.image as string} alt={c.imageAlt as string} className="w-full rounded-2xl" />
    </section>
  )
}
