import Benefits from '@/components/sections/Benefits'
import CenteredCta from '@/components/sections/CenteredCta'
import FeaturesCarousel from '@/components/sections/FeaturesCarousel'
import Footer from '@/components/sections/Footer'
import Header from '@/components/sections/Header'
import HowItWorks from '@/components/sections/HowItWorks'
import LogoCloud from '@/components/sections/LogoCloud'
import Navigation from '@/components/sections/Navigation'
import ShowcaseImage from '@/components/sections/ShowcaseImage'
import Specifications from '@/components/sections/Specifications'
import Testimonial from '@/components/sections/Testimonial'

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1">
      <Navigation />
      <main>
        <Header />
        <LogoCloud />
        <Benefits />
        <FeaturesCarousel />
        <Specifications />
        <Testimonial />
        <HowItWorks />
        <ShowcaseImage />
        <CenteredCta />
      </main>
      <Footer />
    </div>
  )
}
