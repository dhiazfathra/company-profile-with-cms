import Cta from '@/components/Cta'
import { getCollection, getGlobal } from '@/lib/content'

export default async function Specifications() {
  const c = await getGlobal('Specifications')
  const cells = await getCollection('SpecificationsCell')

  // The flat cell list groups into one column per product, ordered by `row`.
  // The three columns share no row axis — each product lists its own features —
  // so they are three independent lists, not a table.
  const columns = [...new Set(cells.map((cell) => cell.column as string))].map((column) => ({
    column,
    rows: cells
      .filter((cell) => cell.column === column)
      .sort((a, b) => (a.row as number) - (b.row as number)),
  }))

  return (
    <section id="specifications" className="px-6 py-16 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-caption text-text-captions">{c.eyebrow as string}</p>
        <h2 className="mt-6 font-display text-4xl leading-[0.9] tracking-[-0.03em] text-text-headline lg:text-h1">
          {c.headline as string}
        </h2>
        <p className="mt-6 font-sans text-paragraph text-text-paragraph">{c.body as string}</p>
        <div className="mt-8">
          <Cta label={c.ctaLabel as string} href={c.ctaHref as string} />
        </div>
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-0">
        {columns.map(({ column, rows }, index) => (
          <div
            key={column}
            className={
              index === 0
                ? 'rounded-[20px] bg-background-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'border-divider-1 lg:border-l'
            }
          >
            <h3
              className={`px-8 py-8 text-center font-sans text-2xl ${
                index === 0 ? 'text-text-headline' : 'text-accent-6'
              }`}
            >
              {column}
            </h3>
            <ul className="border-t border-divider-1">
              {rows.map((cell) => (
                <li
                  key={cell.row as number}
                  className="flex items-center gap-3 border-b border-divider-1 px-8 py-6 last:border-b-0"
                >
                  <img src={cell.icon as string} alt={cell.iconAlt as string} className="h-3.5 w-3.5" />
                  <span className="font-mono text-caption tracking-[-0.12px] text-text-headline">
                    {cell.label as string}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
