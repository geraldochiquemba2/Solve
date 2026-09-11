import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  empresa: z.string().min(2, 'Organização/Instituição obrigatória'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(9, 'Telefone inválido'),
  mensagem: z.string().optional(),
  rgpd: z.boolean().refine((v) => v, 'Deve aceitar a política de privacidade'),
})

type FormData = z.infer<typeof schema>

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    // 1. Tentar enviar para o GoHighLevel
    const ghlWebhookUrl = localStorage.getItem('ghl_webhook_url')
    
    if (ghlWebhookUrl && ghlWebhookUrl.trim() !== '') {
      try {
        await fetch(ghlWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: data.nome,
            email: data.email,
            phone: data.telefone,
            companyName: data.empresa,
            tags: ["landing-page", "alta-performance"],
            source: "Landing Page Bruno Samora",
            customData: {
              aceitou_politica_lei2211: data.rgpd,
              mensagem: data.mensagem
            }
          }),
        })
        console.log('Lead enviada para o GoHighLevel!')
      } catch (error) {
        console.error('Erro ao enviar para o GoHighLevel:', error)
      }
    } else {
      // Sem webhook configurado, simula o tempo
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    
    // 2. Guardar no localStorage para aparecer no Admin
    try {
      const existingLeads = JSON.parse(localStorage.getItem('samora_leads') || '[]')
      const dateStr = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
      const newLead = {
        id: Date.now(),
        name: data.nome,
        email: data.email,
        phone: data.telefone,
        company: data.empresa,
        role: 'Não especificado', // Formulário não tem campo de cargo mas simulamos
        date: dateStr,
        consent: data.rgpd,
      }
      localStorage.setItem('samora_leads', JSON.stringify([newLead, ...existingLeads]))
      // Dispara um evento para o Admin atualizar (opcional)
      window.dispatchEvent(new Event('newLeadAdded'))
    } catch (e) {
      console.error('Erro ao guardar lead:', e)
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <div className="w-20 h-20 bg-[#D71920]/15 border border-[#D71920]/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={36} className="text-[#D71920]" />
        </div>
        <h3 className="font-heading font-black text-zinc-900 dark:text-white text-2xl mb-3">Pedido Enviado!</h3>
        <p className="font-body text-zinc-500 dark:text-zinc-400 text-base leading-relaxed mb-6">
          Obrigado pelo seu interesse! Entraremos em contacto em menos de 24 horas
          para agendar o seu diagnóstico gratuito.
        </p>
        <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm">
          A segurança e privacidade dos seus dados estão garantidas ao abrigo da Lei n.º 22/11 (Angola).
        </p>
      </motion.div>
    )
  }

  return (
    <>
      <h3 className="font-heading font-bold text-zinc-900 dark:text-white text-2xl mb-2">
        Agendar Diagnóstico
      </h3>
      <p className="font-body text-zinc-500 dark:text-zinc-400 text-sm mb-6">
        Preencha o formulário e entraremos em contacto em menos de 24h.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <input
              {...register('nome')}
              placeholder="Nome completo *"
              className="input-field"
              id="form-nome"
            />
            {errors.nome && <p className="text-[#D71920] text-xs mt-1 font-body">{errors.nome.message}</p>}
          </div>
          <div>
            <input
              {...register('empresa')}
              placeholder="Organização ou Instituição *"
              className="input-field"
              id="form-empresa"
            />
            {errors.empresa && <p className="text-[#D71920] text-xs mt-1 font-body">{errors.empresa.message}</p>}
          </div>
        </div>

        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="Email profissional *"
            className="input-field"
            id="form-email"
          />
          {errors.email && <p className="text-[#D71920] text-xs mt-1 font-body">{errors.email.message}</p>}
        </div>

        <div>
          <input
            {...register('telefone')}
            type="tel"
            placeholder="Telefone *"
            className="input-field"
            id="form-telefone"
          />
          {errors.telefone && <p className="text-[#D71920] text-xs mt-1 font-body">{errors.telefone.message}</p>}
        </div>

        <div>
          <textarea
            {...register('mensagem')}
            placeholder="Descreva brevemente o seu desafio (opcional)"
            className="textarea-field"
            id="form-mensagem"
            rows={3}
          />
        </div>

        {/* RGPD */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer group" id="form-rgpd-label">
            <input
              {...register('rgpd')}
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-[#D71920] cursor-pointer"
              id="form-rgpd"
            />
            <span className="font-body text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed group-hover:text-zinc-600 dark:text-zinc-300 transition-colors">
              Aceito a{' '}
              <a 
                href="#privacy" 
                className="text-[#D71920] underline hover:no-underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new Event('openPrivacyModal'));
                }}
              >
                Política de Privacidade
              </a>{' '}
              e o tratamento dos meus dados ao abrigo da Lei n.º 22/11 (Angola).
            </span>
          </label>
          {errors.rgpd && <p className="text-[#D71920] text-xs mt-1 font-body">{errors.rgpd.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full justify-center gap-3 mt-2"
          id="form-submit-btn"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin" />
              A enviar...
            </>
          ) : (
            <>
              Solicitar Contacto
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </>
  )
}
