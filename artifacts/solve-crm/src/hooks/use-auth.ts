import { useState, useCallback, useEffect } from 'react';
import type { User } from '@workspace/api-client-react';
import { login as apiLogin } from '@workspace/api-client-react';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: payload.sub as string,
    name: payload.name as string,
    email: payload.email as string,
    role: payload.role as User['role'],
  };
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() >= payload.exp * 1000;
}

function getLandingUser(): User | null {
  try {
    const raw = localStorage.getItem('samora_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; name: string; email: string; role: string };
    return {
      id: parsed.id ?? '',
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      role: (parsed.role === 'admin' ? 'admin' : 'admin') as any,
    };
  } catch {
    return null;
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    // Try to get token from cookie or localStorage (fallback)
    const stored = localStorage.getItem('token');
    if (stored && !isTokenExpired(stored)) return stored;
    localStorage.removeItem('token');
    return null;
  });
  const [user, setUser] = useState<User | null>(() => {
    if (token) return getUserFromToken(token);
    // Fallback: check landing page auth
    return getLandingUser();
  });

  useEffect(() => {
    if (token) {
      if (isTokenExpired(token)) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
      } else {
        setUser(getUserFromToken(token));
      }
    }
  }, [token]);

  const login = useCallback(async (email: string | undefined, password: string, phone?: string) => {
    const body: Record<string, string> = { password };
    if (email) body.email = email;
    if (phone) body.phone = phone;

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include', // Important: send and receive cookies
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Credenciais inválidas' }));
      throw new Error(err.error || 'Credenciais inválidas');
    }

    const data = await response.json();
    const newToken = data.token;
    if (newToken) {
      // Store in localStorage for client-side decoding (cookie is httpOnly)
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(data.user ?? null);
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    // Call logout endpoint to clear httpOnly cookie
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated: (!!token && !!user) || (!!user && !token && !!localStorage.getItem('samora_user')),
  };
}
