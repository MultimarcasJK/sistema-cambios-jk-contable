import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '@/lib/storage';
import { AuditService } from '@/lib/audit';
import { DailyReport } from '@/types';

const reporte = (cuadre: DailyReport['cuadre']) =>
  ({
    id: 'rep-mayor-2026-10-28-1',
    date: '2026-10-28',
    mode: 'mayor',
    operadora: 'CAMBIOS JK',
    created_at: '2026-10-29T02:00:00.000Z',
    ganancia: { neta: 443.33 },
    cuadre,
    cuadra: cuadre.length === 0 ? null : false,
  }) as unknown as DailyReport;

describe('reporte del día en la bitácora', () => {
  beforeEach(() => localStorage.clear());

  it('anota el reporte y luego su actualización', async () => {
    await StorageService.saveDailyReport(reporte([]), 'mayor');
    await StorageService.saveDailyReport(
      reporte([{ account_id: 'a', name: 'ZELLE', currency: 'USD', sistema: -1110, real: -1100, diferencia: 10 }] as any),
      'mayor'
    );
    const filas = AuditService.getEntries('mayor').filter((e) => e.action === 'reporte');
    expect(filas).toHaveLength(2);
    const textos = filas.map((e) => e.summary);
    expect(textos).toContain('Reporte del día 2026-10-28: neto 443.33 USD, sin cuadre de caja.');
    expect(textos).toContain('Reporte del día actualizado 2026-10-28: neto 443.33 USD, 1 de 1 cuentas con diferencia.');
  });
});
