import { useState, useEffect, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { CMSProvider } from './context/CMSContext'
import { OrderProvider } from './context/OrderContext'
import { CartProvider } from './context/CartContext'
import Header from './layout/Header'
import Footer from './layout/Footer'
import CookieBanner from './ui/CookieBanner'
import FormModal from './ui/FormModal'
import LegalModal from './ui/LegalModal'
import BackToTopButton from './ui/BackToTopButton'
import ScrollToTop from './ui/ScrollToTop'
import PoliticaPrivacidade from './legal/PoliticaPrivacidade'
import TermosCondicoes from './legal/TermosCondicoes'
import PoliticaCookies from './legal/PoliticaCookies'

function LandingInner({ children }: { children: ReactNode }) {
  const { isDark } = useTheme()
  const [location] = useLocation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const [isCookiesOpen, setIsCookiesOpen] = useState(false)

  const isBackoffice = location.startsWith('/admin')

  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true)
    const handleOpenPrivacy = () => setIsPrivacyOpen(true)
    const handleOpenTerms = () => setIsTermsOpen(true)
    const handleOpenCookies = () => setIsCookiesOpen(true)
    window.addEventListener('openFormModal', handleOpenModal)
    window.addEventListener('openPrivacyModal', handleOpenPrivacy)
    window.addEventListener('openTermsModal', handleOpenTerms)
    window.addEventListener('openCookiesModal', handleOpenCookies)
    return () => {
      window.removeEventListener('openFormModal', handleOpenModal)
      window.removeEventListener('openPrivacyModal', handleOpenPrivacy)
      window.removeEventListener('openTermsModal', handleOpenTerms)
      window.removeEventListener('openCookiesModal', handleOpenCookies)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  return (
    <div
      className="min-h-screen relative overflow-hidden max-w-[1920px] mx-auto w-full shadow-[0_0_100px_rgba(0,0,0,0.1)] flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: isDark ? '#09090b' : '#f5f5f7',
        color: isDark ? '#f4f4f5' : '#18181b',
      }}
    >
      <ScrollToTop />
      {!isBackoffice && <CookieBanner />}
      {!isBackoffice && <FormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      {!isBackoffice && (
        <>
          <LegalModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} title="Política de Privacidade">
            <PoliticaPrivacidade />
          </LegalModal>
          <LegalModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} title="Termos e Condições">
            <TermosCondicoes />
          </LegalModal>
          <LegalModal isOpen={isCookiesOpen} onClose={() => setIsCookiesOpen(false)} title="Política de Cookies">
            <PoliticaCookies />
          </LegalModal>
        </>
      )}
      {!isBackoffice && <Header />}
      <div className="flex-grow">
        {children}
      </div>
      {!isBackoffice && <Footer />}
      {!isBackoffice && <BackToTopButton />}
    </div>
  )
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CMSProvider>
          <OrderProvider>
            <CartProvider>
              <LandingInner>{children}</LandingInner>
            </CartProvider>
          </OrderProvider>
        </CMSProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
