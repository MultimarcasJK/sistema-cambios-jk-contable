// Comisión que se le cobra al cliente (ej. $1 en ventas con tasa VIP).
// Supabase no tiene columna para esto, así que se guarda como una marca dentro de "notes".
const TAG_RE = /\s*\[(VIP)?\|?COMCLI:(\d+(?:\.\d+)?)\]\s*/;

export function packClientFee(notes: string | undefined, clientFee?: number, isVip?: boolean): string {
  const clean = (notes || '').replace(TAG_RE, ' ').trim();
  const fee = clientFee && clientFee > 0 ? clientFee : 0;
  if (!fee && !isVip) return clean;
  const tag = `[${isVip ? 'VIP|' : ''}COMCLI:${fee}]`;
  return clean ? `${clean} ${tag}` : tag;
}

export function unpackClientFee(notes: string | undefined): { notes: string; client_fee?: number; is_vip?: boolean } {
  const raw = notes || '';
  const m = raw.match(TAG_RE);
  if (!m) return { notes: raw };
  return {
    notes: raw.replace(TAG_RE, ' ').trim(),
    client_fee: Number(m[2]) || undefined,
    is_vip: m[1] === 'VIP' || undefined,
  };
}

// Gastos/Ingresos: la tabla de Supabase no tiene columnas de moneda ni equivalente en USD,
// así que también viajan como marca dentro de "notes".
const EXP_TAG_RE = /\s*\[MON:([A-Z]{2,5})\|USD:(-?\d+(?:\.\d+)?)\]\s*/;

export function packExpenseMeta(notes: string | undefined, currency?: string, amountUsd?: number): string {
  const clean = (notes || '').replace(EXP_TAG_RE, ' ').trim();
  if (!currency) return clean;
  const tag = `[MON:${currency}|USD:${Number(amountUsd || 0)}]`;
  return clean ? `${clean} ${tag}` : tag;
}

export function unpackExpenseMeta(notes: string | undefined): { notes: string; currency?: string; amount_usd?: number } {
  const raw = notes || '';
  const m = raw.match(EXP_TAG_RE);
  if (!m) return { notes: raw };
  return { notes: raw.replace(EXP_TAG_RE, ' ').trim(), currency: m[1], amount_usd: Number(m[2]) };
}

// Cierres diarios: la tabla solo tiene "net_profit_day", así que el desglose
// (cripto/dólar, regionales, ingresos extra y gastos) viaja como marca dentro de "notes".
const CLOSE_TAG_RE = /\s*\[CIERRE\|D:(-?[\d.]+)\|M:(-?[\d.]+)\|I:(-?[\d.]+)\|G:(-?[\d.]+)(?:\|R:(-?[\d.]+))?\]\s*/;

export interface ClosureBreakdown {
  profit_detal: number;
  profit_mayor: number;
  extra_income: number;
  total_expenses: number;
  profit_remesas?: number;
}

export function packClosureMeta(notes: string | undefined, b: ClosureBreakdown): string {
  const clean = (notes || '').replace(CLOSE_TAG_RE, ' ').trim();
  const n = (x: number) => Number(x || 0);
  const tag = `[CIERRE|D:${n(b.profit_detal)}|M:${n(b.profit_mayor)}|I:${n(b.extra_income)}|G:${n(b.total_expenses)}|R:${n(b.profit_remesas || 0)}]`;
  return clean ? `${clean} ${tag}` : tag;
}

export function unpackClosureMeta(notes: string | undefined): { notes: string } & Partial<ClosureBreakdown> {
  const raw = notes || '';
  const m = raw.match(CLOSE_TAG_RE);
  if (!m) return { notes: raw };
  return {
    notes: raw.replace(CLOSE_TAG_RE, ' ').trim(),
    profit_detal: Number(m[1]) || 0,
    profit_mayor: Number(m[2]) || 0,
    extra_income: Number(m[3]) || 0,
    total_expenses: Number(m[4]) || 0,
    profit_remesas: Number(m[5]) || 0,
  };
}

// Ventas regionales: comisión que sale de la cuenta de salida (en su moneda).
const COMCTA_TAG_RE = /\s*\[COMCTA:(-?\d+(?:\.\d+)?)\]\s*/;

export function packCommissionAccount(notes: string | undefined, commissionAccount?: number): string {
  const clean = (notes || '').replace(COMCTA_TAG_RE, ' ').trim();
  if (commissionAccount === undefined || commissionAccount === null) return clean;
  const tag = `[COMCTA:${Number(commissionAccount || 0)}]`;
  return clean ? `${clean} ${tag}` : tag;
}

export function unpackCommissionAccount(notes: string | undefined): { notes: string; commission_account?: number } {
  const raw = notes || '';
  const m = raw.match(COMCTA_TAG_RE);
  if (!m) return { notes: raw };
  return { notes: raw.replace(COMCTA_TAG_RE, ' ').trim(), commission_account: Number(m[1]) || 0 };
}

// Compras a proveedores: la tabla no guarda la tasa de costo, así que viaja como marca dentro de "notes".
const TASA_TAG_RE = /\s*\[TASA:(-?\d+(?:\.\d+)?(?:e-?\d+)?)\]\s*/;

export function packPurchaseRate(notes: string | undefined, rate?: number): string {
  const clean = (notes || '').replace(TASA_TAG_RE, ' ').trim();
  if (!rate || !(rate > 0)) return clean;
  const tag = `[TASA:${Number(rate)}]`;
  return clean ? `${clean} ${tag}` : tag;
}

export function unpackPurchaseRate(notes: string | undefined): { notes: string; buy_price?: number } {
  const raw = notes || '';
  const m = raw.match(TASA_TAG_RE);
  if (!m) return { notes: raw };
  return { notes: raw.replace(TASA_TAG_RE, ' ').trim(), buy_price: Number(m[1]) || undefined };
}

// Compras guardadas antes de que se guardara la tasa: se recupera de cantidad y costo,
// con la misma fórmula del formulario (USD 1:1, EUR multiplica, el resto divide).
export function rateFromPurchase(currency: string, quantity: number, costUsd: number): number {
  if (currency === 'USD') return 1;
  if (!(quantity > 0) || !(costUsd > 0)) return 0;
  const rate = currency === 'EUR' ? costUsd / quantity : quantity / costUsd;
  return Number(rate.toFixed(4));
}
