import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Phone, MessageCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  requestOtp,
  verifyOtp,
  normalizePhone,
  isValidAONumber,
  setPortalSession,
  getPortalToken,
} from './api';

const OTP_TIMEOUT_S = 5 * 60;

function formatTimer(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(1, '0')}:${String(r).padStart(2, '0')}`;
}

export default function ContaLogin() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TIMEOUT_S);

  useEffect(() => {
    if (getPortalToken()) setLocation('/conta');
  }, [setLocation]);

  useEffect(() => {
    if (step !== 2) return;
    setSecondsLeft(OTP_TIMEOUT_S);
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const sendOtp = async () => {
    setMsg('');
    setDevCode(null);
    if (!isValidAONumber(phone)) {
      setMsg('Indica um número válido: 9XXXXXXXX (9 dígitos).');
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(phone);
      setDevCode(res.devCode ?? null);
      setStep(2);
      setCode('');
      setSecondsLeft(res.expiresIn ?? OTP_TIMEOUT_S);
    } catch (e: any) {
      setMsg('Erro: ' + (e.message || 'não foi possível enviar o código'));
    }
    setLoading(false);
  };

  const confirmCode = async () => {
    setMsg('');
    if (!/^\d{6}$/.test(code.trim())) {
      setMsg('O código tem 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(phone, code);
      if (!res.token) throw new Error('Resposta inválida do servidor');
      setPortalSession(res.token, res.customer);
      setLocation('/conta');
    } catch (e: any) {
      setMsg('Erro: ' + (e.message || 'código inválido'));
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'hsl(var(--background))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '1.5rem' }}>
        <div className="eyebrow">Portal do Cliente</div>
        <h1 className="page-title" style={{ marginTop: '.3rem' }}>
          {step === 1 ? 'Entrar com WhatsApp' : 'Confirma o código'}
        </h1>
        <p className="page-subtitle">
          {step === 1
            ? 'Recebe um código de 6 dígitos no teu WhatsApp.'
            : `Enviámos um código para ${normalizePhone(phone)}. Válido por 5 minutos.`}
        </p>

        {devCode && (
          <div data-testid="portal-dev-code" style={{ marginTop: '.8rem', padding: '.6rem .8rem', borderRadius: '.5rem', background: '#FEF3C7', border: '1px solid #F59E0B', fontSize: '.78rem', color: '#92400E' }}>
            <strong>DEV:</strong> o teu código é <span className="mono" style={{ fontWeight: 800 }}>{devCode}</span>
          </div>
        )}

        {step === 1 ? (
          <div style={{ display: 'grid', gap: '.7rem', marginTop: '1rem' }}>
            <label>
              <span className="form-label">Número de telemóvel</span>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'hsl(var(--muted-foreground))' }} />
                <input
                  className="input"
                  data-testid="input-portal-phone"
                  style={{ paddingLeft: 33 }}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendOtp(); }}
                />
              </div>
              <div className="section-note">Formato: 9XXXXXXXX · guardamos como +244…</div>
            </label>
            {msg && <div style={{ fontSize: '.76rem', color: 'hsl(0 70% 50%)' }}>{msg}</div>}
            <button className="btn-primary" data-testid="button-portal-send-otp" onClick={sendOtp} disabled={loading} style={{ width: '100%' }}>
              <MessageCircle size={15} /> {loading ? 'A enviar…' : 'Enviar código WhatsApp'}
            </button>
            <a href="/login" style={{ textAlign: 'center', fontSize: '.74rem', color: 'hsl(var(--muted-foreground))' }}>
              És staff? Entra aqui
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '.7rem', marginTop: '1rem' }}>
            <label>
              <span className="form-label">Código de 6 dígitos</span>
              <input
                className="input mono"
                data-testid="input-portal-code"
                style={{ letterSpacing: '.35em', textAlign: 'center', fontSize: '1.15rem', fontWeight: 700 }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCode(); }}
              />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.74rem', color: 'hsl(var(--muted-foreground))' }}>
              <span className="mono">Expira em {formatTimer(secondsLeft)}</span>
              <button className="btn-quiet" onClick={sendOtp} disabled={loading || secondsLeft > OTP_TIMEOUT_S - 30} title="Reenviar código">
                <RefreshCw size={13} /> Reenviar
              </button>
            </div>
            {msg && <div style={{ fontSize: '.76rem', color: 'hsl(0 70% 50%)' }}>{msg}</div>}
            <button className="btn-primary" data-testid="button-portal-verify" onClick={confirmCode} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'A confirmar…' : 'Confirmar e entrar'}
            </button>
            <button className="btn-secondary" onClick={() => { setStep(1); setMsg(''); setDevCode(null); }} style={{ width: '100%' }}>
              <ArrowLeft size={14} /> Mudar número
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
