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
