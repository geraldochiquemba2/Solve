import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Copy, Check, Eye, RefreshCw } from 'lucide-react';
import { listPagamentos, type PortalPayment } from './api';

const money = (n: number) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(n || 0);

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
}

/** drizzle devolve camelCase (referenceCode, paidAt…); tolera snake_case legado. */
function normPay(p: any) {
  const id = p.id || p.code || '';
  return {
    key: p.id || p.code || Math.random().toString(36),
    reciboId: id,
    code: p.code || p.id || '—',
    amount: p.amount ?? 0,
    method: p.method || '—',
    status: p.status || p.state || '—',
    date: p.paidAt || p.paid_at || p.createdAt || p.created_at || p.date || null,
    ref: p.referenceCode || p.reference_code || p.referencia || null,
    ent: p.entity || p.entidade || null,
  };
}

type Filter = 'todos' | 'pendente' | 'confirmado';

export default function Pagamentos() {
  const [items, setItems] = useState<PortalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      setItems(await listPagamentos(50));
    } catch (e: any) {
      setErr(e.message || 'Falha ao carregar pagamentos.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = items
    .map(normPay)
    .filter((p) => {
      const st = p.status.toLowerCase();
      if (filter === 'pendente') return st.includes('pendente');
      if (filter === 'confirmado') return st.includes('confirm');
      return true;
    });

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div style={{ display: 'grid', gap: '.8rem' }}>
      <div>
        <div className="eyebrow">Portal do Cliente</div>
        <h1 className="page-title">Pagamentos</h1>
        <p className="page-subtitle">{items.length} movimentos na tua conta.</p>
      </div>

      <div className="card" style={{ padding: '.6rem', display: 'flex', gap: '.4rem' }}>
        {(['todos', 'pendente', 'confirmado'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'btn-primary' : 'btn-quiet'}
            style={{ flex: 1, textTransform: 'capitalize' }}
          >
            {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendente' : 'Confirmado'}
          </button>
        ))}
        <button className="btn-quiet" onClick={load} aria-label="Recarregar"><RefreshCw size={15} /></button>
      </div>

      {loading && <div className="card" style={{ padding: '1rem' }}>A carregar…</div>}
      {err && <div className="card" style={{ padding: '1rem', fontSize: '.78rem' }}>{err}</div>}

      <div style={{ display: 'grid', gap: '.6rem' }}>
        {visible.map((p) => {
          const open = expanded === p.key;
          return (
            <div key={p.key} className="card" style={{ padding: '.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: '.72rem', fontWeight: 700 }}>{p.code}</div>
                  <div className="section-note">{fmtDate(p.date)}</div>
                </div>
                <span className={`status status-${p.status.toLowerCase().includes('confirm') ? 'good' : p.status.toLowerCase().includes('pendente') ? 'pending' : 'warn'}`}>{p.status}</span>
                <span className="mono" style={{ fontSize: '.76rem', fontWeight: 800 }}>{p.amount ? money(p.amount) : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', marginTop: '.6rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setExpanded(open ? null : p.key)}>
                  <Eye size={13} /> {open ? 'Ocultar' : 'Ver referência'}
                </button>
                <Link href={`/conta/recibos/${encodeURIComponent(p.reciboId)}`} className="btn-quiet" style={{ border: '1px solid hsl(var(--border))' }}>
                  Recibo
                </Link>
              </div>
              {open && (
                <div className="mono" style={{ marginTop: '.6rem', padding: '.7rem', background: 'hsl(var(--secondary) / .6)', borderRadius: '.5rem', fontSize: '.74rem', display: 'grid', gap: '.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                    <span>Entidade: <strong>{p.ent || '—'}</strong></span>
                    {p.ent && (
                      <button className="btn-quiet" onClick={() => copy(`${p.key}-ent`, String(p.ent))}>
                        {copied === `${p.key}-ent` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                    <span>Referência: <strong>{p.ref || '—'}</strong></span>
                    {p.ref && (
                      <button className="btn-quiet" onClick={() => copy(`${p.key}-ref`, String(p.ref))}>
                        {copied === `${p.key}-ref` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                  <div>Método: {p.method}</div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && visible.length === 0 && (
          <div className="card" style={{ padding: '1.4rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem' }}>Sem movimentos</div>
            <p className="section-note">Nada aqui para este filtro.</p>
          </div>
        )}
      </div>
    </div>
  );
}
