import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';

export type Notificacao = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  leadId?: string | null;
  read: boolean;
  createdAt: string;
};

const API_BASE = () => import.meta.env.VITE_API_URL || '';
const POLL_MS = 30000;

function headers(): HeadersInit {
  try {
    const t = localStorage.getItem('token');
    if (t) return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  } catch {}
  return { 'X-API-Key': import.meta.env.VITE_ACCESS_API_KEY || '', 'Content-Type': 'application/json' };
}

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${API_BASE()}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { ...headers(), ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
  return j;
}

// Sino de notificações: avisa a equipa quando entra uma lead nova (Fit90,
// balcão, formulário) e quando uma lead lhe é atribuída.
// Poll de 30s — o mesmo cadência que o resumo de leads já usava, para não
// multiplicar requests no servidor.
export function useNotifications(enabled = true) {
  const [items, setItems] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  // IDs já vistos: só avisamos em toast o que é novo, nunca o histórico.
  const vistos = useRef<Set<string>>(new Set());
  const primeiraCarga = useRef(true);

  const carregar = useCallback(async (avisar = false) => {
    try {
      const j = await api('/api/v1/notifications?limit=20');
      const lista: Notificacao[] = Array.isArray(j?.data) ? j.data : [];
      setItems(lista);
      setUnread(Number(j?.unread) || 0);
      setErro(null);
      if (avisar && !primeiraCarga.current) {
        for (const n of lista) {
          if (n.read) continue;
          if (vistos.current.has(n.id)) continue;
          vistos.current.add(n.id);
          toast({ title: n.title, description: n.body || undefined });
        }
      }
      // Marca como vistos para o toast não repetir no próximo poll.
      for (const n of lista) vistos.current.add(n.id);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar as notificações');
    } finally {
      primeiraCarga.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    carregar(true);
    const t = setInterval(() => carregar(true), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, carregar]);

  const marcarLida = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnread(u => Math.max(0, u - 1));
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: 'POST' });
    } catch {
      carregar(false);
    }
  }, [carregar]);

  const marcarTodasLidas = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    try {
      await api('/api/v1/notifications/read-all', { method: 'POST' });
    } catch {
      carregar(false);
    }
  }, [carregar]);

  return { items, unread, erro, carregar, marcarLida, marcarTodasLidas };
}
