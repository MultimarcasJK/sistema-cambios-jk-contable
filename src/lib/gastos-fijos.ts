import { GastoFijo, ServiceCategory, ServiceExpense } from '@/types';
import { unpackGastoFijo } from './client-fee';

// Gastos fijos mensuales (alquiler de cuentas, costos bancarios…) y resumen del mes.
// Lógica pura (sin localStorage ni Supabase) para poder probarla.

const r2 = (n: number) => Number((n || 0).toFixed(2));

export type EstadoGastoFijo = 'pagado' | 'pendiente' | 'vencido';

export interface GastoFijoDelMes {
  fijo: GastoFijo;
  vence: string; // YYYY-MM-DD
  estado: EstadoGastoFijo;
  pagos: ServiceExpense[]; // pagos de ese mes (normalmente uno)
  pagado_usd: number;
}

// Día de pago dentro del mes; si el mes es más corto (día 31 en febrero) se usa el último día
export function venceEn(mes: string, dia: number): string {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Math.round(dia || 1)), ultimo);
  return `${mes}-${String(d).padStart(2, '0')}`;
}

export function gastoFijoDe(s: ServiceExpense): string | undefined {
  return unpackGastoFijo(s.notes).gasto_fijo_id;
}

// Lista del mes: cada gasto fijo activo con su estado. Los creados después de ese mes no salen
// (salvo que tengan un pago ahí). Orden: vencidos, pendientes por día y al final los pagados.
export function estadoDelMes(fijos: GastoFijo[], servicios: ServiceExpense[], mes: string, hoy: string): GastoFijoDelMes[] {
  const pagosPorFijo = new Map<string, ServiceExpense[]>();
  servicios.forEach((s) => {
    if (!s || !s.date || !s.date.startsWith(mes)) return;
    const id = gastoFijoDe(s);
    if (!id) return;
    pagosPorFijo.set(id, [...(pagosPorFijo.get(id) || []), s]);
  });

  const orden: Record<EstadoGastoFijo, number> = { vencido: 0, pendiente: 1, pagado: 2 };
  return fijos
    .filter((f) => f && !f.deleted)
    .filter((f) => pagosPorFijo.has(f.id) || (f.is_active !== false && (f.created_at || '').slice(0, 7) <= mes))
    .map((f) => {
      const pagos = pagosPorFijo.get(f.id) || [];
      const vence = venceEn(mes, f.day_of_month);
      const estado: EstadoGastoFijo = pagos.length > 0 ? 'pagado' : hoy > vence ? 'vencido' : 'pendiente';
      return { fijo: f, vence, estado, pagos, pagado_usd: r2(pagos.reduce((s, p) => s + (p.amount_usd || 0), 0)) };
    })
    .sort((a, b) => orden[a.estado] - orden[b.estado] || a.vence.localeCompare(b.vence) || a.fijo.name.localeCompare(b.fijo.name));
}

export interface ResumenMensual {
  total_usd: number;
  count: number;
  porCategoria: { category: ServiceCategory; total_usd: number; count: number }[];
  porCuenta: { account_id: string; currency: string; monto: number; total_usd: number; count: number }[];
}

// Lo gastado en servicios y gastos fijos en el mes, por categoría y por cuenta (de mayor a menor)
export function resumenMensual(servicios: ServiceExpense[], mes: string): ResumenMensual {
  const delMes = servicios.filter((s) => s && s.date && s.date.startsWith(mes));
  const cats = new Map<ServiceCategory, { total_usd: number; count: number }>();
  const ctas = new Map<string, { currency: string; monto: number; total_usd: number; count: number }>();
  delMes.forEach((s) => {
    const c = cats.get(s.category) || { total_usd: 0, count: 0 };
    c.total_usd += s.amount_usd || 0;
    c.count += 1;
    cats.set(s.category, c);

    const key = `${s.account_id || ''}|${s.currency}`;
    const a = ctas.get(key) || { currency: s.currency, monto: 0, total_usd: 0, count: 0 };
    a.monto += s.amount || 0;
    a.total_usd += s.amount_usd || 0;
    a.count += 1;
    ctas.set(key, a);
  });
  return {
    total_usd: r2(delMes.reduce((s, x) => s + (x.amount_usd || 0), 0)),
    count: delMes.length,
    porCategoria: Array.from(cats.entries())
      .map(([category, v]) => ({ category, total_usd: r2(v.total_usd), count: v.count }))
      .sort((a, b) => b.total_usd - a.total_usd),
    porCuenta: Array.from(ctas.entries())
      .map(([key, v]) => ({ account_id: key.split('|')[0], currency: v.currency, monto: r2(v.monto), total_usd: r2(v.total_usd), count: v.count }))
      .sort((a, b) => b.total_usd - a.total_usd),
  };
}

// Une la lista local con la de Supabase: gana la copia editada más recientemente
// (borrar también es una edición, por eso el borrado se guarda con deleted: true)
export function unirGastosFijos(local: GastoFijo[], remoto: GastoFijo[]): { merged: GastoFijo[]; subir: GastoFijo[] } {
  const byId = new Map<string, GastoFijo>();
  remoto.forEach((r) => r && r.id && byId.set(r.id, r));
  const subir: GastoFijo[] = [];
  local.forEach((l) => {
    if (!l || !l.id) return;
    const r = byId.get(l.id);
    if (!r || (l.updated_at || '') > (r.updated_at || '')) {
      byId.set(l.id, l);
      subir.push(l);
    }
  });
  return { merged: Array.from(byId.values()), subir };
}
