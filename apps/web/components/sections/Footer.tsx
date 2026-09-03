import { getCollection, getGlobal } from '@/lib/content'
import { Img } from '@/components/Img'

// No reference screenshot exists for this section (Figma MCP quota). Built from
// content/globals/Footer.json and node 1:257 of figma-desktop-tree.xml: a Links
// block (nav items) above a Credits block (logo, then the copyright line).
export default async function Footer() {
  const c = await getGlobal('Footer')
  const links = await getCollection('FooterLink')

  return (
    <footer data-section="Footer" className="border-t border-divider-1 px-6 py-16 lg:px-12">
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-6 lg:gap-10">
          {links.map((link) => (
            <li key={link.href as string}>
              <a
                href={link.href as string}
                className="font-sans text-link font-bold tracking-[-0.35px] text-text-link"
              >
                {link.label as string}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-6">
        <Img src={c.logo as string} alt={c.logoAlt as string} className="h-8 w-auto" />
        <p className="font-sans text-paragraph text-text-paragraph">{c.copyright as string}</p>
      </div>
    </footer>
  )
}
