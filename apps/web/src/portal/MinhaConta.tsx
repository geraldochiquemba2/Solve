import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Zap, Copy, Check, RefreshCw, ReceiptText, WalletCards } from 'lucide-react';
import {
  getMinhaConta,
  listPagamentos,
  pagar,
  isValidAONumber,
  type MinhaContaResponse,
  type PortalPayment,
} from './api';

const money = (n: number) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(n || 0);

function statusTone(s: string): 'good' | 'warn' | 'danger' | 'neutral' | 'pending' {
  const v = (s || '').toLowerCase();
  if (v === 'activo' || v === 'ativo' || v.includes('confirm')) return 'good';
  if (v.includes('atraso') || v.includes('bloq') || v.includes('suspens')) return 'danger';
  if (v.includes('pendente')) return 'pending';
  return 'warn';
}

function statusLabel(state?: string): string {
  const v = (state || 'activo').toLowerCase();
  if (v === 'activo' || v === 'ativo') return 'Activo';
  if (v === 'em_atraso' || v === 'em atraso') return 'Em atraso';
  if (v.includes('bloq')) return 'Bloqueado';
  if (v.includes('suspens')) return 'Suspenso';
  if (v.includes('inactiv') || v.includes('inativ')) return 'Inactivo';
  return state || 'Activo';
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

/** Normaliza linha de pagamento (drizzle devolve camelCase; legado pode vir snake_case). */
function normPay(p: any) {
  return {
    key: p.id || p.code || Math.random().toString(36),
    reciboId: p.id || p.code || '',
    code: p.code || p.id || '',
    amount: p.amount ?? 0,
    status: p.status || p.state || 'pendente',
    date: p.paidAt || p.paid_at || p.createdAt || p.created_at || p.date || null,
  };
}

export default function MinhaConta() {
  const [conta, setConta] = useState<MinhaContaResponse | null>(null);
  const [recent, setRecent] = useState<PortalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRef, setLastRef] = useState<{ entity: string | null; reference: string } | null>(null);
  // Qualquer número pode pagar o Express (ex: familiar). Pré-preenche com o da conta.
  const [expressPhone, setExpressPhone] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [c, pays] = await Promise.all([getMinhaConta(), listPagamentos(5).catch(() => [])]);
      setConta(c);
      setRecent(pays || []);
      // Pré-preenche o número Express com o da conta (editável para qualquer número).
      if (c?.customer?.phone) setExpressPhone((prev) => prev || c.customer.phone || '');
    } catch (e: any) {
      setErr(e.message || 'Não foi possível carregar a conta.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const aulas = conta?.aulas;
  const pct = useMemo(() => {
    if (!aulas || aulas.limite === null || !aulas.limite) return null;
    if (aulas.restantes === null) return null;
    return Math.max(0, Math.min(100, (aulas.restantes / aulas.limite) * 100));
  }, [aulas]);

  const planName = conta?.subscription?.planName || '—';
  const validity = conta?.subscription?.endDate || null;
  const nextAmount = conta?.proximaMensalidade?.amount ?? null;
  const nextDue = conta?.proximaMensalidade?.dueDate || null;

  const doPagar = async (method: 'express' | 'referencia') => {
    setPaying(true);
    setPayMsg('');
    try {
      // Express aceita qualquer número AO — valida antes de chamar a API.
      const phoneToUse = method === 'express' ? expressPhone.trim() : undefined;
      if (method === 'express' && phoneToUse && !isValidAONumber(phoneToUse)) {
        setPayMsg('Erro: número Express inválido (usa 9XXXXXXXX).');
        setPaying(false);
        return;
      }
      const r = await pagar(method, undefined, phoneToUse);
      if (method === 'express') {
        setPayMsg(
          r.payment.status === 'confirmado'
            ? `Pagamento confirmado (${r.payment.code}).`
            : `Pedido Express enviado para ${phoneToUse || 'o teu número'} (${r.payment.code}). Confirma no telemóvel — o estado actualiza ao recarregar.`,
        );
      } else {
        setLastRef(r.referencia ? { entity: r.referencia.entity, reference: r.referencia.reference } : null);
        setPayMsg(
          r.referencia
            ? `Referência ${r.referencia.reference}${r.referencia.entity ? ` · Entidade ${r.referencia.entity}` : ''} · expira ${fmtDate(r.referencia.expiresAt)}`
            : `Referência criada (${r.payment.code}).`,
        );
      }
      const pays = await listPagamentos(5).catch(() => []);
      setRecent(pays || []);
    } catch (e: any) {
      setPayMsg('Erro: ' + (e.message || 'falha ao criar pagamento'));
    }
    setPaying(false);
  };

  const copyRef = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) return <div className="card" style={{ padding: '1.2rem' }}>A carregar a tua conta…</div>;
  if (err) {
    return (
      <div className="card" style={{ padding: '1.2rem', display: 'grid', gap: '.6rem' }}>
        <div style={{ fontWeight: 700 }}>Não conseguimos carregar a conta</div>
        <div className="section-note">{err}</div>
        <button className="btn-secondary" onClick={load}><RefreshCw size={14} /> Tentar de novo</button>
      </div>
    );
  }
  if (!conta) return null;

  const state = statusLabel(conta.customer?.state);

  return (
    <div style={{ display: 'grid', gap: '.8rem' }}>
      <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 800 }}>
          {(conta.customer?.name || 'C').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{conta.customer?.name}</div>
          <div className="section-note">{conta.customer?.phone || ''}</div>
        </div>
        <span className={`status status-${statusTone(state)}`}>{state}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="eyebrow">Plano</div>
          <div style={{ fontWeight: 800, fontSize: '.9rem', marginTop: '.3rem' }}>{planName}</div>
          <div className="section-note">Válido até {fmtDate(validity)}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="eyebrow">Aulas</div>
          <div style={{ fontWeight: 800, fontSize: '.9rem', marginTop: '.3rem' }}>
            {aulas?.limite === null || aulas?.limite === undefined
              ? '—'
              : `${aulas?.restantes ?? '—'} / ${aulas?.limite}`}
          </div>
          <div className="section-note">restantes / limite</div>
          {pct !== null && (
            <div className="progress-track" style={{ marginTop: '.5rem' }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: (aulas?.restantes ?? 1) === 0 ? 'hsl(0 70% 50%)' : undefined }} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1.1rem', display: 'grid', gap: '.7rem' }}>
        <div>
          <div className="eyebrow">Próxima mensalidade</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginTop: '.25rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.3rem' }}>{nextAmount ? money(nextAmount) : '—'}</span>
            {nextDue && <span className="section-note">vence {fmtDate(nextDue)}</span>}
          </div>
          {!nextAmount && <div className="section-note">Sem mensalidade pendente de momento.</div>}
          {lastRef && (
            <div className="mono" style={{ fontSize: '.72rem', marginTop: '.4rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Ref: {lastRef.reference}{lastRef.entity ? ` · Ent: ${lastRef.entity}` : ''}</span>
              <button className="btn-quiet" onClick={() => copyRef(lastRef.reference)} aria-label="Copiar referência">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="express-phone">Número Multicaixa Express</label>
          <input
            id="express-phone"
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="9XXXXXXXX — pode ser outro número"
            value={expressPhone}
            onChange={(e) => setExpressPhone(e.target.value)}
            style={{ marginTop: '.35rem' }}
          />
          <div className="section-note" style={{ marginTop: '.25rem' }}>
            O pedido Express vai para este número — pode ser o teu ou de outra pessoa.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
          <button className="btn-primary" data-testid="button-portal-pay-express" onClick={() => doPagar('express')} disabled={paying || !nextAmount}>
            <Zap size={14} /> {paying ? 'A processar…' : 'Pagar Express'}
          </button>
          <button className="btn-secondary" data-testid="button-portal-pay-ref" onClick={() => doPagar('referencia')} disabled={paying || !nextAmount}>
            <WalletCards size={14} /> Gerar Referência
          </button>
        </div>
        {payMsg && <div style={{ fontSize: '.76rem' }}>{payMsg}</div>}
      </div>

      <section className="card" style={{ padding: '1.1rem' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Histórico recente</h2>
            <p className="section-note">Últimos 5 movimentos</p>
          </div>
          <Link href="/conta/pagamentos" className="btn-quiet"><ReceiptText size={14} /> Ver tudo</Link>
        </div>
        <div style={{ display: 'grid', gap: '.5rem' }}>
          {recent.length === 0 && <div className="section-note">Sem movimentos ainda.</div>}
          {recent.map((p: any) => {
            const n = normPay(p);
            return (
              <Link key={n.key} href={`/conta/recibos/${encodeURIComponent(n.reciboId)}`} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem', background: 'hsl(var(--secondary) / .55)', borderRadius: '.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: '.72rem', fontWeight: 700 }}>{n.code}</div>
                  <div className="section-note">{fmtDate(n.date)}</div>
                </div>
                <span className={`status status-${statusTone(n.status)}`}>{n.status}</span>
                <span className="mono" style={{ fontSize: '.74rem', fontWeight: 700 }}>{n.amount ? money(n.amount) : ''}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
