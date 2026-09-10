import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { LockKeyhole, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    setLocation('/');
    return null;
  }

  const isEmail = identifier.includes('@');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEmail) {
        await login(identifier, password);
      } else {
        await login(undefined, password, identifier);
      }
      setLocation('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Credenciais inválidas';
      toast({ title: 'Erro ao entrar', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--background))' }}>
      <div className="card" style={{ width: 400, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 800, fontSize: '1.1rem', margin: '0 auto .75rem', letterSpacing: '-.08em' }}>SC</div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Solve Corporate</h1>
          <p style={{ fontSize: '.78rem', color: 'hsl(var(--muted-foreground))', marginTop: '.3rem' }}>Acesse o command center</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '.85rem' }}>
          <label>
            <span className="form-label">Email ou Telefone</span>
            <input
              className="input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="seu@email.com ou 999999999"
              required
              autoFocus
            />
          </label>

          <label>
            <span className="form-label">Password</span>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua password"
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !identifier || !password}
            style={{ marginTop: '.25rem' }}
          >
            <LockKeyhole size={14} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.72rem', color: 'hsl(var(--muted-foreground))' }}>
          Problemas de acesso? Contacte o administrador.
        </div>
      </div>
    </div>
  );
}
