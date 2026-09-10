const API = 'http://localhost:3000';

async function main() {
  // Simulate frontend login
  const lr = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '999999999', password: '1234567890' }),
  });
  const loginData = await lr.json();
  console.log('Login:', lr.status, loginData.user?.name);
  const token = loginData.token;

  // Simulate what frontend api-client does
  const paymentsUrl = `${API}/api/v1/payments`;
  console.log('Fetching:', paymentsUrl);

  const pr = await fetch(paymentsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payments = await pr.json();
  console.log('Status:', pr.status);
  console.log('Payments count:', payments.data?.length);
  if (payments.data?.length > 0) {
    console.log('First:', payments.data[0].code, payments.data[0].status, payments.data[0].amount + 'kz');
  } else {
    console.log('Response:', JSON.stringify(payments).slice(0, 300));
  }
}

main().catch(console.error);
