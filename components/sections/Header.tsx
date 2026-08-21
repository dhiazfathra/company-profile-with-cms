import { getGlobal } from '@/lib/content'

export default async function Header() {
  const c = await getGlobal('Header')

  return (
    <section className="px-6 pb-16 lg:px-12">
      <h1 className="font-display text-5xl leading-[0.9] tracking-[-0.03em] text-text-headline md:text-7xl lg:text-display">
        {c.headline as string}
      </h1>

      {/* The image sits on a mid-green band, as in the Figma header. */}
      <div className="mt-10 rounded-3xl bg-mid-green px-6 pt-10 lg:mt-16 lg:px-16 lg:pt-16">
        <img
          src={c.image as string}
          alt={c.imageAlt as string}
          className="mx-auto block w-full max-w-5xl rounded-t-2xl"
        />
      </div>
    </section>
  )
}
