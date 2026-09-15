import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────────────
export interface Program {
  id: string
  name: string
  category: 'Motivação' | 'Formação' | 'Workout' | 'Studio' | 'Outro'
  shortDesc: string
  longDesc: string
  image: string
  duration: string
  level: 'Iniciante' | 'Intermédio' | 'Avançado' | 'Profissional'
  status: 'Ativo' | 'Rascunho' | 'Arquivado'
  tags: string[]
  /** Modalidade de entrega */
  mode: 'online' | 'presencial'
  /** Plataforma de destino após pagamento */
  platform: 'cademi' | 'virtuagym' | 'interno'
  createdAt: string
}

export interface Banner {
  id: string
  type: 'image' | 'video'
  url: string
  title: string
  description: string
  ctaText: string
  ctaLink: string
  status: 'Ativo' | 'Inativo'
  createdAt: string
}

export interface Plan {
  id: string
  programId: string
  name: string
  priceMonthly: number
  priceAnnual: number
  currency: 'AOA' | 'EUR'
  features: string[]
  highlighted: boolean
  status: 'Ativo' | 'Inativo'
  createdAt: string
}

interface CMSContextType {
  programs: Program[]
  plans: Plan[]
  addProgram: (p: Omit<Program, 'id' | 'createdAt'>) => Program
  updateProgram: (id: string, data: Partial<Program>) => void
  deleteProgram: (id: string) => void
  addPlan: (p: Omit<Plan, 'id' | 'createdAt'>) => Plan
  updatePlan: (id: string, data: Partial<Plan>) => void
  deletePlan: (id: string) => void
  getPlansByProgram: (programId: string) => Plan[]
  
  banners: Banner[]
  addBanner: (b: Omit<Banner, 'id' | 'createdAt'>) => Banner
  updateBanner: (id: string, data: Partial<Banner>) => void
  deleteBanner: (id: string) => void
}

const CMSContext = createContext<CMSContextType | undefined>(undefined)

const PROGRAMS_KEY = 'samora_programs'
const PLANS_KEY = 'samora_plans'
const BANNERS_KEY = 'samora_banners'

