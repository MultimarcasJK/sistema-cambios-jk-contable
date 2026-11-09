// Ajuste de la tasa de compra por el % al que se compraron los USDT.
// Los bolívares (u otra moneda) se pagan con USDT, y esos USDT se compran en Ecuador
// a veces con % en contra (cada USDT cuesta más de 1 USD) y a veces a favor.
//   pct negativo = en contra (ej. -1.3)  → la tasa real baja
//   pct positivo = a favor   (ej. +0.5)  → la tasa real sube
// tasa real = tasa ÷ (1 − pct/100)   (ej. 200 con -1.3% → 200 ÷ 1.013 = 197.43)

export function parseUsdtPct(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace('%', '').trim());
  if (!Number.isFinite(n) || n <= -100 || n >= 100) return 0;
  return n;
}

export function adjustRateForUsdtPct(rate: number, pct: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return rate;
  if (!pct) return rate;
  return Number((rate / (1 - pct / 100)).toFixed(4));
}

// Monedas cuya tasa es "unidades por 1 USD" y que se pagan con USDT
export function currencyUsesUsdtPct(currency: string): boolean {
  const c = (currency || '').toUpperCase();
  return !!c && c !== 'USD' && c !== 'USDT' && c !== 'EUR';
}

export function usdtPctNote(baseRate: number, pct: number): string {
  if (!pct) return '';
  const sign = pct > 0 ? '+' : '';
  return `% compra USDT ${sign}${pct}% ${pct < 0 ? 'en contra' : 'a favor'} (tasa base ${baseRate})`;
}

// El % del día se recuerda en este navegador para no escribirlo en cada venta
const PCT_KEY = 'cambiosjk_usdt_pct';

export function loadSavedUsdtPct(): string {
  try {
    return (typeof window !== 'undefined' && window.localStorage.getItem(PCT_KEY)) || '';
  } catch {
    return '';
  }
}

export function saveUsdtPct(value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(PCT_KEY, value);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
