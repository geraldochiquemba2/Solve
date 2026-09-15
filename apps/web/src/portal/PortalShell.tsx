import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut, UserRound, ReceiptText, Home } from 'lucide-react';
import { clearPortalSession, getPortalCustomer } from './api';

export default function PortalShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const customer: any = getPortalCustomer();

  const logout = () => {
    clearPortalSession();
    setLocation('/conta/login');
  };

  const tabs = [
    { href: '/conta', label: 'Conta', icon: Home, active: location === '/conta' },
    { href: '/conta/pagamentos', label: 'Pagamentos', icon: ReceiptText, active: location.startsWith('/conta/pagamentos') || location.startsWith('/conta/recibos') },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'hsl(var(--card) / .92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid hsl(var(--border))' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '.7rem 1rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: 'white', fontWeight: 800, fontSize: '.75rem' }}>SC</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {customer?.name || 'A minha conta'}
            </div>
            <div style={{ fontSize: '.66rem', color: 'hsl(var(--muted-foreground))' }}>Portal do Cliente</div>
          </div>
          <button className="btn-quiet" onClick={logout} aria-label="Sair do portal">
            <LogOut size={15} /> <span className="desktop-only">Sair</span>
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '1rem 1rem 5.5rem' }}>{children}</main>

      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'hsl(var(--card) / .96)', backdropFilter: 'blur(10px)', borderTop: '1px solid hsl(var(--border))' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '.5rem .8rem calc(.5rem + env(safe-area-inset-bottom))', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' }}>
          {tabs.map((t) => {
            const I = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem',
                  padding: '.65rem', borderRadius: '.55rem', fontSize: '.8rem', fontWeight: 700,
                  background: t.active ? 'hsl(var(--primary))' : 'transparent',
                  color: t.active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                }}
              >
                <I size={16} /> {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div style={{ display: 'none' }}>
        <UserRound size={1} />
      </div>
    </div>
  );
}