// ─── DEFAULT SEED DATA ───────────────────────────────────────────────────
const DEFAULT_PROGRAMS: Program[] = [
  {
    id: 'prog-fitmotivacao',
    name: 'FitMotivação',
    category: 'Motivação',
    shortDesc: 'Palestras e workshops de alta performance para equipas e líderes.',
    longDesc: 'Eventos corporativos, palestras keynote e programas de mentoria de liderança.',
    image: '',
    duration: 'Personalizado',
    level: 'Avançado',
    status: 'Ativo',
    tags: ['liderança', 'motivação', 'corporate'],
    mode: 'presencial',
    platform: 'interno',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'prog-formacao',
    name: 'Formação',
    category: 'Formação',
    shortDesc: 'Cursos e certificações de alta performance online.',
    longDesc: 'Formações certificadas para profissionais de fitness e líderes.',
    image: '',
    duration: 'Vitalício',
    level: 'Intermédio',
    status: 'Ativo',
    tags: ['formação', 'certificação', 'online'],
    mode: 'online',
    platform: 'cademi',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'prog-fitworkout',
    name: 'FitWorkout',
    category: 'Workout',
    shortDesc: 'App de treino personalizado com planos mensais e anuais.',
    longDesc: 'Plataforma de treino com vídeos 4K, planos personalizados e comunidade exclusiva.',
    image: '',
    duration: 'Subscrição',
    level: 'Iniciante',
    status: 'Ativo',
    tags: ['treino', 'app', 'fitness'],
    mode: 'online',
    platform: 'virtuagym',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'prog-fitstudio',
    name: 'FitStudio',
    category: 'Studio',
    shortDesc: 'Ginásio boutique privado com equipamento premium.',
    longDesc: 'Espaço de treino exclusivo com Personal Trainer e acesso a SPA e crioterapia.',
    image: '',
    duration: 'Subscrição',
    level: 'Avançado',
    status: 'Ativo',
    tags: ['ginásio', 'premium', 'presencial'],
    mode: 'presencial',
    platform: 'interno',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

const DEFAULT_PLANS: Plan[] = [
  // FitMotivação — contacto (sem plano com preço real, é "Sob Consulta")
  {
    id: 'plan-fitmotivacao-executive',
    programId: 'prog-fitmotivacao',
    name: 'Executive',
    priceMonthly: 0,
    priceAnnual: 0,
    currency: 'AOA',
    features: ['Sessão de diagnóstico (90 min)', '3 sessões 1:1/mês', 'Suporte WhatsApp 24h'],
    highlighted: false,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'plan-fitmotivacao-corporate',
    programId: 'prog-fitmotivacao',
    name: 'Corporate',
    priceMonthly: 0,
    priceAnnual: 0,
    currency: 'AOA',
    features: ['2 workshops mensais', 'Corporate Wellness', 'Dashboard de métricas'],
    highlighted: true,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  // Formação
  {
    id: 'plan-formacao-starter',
    programId: 'prog-formacao',
    name: 'Starter',
    priceMonthly: 15000,
    priceAnnual: 150000,
    currency: 'AOA',
    features: ['1 Curso à escolha', 'Acesso vitalício', 'Certificado digital'],
    highlighted: false,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'plan-formacao-pro',
    programId: 'prog-formacao',
    name: 'Pro',
    priceMonthly: 35000,
    priceAnnual: 350000,
    currency: 'AOA',
    features: ['Acesso a todos os cursos', 'Suporte de mentores', 'Certificado profissional'],
    highlighted: true,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  // FitWorkout
  {
    id: 'plan-fitworkout-basic',
    programId: 'prog-fitworkout',
    name: 'Basic',
    priceMonthly: 3500,
    priceAnnual: 35000,
    currency: 'AOA',
    features: ['Acesso à app', 'Planos de treino', 'Vídeos 4K'],
    highlighted: false,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'plan-fitworkout-elite',
    programId: 'prog-fitworkout',
    name: 'Elite',
    priceMonthly: 8500,
    priceAnnual: 85000,
    currency: 'AOA',
    features: ['Tudo do Basic', 'Plano nutricional', 'Check-in semanal 1:1', 'Comunidade privada'],
    highlighted: true,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  // FitStudio
  {
    id: 'plan-fitstudio-access',
    programId: 'prog-fitstudio',
    name: 'Access',
    priceMonthly: 12000,
    priceAnnual: 120000,
    currency: 'AOA',
    features: ['Acesso livre', 'Equipamento premium', 'Balneários privados'],
    highlighted: false,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'plan-fitstudio-elite',
    programId: 'prog-fitstudio',
    name: 'Elite',
    priceMonthly: 25000,
    priceAnnual: 250000,
    currency: 'AOA',
    features: ['PT incluído (4x/mês)', 'SPA & Crioterapia', 'Plano nutricional', 'Prioridade de reserva'],
    highlighted: true,
    status: 'Ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

const DEFAULT_BANNERS: Banner[] = []

// ─── PROVIDER ────────────────────────────────────────────────────────────
export function CMSProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [banners, setBanners] = useState<Banner[]>([])

  useEffect(() => {
    try {
      const rawP = localStorage.getItem(PROGRAMS_KEY)
      let parsedPrograms: Program[] = rawP ? JSON.parse(rawP) : []
      // Always ensure default programs are present (seed data)
      DEFAULT_PROGRAMS.forEach(dp => {
        if (!parsedPrograms.find((p: Program) => p.id === dp.id)) {
          parsedPrograms.push(dp)
        }
      })
      setPrograms(parsedPrograms)
    } catch {
      setPrograms(DEFAULT_PROGRAMS)
    }
    try {
      const rawPl = localStorage.getItem(PLANS_KEY)
      let parsedPlans: Plan[] = rawPl ? JSON.parse(rawPl) : []
      // Always ensure default plans are present (seed data)
      DEFAULT_PLANS.forEach(dp => {
        if (!parsedPlans.find((p: Plan) => p.id === dp.id)) {
          parsedPlans.push(dp)
        }
      })
      setPlans(parsedPlans)
    } catch {
      setPlans(DEFAULT_PLANS)
    }
    
    try {
      const rawB = localStorage.getItem(BANNERS_KEY)
      setBanners(rawB ? JSON.parse(rawB) : DEFAULT_BANNERS)
    } catch {
      setBanners(DEFAULT_BANNERS)
    }
  }, [])

  const savePrograms = (p: Program[]) => {
    setPrograms(p)
    localStorage.setItem(PROGRAMS_KEY, JSON.stringify(p))
  }
  const savePlans = (p: Plan[]) => {
    setPlans(p)
    localStorage.setItem(PLANS_KEY, JSON.stringify(p))
  }
  const saveBanners = (b: Banner[]) => {
    setBanners(b)
    localStorage.setItem(BANNERS_KEY, JSON.stringify(b))
  }

  const addProgram = (data: Omit<Program, 'id' | 'createdAt'>) => {
    const prog: Program = { ...data, id: `prog-${Date.now()}`, createdAt: new Date().toISOString() }
    savePrograms([...programs, prog])
    return prog
  }
  const updateProgram = (id: string, data: Partial<Program>) =>
    savePrograms(programs.map(p => p.id === id ? { ...p, ...data } : p))
  const deleteProgram = (id: string) =>
    savePrograms(programs.filter(p => p.id !== id))

  const addPlan = (data: Omit<Plan, 'id' | 'createdAt'>) => {
    const plan: Plan = { ...data, id: `plan-${Date.now()}`, createdAt: new Date().toISOString() }
    savePlans([...plans, plan])
    return plan
  }
  const updatePlan = (id: string, data: Partial<Plan>) =>
    savePlans(plans.map(p => p.id === id ? { ...p, ...data } : p))
  const deletePlan = (id: string) =>
    savePlans(plans.filter(p => p.id !== id))

  const getPlansByProgram = (programId: string) =>
    plans.filter(p => p.programId === programId && p.status === 'Ativo')

  const addBanner = (data: Omit<Banner, 'id' | 'createdAt'>) => {
    const banner: Banner = { ...data, id: `banner-${Date.now()}`, createdAt: new Date().toISOString() }
    saveBanners([...banners, banner])
    return banner
  }
  const updateBanner = (id: string, data: Partial<Banner>) =>
    saveBanners(banners.map(b => b.id === id ? { ...b, ...data } : b))
  const deleteBanner = (id: string) =>
    saveBanners(banners.filter(b => b.id !== id))

  return (
    <CMSContext.Provider value={{ 
      programs, plans, addProgram, updateProgram, deleteProgram, 
      addPlan, updatePlan, deletePlan, getPlansByProgram,
      banners, addBanner, updateBanner, deleteBanner 
    }}>
      {children}
    </CMSContext.Provider>
  )
}

export function useCMS() {
  const ctx = useContext(CMSContext)
  if (!ctx) throw new Error('useCMS must be used within CMSProvider')
  return ctx
}
