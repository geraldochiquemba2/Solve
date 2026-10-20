import { setBaseUrl, setAuthTokenGetter, setOnUnauthorized } from '@workspace/api-client-react';

// Produção: same-origin (string vazia) — o backend é servido no mesmo host,
// por isso a app funciona em qualquer domínio sem reconstruir o bundle.
// Dev: sem VITE_API_URL no .env, aponta à API local.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

setBaseUrl(API_BASE_URL);

setAuthTokenGetter(() => {
  return localStorage.getItem('token');
});

let _isRedirectingToLogin = false;

setOnUnauthorized(async () => {
  if (_isRedirectingToLogin) return;
  _isRedirectingToLogin = true;
  localStorage.removeItem('token');
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  window.location.href = '/login';
});

export { API_BASE_URL };
