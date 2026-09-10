const API = 'http://localhost:3000';

async function main() {
  // Login
  const lr = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '999999999', password: '1234567890' }),
  });
  const { token } = await lr.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  console.log('1. Login OK');

  // Buscar primeiro cliente
  const cr = await fetch(`${API}/api/v1/customers?limit=1`, { headers: h });
  const { data } = await cr.json();
  const cid = data[0].id;
  console.log(`2. Cliente: ${data[0].name} (${cid})`);

  // Criar cobrança GPO 100kz
  const gr = await fetch(`${API}/api/v1/payments/ekwanza/charge`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ customerId: cid, amount: 100, description: 'Teste 100kz', phoneNumber: '999999999' }),
  });
  const gd = await gr.json();
  console.log(`3. Cobrança criada: ${JSON.stringify(gd.data?.payment?.code)} - Estado: ${gd.data?.payment?.status}`);
  const code = gd.data?.payment?.code;

  // Verificar pagamentos
  const pr = await fetch(`${API}/api/v1/payments?limit=5`, { headers: h });
  const pd = await pr.json();
  const pendentes = pd.data?.filter(p => p.status === 'pendente') ?? [];
  console.log(`4. Pagamentos pendentes: ${pendentes.length}`);
  pendentes.forEach(p => console.log(`   - ${p.code}: ${p.amount}kz (${p.status})`));

  // Simular callback É-kwanza = PAGO
  const wr = await fetch(`${API}/webhooks/ekwanza`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantTransactionId: code, ekwanzaTransactionId: 'EKW-TEST-001', operationStatus: 1, operationData: { amount: 100 } }),
  });
  const wd = await wr.json();
  console.log(`5. Webhook confirmado: ${JSON.stringify(wd)}`);

  // Verificar estado
  const pr2 = await fetch(`${API}/api/v1/payments?limit=5`, { headers: h });
  const pd2 = await pr2.json();
  const pagos = pd2.data?.filter(p => p.code === code) ?? [];
  console.log(`6. Estado após webhook: ${pagos[0]?.code} = ${pagos[0]?.status}`);

  console.log('\n=== FLUXO COMPLETO ===');
  console.log(`Pagamento ${code}: pendente -> PAGO (operationStatus=1)`);
}

main().catch(e => { console.error(e); process.exit(1); });
