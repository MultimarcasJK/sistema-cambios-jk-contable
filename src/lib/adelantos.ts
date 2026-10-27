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

// Adelantos que aún no se han descontado: los registrados después del último pago de sueldo
// (no adelanto) del empleado. Si se anula ese pago, sus adelantos vuelven a quedar pendientes.
export function pendingAdelantos(payments: PayrollPayment[], employeeId: string): PayrollPayment[] {
  const own = payments.filter((p) => p.employee_id === employeeId);
  const lastPay = own
    .filter((p) => !isAdelanto(p))
    .reduce((max, p) => (registeredAt(p) > max ? registeredAt(p) : max), '');
  return own
    .filter((p) => isAdelanto(p) && registeredAt(p) > lastPay)
    .sort((a, b) => registeredAt(a).localeCompare(registeredAt(b)));
}

// Total pendiente en la moneda pactada del sueldo (net_amount está en esa moneda)
export function pendingAdelantosTotal(payments: PayrollPayment[], employeeId: string): number {
  const total = pendingAdelantos(payments, employeeId).reduce((s, p) => s + (p.net_amount || 0), 0);
  return Number(total.toFixed(2));
}
