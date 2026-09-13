import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Printer } from 'lucide-react';
import { getRecibo, type ReciboResponse } from './api';

const money = (n: number) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(n || 0);

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
}

export default function Recibo() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReciboResponse | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await getRecibo(decodeURIComponent(id || '')));
      } catch (e: any) {
        setErr(e.message || 'Recibo não encontrado.');
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="card" style={{ padding: '1.2rem' }}>A carregar recibo…</div>;
  if (err || !data) {
    return (
      <div className="card" style={{ padding: '1.2rem', display: 'grid', gap: '.6rem' }}>
        <div style={{ fontWeight: 700 }}>Recibo indisponível</div>
        <div className="section-note">{err}</div>
        <Link href="/conta/pagamentos" className="btn-secondary"><ArrowLeft size={14} /> Voltar</Link>
      </div>
    );
  }

  const p: any = data.payment || {};
  const code = p.code || p.id || id;
  const amount = p.amount ?? data.subscription?.price ?? 0;
  const status = p.status || p.state || '—';
  const ref = p.referenceCode || p.reference_code || '—';
  const ent = p.entity || p.entidade || '—';
  const when = p.paidAt || p.paid_at || p.createdAt || p.created_at;

  return (
    <div style={{ display: 'grid', gap: '.8rem' }}>
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <Link href="/conta/pagamentos" className="btn-secondary"><ArrowLeft size={14} /> Pagamentos</Link>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
          <Printer size={14} /> Imprimir
        </button>
      </div>

      <div className="card" style={{ padding: '1.4rem', display: 'grid', gap: '.8rem' }}>
        <div style={{ textAlign: 'center', borderBottom: '1px dashed hsl(var(--border))', paddingBottom: '.9rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 800, margin: '0 auto .5rem' }}>SC</div>
          <div className="eyebrow">Solve Corporate · Recibo</div>
          <div className="mono" style={{ fontWeight: 800, fontSize: '1rem', marginTop: '.2rem' }}>{code}</div>
          <span className={`status status-${String(status).toLowerCase().includes('confirm') ? 'good' : 'pending'}`} style={{ marginTop: '.4rem' }}>{status}</span>
        </div>

        <div style={{ display: 'grid', gap: '.4rem', fontSize: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Cliente</span><strong>{data.customer?.name || '—'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Plano</span><strong>{data.subscription?.planName || '—'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Montante</span><strong className="mono">{money(amount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Método</span><strong>{p.method || '—'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Entidade</span><strong className="mono">{ent}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Referência</span><strong className="mono">{ref}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="section-note">Data</span><strong>{fmtDate(when)}</strong></div>
        </div>

        <div className="section-note" style={{ textAlign: 'center', borderTop: '1px dashed hsl(var(--border))', paddingTop: '.8rem' }}>
          Guarda este recibo como comprovativo de pagamento.
        </div>
      </div>
    </div>
  );
}
