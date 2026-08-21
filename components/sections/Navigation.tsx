import Cta from '@/components/Cta'
import { getCollection, getGlobal } from '@/lib/content'

export default async function Navigation() {
  const c = await getGlobal('Navigation')
  const items = await getCollection('NavigationItem')

  return (
    <header className="w-full px-6 pt-8 pb-10 lg:px-12 lg:pt-10 lg:pb-20">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-6">
        <a
          href="#"
          className="font-sans text-2xl font-medium tracking-[-1.5px] text-text-headline lg:text-[30px]"
        >
          {c.logoText as string}
        </a>

        <nav>
          <ul className="flex flex-wrap items-center gap-6 lg:gap-10">
            {items.map((item) => (
              <li key={item.href as string}>
                <a
                  href={item.href as string}
                  className="font-sans text-link font-bold tracking-[-0.35px] text-text-link"
                >
                  {item.label as string}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Cta label={c.ctaLabel as string} href={c.ctaHref as string} variant="solid" />
      </div>
    </header>
  )
}
