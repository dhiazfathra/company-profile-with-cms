import { getGlobal } from '@/lib/content'
import { Img } from '@/components/Img'

export default async function ShowcaseImage() {
  const c = await getGlobal('ShowcaseImage')

  return (
    // The section is 1200x704 in design/refs/ShowcaseImage.png and the image node
    // is 1200x664.29 (per its Figma size badge): full width, with 20px of white
    // above and below and no horizontal padding. At thumbnail size the image
    // looks like it fills the frame corner to corner, which is what led to this
    // section briefly having no padding and a 40px-too-tall image — see the
    // Showcase entry in design/figma.targets.json.
    <section data-section="ShowcaseImage" className="py-5">
      <Img src={c.image as string} alt={c.imageAlt as string} className="w-full rounded-2xl" />
    </section>
  )
}
