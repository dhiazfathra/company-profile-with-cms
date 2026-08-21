/**
 * The `01`/`02`/… markers in FeaturesCarousel and HowItWorks. Derived from the
 * array index, not stored in content: the number is presentation, and storing
 * it would let an editor renumber a list into nonsense.
 */
export const ordinal = (index: number) => String(index + 1).padStart(2, '0')
