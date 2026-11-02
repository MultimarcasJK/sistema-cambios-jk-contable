import { Debtor, DebtPayment, Remesa, TransactionDetal, TransactionMayor } from '@/types';
import { getManualEntries, normalizeDebtorName } from './debtor-sync';
import { localDateOf } from './dates';

// Deudas por fecha: separa el saldo de cada deudor en las operaciones que lo forman (ventas
// pendientes o parciales, remesas fiadas y deudas anotadas a mano), cada una con su fecha.
// Los abonos pagan primero las deudas más viejas. Se calcula con las mismas reglas que
// StorageService.syncDebtors, así la suma de lo pendiente da el saldo que muestra Deudores.
// Lógica pura (sin localStorage ni Supabase) para poder probarla.

const r2 = (n: number) => Number((n || 0).toFixed(2));

export type OrigenDeuda = 'venta' | 'remesa' | 'manual' | 'anterior';

export interface DeudaFechada {
  date: string; // YYYY-MM-DD ('' si no se sabe)
  origen: OrigenDeuda;
  descripcion: string;
  monto: number; // lo que se debió en esa operación (USD)
  pendiente: number; // lo que todavía falta de esa operación (USD)
  orden: string; // created_at para desempatar el mismo día
}

export interface DeudasDeCliente {
  items: DeudaFechada[]; // de la más vieja a la más nueva
  totalPendiente: number;
  abonado: number; // abonos aplicados a estas deudas
  aFavor: number; // abonos que sobran (saldo a favor del cliente)
}

export interface FuentesDeuda {
  detalTxs?: TransactionDetal[];
  mayorTxs?: TransactionMayor[];
  remesas?: Remesa[];
  payments?: DebtPayment[];
}

function faltaDeVenta(t: { total_to_pay?: number; payment_status?: string; amount_received?: number }): number {
  const total = t.total_to_pay || 0;
  let pagado = 0;
  if (t.payment_status === 'PAGADO') pagado = total;
  else if (t.payment_status === 'PARCIAL' && t.amount_received) pagado = t.amount_received;
  return total - pagado;
}

export function deudasDeCliente(debtor: Debtor | undefined, clientName: string, fuentes: FuentesDeuda): DeudasDeCliente {
  const name = normalizeDebtorName(clientName || debtor?.client_name);
  const deMismoCliente = (n?: string) => normalizeDebtorName(n) === name;
  const cargos: DeudaFechada[] = [];

  const ventas = [
    ...(fuentes.detalTxs || []).filter(Boolean).map((t) => ({ t, tipo: 'Venta cripto' })),
    ...(fuentes.mayorTxs || []).filter(Boolean).map((t) => ({ t, tipo: 'Venta' })),
  ];
  ventas.forEach(({ t, tipo }) => {
    if (!deMismoCliente(t.client_name)) return;
    const falta = faltaDeVenta(t);
    if (falta <= 0.005) return;
    cargos.push({
      date: t.date || '',
      origen: 'venta',
      descripcion: `${tipo}${t.reference ? ' · ' + t.reference : ''}`,
      monto: r2(falta),
      pendiente: r2(falta),
      orden: t.created_at || '',
    });
  });

  (fuentes.remesas || []).forEach((r) => {
    if (!r || r.estado === 'anulada' || !((r.fiado_usd || 0) > 0) || !deMismoCliente(r.remitente_name)) return;
    cargos.push({
      date: r.date || localDateOf(r.created_at),
      origen: 'remesa',
      descripcion: `Remesa #${r.numero} fiada`,
      monto: r2(r.fiado_usd || 0),
      pendiente: r2(r.fiado_usd || 0),
      orden: r.created_at || '',
    });
  });

  let manualNegativo = 0;
  getManualEntries(debtor?.notes).forEach((e) => {
    if (e.amount < 0) {
      manualNegativo += -e.amount;
      return;
    }
    cargos.push({
      date: e.at ? localDateOf(e.at) : '',
      origen: 'manual',
      descripcion: 'Deuda anotada a mano',
      monto: r2(e.amount),
      pendiente: r2(e.amount),
      orden: e.at || '',
    });
  });

  // Ventas con pago de más (falta negativa) y anotaciones negativas restan como un abono
  const sobrepagos = ventas
    .filter(({ t }) => deMismoCliente(t.client_name))
    .reduce((s, { t }) => s + Math.min(0, faltaDeVenta(t)), 0);
  let abonos =
    (fuentes.payments || []).filter((p) => p && deMismoCliente(p.client_name)).reduce((s, p) => s + (p.amount || 0), 0) -
    sobrepagos +
    manualNegativo;

  // Si el saldo guardado no sale de las operaciones (deuda vieja sin marca), la diferencia
  // se muestra como "saldo anterior" sin fecha, la más vieja de todas.
  if (debtor) {
    const calculado = cargos.reduce((s, c) => s + c.monto, 0) - abonos;
    const diferencia = r2((debtor.current_debt || 0) - calculado);
    if (diferencia > 0.01) {
      cargos.push({ date: '', origen: 'anterior', descripcion: 'Saldo anterior', monto: diferencia, pendiente: diferencia, orden: '' });
    } else if (diferencia < -0.01) {
      abonos += -diferencia;
    }
  }

  cargos.sort((a, b) => a.date.localeCompare(b.date) || a.orden.localeCompare(b.orden));

  let restante = Math.max(0, abonos);
  let abonado = 0;
  cargos.forEach((c) => {
    if (restante <= 0) return;
    const usa = Math.min(restante, c.pendiente);
    c.pendiente = r2(c.pendiente - usa);
    restante -= usa;
    abonado += usa;
  });

  return {
    items: cargos,
    totalPendiente: r2(cargos.reduce((s, c) => s + c.pendiente, 0)),
    abonado: r2(abonado),
    aFavor: r2(restante),
  };
}

export function diasEntre(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0;
  const a = new Date(desde + 'T12:00:00').getTime();
  const b = new Date(hasta + 'T12:00:00').getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export interface AntiguedadDeudas {
  hasta7: number;
  hasta30: number;
  mas30: number;
  sinFecha: number;
  total: number;
}

// Suma lo pendiente por antigüedad (días desde la fecha de cada deuda hasta `hoy`)
export function antiguedad(items: DeudaFechada[], hoy: string): AntiguedadDeudas {
  const res: AntiguedadDeudas = { hasta7: 0, hasta30: 0, mas30: 0, sinFecha: 0, total: 0 };
  items.forEach((c) => {
    if (c.pendiente <= 0) return;
    if (!c.date) res.sinFecha += c.pendiente;
    else {
      const d = diasEntre(c.date, hoy);
      if (d <= 7) res.hasta7 += c.pendiente;
      else if (d <= 30) res.hasta30 += c.pendiente;
      else res.mas30 += c.pendiente;
    }
    res.total += c.pendiente;
  });
  return {
    hasta7: r2(res.hasta7),
    hasta30: r2(res.hasta30),
    mas30: r2(res.mas30),
    sinFecha: r2(res.sinFecha),
    total: r2(res.total),
  };
}

// Antigüedad de todos los deudores que deben (saldo > 0)
export function antiguedadCartera(debtors: Debtor[], fuentes: FuentesDeuda, hoy: string): AntiguedadDeudas {
  const items = debtors
    .filter((d) => d && (d.current_debt || 0) > 0)
    .flatMap((d) => deudasDeCliente(d, d.client_name, fuentes).items);
  return antiguedad(items, hoy);
}
