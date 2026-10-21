import { describe, expect, it } from 'vitest';
import { createdAtOf } from '@/lib/supabase-sync';

describe('createdAtOf', () => {
  it('usa created_at si viene de Supabase', () => {
    expect(createdAtOf({ id: 'mayor-1792619066107', created_at: '2026-10-21T10:00:00.000Z' })).toBe(
      '2026-10-21T10:00:00.000Z',
    );
  });

  it('recupera la hora desde el id cuando falta', () => {
    expect(createdAtOf({ id: 'mayor-1792619066107' })).toBe(new Date(1792619066107).toISOString());
    expect(createdAtOf({ id: 'rms-1792619066107-ab12' })).toBe(new Date(1792619066107).toISOString());
  });

  it('no inventa una hora si el id no la trae', () => {
    expect(createdAtOf({ id: 'deb-auto-mayor-CARLOS' })).toBeUndefined();
  });
});
