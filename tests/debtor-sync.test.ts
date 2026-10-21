import { describe, expect, it } from 'vitest';
import {
  addDebtorTombstone,
  emptyTombstones,
  enqueueDebtorOp,
  isDebtorSuppressed,
  lastActivityByName,
  mergeRemoteDebtors,
  pendingUpsertIds,
} from '@/lib/debtor-sync';
import { Debtor } from '@/types';

const T0 = '2026-10-01T12:00:00.000Z';
const BEFORE = '2026-10-01T11:00:00.000Z';
const AFTER = '2026-10-01T13:00:00.000Z';

const debtor = (id: string, name: string, updated_at?: string): Debtor => ({
  id,
  client_name: name,
  current_debt: 10,
  updated_at,
});

describe('isDebtorSuppressed', () => {
  it('oculta por id o por nombre lo que no cambió después del borrado', () => {
    const store = addDebtorTombstone(emptyTombstones(), 'deb-1', 'Ana Pérez', T0);
    expect(isDebtorSuppressed(store, debtor('deb-1', 'OTRO', BEFORE))).toBe(true);
    expect(isDebtorSuppressed(store, debtor('deb-2', ' ana pérez ', BEFORE))).toBe(true);
    expect(isDebtorSuppressed(store, debtor('deb-2', 'ANA PÉREZ'))).toBe(true);
  });

  it('deja ver al deudor si hubo actividad posterior al borrado', () => {
    const store = addDebtorTombstone(emptyTombstones(), 'deb-1', 'ANA', T0);
    expect(isDebtorSuppressed(store, debtor('deb-9', 'ANA', AFTER))).toBe(false);
    expect(isDebtorSuppressed(store, debtor('deb-1', 'ANA'), new Date(AFTER).getTime())).toBe(false);
    expect(isDebtorSuppressed(store, debtor('deb-1', 'ANA', AFTER), null)).toBe(true);
  });

  it('no afecta a deudores sin lápida', () => {
    expect(isDebtorSuppressed(emptyTombstones(), debtor('deb-1', 'ANA'))).toBe(false);
  });

  it('mantiene el bloqueo permanente de GLENDYS', () => {
    expect(isDebtorSuppressed(emptyTombstones(), debtor('deb-x', 'Glendys', AFTER))).toBe(true);
    expect(isDebtorSuppressed(emptyTombstones(), debtor('deb-1792537298623', 'X', AFTER))).toBe(true);
  });
});

describe('lastActivityByName', () => {
  it('usa created_at y si falta la fecha de la operación', () => {
    const map = lastActivityByName([
      { client_name: 'ana', created_at: BEFORE },
      { client_name: 'ANA ', created_at: AFTER },
      { client_name: 'luis', date: '2026-09-30' },
      null,
    ]);
    expect(map.get('ANA')).toBe(new Date(AFTER).getTime());
    expect(map.get('LUIS')).toBe(new Date('2026-09-30').getTime());
  });
});

describe('mergeRemoteDebtors', () => {
  const fetchStartedAt = new Date(T0).getTime();

  it('no resucita filas remotas borradas aquí y pide re-borrarlas por id', () => {
    const tombstones = addDebtorTombstone(emptyTombstones(), 'deb-1', 'ANA', T0);
    const result = mergeRemoteDebtors({
      remote: [debtor('deb-1', 'ANA', BEFORE), debtor('deb-2', 'LUIS', BEFORE)],
      local: [],
      tombstones,
      pendingIds: new Set(),
      fetchStartedAt,
    });
    expect(result.debtors.map((d) => d.id)).toEqual(['deb-2']);
    expect(result.staleRemoteIds).toEqual(['deb-1']);
  });

  it('oculta por nombre sin re-borrar en Supabase (podría ser otro registro nuevo)', () => {
    const tombstones = addDebtorTombstone(emptyTombstones(), 'deb-1', 'ANA', T0);
    const result = mergeRemoteDebtors({
      remote: [debtor('deb-7', 'ANA', BEFORE)],
      local: [],
      tombstones,
      pendingIds: new Set(),
      fetchStartedAt,
    });
    expect(result.debtors).toEqual([]);
    expect(result.staleRemoteIds).toEqual([]);
  });

  it('conserva deudores locales pendientes o creados durante la descarga', () => {
    const result = mergeRemoteDebtors({
      remote: [debtor('deb-2', 'LUIS', BEFORE)],
      local: [
        debtor('deb-2', 'LUIS', BEFORE),
        debtor('deb-3', 'PEDRO', BEFORE), // pendiente de subir
        debtor('deb-4', 'MARTA', AFTER), // creado tras empezar la descarga
        debtor('deb-5', 'VIEJO', BEFORE), // ya no existe en Supabase
      ],
      tombstones: emptyTombstones(),
      pendingIds: new Set(['deb-3']),
      fetchStartedAt,
    });
    expect(result.debtors.map((d) => d.id).sort()).toEqual(['deb-2', 'deb-3', 'deb-4']);
  });

  it('la versión local pendiente gana sobre la remota', () => {
    const result = mergeRemoteDebtors({
      remote: [{ ...debtor('deb-2', 'LUIS', BEFORE), current_debt: 1 }],
      local: [{ ...debtor('deb-2', 'LUIS', BEFORE), current_debt: 99 }],
      tombstones: emptyTombstones(),
      pendingIds: new Set(['deb-2']),
      fetchStartedAt,
    });
    expect(result.debtors[0].current_debt).toBe(99);
  });
});

describe('enqueueDebtorOp', () => {
  it('un upsert reemplaza al upsert anterior del mismo deudor', () => {
    let q = enqueueDebtorOp([], { op: 'upsert', mode: 'detal', id: 'deb-1', debtor: debtor('deb-1', 'A') }, 1);
    q = enqueueDebtorOp(q, { op: 'upsert', mode: 'detal', id: 'deb-1', debtor: debtor('deb-1', 'B') }, 2);
    expect(q).toHaveLength(1);
    expect(q[0].seq).toBe(2);
  });

  it('un borrado descarta los upserts pendientes del mismo deudor', () => {
    let q = enqueueDebtorOp([], { op: 'upsert', mode: 'detal', id: 'deb-1', debtor: debtor('deb-1', 'A') }, 1);
    q = enqueueDebtorOp(q, { op: 'upsert', mode: 'mayor', id: 'deb-1', debtor: debtor('deb-1', 'A') }, 2);
    q = enqueueDebtorOp(q, { op: 'delete', mode: 'detal', id: 'deb-1', name: 'A' }, 3);
    expect(q.map((e) => [e.op, e.mode])).toEqual([
      ['upsert', 'mayor'],
      ['delete', 'detal'],
    ]);
    expect(pendingUpsertIds(q, 'detal').size).toBe(0);
    expect(pendingUpsertIds(q, 'mayor').has('deb-1')).toBe(true);
  });
});
