import { describe, expect, it } from 'vitest';
import { newestFirst } from '@/lib/order';

describe('newestFirst', () => {
  it('pone arriba la fecha más reciente', () => {
    const r = newestFirst([
      { id: 'a', date: '2026-10-19' },
      { id: 'b', date: '2026-10-21' },
      { id: 'c', date: '2026-10-20' },
    ]);
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('dentro del mismo día ordena por hora de creación, aunque falte created_at', () => {
    const r = newestFirst([
      { id: 'mayor-1792600000000', date: '2026-10-21' },
      { id: 'mayor-1792610000000', date: '2026-10-21' },
      { id: 'mayor-1792605000000', date: '2026-10-21', created_at: new Date(1792605000000).toISOString() },
    ]);
    expect(r.map((x) => x.id)).toEqual(['mayor-1792610000000', 'mayor-1792605000000', 'mayor-1792600000000']);
  });

  it('no cambia la lista original', () => {
    const list = [
      { id: 'a', date: '2026-10-19' },
      { id: 'b', date: '2026-10-21' },
    ];
    newestFirst(list);
    expect(list[0].id).toBe('a');
  });
});
