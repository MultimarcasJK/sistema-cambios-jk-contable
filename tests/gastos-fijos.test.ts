import { describe, expect, it } from 'vitest';
import { estadoDelMes, resumenMensual, unirGastosFijos, venceEn } from '@/lib/gastos-fijos';
import { packGastoFijo, unpackGastoFijo } from '@/lib/client-fee';
import { GastoFijo, ServiceExpense } from '@/types';

const fijo = (id: string, dia: number, extra: Partial<GastoFijo> = {}): GastoFijo => ({
  id,
  name: id.toUpperCase(),
  category: 'ALQUILER_CUENTAS',
  amount: 50,
  currency: 'USD',
  day_of_month: dia,
  is_active: true,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...extra,
});

const pago = (id: string, date: string, extra: Partial<ServiceExpense> = {}): ServiceExpense => ({
  id,
  date,
  category: 'ALQUILER_CUENTAS',
  description: 'X',
  amount: 50,
  currency: 'USD',
  exchange_rate: 1,
  amount_usd: 50,
  created_at: date + 'T12:00:00.000Z',
  ...extra,
});

describe('gastos fijos del mes', () => {
  it('la marca [FIJO:id] va y vuelve en las notas sin dañarlas', () => {
    const n = packGastoFijo('pagado por zelle', 'fijo-1');
    expect(n).toBe('pagado por zelle [FIJO:fijo-1]');
    expect(unpackGastoFijo(n)).toEqual({ notes: 'pagado por zelle', gasto_fijo_id: 'fijo-1' });
    expect(packGastoFijo('', undefined)).toBe('');
    expect(unpackGastoFijo('solo notas')).toEqual({ notes: 'solo notas' });
  });

  it('el día de pago se ajusta a meses cortos', () => {
    expect(venceEn('2026-02', 31)).toBe('2026-02-28');
    expect(venceEn('2026-10', 5)).toBe('2026-10-05');
  });

  it('marca pagado, vencido y pendiente según los pagos y la fecha', () => {
    const fijos = [fijo('a', 5), fijo('b', 10), fijo('c', 30), fijo('d', 1, { is_active: false }), fijo('e', 1, { deleted: true })];
    const servicios = [
      pago('p1', '2026-10-06', { notes: packGastoFijo('', 'a') }),
      pago('p2', '2026-09-10', { notes: packGastoFijo('', 'b') }), // de otro mes
      pago('p3', '2026-10-02'), // servicio suelto
    ];
    const lista = estadoDelMes(fijos, servicios, '2026-10', '2026-10-28');
    expect(lista.map((x) => [x.fijo.id, x.estado])).toEqual([
      ['b', 'vencido'],
      ['c', 'pendiente'],
      ['a', 'pagado'],
    ]);
    expect(lista.find((x) => x.fijo.id === 'a')!.pagado_usd).toBe(50);
  });

  it('un gasto fijo creado después no sale en meses anteriores', () => {
    const lista = estadoDelMes([fijo('nuevo', 5, { created_at: '2026-10-20T00:00:00.000Z' })], [], '2026-09', '2026-10-28');
    expect(lista).toEqual([]);
  });

  it('resume el mes por categoría y por cuenta', () => {
    const r = resumenMensual(
      [
        pago('1', '2026-10-01', { account_id: 'bdv', currency: 'VES', amount: 4000, amount_usd: 10, category: 'COSTOS_BANCARIOS' }),
        pago('2', '2026-10-03', { account_id: 'bdv', currency: 'VES', amount: 2000, amount_usd: 5, category: 'COSTOS_BANCARIOS' }),
        pago('3', '2026-10-04', { account_id: 'zelle', amount: 50, amount_usd: 50 }),
        pago('4', '2026-09-30', { account_id: 'zelle', amount: 99, amount_usd: 99 }),
      ],
      '2026-10'
    );
    expect(r.total_usd).toBe(65);
    expect(r.count).toBe(3);
    expect(r.porCategoria).toEqual([
      { category: 'ALQUILER_CUENTAS', total_usd: 50, count: 1 },
      { category: 'COSTOS_BANCARIOS', total_usd: 15, count: 2 },
    ]);
    expect(r.porCuenta).toEqual([
      { account_id: 'zelle', currency: 'USD', monto: 50, total_usd: 50, count: 1 },
      { account_id: 'bdv', currency: 'VES', monto: 6000, total_usd: 15, count: 2 },
    ]);
  });

  it('al sincronizar gana la copia editada más reciente, también el borrado', () => {
    const remoto = [fijo('a', 5, { amount: 60, updated_at: '2026-10-02T00:00:00.000Z' }), fijo('b', 5)];
    const local = [
      fijo('a', 5, { amount: 50, updated_at: '2026-10-01T00:00:00.000Z' }),
      fijo('b', 5, { deleted: true, updated_at: '2026-10-05T00:00:00.000Z' }),
      fijo('c', 5),
    ];
    const { merged, subir } = unirGastosFijos(local, remoto);
    expect(merged.find((f) => f.id === 'a')!.amount).toBe(60);
    expect(merged.find((f) => f.id === 'b')!.deleted).toBe(true);
    expect(subir.map((f) => f.id)).toEqual(['b', 'c']);
  });
});
