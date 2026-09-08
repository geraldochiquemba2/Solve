import { Router, Request, Response } from 'express';

const router = Router();

const SOLVE_ACCESS_URL = process.env.SOLVE_ACCESS_URL || 'http://192.168.1.182:8080';
const SOLVE_ACCESS_USER = process.env.SOLVE_ACCESS_USER || 'admin';
const SOLVE_ACCESS_PASS = process.env.SOLVE_ACCESS_PASS || 'admin';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(`${SOLVE_ACCESS_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: SOLVE_ACCESS_USER, senha: SOLVE_ACCESS_PASS }),
  });

  if (!res.ok) throw new Error(`Solve Access login failed: ${res.status}`);
  const data = await res.json() as { token: string };
  cachedToken = data.token;
  tokenExpiry = Date.now() + 30 * 60 * 1000;
  return cachedToken;
}

async function solveAccessFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${SOLVE_ACCESS_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Solve Access error ${res.status}: ${text}`);
  }
  return res.json();
}

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch('/api/dashboard');
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/terminais', async (_req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch('/api/terminais');
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/clientes', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.busca) params.set('busca', req.query.busca as string);
    if (req.query.pagina) params.set('pagina', req.query.pagina as string);
    if (req.query.por_pagina) params.set('por_pagina', req.query.por_pagina as string);
    const qs = params.toString();
    const data = await solveAccessFetch(`/api/clientes${qs ? '?' + qs : ''}`);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/clientes/:id', async (req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch(`/api/clientes/${req.params.id}`);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/acessos', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limite) params.set('limite', req.query.limite as string);
    if (req.query.cliente_id) params.set('cliente_id', req.query.cliente_id as string);
    const qs = params.toString();
    const data = await solveAccessFetch(`/api/acessos${qs ? '?' + qs : ''}`);
    res.json({ success: true, data });
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
    const data = await solveAccessFetch(`/api/relatorios/acessos${qs ? '?' + qs : ''}`);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/relatorios/eventos', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limite) params.set('limite', req.query.limite as string);
    const qs = params.toString();
    const data = await solveAccessFetch(`/api/relatorios/eventos${qs ? '?' + qs : ''}`);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/clientes/:id/ativar-acesso', async (req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch(`/api/clientes/${req.params.id}/ativar-acesso`, {
      method: 'POST',
    });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/clientes/:id/enroll-digital/:tipo', async (req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch(`/api/clientes/${req.params.id}/enroll-digital/${req.params.tipo}`, {
      method: 'POST',
    });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/clientes/:id/enroll-digital/:tipo/status', async (req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch(`/api/clientes/${req.params.id}/enroll-digital/${req.params.tipo}/status`);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.post('/terminais/:tipo/unlock', async (req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch(`/api/terminais/${req.params.tipo}/unlock`, {
      method: 'POST',
    });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const data = await solveAccessFetch('/health');
    res.json({ success: true, data, source: SOLVE_ACCESS_URL });
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message, source: SOLVE_ACCESS_URL });
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
