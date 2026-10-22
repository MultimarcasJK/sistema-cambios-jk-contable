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
