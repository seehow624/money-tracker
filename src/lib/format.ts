export function fmtMyr(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function currencySymbol(code: string): string {
  return code === 'MYR' ? 'RM' : code;
}

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('en-MY', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  return iso;
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function dayOfMonth(): number {
  return new Date().getDate();
}
