export type StatusTone = 'good' | 'warn' | 'danger' | 'neutral' | 'pending';

export function statusTone(s: string | undefined): StatusTone {
  const v = (s || '').toLowerCase();
  if (v === 'activo' || v === 'ativo' || v.includes('confirm')) return 'good';
  if (v === 'em_dia' || v === 'em dia') return 'good';
  if (v.includes('atraso') || v.includes('bloq') || v.includes('suspens')) return 'danger';
  if (v.includes('pendente') || v.includes('pending')) return 'pending';
  if (v.includes('ambulante') || v.includes('seguimento')) return 'warn';
  return 'neutral';
}

export function statusLabel(state?: string): string {
  const v = (state || 'activo').toLowerCase();
  if (v === 'activo' || v === 'ativo' || v === 'em_dia' || v === 'em dia') return 'Activo';
  if (v === 'em_atraso' || v === 'em atraso') return 'Em atraso';
  if (v.includes('bloq')) return 'Bloqueado';
  if (v.includes('suspens')) return 'Suspenso';
  if (v.includes('inactiv') || v.includes('inativ') || v === 'cancelado') return 'Inactivo';
  if (v.includes('confirm')) return 'Confirmado';
  if (v.includes('pendente')) return 'Pendente';
  if (v.includes('reembols') || v === 'reembolsado') return 'Reembolsado';
  if (v.includes('expirado')) return 'Expirado';
  return state || 'Activo';
}