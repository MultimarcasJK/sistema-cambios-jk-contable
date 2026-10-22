import { describe, it, expect } from 'vitest';
import { localDateStr, localDateOf } from '@/lib/dates';

// Corre con TZ=America/Caracas (ver script "test"): 21 de octubre, 9:15 p.m. en Venezuela = 22 en UTC.
describe('fechas en hora local', () => {
  const nochePe = new Date('2026-10-22T01:15:00Z');

  it('usa el día local, no el de UTC', () => {
    expect(localDateStr(nochePe)).toBe('2026-10-21');
  });

  it('convierte created_at a la fecha local', () => {
    expect(localDateOf('2026-10-22T01:15:00Z')).toBe('2026-10-21');
    expect(localDateOf('')).toBe('');
  });
});
