/**
 * Serviço Cademi — Plataforma de Cursos Online (LMS)
 * 
 * Programas: FitMotivação, FitWorkout, Formações Online
 * 
 * IMPORTANTE: Este serviço deve ser chamado EXCLUSIVAMENTE pelo Backend/Serverless
 * após a confirmação do Webhook do Pay4All (payment.confirmed).
 * NUNCA chamar directamente do Frontend.
 * 
 * Documentação oficial: https://api.cademi.com.br/docs
 */

export interface CademiStudent {
  name: string
  email: string
  phone?: string
  /** ID externo para mapeamento com o nosso CRM (order_id do Pay4All) */
  external_id?: string
}

export interface CademiEnrollment {
  student_email: string
  /** ID do curso no Cademi — deve ser mapeado a partir do plan_id interno */
  course_id: string
}

export interface CademiResponse {
  success: boolean
  student_id?: string
  enrollment_id?: string
  message: string
  error?: string
}

// TODO (Backend): Substituir pelos valores reais nas variáveis de ambiente do servidor
const CADEMI_API_URL = 'https://api.cademi.com.br/v1' // process.env.CADEMI_API_URL
const CADEMI_API_TOKEN = 'SEU_TOKEN_AQUI'              // process.env.CADEMI_API_TOKEN

/**
 * Cria ou actualiza um aluno no Cademi.
 * Verifica se o email já existe antes de criar (anti-duplicação).
 */
export const cademiCreateStudent = async (student: CademiStudent): Promise<CademiResponse> => {
  // --- MOCK IMPLEMENTATION ---
  console.log('[Cademi] Criar aluno:', student)
  return {
    success: true,
    student_id: `cademi-student-${Date.now()}`,
    message: 'Aluno criado com sucesso (mock).',
  }

  // --- REAL IMPLEMENTATION ---
  /*
  try {
    // 1. Verifica se o aluno já existe
    const checkRes = await fetch(`${CADEMI_API_URL}/students?email=${encodeURIComponent(student.email)}`, {
      headers: { 'Authorization': `Bearer ${CADEMI_API_TOKEN}`, 'Content-Type': 'application/json' }
    })
    const existing = await checkRes.json()

    if (existing?.data?.length > 0) {
      return { success: true, student_id: existing.data[0].id, message: 'Aluno já existe.' }
    }

    // 2. Cria o aluno
    const res = await fetch(`${CADEMI_API_URL}/students`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CADEMI_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    })
    const data = await res.json()
    return { success: true, student_id: data.id, message: 'Aluno criado.' }
  } catch (error: any) {
    console.error('[Cademi Error]', error)
    return { success: false, message: 'Erro ao criar aluno.', error: error.message }
  }
  */
}

/**
 * Matricula um aluno num curso específico do Cademi.
 * Deve ser chamado após cademiCreateStudent() com sucesso.
 */
export const cademiEnrollStudent = async (enrollment: CademiEnrollment): Promise<CademiResponse> => {
  // --- MOCK IMPLEMENTATION ---
  console.log('[Cademi] Matricular aluno:', enrollment)
  return {
    success: true,
    enrollment_id: `cademi-enroll-${Date.now()}`,
    message: 'Aluno matriculado com sucesso (mock).',
  }

  // --- REAL IMPLEMENTATION ---
  /*
  try {
    const res = await fetch(`${CADEMI_API_URL}/enrollments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CADEMI_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(enrollment)
    })
    const data = await res.json()
    return { success: true, enrollment_id: data.id, message: 'Matriculado com sucesso.' }
  } catch (error: any) {
    console.error('[Cademi Enrollment Error]', error)
    return { success: false, message: 'Erro na matrícula.', error: error.message }
  }
  */
}
