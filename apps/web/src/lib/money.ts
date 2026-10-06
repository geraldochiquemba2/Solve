const fmt = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 });

export function money(n: number | string | null | undefined): string {
  const value = typeof n === 'string' ? Number(n) : (n || 0);
  return fmt.format(Number.isFinite(value) ? value : 0);
}