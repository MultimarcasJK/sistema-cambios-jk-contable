import { AppMode, Debtor } from '@/types';

// Lógica pura de sincronización de deudores (sin localStorage ni Supabase) para poder probarla.
//
// Regla única de borrado: un deudor borrado en el instante T permanece oculto mientras no
// ocurra nada nuevo con él después de T (una venta, un abono o una edición con updated_at > T).
// Así un borrado no se deshace solo al recalcular deudas ni al llegar datos viejos de Supabase,
// pero sí se puede volver a registrar al mismo cliente más adelante.

export interface DebtorTombstones {
  // id del deudor -> fecha ISO del borrado
  ids: Record<string, string>;
  // nombre normalizado -> fecha ISO del borrado
  names: Record<string, string>;
}

// Bloqueos permanentes pedidos explícitamente (purga de GLENDYS).
export const PERMANENTLY_BLOCKED_DEBTOR_IDS = new Set(['deb-1792537298623']);
export const PERMANENTLY_BLOCKED_DEBTOR_NAMES = new Set(['GLENDYS']);

export function normalizeDebtorName(name?: string | null): string {
  return (name || '').trim().toUpperCase();
}

export function emptyTombstones(): DebtorTombstones {
  return { ids: {}, names: {} };
}

export function toMillis(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function addDebtorTombstone(
  store: DebtorTombstones,
  id: string | undefined,
  name: string | undefined,
  at: string
): DebtorTombstones {
  const next: DebtorTombstones = { ids: { ...store.ids }, names: { ...store.names } };
  if (id) next.ids[id] = at;
  const norm = normalizeDebtorName(name);
  if (norm) next.names[norm] = at;
  return next;
}

export function isPermanentlyBlocked(debtor: Pick<Debtor, 'id' | 'client_name'>): boolean {
  return (
    PERMANENTLY_BLOCKED_DEBTOR_IDS.has(debtor.id) ||
    PERMANENTLY_BLOCKED_DEBTOR_NAMES.has(normalizeDebtorName(debtor.client_name))
  );
}

// Fecha (ms) del borrado más reciente que aplica a este deudor, por id o por nombre.
export function deletionTimeFor(
  store: DebtorTombstones,
  debtor: { id?: string; client_name?: string }
): number | null {
  const byId = debtor.id ? toMillis(store.ids[debtor.id]) : null;
  const byName = toMillis(store.names[normalizeDebtorName(debtor.client_name)]);
  if (byId === null) return byName;
  if (byName === null) return byId;
  return Math.max(byId, byName);
}

// true si el deudor debe seguir oculto. `activityAt` es la última actividad conocida;
// por defecto se usa su updated_at. Sin actividad conocida se asume anterior al borrado.
export function isDebtorSuppressed(
  store: DebtorTombstones,
  debtor: Pick<Debtor, 'id' | 'client_name'> & { updated_at?: string },
  activityAt?: number | null
): boolean {
  if (isPermanentlyBlocked(debtor)) return true;
  const deletedAt = deletionTimeFor(store, debtor);
  if (deletedAt === null) return false;
  const activity = activityAt !== undefined ? activityAt : toMillis(debtor.updated_at);
  return activity === null || activity <= deletedAt;
}

// Última actividad (ms) por cliente a partir de ventas y abonos.
export function lastActivityByName(
  records: Array<{ client_name?: string; created_at?: string; date?: string } | null | undefined>
): Map<string, number> {
  const result = new Map<string, number>();
  records.forEach((r) => {
    if (!r) return;
    const name = normalizeDebtorName(r.client_name);
    if (!name) return;
    const at = toMillis(r.created_at) ?? toMillis(r.date);
    if (at === null) return;
    const prev = result.get(name);
    if (prev === undefined || at > prev) result.set(name, at);
  });
  return result;
}

export interface MergeRemoteDebtorsInput {
  remote: Debtor[];
  local: Debtor[];
  tombstones: DebtorTombstones;
  // ids con cambios locales aún no confirmados por Supabase
  pendingIds: Set<string>;
  // momento en que empezó la descarga: lo creado localmente después no puede venir en `remote`
  fetchStartedAt: number;
}

export interface MergeRemoteDebtorsResult {
  debtors: Debtor[];
  // filas remotas cuyo id fue borrado aquí: hay que volver a borrarlas en Supabase
  staleRemoteIds: string[];
}

export function mergeRemoteDebtors(input: MergeRemoteDebtorsInput): MergeRemoteDebtorsResult {
  const { remote, local, tombstones, pendingIds, fetchStartedAt } = input;
  const staleRemoteIds: string[] = [];
  const byId = new Map<string, Debtor>();

  remote.forEach((d) => {
    if (!d || !d.id) return;
    if (isDebtorSuppressed(tombstones, d)) {
      // Solo se re-borra por id: el borrado por nombre ya se hizo al eliminar y repetirlo
      // podría pisar a un deudor con el mismo nombre registrado de nuevo en otro dispositivo.
      if (tombstones.ids[d.id] || isPermanentlyBlocked(d)) staleRemoteIds.push(d.id);
      return;
    }
    byId.set(d.id, d);
  });

  // Conservar cambios locales que Supabase todavía no refleja
  local.forEach((d) => {
    if (!d || !d.id) return;
    if (isDebtorSuppressed(tombstones, d)) return;
    const updatedAt = toMillis(d.updated_at);
    const isPending = pendingIds.has(d.id);
    const isNewerThanFetch = updatedAt !== null && updatedAt >= fetchStartedAt;
    if (isPending || isNewerThanFetch) byId.set(d.id, d);
  });

  const debtors = Array.from(byId.values()).sort((a, b) =>
    (a.client_name || '').localeCompare(b.client_name || '', 'es', { sensitivity: 'base' })
  );
  return { debtors, staleRemoteIds };
}

// Cola de operaciones pendientes hacia Supabase (outbox). Una operación solo sale de la cola
// cuando Supabase confirma sin error, así un fallo de red no deja filas fantasma.
export type DebtorOutboxEntry =
  | { seq: number; op: 'upsert'; mode: AppMode; id: string; debtor: Debtor }
  | { seq: number; op: 'delete'; mode: AppMode; id: string; name?: string };

export type DebtorOutboxOp =
  | { op: 'upsert'; mode: AppMode; id: string; debtor: Debtor }
  | { op: 'delete'; mode: AppMode; id: string; name?: string };

export function enqueueDebtorOp(queue: DebtorOutboxEntry[], entry: DebtorOutboxOp, seq: number): DebtorOutboxEntry[] {
  // Un upsert pendiente queda obsoleto ante otro upsert o un borrado del mismo deudor.
  // Los borrados se mantienen y la cola se envía en orden, así nada se reordena.
  const kept = queue.filter((q) => !(q.mode === entry.mode && q.id === entry.id && q.op === 'upsert'));
  return [...kept, { ...entry, seq } as DebtorOutboxEntry];
}

export function pendingUpsertIds(queue: DebtorOutboxEntry[], mode: AppMode): Set<string> {
  return new Set(queue.filter((q) => q.mode === mode && q.op === 'upsert').map((q) => q.id));
}

// Deuda anotada a mano en Deudores ("Agregar Cliente / Deuda"). Se guarda dentro de las notas
// como [MANUAL:x] para que viaje a Supabase sin cambiar la tabla, y se suma al recalcular la
// deuda desde ventas, remesas y abonos (si no, el recálculo la borraba).
const MANUAL_TAG = /\s*\[MANUAL:(-?\d+(?:\.\d+)?)\]/;

export function getManualDebt(notes?: string | null): number {
  const m = (notes || '').match(MANUAL_TAG);
  return m ? Number(m[1]) || 0 : 0;
}

export function stripManualTag(notes?: string | null): string {
  return (notes || '').replace(MANUAL_TAG, '').trim();
}

export function withManualDebt(notes: string | undefined | null, amount: number): string {
  const base = stripManualTag(notes);
  const rounded = Number(amount.toFixed(2));
  if (rounded === 0) return base;
  return (base ? base + ' ' : '') + '[MANUAL:' + rounded + ']';
}
