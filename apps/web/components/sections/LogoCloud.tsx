import { getCollection, getGlobal } from '@/lib/content'
import { Img } from '@/components/Img'

export default async function LogoCloud() {
  const c = await getGlobal('LogoCloud')
  const logos = await getCollection('LogoCloudLogo')

  return (
    <section data-section="LogoCloud" className="px-6 py-[50px] lg:px-12">
      <h2 className="font-sans text-paragraph text-text-paragraph">{c.heading as string}</h2>

      <ul className="mt-8 grid grid-cols-2 items-center justify-items-center gap-x-10 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {logos.map((logo) => (
          <li
            key={logo.logo as string}
            className="flex h-[84px] w-full items-center justify-center"
          >
            <Img
              src={logo.logo as string}
              alt={logo.name as string}
              className="max-h-14 w-auto max-w-full opacity-60"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
