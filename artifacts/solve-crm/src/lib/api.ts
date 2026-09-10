import { setBaseUrl, setAuthTokenGetter, setOnUnauthorized } from '@workspace/api-client-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
