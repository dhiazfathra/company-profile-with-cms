// The one button in the design, in its two observed skins. Not a section: it
// takes props, and every word it renders is passed in from a section's content.
const SKIN = {
  solid: 'bg-accent-1 text-text-on-accent-1',
  soft: 'bg-accent-2 text-text-headline',
} as const

export default function Cta({
  label,
  href,
  variant = 'soft',
}: {
  label: string
  href: string
  variant?: keyof typeof SKIN
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-[22px] py-[14px] font-sans text-link font-bold tracking-[-0.35px] ${SKIN[variant]}`}
    >
      {label}
      {variant === 'solid' ? (
        <img src="/icons/arrow-linkout.svg" alt="" aria-hidden="true" className="h-3 w-3 invert" />
      ) : null}
    </a>
  )
}
