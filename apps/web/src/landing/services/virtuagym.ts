/**
 * Serviço Virtuagym — Plataforma de Gestão de Ginásio
 * 
 * Programas: FitStudio (Presencial — Reservas e acesso ao clube)
 * 
 * IMPORTANTE: Este serviço deve ser chamado EXCLUSIVAMENTE pelo Backend/Serverless
 * após a confirmação do Webhook do Pay4All (payment.confirmed).
 * NUNCA chamar directamente do Frontend.
 * 
 * Documentação oficial: https://api.virtuagym.com/docs/api/v1
 */

export interface VirtuagymMember {
  firstname: string
  lastname: string
  email: string
  phone?: string
  /** ID externo para mapeamento com o nosso CRM (order_id) */
  external_id?: string
}

export interface VirtuagymMembership {
  member_id: string
  /** ID do tipo de plano no Virtuagym — mapeado a partir do plan_id interno */
  membership_type_id: string
  start_date: string
}

export interface VirtuagymResponse {
  success: boolean
  member_id?: string
  membership_id?: string
  message: string
  error?: string
}

// TODO (Backend): Substituir pelos valores reais nas variáveis de ambiente do servidor
const VIRTUAGYM_API_URL = 'https://api.virtuagym.com/api/v1' // process.env.VIRTUAGYM_API_URL
const VIRTUAGYM_API_KEY = 'SEU_API_KEY_AQUI'                 // process.env.VIRTUAGYM_API_KEY
const VIRTUAGYM_CLUB_ID = 'SEU_CLUB_ID_AQUI'                 // process.env.VIRTUAGYM_CLUB_ID

/**
 * Cria um membro no Virtuagym.
 * Verifica se o email já existe antes de criar (anti-duplicação).
 */
export const virtuagymCreateMember = async (member: VirtuagymMember): Promise<VirtuagymResponse> => {
  // --- MOCK IMPLEMENTATION ---
  console.log('[Virtuagym] Criar membro:', member)
  return {
    success: true,
    member_id: `vg-member-${Date.now()}`,
    message: 'Membro criado com sucesso (mock).',
  }

  // --- REAL IMPLEMENTATION ---
  /*
  try {
    // 1. Verifica se o membro já existe pelo email
    const checkRes = await fetch(`${VIRTUAGYM_API_URL}/club/${VIRTUAGYM_CLUB_ID}/member?email=${encodeURIComponent(member.email)}`, {
      headers: { 'Authorization': `Bearer ${VIRTUAGYM_API_KEY}`, 'Content-Type': 'application/json' }
    })
    const existing = await checkRes.json()

    if (existing?.member_id) {
      return { success: true, member_id: existing.member_id, message: 'Membro já existe.' }
    }

    // 2. Cria o membro
    const nameParts = `${member.firstname} ${member.lastname}`.split(' ')
    const res = await fetch(`${VIRTUAGYM_API_URL}/club/${VIRTUAGYM_CLUB_ID}/member`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VIRTUAGYM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstname: member.firstname,
        lastname: member.lastname || nameParts.slice(1).join(' '),
        email: member.email,
        phone: member.phone,
        external_id: member.external_id,
      })
    })
    const data = await res.json()
    return { success: true, member_id: data.member_id, message: 'Membro criado.' }
  } catch (error: any) {
    console.error('[Virtuagym Error]', error)
    return { success: false, message: 'Erro ao criar membro.', error: error.message }
  }
  */
}

/**
 * Atribui um plano de sócio a um membro no Virtuagym.
 * Deve ser chamado após virtuagymCreateMember() com sucesso.
 */
export const virtuagymAssignMembership = async (membership: VirtuagymMembership): Promise<VirtuagymResponse> => {
  // --- MOCK IMPLEMENTATION ---
  console.log('[Virtuagym] Atribuir plano:', membership)
  return {
    success: true,
    membership_id: `vg-membership-${Date.now()}`,
    message: 'Plano atribuído com sucesso (mock).',
  }

  // --- REAL IMPLEMENTATION ---
  /*
  try {
    const res = await fetch(`${VIRTUAGYM_API_URL}/club/${VIRTUAGYM_CLUB_ID}/membership`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VIRTUAGYM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(membership)
    })
    const data = await res.json()
    return { success: true, membership_id: data.membership_id, message: 'Plano atribuído.' }
  } catch (error: any) {
    console.error('[Virtuagym Membership Error]', error)
    return { success: false, message: 'Erro ao atribuir plano.', error: error.message }
  }
  */
}
