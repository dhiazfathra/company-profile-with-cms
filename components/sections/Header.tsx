import { getGlobal } from '@/lib/content'

/**
 * Geometry measured off `design/refs/Header.png`, in the 1200x738 design px the
 * section occupies (see `design/refs/refs.json`):
 *
 *   headline   x 64   y 8    143 tall
 *   green band x 0    y 376  1200 x 362, 20px radius on all four corners
 *   laptop     x 149  y 237  904 x 501, so its bottom edge lands on the band's
 *
 * The laptop therefore overhangs the band by 139px at the top and must not be
 * clipped. Its own bottom corners sit 149px inside the band's, so they never
 * reach the band's rounded corners and no clipping is needed anywhere.
 *
 * `c.image` is the laptop alone. It used to be a crop of the band *with* the
 * laptop composited onto it, which this component then placed inside a second
 * band of its own — see docs/decisions/0007 and TOKEN-GAPS.md.
 */
export default async function Header() {
  const c = await getGlobal('Header')

  return (
    <section data-section="Header" className="pt-2">
      {/*
        `lg:tracking-[-8px]` is a font-substitution compensation, not a design
        value. In the reference the headline is one line whose ink is 1068 design
        px wide; set in Crimson Text (what `--font-display` resolves to) at the
        same 160px it advances 1132 px, so it wraps to two lines and the whole
        section comes out 145px too tall. -8px per character is the tracking that
        reproduces the measured 1068. The real fix is identifying the typeface
        the Figma file uses — see TOKEN-GAPS.md.
      */}
      <h1 className="px-6 font-display text-5xl leading-[0.9] tracking-[-0.03em] text-text-headline md:text-7xl lg:px-12 lg:text-display lg:tracking-[-8px]">
        {c.headline as string}
      </h1>

      <div className="relative mt-10 aspect-[1200/362] rounded-[20px] bg-mid-green lg:mt-[225px]">
        <img
          src={c.image as string}
          alt={c.imageAlt as string}
          className="absolute bottom-0 left-1/2 w-[75.333%] -translate-x-1/2"
        />
      </div>
    </section>
  )
}
