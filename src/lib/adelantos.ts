import { PayrollPayment } from '@/types';

// Adelantos de sueldo: se guardan como un pago de nómina normal (misma tabla en Supabase)
// cuyo período empieza con esta marca. No hace falta otra tabla ni columna.
export const ADELANTO_PREFIX = 'ADELANTO';

export function isAdelanto(p: Pick<PayrollPayment, 'period'> | null | undefined): boolean {
  return !!p && (p.period || '').trim().toUpperCase().startsWith(ADELANTO_PREFIX);
}

export function adelantoPeriod(period: string): string {
  const clean = period.trim();
  return clean ? `${ADELANTO_PREFIX} - ${clean}` : ADELANTO_PREFIX;
}

const registeredAt = (p: PayrollPayment) => p.created_at || p.date || '';

// Marca que se escribe en las notas de un pago de sueldo cuando solo se descontó una parte
// de los adelantos. Los pagos sin esta marca saldan todos los adelantos anteriores (como siempre).
export const ADELANTO_PARCIAL_MARK = 'Adelanto pendiente:';

export function isPartialAdelantoPay(p: Pick<PayrollPayment, 'notes'>): boolean {
  return (p.notes || '').includes(ADELANTO_PARCIAL_MARK);
}

export interface PendingAdelanto {
  payment: PayrollPayment;
  remaining: number;
}

// Recorre los pagos del empleado en orden: cada adelanto suma; un pago de sueldo normal salda
// todo lo pendiente; un pago con descuento parcial resta solo lo descontado (de los más viejos
// primero) y el resto sigue pendiente. Si se anula un pago, sus adelantos vuelven a quedar pendientes.
function pendingDetail(payments: PayrollPayment[], employeeId: string): PendingAdelanto[] {
  const own = payments
    .filter((p) => p.employee_id === employeeId)
    .sort((a, b) => registeredAt(a).localeCompare(registeredAt(b)));
  let queue: PendingAdelanto[] = [];
  for (const p of own) {
    if (isAdelanto(p)) {
      queue.push({ payment: p, remaining: p.net_amount || 0 });
    } else if (isPartialAdelantoPay(p)) {
      let left = p.deductions || 0;
      for (const item of queue) {
        const used = Math.min(item.remaining, left);
        item.remaining = Number((item.remaining - used).toFixed(2));
        left = Number((left - used).toFixed(2));
      }
      queue = queue.filter((item) => item.remaining > 0);
    } else {
      queue = [];
    }
  }
  return queue;
}

// Adelantos que aún no se han descontado del todo
export function pendingAdelantos(payments: PayrollPayment[], employeeId: string): PendingAdelanto[] {
  return pendingDetail(payments, employeeId);
}

// Total pendiente en la moneda pactada del sueldo (net_amount está en esa moneda)
export function pendingAdelantosTotal(payments: PayrollPayment[], employeeId: string): number {
  const total = pendingDetail(payments, employeeId).reduce((s, item) => s + item.remaining, 0);
  return Number(total.toFixed(2));
}
