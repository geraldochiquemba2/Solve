import { Router, Request, Response } from 'express';

const router = Router();

const RENDER_URL = process.env.RENDER_URL || 'https://solve-sqoh.onrender.com';

async function renderFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${RENDER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Render error ${res.status}: ${text}`);
  }
  return res.json();
}

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await renderFetch('/api/v1/access/stats');
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/terminais', async (_req: Request, res: Response) => {
  try {
    const data = await renderFetch('/api/v1/terminal/status');
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.json({ success: true, data: { nome_terminal: 'Solve Access', online: false, ip: '192.168.1.182', porta: 8080, modelo: 'ZKTeco', tipo: 'Entrada' } });
  }
});

router.get('/clientes', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.busca) params.set('busca', req.query.busca as string);
    if (req.query.pagina) params.set('pagina', req.query.pagina as string);
    if (req.query.por_pagina) params.set('por_pagina', req.query.por_pagina as string);
    const qs = params.toString();
    const data = await renderFetch(`/api/v1/access/clients${qs ? '?' + qs : ''}`);
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/clientes/:id', async (req: Request, res: Response) => {
  try {
    const data = await renderFetch(`/api/v1/access/clients/${req.params.id}`);
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/acessos', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.page) params.set('page', req.query.page as string);
    if (req.query.limit) params.set('limit', req.query.limit as string);
    if (req.query.client_id) params.set('client_id', req.query.client_id as string);
    if (req.query.date_from) params.set('date_from', req.query.date_from as string);
    if (req.query.date_to) params.set('date_to', req.query.date_to as string);
    if (req.query.search) params.set('search', req.query.search as string);
    if (req.query.resultado) params.set('resultado', req.query.resultado as string);
    if (req.query.tipo_acesso) params.set('tipo_acesso', req.query.tipo_acesso as string);
    const qs = params.toString();
    const raw = await renderFetch(`/api/v1/access/logs${qs ? '?' + qs : ''}`) as any;
    res.json({ success: true, data: raw.data ?? raw, pagination: raw.pagination ?? null });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/relatorios/acessos', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.data_inicio) params.set('data_inicio', req.query.data_inicio as string);
    if (req.query.data_fim) params.set('data_fim', req.query.data_fim as string);
    if (req.query.cliente_id) params.set('cliente_id', req.query.cliente_id as string);
    const qs = params.toString();
    const data = await renderFetch(`/api/v1/access/logs${qs ? '?' + qs : ''}`);
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/relatorios/eventos', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limite) params.set('limite', req.query.limite as string);
    const qs = params.toString();
    const data = await renderFetch(`/api/v1/access/logs${qs ? '?' + qs : ''}`);
    res.json({ success: true, data: (data as any).data ?? data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/clientes/:id/ativar-acesso', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { message: 'Acesso activo via Render' } });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/clientes/:id/enroll-digital/:tipo', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { message: 'Enrolamento via catraca local' } });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/clientes/:id/enroll-digital/:tipo/status', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { enrolled: false } });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/terminais/:tipo/unlock', async (req: Request, res: Response) => {
  try {
    const { tipo } = req.params;
    const SOLVE_ACCESS_URL = process.env.SOLVE_ACCESS_URL || 'http://192.168.1.182:8080';
    const door = tipo === 'entrada' ? 1 : 2;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(`${SOLVE_ACCESS_URL}/api/v1/terminal/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ door, tipo }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({ message: 'OK' }));
      res.json({ success: true, data: { message: `Catraca ${tipo} desbloqueada`, response: data } });
    } catch (e: any) {
      res.status(502).json({ success: false, error: `Não foi possível contactar a catraca em ${SOLVE_ACCESS_URL}: ${e.message}` });
    }
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const data = await renderFetch('/healthz');
    res.json({ success: true, data, source: RENDER_URL });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message, source: RENDER_URL });
  }
});

// ─── Real-time: Webhook接收 + SSE Stream ──────────────────────────────────────

interface AccessEvent {
  tipo: string;
  cliente_id: number;
  cliente_nome: string;
  tipo_acesso: string;
  resultado: string;
  mensagem: string;
  hora: string;
  data: string;
}

const sseClients: Set<Response> = new Set();
const eventHistory: AccessEvent[] = [];
const MAX_HISTORY = 50;

router.post('/event', (req: Request, res: Response) => {
  const event: AccessEvent = req.body;
  if (!event || !event.cliente_id) {
    res.status(400).json({ error: 'Invalid event' });
    return;
  }

  eventHistory.unshift(event);
  if (eventHistory.length > MAX_HISTORY) eventHistory.length = MAX_HISTORY;

  for (const client of sseClients) {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }

  res.status(200).json({ ok: true });
});

router.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', history: eventHistory.slice(0, 20) })}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

export default router;
