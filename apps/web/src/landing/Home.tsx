import Hero from './sections/Hero'
import Universo from './sections/Universo'
import BrandShowcase from './sections/BrandShowcase'
import VideoManifesto from './sections/VideoManifesto'
import BrunoSamora from './sections/BrunoSamora'
import Numeros from './sections/Numeros'
import CasosSucesso from './sections/CasosSucesso'
import FAQ from './sections/FAQ'
import CTAFinal from './sections/CTAFinal'

export default function Home() {
  return (
    <main>
      <Hero />
      <Universo />
      <BrandShowcase />
      <VideoManifesto />
      <Numeros />
      <CasosSucesso />
      <BrunoSamora />
      <FAQ />
      <CTAFinal />
    </main>
  )
}
