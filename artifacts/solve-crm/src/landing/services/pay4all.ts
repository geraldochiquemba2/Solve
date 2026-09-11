export interface CustomerData {
  name: string
  email: string
  phone: string
  address: string
  nif?: string
}

export interface PaymentRequest {
  totalAmount: number
  customer: CustomerData
  items: any[]
}

// TODO: Substituir pelo Endpoint e Chave de API reais da Pay4All
const PAY4ALL_API_URL = 'https://api.pay4all.ao/v1/payments' 
const PAY4ALL_API_KEY = 'SUA_CHAVE_AQUI'

export const createPay4AllPayment = async (data: PaymentRequest) => {
  // --- MOCK IMPLEMENTATION ---
  console.log('[Pay4All API] Iniciando pedido de pagamento...', data)
  
  return new Promise<{ success: boolean; message: string; payment_url?: string }>((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Pagamento gerado com sucesso.',
        payment_url: 'https://pay4all.ao/checkout/mock-id-12345' // Exemplo de URL
      })
    }, 1500)
  })

  // --- REAL IMPLEMENTATION (Descomentar quando tiveres os dados reais) ---
  /*
  try {
    const response = await fetch(PAY4ALL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAY4ALL_API_KEY}`
      },
      body: JSON.stringify({
        amount: data.totalAmount,
        currency: 'AOA', // Ou EUR, consoante a documentação
        customer: data.customer,
        description: 'Compra na Loja Bruno Samora',
        reference: `BS-${Date.now()}`
      })
    })

    if (!response.ok) {
      throw new Error('Erro na comunicação com a API Pay4All')
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[Pay4All API Error]', error)
    throw error
  }
  */
}
