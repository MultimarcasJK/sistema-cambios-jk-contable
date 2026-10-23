import {
  Account,
  TransactionDetal,
  TransactionMayor,
  BalanceTransfer,
  Expense,
  Currency,
  DailyClosure,
  AccountSnapshot,
  DebtorSnapshot,
  Debtor,
  DebtPayment,
  Client,
  Supplier,
  SupplierPurchase,
  SupplierPayment,
  Employee,
  PayrollPayment,
  ServiceExpense,
  AppMode,
  BalanceAdjustment,
  Remesa,
  RemesaEstado,
  RemesaMetodoPago,
  Remitente,
  Beneficiario,
} from '@/types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_ACCOUNTS_DETAL,
  INITIAL_ACCOUNTS_MAYOR,
  INITIAL_DEBTORS,
  INITIAL_CLIENTS,
  INITIAL_CLIENTS_DETAL,
  INITIAL_CLIENTS_MAYOR,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIERS_DETAL,
  INITIAL_SUPPLIERS_MAYOR,
} from './initial-data';
import { SupabaseSyncService } from './supabase-sync';
import { commissionOutOfAccount } from './commission';
import { AuditService } from './audit';
import { recordTime } from './order';
import { isActorAdmin, getActor } from './actor';
import type { LedgerSources } from './ledger';
import {
  DebtorOutboxEntry,
  DebtorOutboxOp,
  DebtorTombstones,
  addDebtorTombstone,
  emptyTombstones,
  enqueueDebtorOp,
  isDebtorSuppressed,
  lastActivityByName,
  mergeRemoteDebtors,
  normalizeDebtorName,
  pendingUpsertIds,
} from './debtor-sync';
import { localDateStr } from './dates';

let activeAppMode: AppMode = 'detal';

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error('Error reading ' + key + ' from storage:', err);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Error saving ' + key + ' to storage:', err);
  }
}

const DELETED_IDS_KEY = 'cambiosjk_deleted_ids_v1';

function getDeletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markAsDeleted(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getDeletedIds();
    set.add(id);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Error recording deleted id:', err);
  }
}

function unmarkDeleted(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getDeletedIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

function isDeleted(id: string): boolean {
  if (!id) return false;
  return getDeletedIds().has(id);
}

// Filas que este dispositivo ya vio en Supabase. Si una de ellas desaparece de Supabase es
// porque otro dispositivo la borró: se quita aquí también en vez de volver a subirla
// (antes se "resucitaba" lo que otra computadora había borrado).
function getSeenRemote(storageKey: string): Set<string> {
  return new Set(getFromStorage<string[]>(storageKey + '_vistos_v1', []));
}

// Si este dispositivo todavía no tiene lista de "vistos" (primera vez con esta versión, o datos viejos),
// no puede saber si un registro que solo tiene él se borró en otra computadora. Solo vuelve a subir los
// recién creados; los viejos se dejan (así se resucitaron un traspaso y dos compras el 21/10).
const RECENT_LOCAL_MS = 2 * 60 * 60 * 1000;
function isRecentLocal(r: { id?: string; date?: string; created_at?: string }): boolean {
  return Date.now() - recordTime(r) < RECENT_LOCAL_MS;
}

function rememberSeenRemote(storageKey: string, seen: Set<string>, remoteIds: Set<string>): void {
  // Supabase devuelve como máximo 1000 filas: con listas así de largas no se puede saber qué se borró
  if (remoteIds.size >= 1000) return;
  let changed = false;
  remoteIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  });
  if (changed) saveToStorage(storageKey + '_vistos_v1', Array.from(seen));
}

// Abonos creados en este dispositivo que Supabase todavía no confirmó. La sincronización
// los conserva y reintenta en vez de reemplazarlos por la lista remota, que aún no los tiene.
function getPendingDebtPaymentsKey(mode: AppMode): string {
  return 'cambiosjk_' + mode + '_abonos_pendientes_v1';
}

function getPendingDebtPaymentIds(mode: AppMode): Set<string> {
  const ids = getFromStorage<string[]>(getPendingDebtPaymentsKey(mode), []);
  return new Set(Array.isArray(ids) ? ids.filter(Boolean) : []);
}

function setDebtPaymentPending(id: string, mode: AppMode, pending: boolean): void {
  const ids = getPendingDebtPaymentIds(mode);
  if (pending === ids.has(id)) return;
  if (pending) ids.add(id);
  else ids.delete(id);
  saveToStorage(getPendingDebtPaymentsKey(mode), Array.from(ids));
}

function pushDebtPayment(payment: DebtPayment, mode: AppMode): void {
  setDebtPaymentPending(payment.id, mode, true);
  SupabaseSyncService.upsertDebtPayment(payment, mode)
    .then((ok) => {
      if (ok) setDebtPaymentPending(payment.id, mode, false);
    })
    .catch(() => {});
}

// Lápidas de deudores: propias de cada modo, con fecha y sin límite de tamaño, para que
// un borrado no se pierda cuando la lista genérica de IDs borrados supera 500 entradas.
function getDebtorTombstonesKey(mode: AppMode): string {
  return 'cambiosjk_' + mode + '_debtor_tombstones_v1';
}

function getDebtorTombstones(mode: AppMode): DebtorTombstones {
  if (typeof window === 'undefined') return emptyTombstones();
  const key = getDebtorTombstonesKey(mode);
  const stored = getFromStorage<DebtorTombstones | null>(key, null);
  if (stored && stored.ids && stored.names) return stored;

  // Migración única desde cambiosjk_deleted_ids_v1: se conservan los borrados anteriores
  // con la fecha de hoy, así lo nuevo que se registre después vuelve a aparecer.
  let migrated = emptyTombstones();
  const now = new Date().toISOString();
  getDeletedIds().forEach((entry) => {
    if (entry.startsWith('name:')) {
      migrated = addDebtorTombstone(migrated, undefined, entry.slice(5), now);
    } else if (entry.startsWith('deb')) {
      migrated = addDebtorTombstone(migrated, entry, undefined, now);
    }
  });
  saveToStorage(key, migrated);
  return migrated;
}

// `notBefore` permite fechar el borrado después del updated_at del deudor, por si el reloj
// del dispositivo que lo editó iba adelantado.
function recordDebtorDeletion(mode: AppMode, id: string | undefined, name?: string, notBefore = 0): void {
  const at = new Date(Math.max(Date.now(), notBefore)).toISOString();
  const next = addDebtorTombstone(getDebtorTombstones(mode), id, name, at);
  saveToStorage(getDebtorTombstonesKey(mode), next);
  if (id) markAsDeleted(id);
}

const DEBTOR_OUTBOX_KEY = 'cambiosjk_debtor_outbox_v1';

function getDebtorOutbox(): DebtorOutboxEntry[] {
  const queue = getFromStorage<DebtorOutboxEntry[]>(DEBTOR_OUTBOX_KEY, []);
  return Array.isArray(queue) ? queue.filter(Boolean) : [];
}

function queueDebtorRemote(op: DebtorOutboxOp): void {
  if (typeof window === 'undefined') return;
  const queue = getDebtorOutbox();
  const seq = queue.reduce((max, q) => Math.max(max, q.seq), 0) + 1;
  saveToStorage(DEBTOR_OUTBOX_KEY, enqueueDebtorOp(queue, op, seq));
}

let debtorFlushInFlight: Promise<void> | null = null;
let debtorFlushGeneration = 0;

// Envía a Supabase las operaciones pendientes de deudores, en orden. Lo que falla se queda
// en la cola y se reintenta en la próxima sincronización.
function flushDebtorOutbox(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (debtorFlushInFlight) {
    // Encadenar para que lo encolado durante el envío actual también salga
    return debtorFlushInFlight.then(() => flushDebtorOutbox());
  }
  const generation = ++debtorFlushGeneration;
  const run = (async () => {
    // Ceder un turno para que `debtorFlushInFlight` quede asignado antes de empezar
    await Promise.resolve();
    try {
      const snapshot = getDebtorOutbox();
      const done = new Set<number>();
      const blocked = new Set<string>();
      for (const entry of snapshot) {
        const key = entry.mode + ':' + entry.id;
        // Si falló una operación anterior del mismo deudor, no adelantar las siguientes
        if (blocked.has(key)) continue;
        const ok =
          entry.op === 'upsert'
            ? await SupabaseSyncService.upsertDebtor(entry.debtor, entry.mode).catch(() => false)
            : await SupabaseSyncService.deleteDebtor(entry.id, entry.mode, entry.name).catch(() => false);
        if (ok) done.add(entry.seq);
        else blocked.add(key);
      }
      if (done.size > 0) {
        saveToStorage(DEBTOR_OUTBOX_KEY, getDebtorOutbox().filter((q) => !done.has(q.seq)));
      }
    } finally {
      if (generation === debtorFlushGeneration) debtorFlushInFlight = null;
    }
  })();
  debtorFlushInFlight = run;
  return run;
}

export const StorageService = {
  getAppMode(): AppMode {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cambiosjk_app_mode') as AppMode;
      if (saved === 'detal' || saved === 'mayor') return saved;
    }
    return activeAppMode;
  },

  setAppMode(mode: AppMode): void {
    activeAppMode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('cambiosjk_app_mode', mode);
    }
  },

  // Dynamic Keys
  getAccountsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_accounts_v2';
  },
  getClientsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_clients_v2';
  },
  getSuppliersKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_suppliers_v2';
  },
  getTransfersKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_transfers_v2';
  },
  getExpensesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_expenses_v2';
  },
  getClosuresKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_closures_v2';
  },
  getSupplierPurchasesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_sup_purchases_v2';
  },
  getSupplierPaymentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_sup_payments_v2';
  },
  getTransactionsDetalKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_txs_detal_v2';
  },
  getTransactionsMayorKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_txs_mayor_v2';
  },
  getDebtorsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_debtors_v2';
  },
  getDebtPaymentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_debt_payments_v2';
  },
  getEmployeesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_employees_v1';
  },
  getPayrollPaymentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_payroll_payments_v1';
  },
  getServiceExpensesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_service_expenses_v1';
  },
  getAdjustmentsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_ajustes_saldo_v1';
  },
  getRemesasKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_remesas_v1';
  },
  getRemitentesKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_remitentes_v1';
  },
  getRemesaPrefsKey(mode?: AppMode): string {
    const m = mode || this.getAppMode();
    return 'cambiosjk_' + m + '_remesas_pref_pais_v1';
  },

  // ── Candado de días cerrados ──
  // Un día queda bloqueado cuando tiene cierre o cuando hay un cierre en una fecha posterior.
  getLockedThrough(mode?: AppMode): string | null {
    const m = mode || this.getAppMode();
    const dates = this.getClosures(m)
      .map((c) => c.date)
      .filter(Boolean)
      .sort();
    return dates.length > 0 ? dates[dates.length - 1] : null;
  },

  isDayLocked(date: string | undefined, mode?: AppMode): boolean {
    if (!date) return false;
    const lockedThrough = this.getLockedThrough(mode);
    return lockedThrough !== null && date.slice(0, 10) <= lockedThrough;
  },

  // Lanza un error (y avisa en pantalla) si se intenta mover dinero en un día cerrado
  assertDayOpen(date: string | undefined, mode: AppMode, what: string): void {
    if (!this.isDayLocked(date, mode)) return;
    const lockedThrough = this.getLockedThrough(mode);
    const msg =
      `El día ${date} ya está cerrado (hay cierre hasta el ${lockedThrough}).\n\n` +
      `No se puede ${what} en un día cerrado. Regístralo con fecha de hoy, ` +
      `o pide a un ADMIN que reabra el día desde "Cierre".`;
    AuditService.log({
      mode,
      action: 'bloqueado',
      entity: 'dia_cerrado',
      entityId: date || '',
      summary: `Intento de ${what} con fecha ${date} (día cerrado)`,
    });
    if (typeof window !== 'undefined') window.alert(msg);
    const err = new Error(msg);
    err.name = 'DiaCerradoError';
    throw err;
  },

  // Migración automática de datos antiguos para separar César a Detal y María a Mayor
  migrateOldDataIfNeeded(): void {
    if (typeof window === 'undefined') return;

    // Purga forzada y definitiva de deudores y transacciones huérfanas de Mayor tras reinicio
    const PURGE_MAYOR_GHOSTS = 'cambiosjk_purge_mayor_ghosts_v3';
    if (!localStorage.getItem(PURGE_MAYOR_GHOSTS)) {
      saveToStorage(this.getTransactionsMayorKey('mayor'), []);
      saveToStorage(this.getDebtorsKey('mayor'), []);
      saveToStorage(this.getDebtPaymentsKey('mayor'), []);
      localStorage.setItem(PURGE_MAYOR_GHOSTS, '1');
      console.log('[JK] Purga automática de deudores y ventas fantasmas de Mayor ejecutada.');
    }

    // Purga forzada v2 para eliminar a Glendys y deudores huérfanos sin ventas
    const PURGE_GLENDYS_V2 = 'cambiosjk_purge_glendys_v2';
    if (!localStorage.getItem(PURGE_GLENDYS_V2)) {
      const detalTxs = getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey('detal'), []);
      const activeClients = new Set(detalTxs.map((t) => (t.client_name || '').trim().toUpperCase()));
      const curDebtors = getFromStorage<Debtor[]>(this.getDebtorsKey('detal'), []);
      const cleaned = curDebtors.filter((d) => {
        if (!d) return false;
        const name = (d.client_name || '').trim().toUpperCase();
        if (name.includes('GLENDYS') || name.includes('GLENDY')) {
          recordDebtorDeletion('detal', d.id, name);
          queueDebtorRemote({ op: 'delete', mode: 'detal', id: d.id, name });
          return false;
        }
        return true;
      });
      saveToStorage(this.getDebtorsKey('detal'), cleaned);
      localStorage.setItem(PURGE_GLENDYS_V2, '1');
    }

    // Purga forzada y definitiva de deudores automáticos huérfanos de Detal (ej. GLENDYS sin transacciones)
    const PURGE_DETAL_GHOSTS = 'cambiosjk_purge_detal_ghosts_v1';
    if (!localStorage.getItem(PURGE_DETAL_GHOSTS)) {
      const detalTxs = getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey('detal'), []);
      const activeClients = new Set(detalTxs.map((t) => (t.client_name || '').trim().toUpperCase()));
      const curDebtors = getFromStorage<Debtor[]>(this.getDebtorsKey('detal'), []);
      const cleaned = curDebtors.filter((d) => {
        if (!d) return false;
        const isAuto = Boolean(d.id?.startsWith('deb-auto-') || (d.notes && d.notes.toLowerCase().includes('sincronizado de operaciones')));
        if (isAuto && !activeClients.has((d.client_name || '').trim().toUpperCase())) {
          recordDebtorDeletion('detal', d.id);
          queueDebtorRemote({ op: 'delete', mode: 'detal', id: d.id });
          return false;
        }
        return true;
      });
      saveToStorage(this.getDebtorsKey('detal'), cleaned);
      localStorage.setItem(PURGE_DETAL_GHOSTS, '1');
      console.log('[JK] Purga automática de deudores fantasmas de Detal ejecutada.');
    }

    const MIGRATED_FLAG = 'cambiosjk_data_split_v2_migrated';
    if (localStorage.getItem(MIGRATED_FLAG)) return;

    try {
      // 1. Migrar Transacciones Detal (César va a detal)
      const oldDetalRaw = localStorage.getItem('cambiosjk_detal_v1');
      if (oldDetalRaw) {
        const oldDetal = JSON.parse(oldDetalRaw) as TransactionDetal[];
        if (Array.isArray(oldDetal)) {
          const detalList: TransactionDetal[] = [];
          const mayorList: TransactionDetal[] = [];
          oldDetal.forEach((tx) => {
            const clientName = (tx.client_name || '').toUpperCase();
            if (clientName.includes('MARIA')) {
              mayorList.push(tx);
            } else {
              detalList.push(tx);
            }
          });
          saveToStorage(this.getTransactionsDetalKey('detal'), detalList);
          if (mayorList.length > 0) {
            saveToStorage(this.getTransactionsDetalKey('mayor'), mayorList);
          }
        }
      }

      // 2. Migrar Transacciones Mayor (María va a mayor)
      const oldMayorRaw = localStorage.getItem('cambiosjk_mayor_v1');
      if (oldMayorRaw) {
        const oldMayor = JSON.parse(oldMayorRaw) as TransactionMayor[];
        if (Array.isArray(oldMayor)) {
          const detalList: TransactionMayor[] = [];
          const mayorList: TransactionMayor[] = [];
          oldMayor.forEach((tx) => {
            const clientName = (tx.client_name || '').toUpperCase();
            if (clientName.includes('CESAR')) {
              detalList.push(tx);
            } else {
              mayorList.push(tx);
            }
          });
          if (detalList.length > 0) {
            saveToStorage(this.getTransactionsMayorKey('detal'), detalList);
          }
          saveToStorage(this.getTransactionsMayorKey('mayor'), mayorList);
        }
      }

      // 3. Migrar Deudores
      const oldDebtorsRaw = localStorage.getItem('cambiosjk_debtors_v1');
      if (oldDebtorsRaw) {
        const oldDebtors = JSON.parse(oldDebtorsRaw) as Debtor[];
        if (Array.isArray(oldDebtors)) {
          const detalDebtors = oldDebtors.filter((d) => !d.client_name.toUpperCase().includes('MARIA'));
          const mayorDebtors = oldDebtors.filter((d) => !d.client_name.toUpperCase().includes('CESAR'));
          saveToStorage(this.getDebtorsKey('detal'), detalDebtors);
          saveToStorage(this.getDebtorsKey('mayor'), mayorDebtors);
        }
      }

      // 4. Migrar Abonos
      const oldPaymentsRaw = localStorage.getItem('cambiosjk_debt_payments_v1');
      if (oldPaymentsRaw) {
        const oldPayments = JSON.parse(oldPaymentsRaw) as DebtPayment[];
        if (Array.isArray(oldPayments)) {
          const detalPayments = oldPayments.filter((p) => !p.client_name.toUpperCase().includes('MARIA'));
          const mayorPayments = oldPayments.filter((p) => !p.client_name.toUpperCase().includes('CESAR'));
          saveToStorage(this.getDebtPaymentsKey('detal'), detalPayments);
          saveToStorage(this.getDebtPaymentsKey('mayor'), mayorPayments);
        }
      }

      localStorage.setItem(MIGRATED_FLAG, 'true');
      console.log('[JK] Migración y separación de datos Detal / Mayor completada.');
    } catch (err) {
      console.error('[JK] Error durante migración de datos:', err);
    }
  },

  // Sincronización con Supabase en segundo plano
  async syncFromSupabase(mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    try {
      // Enviar primero lo pendiente para no descargar filas que ya se borraron aquí
      await flushDebtorOutbox().catch(() => {});
      const [remoteAdjustments, remoteAudit, remoteRemesas, remoteRemitentes] = await Promise.all([
        SupabaseSyncService.fetchAdjustments(m),
        SupabaseSyncService.fetchAuditEntries(m),
        SupabaseSyncService.fetchRemesas(m),
        SupabaseSyncService.fetchRemitentes(m),
      ]);
      if (remoteRemesas !== null) {
        // Gana la copia que avanzó más en su historial de estados
        const local = this.getRemesas(m);
        const byId = new Map<string, Remesa>();
        remoteRemesas.forEach((r) => byId.set(r.id, r));
        local.forEach((l) => {
          const r = byId.get(l.id);
          if (!r || (l.historial?.length || 0) > (r.historial?.length || 0)) {
            byId.set(l.id, l);
            SupabaseSyncService.upsertRemesa(l, m).catch(() => {});
          }
        });
        saveToStorage(
          this.getRemesasKey(m),
          Array.from(byId.values()).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        );
      }
      if (remoteRemitentes !== null) {
        const local = this.getRemitentes(m);
        const byId = new Map<string, Remitente>();
        remoteRemitentes.forEach((r) => byId.set(r.id, r));
        local.forEach((l) => {
          const r = byId.get(l.id);
          // Gana la copia editada más recientemente (borrar un beneficiario también cuenta)
          const localNewer =
            l.updated_at || r?.updated_at
              ? (l.updated_at || '') > (r?.updated_at || '')
              : (l.beneficiarios?.length || 0) > (r?.beneficiarios?.length || 0);
          if (!r || localNewer) {
            byId.set(l.id, l);
            SupabaseSyncService.upsertRemitente(l, m).catch(() => {});
          }
        });
        saveToStorage(this.getRemitentesKey(m), Array.from(byId.values()));
      }
      if (remoteAdjustments !== null) {
        const local = this.getAdjustments(m);
        const remoteIds = new Set(remoteAdjustments.map((a) => a.id));
        const localPending = local.filter((a) => a && !remoteIds.has(a.id));
        localPending.forEach((a) => {
          SupabaseSyncService.upsertAdjustment(a, m).catch(() => {});
        });
        saveToStorage(this.getAdjustmentsKey(m), [...remoteAdjustments, ...localPending]);
      }
      if (remoteAudit !== null) {
        AuditService.mergeRemote(m, remoteAudit);
      }
      const fetchStartedAt = Date.now();
      const [
        remoteAccs,
        remoteClients,
        remoteSuppliers,
        remoteTransfers,
        remoteExpenses,
        remoteClosures,
        remoteTxsDetal,
        remoteTxsMayor,
        remoteDebtors,
        remoteDebtPayments,
        remotePurchases,
        remoteSupplierPayments,
        remoteEmployees,
        remotePayrollPayments,
        remoteServiceExpenses,
      ] = await Promise.all([
        SupabaseSyncService.fetchAccounts(m),
        SupabaseSyncService.fetchClients(m),
        SupabaseSyncService.fetchSuppliers(m),
        SupabaseSyncService.fetchTransfers(m),
        SupabaseSyncService.fetchExpenses(m),
        SupabaseSyncService.fetchClosures(m),
        SupabaseSyncService.fetchTransactionsDetal(m),
        SupabaseSyncService.fetchTransactionsMayor(m),
        SupabaseSyncService.fetchDebtors(m),
        SupabaseSyncService.fetchDebtPayments(m),
        SupabaseSyncService.fetchSupplierPurchases(m),
        SupabaseSyncService.fetchSupplierPayments(m),
        SupabaseSyncService.fetchEmployees(m),
        SupabaseSyncService.fetchPayrollPayments(m),
        SupabaseSyncService.fetchServiceExpenses(m),
      ]);

      if (remoteAccs !== null) {
        const validRemote = remoteAccs.filter((a) => {
          if (isDeleted(a.id)) {
            SupabaseSyncService.deleteAccount(a.id, m).catch(() => {});
            return false;
          }
          return true;
        });

        const local = this.getAccounts(m);
        const remoteIds = new Set(validRemote.map((a) => a.id));
        const remoteNames = new Set(validRemote.map((a) => a.name.trim().toUpperCase()));

        // Preservar cuentas creadas localmente que aún no hayan llegado a Supabase y no hayan sido borradas
        const localPending = local.filter(
          (a) =>
            a &&
            !remoteIds.has(a.id) &&
            !remoteNames.has((a.name || '').trim().toUpperCase()) &&
            !isDeleted(a.id)
        );
        localPending.forEach((a) => {
          SupabaseSyncService.upsertAccount(a, m).catch(() => {});
        });

        const localMap = new Map<string, Account>();
        local.forEach((a) => {
          if (a && a.id && !isDeleted(a.id)) localMap.set(a.id, a);
          if (a && a.name && !isDeleted(a.id)) localMap.set(a.name.trim().toUpperCase(), a);
        });

        const mergedAccounts = [
          ...validRemote.map((remote) => {
            const loc = localMap.get(remote.id) || localMap.get(remote.name.trim().toUpperCase());
            return {
              ...remote,
              account_subtype: remote.account_subtype || loc?.account_subtype || '',
              account_number: remote.account_number || loc?.account_number || '',
              notes: remote.notes || loc?.notes || '',
              scope: remote.scope || loc?.scope || m,
              order_index: remote.order_index !== undefined ? remote.order_index : loc?.order_index,
            };
          }),
          ...localPending,
        ];

        saveToStorage(this.getAccountsKey(m), mergedAccounts);
      }
      if (remoteClients !== null) {
        const validRemote = remoteClients.filter((c) => {
          if (isDeleted(c.id)) {
            SupabaseSyncService.deleteClient(c.id, m).catch(() => {});
            return false;
          }
          return true;
        });

        const local = this.getClients(m);
        const uniqueMap = new Map<string, Client>();
        validRemote.forEach((c) => {
          if (!c || !c.name) return;
          const key = c.name.trim().toUpperCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, c);
          } else {
            const existing = uniqueMap.get(key)!;
            // Preservar teléfono, cédula o deuda si la otra copia los tiene
            const updated: Client = {
              ...existing,
              phone: existing.phone || c.phone || '',
              identification: existing.identification || c.identification || '',
              current_debt: existing.current_debt || c.current_debt || 0,
            };
            uniqueMap.set(key, updated);
          }
        });

        const sorted = Array.from(uniqueMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        );
        saveToStorage(this.getClientsKey(m), sorted);
      }
      if (remoteSuppliers !== null) {
        const validRemote = remoteSuppliers.filter((s) => {
          if (isDeleted(s.id)) {
            SupabaseSyncService.deleteSupplier(s.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getSuppliers(m);
        const remoteIds = new Set(validRemote.map((s) => s.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getSuppliersKey(m)) : new Set<string>();
        const localPending = local.filter((s) => s && !remoteIds.has(s.id) && !isDeleted(s.id) && !seenRemote.has(s.id) && (seenRemote.size > 0 || isRecentLocal(s)));
        rememberSeenRemote(this.getSuppliersKey(m), seenRemote, remoteIds);
        localPending.forEach((s) => {
          SupabaseSyncService.upsertSupplier(s, m).catch(() => {});
        });
        saveToStorage(this.getSuppliersKey(m), [...validRemote, ...localPending]);
      }
      if (remoteTransfers !== null) {
        const validRemote = remoteTransfers.filter((t) => {
          if (isDeleted(t.id)) {
            SupabaseSyncService.deleteTransfer(t.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getTransfers(m);
        const remoteIds = new Set(validRemote.map((t) => t.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getTransfersKey(m)) : new Set<string>();
        const localPending = local.filter((t) => t && !remoteIds.has(t.id) && !isDeleted(t.id) && !seenRemote.has(t.id) && (seenRemote.size > 0 || isRecentLocal(t)));
        rememberSeenRemote(this.getTransfersKey(m), seenRemote, remoteIds);
        localPending.forEach((t) => {
          SupabaseSyncService.upsertTransfer(t, m).catch(() => {});
        });
        saveToStorage(this.getTransfersKey(m), [...validRemote, ...localPending]);
      }
      if (remoteExpenses !== null) {
        const validRemote = remoteExpenses.filter((e) => {
          if (isDeleted(e.id)) {
            SupabaseSyncService.deleteExpense(e.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getExpenses(m);
        const localById = new Map(local.filter(Boolean).map((e) => [e.id, e]));
        // Filas viejas en Supabase no traen moneda ni equivalente USD: se completan con la copia local,
        // o con la moneda de la cuenta; y se vuelven a subir para que queden guardadas.
        const accs = this.getAccounts(m);
        const mergedRemote = validRemote.map((e) => {
          if (e.currency && Number.isFinite(e.amount_usd)) return e;
          const loc = localById.get(e.id);
          const acc = accs.find((a) => a.id === e.account_id);
          const currency = (loc?.currency || e.currency || acc?.currency || 'USD') as Currency;
          const isUsd = currency === 'USD' || currency === 'USDT';
          const amountUsd = Number.isFinite(e.amount_usd)
            ? e.amount_usd
            : loc && Number.isFinite(loc.amount_usd)
            ? loc.amount_usd
            : isUsd
            ? Number(e.amount) || 0
            : 0;
          const fixed = { ...e, currency, amount_usd: amountUsd };
          if (loc && loc.currency) SupabaseSyncService.upsertExpense(fixed, m).catch(() => {});
          return fixed;
        });
        const remoteIds = new Set(validRemote.map((e) => e.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getExpensesKey(m)) : new Set<string>();
        const localPending = local.filter((e) => e && !remoteIds.has(e.id) && !isDeleted(e.id) && !seenRemote.has(e.id) && (seenRemote.size > 0 || isRecentLocal(e)));
        rememberSeenRemote(this.getExpensesKey(m), seenRemote, remoteIds);
        localPending.forEach((e) => {
          SupabaseSyncService.upsertExpense(e, m).catch(() => {});
        });
        saveToStorage(this.getExpensesKey(m), [...mergedRemote, ...localPending]);
      }
      if (remoteClosures !== null) {
        const validRemote = remoteClosures.filter((c) => {
          if (isDeleted(c.id)) {
            SupabaseSyncService.deleteClosure(c.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getClosures(m);
        const remoteIds = new Set(validRemote.map((c) => c.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getClosuresKey(m)) : new Set<string>();
        const localPending = local.filter((c) => c && !remoteIds.has(c.id) && !isDeleted(c.id) && !seenRemote.has(c.id) && (seenRemote.size > 0 || isRecentLocal(c)));
        rememberSeenRemote(this.getClosuresKey(m), seenRemote, remoteIds);
        localPending.forEach((c) => {
          SupabaseSyncService.upsertClosure(c, m).catch(() => {});
        });
        // Cierres que llegaron sin desglose: se completa con la copia local, o en 0
        const localById = new Map(local.filter(Boolean).map((c) => [c.id, c]));
        const completed = validRemote.map((c) => {
          const loc = localById.get(c.id);
          return {
            ...c,
            profit_detal: c.profit_detal ?? loc?.profit_detal ?? 0,
            profit_mayor: c.profit_mayor ?? loc?.profit_mayor ?? 0,
            extra_income: c.extra_income ?? loc?.extra_income ?? 0,
            total_expenses: c.total_expenses ?? loc?.total_expenses ?? 0,
            profit_remesas: c.profit_remesas ?? loc?.profit_remesas ?? 0,
          };
        });
        saveToStorage(this.getClosuresKey(m), [...completed, ...localPending]);
      }
      if (remoteTxsDetal !== null) {
        const validRemote = remoteTxsDetal.filter((t) => {
          if (isDeleted(t.id)) {
            SupabaseSyncService.deleteTransactionDetal(t.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []);
        const remoteIds = new Set(validRemote.map((t) => t.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getTransactionsDetalKey(m)) : new Set<string>();
        const localPending = local.filter((t) => !remoteIds.has(t.id) && !isDeleted(t.id) && !seenRemote.has(t.id) && (seenRemote.size > 0 || isRecentLocal(t)));
        rememberSeenRemote(this.getTransactionsDetalKey(m), seenRemote, remoteIds);
        localPending.forEach((tx) => {
          SupabaseSyncService.upsertTransactionDetal(tx, m).catch(() => {});
        });
        const merged = [...validRemote, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getTransactionsDetalKey(m), merged);
      }
      if (remoteTxsMayor !== null) {
        const validRemote = remoteTxsMayor.filter((t) => {
          if (isDeleted(t.id)) {
            SupabaseSyncService.deleteTransactionMayor(t.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []);
        const remoteIds = new Set(validRemote.map((t) => t.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getTransactionsMayorKey(m)) : new Set<string>();
        const localPending = local.filter((t) => !remoteIds.has(t.id) && !isDeleted(t.id) && !seenRemote.has(t.id) && (seenRemote.size > 0 || isRecentLocal(t)));
        rememberSeenRemote(this.getTransactionsMayorKey(m), seenRemote, remoteIds);
        localPending.forEach((tx) => {
          SupabaseSyncService.upsertTransactionMayor(tx, m).catch(() => {});
        });
        const merged = [...validRemote, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getTransactionsMayorKey(m), merged);
      }
      if (remoteDebtors !== null) {
        const { debtors: mergedDebtors, staleRemoteIds } = mergeRemoteDebtors({
          remote: remoteDebtors,
          local: getFromStorage<Debtor[]>(this.getDebtorsKey(m), []) || [],
          tombstones: getDebtorTombstones(m),
          pendingIds: pendingUpsertIds(getDebtorOutbox(), m),
          fetchStartedAt,
        });
        saveToStorage(this.getDebtorsKey(m), mergedDebtors);
        // Filas que otro dispositivo (o un borrado fallido) dejó vivas en Supabase
        if (staleRemoteIds.length > 0) {
          staleRemoteIds.forEach((id) => queueDebtorRemote({ op: 'delete', mode: m, id }));
          flushDebtorOutbox().catch(() => {});
        }
      }
      if (remoteDebtPayments !== null) {
        const validRemote = remoteDebtPayments.filter((p) => !isDeleted(p.id));
        const remoteIds = new Set(validRemote.map((p) => p.id));
        const pendingIds = getPendingDebtPaymentIds(m);
        // Solo se conservan los abonos locales nunca confirmados; uno ya confirmado que falta
        // en Supabase fue borrado desde otro dispositivo y no debe resucitar.
        const localPending = (getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []) || []).filter(
          (p) => p && pendingIds.has(p.id) && !remoteIds.has(p.id) && !isDeleted(p.id)
        );
        pendingIds.forEach((id) => {
          if (remoteIds.has(id) || isDeleted(id)) setDebtPaymentPending(id, m, false);
        });
        localPending.forEach((p) => pushDebtPayment(p, m));
        const merged = [...validRemote, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getDebtPaymentsKey(m), merged);
      }
      if (remotePurchases !== null) {
        const validRemote = remotePurchases.filter((p) => {
          if (isDeleted(p.id)) {
            SupabaseSyncService.deleteSupplierPurchase(p.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getSupplierPurchases(m);
        const remoteIds = new Set(validRemote.map((p) => p.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getSupplierPurchasesKey(m)) : new Set<string>();
        const localPending = local.filter((p) => p && !remoteIds.has(p.id) && !isDeleted(p.id) && !seenRemote.has(p.id) && (seenRemote.size > 0 || isRecentLocal(p)));
        rememberSeenRemote(this.getSupplierPurchasesKey(m), seenRemote, remoteIds);
        localPending.forEach((p) => {
          SupabaseSyncService.upsertSupplierPurchase(p, m).catch(() => {});
        });
        saveToStorage(this.getSupplierPurchasesKey(m), [...validRemote, ...localPending]);
      }
      if (remoteSupplierPayments !== null) {
        const validRemote = remoteSupplierPayments.filter((p) => {
          if (isDeleted(p.id)) {
            SupabaseSyncService.deleteSupplierPayment(p.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getSupplierPayments(m);
        const remoteIds = new Set(validRemote.map((p) => p.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getSupplierPaymentsKey(m)) : new Set<string>();
        const localPending = local.filter((p) => p && !remoteIds.has(p.id) && !isDeleted(p.id) && !seenRemote.has(p.id) && (seenRemote.size > 0 || isRecentLocal(p)));
        rememberSeenRemote(this.getSupplierPaymentsKey(m), seenRemote, remoteIds);
        localPending.forEach((p) => {
          SupabaseSyncService.upsertSupplierPayment(p, m).catch(() => {});
        });
        saveToStorage(this.getSupplierPaymentsKey(m), [...validRemote, ...localPending]);
      }
      if (remoteEmployees !== null) {
        const validRemote = remoteEmployees.filter((e) => {
          if (isDeleted(e.id)) {
            SupabaseSyncService.deleteEmployee(e.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getEmployees(m);
        const remoteIds = new Set(validRemote.map((e) => e.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getEmployeesKey(m)) : new Set<string>();
        const localPending = local.filter((e) => e && !remoteIds.has(e.id) && !isDeleted(e.id) && !seenRemote.has(e.id) && (seenRemote.size > 0 || isRecentLocal(e)));
        rememberSeenRemote(this.getEmployeesKey(m), seenRemote, remoteIds);
        localPending.forEach((e) => {
          SupabaseSyncService.upsertEmployee(e, m).catch(() => {});
        });
        this.saveEmployees([...validRemote, ...localPending], m);
      }
      if (remotePayrollPayments !== null) {
        const validRemote = remotePayrollPayments.filter((p) => {
          if (isDeleted(p.id)) {
            SupabaseSyncService.deletePayrollPayment(p.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getPayrollPayments(m);
        const remoteIds = new Set(validRemote.map((p) => p.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getPayrollPaymentsKey(m)) : new Set<string>();
        const localPending = local.filter((p) => p && !remoteIds.has(p.id) && !isDeleted(p.id) && !seenRemote.has(p.id) && (seenRemote.size > 0 || isRecentLocal(p)));
        rememberSeenRemote(this.getPayrollPaymentsKey(m), seenRemote, remoteIds);
        localPending.forEach((p) => {
          SupabaseSyncService.upsertPayrollPayment(p, m).catch(() => {});
        });
        const merged = [...validRemote, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getPayrollPaymentsKey(m), merged);
      }
      if (remoteServiceExpenses !== null) {
        const validRemote = remoteServiceExpenses.filter((s) => {
          if (isDeleted(s.id)) {
            SupabaseSyncService.deleteServiceExpense(s.id, m).catch(() => {});
            return false;
          }
          return true;
        });
        const local = this.getServiceExpenses(m);
        const remoteIds = new Set(validRemote.map((s) => s.id));
        const seenRemote = remoteIds.size < 1000 ? getSeenRemote(this.getServiceExpensesKey(m)) : new Set<string>();
        const localPending = local.filter((s) => s && !remoteIds.has(s.id) && !isDeleted(s.id) && !seenRemote.has(s.id) && (seenRemote.size > 0 || isRecentLocal(s)));
        rememberSeenRemote(this.getServiceExpensesKey(m), seenRemote, remoteIds);
        localPending.forEach((s) => {
          SupabaseSyncService.upsertServiceExpense(s, m).catch(() => {});
        });
        const merged = [...validRemote, ...localPending].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        saveToStorage(this.getServiceExpensesKey(m), merged);
      }
    } catch (err) {
      console.warn('[Sync ' + m + '] Sincronización secundaria pospuesta:', err);
    }
  },

  // Accounts
  getAccounts(mode?: AppMode): Account[] {
    const m = mode || this.getAppMode();
    const key = this.getAccountsKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            return parsed.map((acc: any) => ({
              ...acc,
              current_balance: Number(acc.current_balance) || 0,
              is_active: acc.is_active !== undefined && acc.is_active !== null ? Boolean(acc.is_active) : true,
            }));
          }
        } catch {
          // ignore
        }
      }
    }
    const initial = m === 'mayor' ? INITIAL_ACCOUNTS_MAYOR : INITIAL_ACCOUNTS_DETAL;
    if (initial && initial.length > 0) {
      saveToStorage(key, initial);
      return initial;
    }
    saveToStorage(key, []);
    return [];
  },


  saveAccounts(accounts: Account[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getAccountsKey(m), accounts);
  },

  addAccount(account: Account, mode?: AppMode): Account {
    unmarkDeleted(account.id);
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    const existingIndex = accounts.findIndex(
      (a) =>
        a.id === account.id ||
        (a.name && account.name && a.name.trim().toUpperCase() === account.name.trim().toUpperCase())
    );
    let updated: Account[];
    if (existingIndex >= 0) {
      updated = [...accounts];
      updated[existingIndex] = { ...accounts[existingIndex], ...account };
    } else {
      updated = [...accounts, account];
    }
    this.saveAccounts(updated, m);
    AuditService.log({
      mode: m,
      action: existingIndex >= 0 ? 'editar' : 'crear',
      entity: 'cuenta',
      entityId: account.id,
      summary: `${existingIndex >= 0 ? 'Actualizada' : 'Creada'} cuenta ${account.name} (${account.currency}) con saldo ${account.current_balance}`,
      data: account,
    });
    SupabaseSyncService.upsertAccount(account, m).catch((err) => {
      console.error(`[SupabaseSync] Error al subir cuenta ${account.name} a Supabase:`, err);
    });
    return account;
  },

  updateAccount(accountId: string, updates: Partial<Account>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    let updatedAcc: Account | null = null;
    let previous: Account | null = null;
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        previous = acc;
        updatedAcc = { ...acc, ...updates };
        return updatedAcc;
      }
      return acc;
    });
    this.saveAccounts(updated, m);
    const prev = previous as Account | null;
    const next = updatedAcc as Account | null;
    if (prev && next) {
      const balanceChanged =
        Math.abs((Number(prev.current_balance) || 0) - (Number(next.current_balance) || 0)) > 0.00005 ||
        Math.abs((Number(prev.initial_balance) || 0) - (Number(next.initial_balance) || 0)) > 0.00005;
      // Solo se registran en bitácora los cambios de dinero o de datos clave (no el orden en pantalla)
      const keys = Object.keys(updates).filter((k) => k !== 'order_index');
      if (balanceChanged || keys.length > 0) {
        AuditService.log({
          mode: m,
          action: 'editar',
          entity: 'cuenta',
          entityId: accountId,
          summary: balanceChanged
            ? `Saldo de ${next.name} cambiado de ${prev.current_balance} a ${next.current_balance}` +
              (prev.initial_balance !== next.initial_balance
                ? ` (saldo inicial ${prev.initial_balance ?? 0} → ${next.initial_balance ?? 0})`
                : '')
            : `Datos de la cuenta ${next.name} actualizados`,
          data: { antes: prev, despues: next },
        });
      }
    }
    if (updatedAcc) {
      SupabaseSyncService.upsertAccount(updatedAcc, m).catch(() => {});
    }
  },

  async deleteAccount(accountId: string, mode?: AppMode): Promise<void> {
    markAsDeleted(accountId);
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    const removed = accounts.find((acc) => acc.id === accountId);
    if (removed) {
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'cuenta',
        entityId: accountId,
        summary: `Eliminada cuenta ${removed.name} con saldo ${removed.current_balance} ${removed.currency}`,
        data: removed,
      });
    }
    const updated = accounts.filter((acc) => acc.id !== accountId);
    this.saveAccounts(updated, m);
    await SupabaseSyncService.deleteAccount(accountId, m).catch(() => {});
  },

  updateAccountBalance(accountId: string, delta: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const accounts = this.getAccounts(m);
    let updatedAcc: Account | null = null;
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        updatedAcc = {
          ...acc,
          current_balance: Number((acc.current_balance + delta).toFixed(4)),
        };
        return updatedAcc;
      }
      return acc;
    });
    this.saveAccounts(updated, m);
    if (updatedAcc) {
      SupabaseSyncService.upsertAccount(updatedAcc, m).catch(() => {});
    }
  },

  // ── Ajustes de saldo con motivo ──
  getAdjustments(mode?: AppMode): BalanceAdjustment[] {
    const m = mode || this.getAppMode();
    return getFromStorage<BalanceAdjustment[]>(this.getAdjustmentsKey(m), []);
  },

  saveAdjustment(adj: BalanceAdjustment, mode: AppMode): BalanceAdjustment {
    const all = this.getAdjustments(mode);
    all.unshift(adj);
    saveToStorage(this.getAdjustmentsKey(mode), all);
    SupabaseSyncService.upsertAdjustment(adj, mode).catch(() => {});
    AuditService.log({
      mode,
      action: 'ajuste_saldo',
      entity: 'cuenta',
      entityId: adj.account_id,
      summary:
        adj.kind === 'manual'
          ? `Ajuste de saldo ${adj.account_name}: ${adj.previous_balance} → ${adj.new_balance} ${adj.currency}`
          : `Diferencia reconocida en ${adj.account_name}: ${adj.delta > 0 ? '+' : ''}${adj.delta} ${adj.currency}`,
      reason: adj.reason,
      data: adj,
    });
    return adj;
  },

  // Cambia el saldo de una cuenta dejando un ajuste con motivo (reemplaza la edición directa del número)
  adjustAccountBalance(accountId: string, newBalance: number, reason: string, mode?: AppMode): BalanceAdjustment | null {
    const m = mode || this.getAppMode();
    const acc = this.getAccounts(m).find((a) => a.id === accountId);
    if (!acc) return null;
    const delta = Number((newBalance - (acc.current_balance || 0)).toFixed(4));
    if (Math.abs(delta) < 0.00005) return null;
    const motivo = (reason || '').trim();
    if (!motivo) throw new Error('El ajuste de saldo necesita un motivo.');
    const today = localDateStr();
    this.assertDayOpen(today, m, 'ajustar un saldo');
    const adj: BalanceAdjustment = {
      id: 'adj-' + Date.now(),
      date: today,
      account_id: acc.id,
      account_name: acc.name,
      currency: acc.currency,
      previous_balance: Number((acc.current_balance || 0).toFixed(4)),
      new_balance: Number(newBalance.toFixed(4)),
      delta,
      reason: motivo,
      kind: 'manual',
      user_email: getActor()?.email,
      created_at: new Date().toISOString(),
    };
    this.saveAdjustment(adj, m);
    this.updateAccountBalance(acc.id, delta, m);
    return adj;
  },

  // Reconoce en el libro una diferencia que ya existe en el saldo (no cambia el saldo)
  recognizeDifference(accountId: string, difference: number, reason: string, mode?: AppMode): BalanceAdjustment | null {
    const m = mode || this.getAppMode();
    if (!isActorAdmin()) throw new Error('Solo un ADMIN puede reconocer diferencias de saldo.');
    const acc = this.getAccounts(m).find((a) => a.id === accountId);
    if (!acc || Math.abs(difference) < 0.00005) return null;
    const motivo = (reason || '').trim();
    if (!motivo) throw new Error('Hace falta un motivo.');
    const today = localDateStr();
    this.assertDayOpen(today, m, 'reconocer una diferencia de saldo');
    const adj: BalanceAdjustment = {
      id: 'adj-' + Date.now(),
      date: today,
      account_id: acc.id,
      account_name: acc.name,
      currency: acc.currency,
      previous_balance: Number(((acc.current_balance || 0) - difference).toFixed(4)),
      new_balance: Number((acc.current_balance || 0).toFixed(4)),
      delta: Number(difference.toFixed(4)),
      reason: motivo,
      kind: 'reconciliacion',
      user_email: getActor()?.email,
      created_at: new Date().toISOString(),
    };
    return this.saveAdjustment(adj, m);
  },

  // Datos de ambas unidades (detal y mayor) para armar el libro contable
  getLedgerSources(): LedgerSources {
    const modes: AppMode[] = ['detal', 'mayor'];
    const accounts: Account[] = [];
    const seen = new Set<string>();
    modes.forEach((mm) =>
      this.getAccounts(mm).forEach((a) => {
        if (a && a.id && !seen.has(a.id)) {
          seen.add(a.id);
          accounts.push({ ...a, scope: a.scope || mm });
        }
      })
    );
    const byMode = {} as LedgerSources['byMode'];
    modes.forEach((mm) => {
      byMode[mm] = {
        detalTxs: getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(mm), []).filter(Boolean),
        mayorTxs: getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(mm), []).filter(Boolean),
        transfers: this.getTransfers(mm).filter(Boolean),
        expenses: this.getExpenses(mm).filter(Boolean),
        purchases: this.getSupplierPurchases(mm).filter(Boolean),
        supplierPayments: this.getSupplierPayments(mm).filter(Boolean),
        debtPayments: this.getDebtPayments(mm).filter(Boolean),
        adjustments: this.getAdjustments(mm).filter(Boolean),
        remesas: this.getRemesas(mm).filter(Boolean),
      };
    });
    return { accounts, byMode };
  },

  // ── Remesas ──
  getRemesas(mode?: AppMode): Remesa[] {
    const m = mode || this.getAppMode();
    return getFromStorage<Remesa[]>(this.getRemesasKey(m), []);
  },

  getRemitentes(mode?: AppMode): Remitente[] {
    const m = mode || this.getAppMode();
    return getFromStorage<Remitente[]>(this.getRemitentesKey(m), []);
  },

  // Crea o actualiza un remitente (y agrega el beneficiario si es nuevo)
  saveRemitente(
    data: { id?: string; name: string; identification?: string; phone?: string },
    beneficiario: Beneficiario | null,
    mode?: AppMode
  ): { remitente: Remitente; beneficiario: Beneficiario | null } {
    const m = mode || this.getAppMode();
    const all = this.getRemitentes(m);
    const name = data.name.trim().toUpperCase();
    let rem =
      all.find((r) => data.id && r.id === data.id) ||
      all.find((r) => r.name.trim().toUpperCase() === name) ||
      null;
    if (!rem) {
      rem = {
        id: 'rem-' + Date.now(),
        name,
        identification: data.identification?.trim() || '',
        phone: data.phone?.trim() || '',
        beneficiarios: [],
        created_at: new Date().toISOString(),
      };
      all.unshift(rem);
    } else {
      rem.identification = data.identification?.trim() || rem.identification;
      rem.phone = data.phone?.trim() || rem.phone;
    }
    let ben: Beneficiario | null = null;
    if (beneficiario) {
      const bname = beneficiario.name.trim().toUpperCase();
      ben =
        rem.beneficiarios.find((b) => b.id === beneficiario.id) ||
        rem.beneficiarios.find(
          (b) => b.name.trim().toUpperCase() === bname && b.country === beneficiario.country
        ) ||
        null;
      if (ben) {
        Object.assign(ben, { ...beneficiario, id: ben.id, name: bname });
      } else {
        ben = { ...beneficiario, id: 'ben-' + Date.now(), name: bname };
        rem.beneficiarios.push(ben);
      }
    }
    rem.updated_at = new Date().toISOString();
    saveToStorage(this.getRemitentesKey(m), all);
    SupabaseSyncService.upsertRemitente(rem, m).catch(() => {});
    return { remitente: rem, beneficiario: ben };
  },

  updateBeneficiario(remitenteId: string, ben: Beneficiario, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getRemitentes(m);
    const rem = all.find((r) => r.id === remitenteId);
    const cur = rem?.beneficiarios.find((b) => b.id === ben.id);
    if (!rem || !cur) throw new Error('No se encontró el beneficiario.');
    if (!ben.name.trim()) throw new Error('El beneficiario necesita un nombre.');
    Object.assign(cur, { ...ben, id: cur.id, country: ben.country || cur.country, name: ben.name.trim().toUpperCase() });
    rem.updated_at = new Date().toISOString();
    saveToStorage(this.getRemitentesKey(m), all);
    SupabaseSyncService.upsertRemitente(rem, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'beneficiario',
      entityId: cur.id,
      summary: `Beneficiario ${cur.name} de ${rem.name} actualizado`,
      data: { ...cur },
    });
  },

  // Al renombrar un cliente, sus beneficiarios lo siguen (el remitente se busca por nombre)
  renameRemitente(oldName: string, newName: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const from = oldName.trim().toUpperCase();
    const to = newName.trim().toUpperCase();
    if (!from || !to || from === to) return;
    const all = this.getRemitentes(m);
    const rem = all.find((r) => r.name.trim().toUpperCase() === from);
    if (!rem || all.some((r) => r.name.trim().toUpperCase() === to)) return;
    rem.name = to;
    rem.updated_at = new Date().toISOString();
    saveToStorage(this.getRemitentesKey(m), all);
    SupabaseSyncService.upsertRemitente(rem, m).catch(() => {});
  },

  deleteBeneficiario(remitenteId: string, beneficiarioId: string, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getRemitentes(m);
    const rem = all.find((r) => r.id === remitenteId);
    const cur = rem?.beneficiarios.find((b) => b.id === beneficiarioId);
    if (!rem || !cur) return;
    rem.beneficiarios = rem.beneficiarios.filter((b) => b.id !== beneficiarioId);
    rem.updated_at = new Date().toISOString();
    saveToStorage(this.getRemitentesKey(m), all);
    SupabaseSyncService.upsertRemitente(rem, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'eliminar',
      entity: 'beneficiario',
      entityId: cur.id,
      summary: `Beneficiario ${cur.name} de ${rem.name} eliminado (las remesas anteriores conservan sus datos)`,
      data: { ...cur },
    });
  },

  getRemesaPrefs(mode?: AppMode): Record<string, { metodo: RemesaMetodoPago; cuenta_pago_id?: string; aliado_id?: string }> {
    const m = mode || this.getAppMode();
    return getFromStorage(this.getRemesaPrefsKey(m), {});
  },

  saveRemesaPref(pais: string, pref: { metodo: RemesaMetodoPago; cuenta_pago_id?: string; aliado_id?: string }, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const prefs = this.getRemesaPrefs(m);
    prefs[pais] = pref;
    saveToStorage(this.getRemesaPrefsKey(m), prefs);
  },

  persistRemesa(remesa: Remesa, mode: AppMode): void {
    const all = this.getRemesas(mode);
    const idx = all.findIndex((r) => r.id === remesa.id);
    if (idx >= 0) all[idx] = remesa;
    else all.unshift(remesa);
    saveToStorage(this.getRemesasKey(mode), all);
    SupabaseSyncService.upsertRemesa(remesa, mode).catch(() => {});
  },

  // Registrar una remesa: el dinero del remitente entra a la cuenta de cobro
  createRemesa(
    input: Omit<Remesa, 'id' | 'numero' | 'created_at' | 'estado' | 'historial' | 'date'>,
    mode?: AppMode
  ): Remesa {
    const m = mode || this.getAppMode();
    const today = localDateStr();
    this.assertDayOpen(today, m, 'registrar una remesa');
    if (!input.cuenta_cobro_id) throw new Error('Falta la cuenta donde se cobró.');
    if (!(input.total_cobrado > 0) || !(input.monto_pago > 0)) throw new Error('Los montos deben ser mayores que cero.');
    if ((input.monto_fiado || 0) < 0 || (input.monto_fiado || 0) > input.total_cobrado)
      throw new Error('El fiado no puede ser mayor que el total a cobrar.');
    const all = this.getRemesas(m);
    const numero = all.reduce((max, r) => Math.max(max, r.numero || 0), 0) + 1;
    const now = new Date().toISOString();
    const remesa: Remesa = {
      ...input,
      id: 'rms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      numero,
      date: today,
      created_at: now,
      estado: 'cobrada',
      historial: [{ estado: 'cobrada', ts: now, date: today, user_email: getActor()?.email }],
    };
    this.persistRemesa(remesa, m);
    const caja = remesa.total_cobrado - (remesa.monto_fiado || 0);
    if (caja) this.updateAccountBalance(remesa.cuenta_cobro_id, caja, m);
    this.saveRemesaPref(
      remesa.pais_pago,
      { metodo: remesa.metodo_pago, cuenta_pago_id: remesa.cuenta_pago_id, aliado_id: remesa.aliado_id },
      m
    );
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'remesa',
      entityId: remesa.id,
      summary: `Remesa #${remesa.numero} de ${remesa.remitente_name} a ${remesa.beneficiario.name} (${remesa.pais_pago}): cobrado ${remesa.total_cobrado} ${remesa.moneda_origen}${remesa.monto_fiado ? ` (fiado ${remesa.monto_fiado})` : ''}, a pagar ${remesa.monto_pago} ${remesa.moneda_pago}`,
      data: remesa,
    });
    // El fiado aparece en Deudores (se recalcula desde las remesas)
    if (remesa.fiado_usd) this.getDebtors(m);
    return remesa;
  },

  // Cambia el estado de una remesa y mueve los saldos que correspondan
  changeRemesaEstado(
    id: string,
    nuevo: RemesaEstado,
    opts: {
      nota?: string;
      referencia_pago?: string;
      metodo_pago?: RemesaMetodoPago;
      cuenta_pago_id?: string;
      aliado_id?: string;
      aliado_name?: string;
    } = {},
    mode?: AppMode
  ): Remesa {
    const m = mode || this.getAppMode();
    const remesa = this.getRemesas(m).find((r) => r.id === id);
    if (!remesa) throw new Error('No se encontró la remesa.');
    const allowed: Record<RemesaEstado, RemesaEstado[]> = {
      cobrada: ['en_proceso', 'pagada', 'anulada'],
      en_proceso: ['pagada', 'fallida', 'anulada'],
      fallida: ['en_proceso', 'anulada'],
      pagada: [],
      anulada: [],
    };
    if (!allowed[remesa.estado].includes(nuevo)) {
      throw new Error(`Una remesa ${remesa.estado.replace('_', ' ')} no puede pasar a ${nuevo.replace('_', ' ')}.`);
    }
    const today = localDateStr();
    const now = new Date().toISOString();
    const updated: Remesa = { ...remesa, historial: [...(remesa.historial || [])] };

    if (opts.metodo_pago) {
      updated.metodo_pago = opts.metodo_pago;
      updated.cuenta_pago_id = opts.metodo_pago === 'cuenta_propia' ? opts.cuenta_pago_id : undefined;
      updated.aliado_id = opts.metodo_pago === 'aliado' ? opts.aliado_id : undefined;
      updated.aliado_name = opts.metodo_pago === 'aliado' ? opts.aliado_name : undefined;
    }

    if (nuevo === 'pagada') {
      this.assertDayOpen(today, m, 'marcar una remesa como pagada');
      if (updated.metodo_pago === 'cuenta_propia') {
        if (!updated.cuenta_pago_id) throw new Error('Elige la cuenta desde donde se pagó.');
        this.updateAccountBalance(updated.cuenta_pago_id, -updated.monto_pago, m);
      } else {
        if (!updated.aliado_id) throw new Error('Elige el aliado que pagó.');
        this.updateSupplierDebt(updated.aliado_id, updated.costo_usd, m);
      }
      updated.fecha_pago = today;
      updated.referencia_pago = opts.referencia_pago || updated.referencia_pago;
    }

    if (nuevo === 'anulada') {
      if (!isActorAdmin()) throw new Error('Solo un ADMIN puede anular una remesa.');
      if (!(opts.nota || '').trim()) throw new Error('Para anular hace falta un motivo.');
      this.assertDayOpen(today, m, 'anular una remesa');
      // Se devuelve al remitente lo cobrado: sale de la cuenta de cobro
      const caja = updated.total_cobrado - (updated.monto_fiado || 0);
      if (caja) this.updateAccountBalance(updated.cuenta_cobro_id, -caja, m);
      updated.fecha_anulacion = today;
    }

    updated.estado = nuevo;
    updated.historial.push({ estado: nuevo, ts: now, date: today, user_email: getActor()?.email, nota: opts.nota });
    this.persistRemesa(updated, m);
    if (opts.metodo_pago) {
      this.saveRemesaPref(
        updated.pais_pago,
        { metodo: updated.metodo_pago, cuenta_pago_id: updated.cuenta_pago_id, aliado_id: updated.aliado_id },
        m
      );
    }
    AuditService.log({
      mode: m,
      action: nuevo === 'anulada' ? 'eliminar' : 'editar',
      entity: 'remesa',
      entityId: id,
      summary: `Remesa #${updated.numero} (${updated.beneficiario.name}) pasó de ${remesa.estado.replace('_', ' ')} a ${nuevo.replace('_', ' ')}`,
      reason: opts.nota,
      data: { antes: remesa.estado, despues: nuevo, referencia_pago: updated.referencia_pago },
    });
    // Al anular, el fiado sale de Deudores
    if (nuevo === 'anulada' && updated.fiado_usd) this.getDebtors(m);
    return updated;
  },

  // Solo ADMIN: deshace el pago de una remesa pagada y la devuelve a "cobrada"
  revertirPagoRemesa(id: string, nota: string, mode?: AppMode): Remesa {
    const m = mode || this.getAppMode();
    const remesa = this.getRemesas(m).find((r) => r.id === id);
    if (!remesa) throw new Error('No se encontró la remesa.');
    if (remesa.estado !== 'pagada') throw new Error('Solo se puede revertir el pago de una remesa pagada.');
    if (!isActorAdmin()) throw new Error('Solo un ADMIN puede revertir el pago de una remesa.');
    const motivo = (nota || '').trim();
    if (!motivo) throw new Error('Para revertir el pago hace falta un motivo.');
    const today = localDateStr();
    this.assertDayOpen(today, m, 'revertir el pago de una remesa');
    const now = new Date().toISOString();

    // Se devuelve lo pagado: vuelve a la cuenta de pago, o se le baja la deuda al aliado
    if (remesa.metodo_pago === 'cuenta_propia') {
      if (remesa.cuenta_pago_id) this.updateAccountBalance(remesa.cuenta_pago_id, remesa.monto_pago, m);
    } else if (remesa.aliado_id) {
      this.updateSupplierDebt(remesa.aliado_id, -remesa.costo_usd, m);
    }

    const pago = [...(remesa.historial || [])].reverse().find((h) => h.estado === 'pagada');
    const updated: Remesa = {
      ...remesa,
      estado: 'cobrada',
      fecha_pago: undefined,
      pagos_revertidos: [
        ...(remesa.pagos_revertidos || []),
        {
          fecha_pago: remesa.fecha_pago || pago?.date || today,
          ts_pago: pago?.ts,
          fecha_reverso: today,
          ts: now,
          metodo_pago: remesa.metodo_pago,
          cuenta_pago_id: remesa.cuenta_pago_id,
          aliado_id: remesa.aliado_id,
          aliado_name: remesa.aliado_name,
          monto_pago: remesa.monto_pago,
          costo_usd: remesa.costo_usd,
          ganancia_usd: remesa.ganancia_usd,
          referencia_pago: remesa.referencia_pago,
          nota: motivo,
          user_email: getActor()?.email,
        },
      ],
      historial: [
        ...(remesa.historial || []),
        { estado: 'cobrada', ts: now, date: today, user_email: getActor()?.email, nota: 'Pago revertido: ' + motivo },
      ],
    };
    this.persistRemesa(updated, m);
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'remesa',
      entityId: id,
      summary: `Remesa #${updated.numero} (${updated.beneficiario.name}): pago revertido, vuelve a cobrada`,
      reason: motivo,
      data: { antes: 'pagada', despues: 'cobrada', metodo_pago: remesa.metodo_pago, monto_pago: remesa.monto_pago },
    });
    return updated;
  },

  // Corrige el remitente de una remesa. La deuda fiada se recalcula sola en Deudores porque
  // sale de remitente_name; el beneficiario se copia al remitente nuevo.
  renameRemesaRemitente(id: string, newName: string, mode?: AppMode): Remesa | null {
    const m = mode || this.getAppMode();
    const remesa = this.getRemesas(m).find((r) => r.id === id);
    const upperNew = newName.trim().toUpperCase();
    if (!remesa || !upperNew) return null;
    if (remesa.remitente_name.trim().toUpperCase() === upperNew) return remesa;
    const { remitente } = this.saveRemitente({ name: upperNew }, remesa.beneficiario, m);
    const updated: Remesa = {
      ...remesa,
      remitente_id: remitente.id,
      remitente_name: remitente.name,
      remitente_identification: remitente.identification,
      remitente_phone: remitente.phone,
    };
    this.persistRemesa(updated, m);
    if (remesa.fiado_usd) this.getDebtors(m);
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'remesa',
      entityId: id,
      summary: `Remesa #${remesa.numero}: remitente cambiado de ${remesa.remitente_name} a ${remitente.name}`,
      data: updated,
    });
    return updated;
  },

  editRemesa(
    id: string,
    changes: { remitente_name?: string; cuenta_cobro_id?: string; cuenta_pago_id?: string },
    mode?: AppMode
  ): Remesa | null {
    const m = mode || this.getAppMode();
    let remesa = this.getRemesas(m).find((r) => r.id === id);
    if (!remesa) return null;
    const cobroChanged = !!changes.cuenta_cobro_id && changes.cuenta_cobro_id !== remesa.cuenta_cobro_id;
    const pagoChanged =
      !!changes.cuenta_pago_id &&
      changes.cuenta_pago_id !== remesa.cuenta_pago_id &&
      remesa.estado === 'pagada' &&
      remesa.metodo_pago === 'cuenta_propia';
    if (cobroChanged || pagoChanged) {
      this.assertDayOpen(remesa.date, m, 'cambiar la cuenta de una remesa');
      if (cobroChanged && remesa.estado !== 'anulada') {
        const caja = remesa.total_cobrado - (remesa.monto_fiado || 0);
        this.moveAccountEffect(remesa.cuenta_cobro_id, changes.cuenta_cobro_id!, caja, m);
      } else if (cobroChanged) {
        this.moveAccountEffect(remesa.cuenta_cobro_id, changes.cuenta_cobro_id!, 0, m);
      }
      if (pagoChanged) {
        this.moveAccountEffect(remesa.cuenta_pago_id, changes.cuenta_pago_id!, -remesa.monto_pago, m);
      }
      const updated: Remesa = {
        ...remesa,
        cuenta_cobro_id: cobroChanged ? changes.cuenta_cobro_id! : remesa.cuenta_cobro_id,
        cuenta_pago_id: pagoChanged ? changes.cuenta_pago_id : remesa.cuenta_pago_id,
      };
      this.persistRemesa(updated, m);
      AuditService.log({
        mode: m,
        action: 'editar',
        entity: 'remesa',
        entityId: id,
        summary: `Remesa #${remesa.numero}: cuentas cambiadas`,
        data: {
          antes: { cobro: remesa.cuenta_cobro_id, pago: remesa.cuenta_pago_id },
          despues: { cobro: updated.cuenta_cobro_id, pago: updated.cuenta_pago_id },
        },
      });
      remesa = updated;
    }
    if (changes.remitente_name) remesa = this.renameRemesaRemitente(id, changes.remitente_name, m) || remesa;
    return remesa;
  },

  // Clients
  getClients(mode?: AppMode): Client[] {
    const m = mode || this.getAppMode();
    const key = this.getClientsKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          const list: Client[] = JSON.parse(item) || [];
          return list.sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
          );
        } catch {
          return [];
        }
      }
    }
    saveToStorage(key, []);
    return [];
  },

  saveClients(clients: Client[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const sorted = [...clients].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
    );
    saveToStorage(this.getClientsKey(m), sorted);
  },

  addClient(client: Omit<Client, 'id' | 'created_at'>, mode?: AppMode): Client {
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    const upperName = (client.name || '').trim().toUpperCase();
    const existing = all.find((c) => (c.name || '').trim().toUpperCase() === upperName);
    if (existing) {
      unmarkDeleted(existing.id);
      this.updateClient(existing.id, client, m);
      return { ...existing, ...client };
    }
    const newClient: Client = {
      ...client,
      id: 'cli-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newClient.id);
    all.unshift(newClient);
    this.saveClients(all, m);
    SupabaseSyncService.upsertClient(newClient, m).catch(() => {});
    return newClient;
  },

  updateClient(clientId: string, updates: Partial<Client>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    let updatedClient: Client | null = null;
    const updated = all.map((c) => {
      if (c.id === clientId) {
        updatedClient = { ...c, ...updates };
        return updatedClient;
      }
      return c;
    });
    this.saveClients(updated, m);
    if (updatedClient) {
      SupabaseSyncService.upsertClient(updatedClient, m).catch(() => {});
    }
  },

  async deleteClient(clientId: string, mode?: AppMode): Promise<void> {
    markAsDeleted(clientId);
    const m = mode || this.getAppMode();
    const all = this.getClients(m);
    const updated = all.filter((c) => c.id !== clientId);
    this.saveClients(updated, m);
    await SupabaseSyncService.deleteClient(clientId, m).catch(() => {});
  },

  // Suppliers & Purchases
  getSuppliers(mode?: AppMode): Supplier[] {
    const m = mode || this.getAppMode();
    const key = this.getSuppliersKey(m);
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item !== null) {
        try {
          return JSON.parse(item) || [];
        } catch {
          return [];
        }
      }
    }
    saveToStorage(key, []);
    return [];
  },



  saveSuppliers(suppliers: Supplier[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getSuppliersKey(m), suppliers);
  },

  updateSupplierDebt(supplierId: string, deltaUsd: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const suppliers = this.getSuppliers(m);
    let updatedSup: Supplier | null = null;
    const updated = suppliers.map((s) => {
      if (s.id === supplierId) {
        updatedSup = {
          ...s,
          current_debt_usd: Number((s.current_debt_usd + deltaUsd).toFixed(2)),
        };
        return updatedSup;
      }
      return s;
    });
    this.saveSuppliers(updated, m);
    if (updatedSup) {
      SupabaseSyncService.upsertSupplier(updatedSup, m).catch(() => {});
    }
  },

  addSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>, mode?: AppMode): Supplier {
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    const newSupplier: Supplier = {
      ...supplier,
      id: 'sup-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newSupplier.id);
    all.unshift(newSupplier);
    this.saveSuppliers(all, m);
    SupabaseSyncService.upsertSupplier(newSupplier, m).catch(() => {});
    return newSupplier;
  },

  updateSupplier(supplierId: string, updates: Partial<Supplier>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    let updatedSup: Supplier | null = null;
    const updated = all.map((s) => {
      if (s.id === supplierId) {
        updatedSup = { ...s, ...updates };
        return updatedSup;
      }
      return s;
    });
    this.saveSuppliers(updated, m);
    if (updatedSup) {
      SupabaseSyncService.upsertSupplier(updatedSup, m).catch(() => {});
    }
  },

  async deleteSupplier(supplierId: string, mode?: AppMode): Promise<void> {
    markAsDeleted(supplierId);
    const m = mode || this.getAppMode();
    const all = this.getSuppliers(m);
    const updated = all.filter((s) => s.id !== supplierId);
    this.saveSuppliers(updated, m);
    await SupabaseSyncService.deleteSupplier(supplierId, m).catch(() => {});
  },

  getSupplierPurchases(mode?: AppMode): SupplierPurchase[] {
    const m = mode || this.getAppMode();
    return getFromStorage<SupplierPurchase[]>(this.getSupplierPurchasesKey(m), []);
  },

  addSupplierPurchase(purchase: Omit<SupplierPurchase, 'id' | 'created_at'>, mode?: AppMode): SupplierPurchase {
    const m = mode || this.getAppMode();
    this.assertDayOpen(purchase.date, m, 'registrar una compra a proveedor');
    const all = this.getSupplierPurchases(m);
    const newPurchase: SupplierPurchase = {
      ...purchase,
      id: 'pur-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newPurchase.id);
    all.unshift(newPurchase);
    saveToStorage(this.getSupplierPurchasesKey(m), all);

    const netDebtIncrease = newPurchase.cost_usd - newPurchase.credited_amount;
    this.updateSupplierDebt(newPurchase.supplier_id, netDebtIncrease, m);

    if (newPurchase.account_id && newPurchase.quantity > 0) {
      this.updateAccountBalance(newPurchase.account_id, newPurchase.quantity, m);
    }

    SupabaseSyncService.upsertSupplierPurchase(newPurchase, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'compra_proveedor',
      entityId: newPurchase.id,
      summary: `Compra a ${newPurchase.supplier_name}: ${newPurchase.quantity} ${newPurchase.currency} por ${newPurchase.cost_usd} USD`,
      data: newPurchase,
    });
    return newPurchase;
  },

  getSupplierPayments(mode?: AppMode): SupplierPayment[] {
    const m = mode || this.getAppMode();
    return getFromStorage<SupplierPayment[]>(this.getSupplierPaymentsKey(m), []);
  },

  addSupplierPayment(payment: Omit<SupplierPayment, 'id' | 'created_at'>, mode?: AppMode): SupplierPayment {
    const m = mode || this.getAppMode();
    this.assertDayOpen(payment.date, m, 'registrar un pago a proveedor');
    const all = this.getSupplierPayments(m);
    const newPayment: SupplierPayment = {
      ...payment,
      id: 'pay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newPayment.id);
    all.unshift(newPayment);
    saveToStorage(this.getSupplierPaymentsKey(m), all);

    this.updateSupplierDebt(newPayment.supplier_id, -newPayment.amount_usd, m);

    if (newPayment.account_id && newPayment.amount_usd > 0) {
      this.updateAccountBalance(newPayment.account_id, -newPayment.amount_usd, m);
    }

    SupabaseSyncService.upsertSupplierPayment(newPayment, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'pago_proveedor',
      entityId: newPayment.id,
      summary: `Pago a proveedor ${newPayment.supplier_name}: ${newPayment.amount_usd}`,
      data: newPayment,
    });
    return newPayment;
  },

  // Quitar una copia repetida que llegó por sincronización: borra el registro SIN mover saldos ni deudas,
  // porque esa copia nunca los movió. Solo ADMIN, con motivo y en día abierto.
  async removeDuplicateRecord(kind: 'traspaso' | 'compra_proveedor', id: string, reason: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    if (!isActorAdmin()) throw new Error('Solo un ADMIN puede quitar copias repetidas.');
    const motivo = (reason || '').trim();
    if (!motivo) throw new Error('Hace falta un motivo.');
    const key = kind === 'traspaso' ? this.getTransfersKey(m) : this.getSupplierPurchasesKey(m);
    const all = getFromStorage<{ id: string; date: string }[]>(key, []);
    const rec = all.find((r) => r && r.id === id);
    if (!rec) return;
    this.assertDayOpen(rec.date, m, 'quitar una copia repetida');
    AuditService.log({
      mode: m,
      action: 'eliminar',
      entity: kind,
      entityId: id,
      summary: `Quitada copia repetida del ${rec.date} (sin mover saldos ni deudas)`,
      reason: motivo,
      data: rec,
    });
    markAsDeleted(id);
    saveToStorage(
      key,
      all.filter((r) => r && r.id !== id),
    );
    if (kind === 'traspaso') await SupabaseSyncService.deleteTransfer(id, m).catch(() => {});
    else await SupabaseSyncService.deleteSupplierPurchase(id, m).catch(() => {});
  },

  async deleteSupplierPurchase(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPurchases(m);
    const purchase = all.find((p) => p.id === id);
    if (purchase) {
      this.assertDayOpen(purchase.date, m, 'anular una compra a proveedor');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'compra_proveedor',
        entityId: id,
        summary: 'Anulado registro del ' + purchase.date,
        data: purchase,
      });
    }
    markAsDeleted(id);
    if (purchase) {
      const netDebtIncrease = purchase.cost_usd - (purchase.credited_amount || 0);
      this.updateSupplierDebt(purchase.supplier_id, -netDebtIncrease, m);
      if (purchase.account_id && purchase.quantity > 0) {
        this.updateAccountBalance(purchase.account_id, -purchase.quantity, m);
      }
    }
    saveToStorage(this.getSupplierPurchasesKey(m), all.filter((p) => p.id !== id));
    await SupabaseSyncService.deleteSupplierPurchase(id, m).catch(() => {});
  },

  async deleteSupplierPayment(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getSupplierPayments(m);
    const payment = all.find((p) => p.id === id);
    if (payment) {
      this.assertDayOpen(payment.date, m, 'anular un pago a proveedor');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'pago_proveedor',
        entityId: id,
        summary: 'Anulado registro del ' + payment.date,
        data: payment,
      });
    }
    markAsDeleted(id);
    if (payment) {
      this.updateSupplierDebt(payment.supplier_id, payment.amount_usd, m);
      if (payment.account_id && payment.amount_usd > 0) {
        this.updateAccountBalance(payment.account_id, payment.amount_usd, m);
      }
    }
    saveToStorage(this.getSupplierPaymentsKey(m), all.filter((p) => p.id !== id));
    await SupabaseSyncService.deleteSupplierPayment(id, m).catch(() => {});
  },

  // Detal Transactions (Ventas Cripto / Dólar) - 100% aisladas por modo
  getTransactionsDetal(mode?: AppMode): TransactionDetal[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []);
  },

  addTransactionDetal(tx: Omit<TransactionDetal, 'id' | 'created_at'>, mode?: AppMode): TransactionDetal {
    const m = mode || this.getAppMode();
    this.assertDayOpen(tx.date, m, 'registrar una venta');
    const all = this.getTransactionsDetal(m);
    const newTx: TransactionDetal = {
      ...tx,
      id: 'detal-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newTx.id);
    all.unshift(newTx);
    saveToStorage(this.getTransactionsDetalKey(m), all);

    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && newTx.amount_received > 0) {
      this.updateAccountBalance(newTx.received_account_id, newTx.amount_received, m);
    }
    if (newTx.paid_account_id && newTx.usdt_amount > 0) {
      const totalOut = newTx.usdt_amount + (newTx.bank_fee || 0);
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, m);
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - (newTx.amount_received || 0)).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid, m);
    }

    SupabaseSyncService.upsertTransactionDetal(newTx, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'venta_detal',
      entityId: newTx.id,
      summary: `Venta detal a ${newTx.client_name}: ${newTx.usdt_amount} USDT, cobrado ${newTx.amount_received}, ganancia ${newTx.profit_usd} USD`,
      data: newTx,
    });
    return newTx;
  },

  async deleteTransactionDetal(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsDetal(m);
    const tx = all.find((t) => t.id === id);
    if (tx) {
      this.assertDayOpen(tx.date, m, 'anular una venta');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'venta_detal',
        entityId: id,
        summary: 'Anulado registro del ' + tx.date,
        data: tx,
      });
    }
    markAsDeleted(id);
    if (tx) {
      const unpaid = Number(((tx.total_to_pay || 0) - (tx.amount_received || 0)).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid, m);
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && tx.amount_received > 0) {
        this.updateAccountBalance(tx.received_account_id, -tx.amount_received, m);
      }
      if (tx.paid_account_id && tx.usdt_amount > 0) {
        const totalOut = tx.usdt_amount + (tx.bank_fee || 0);
        this.updateAccountBalance(tx.paid_account_id, totalOut, m);
      }
    }
    saveToStorage(this.getTransactionsDetalKey(m), all.filter((t) => t.id !== id));
    await SupabaseSyncService.deleteTransactionDetal(id, m).catch(() => {});
  },

  // Mayor Transactions (Ventas Monedas Regionales) - 100% aisladas por modo
  getTransactionsMayor(mode?: AppMode): TransactionMayor[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []);
  },

  addTransactionMayor(tx: Omit<TransactionMayor, 'id' | 'created_at'>, mode?: AppMode): TransactionMayor {
    const m = mode || this.getAppMode();
    this.assertDayOpen(tx.date, m, 'registrar una venta');
    const all = this.getTransactionsMayor(m);
    const newTx: TransactionMayor = {
      ...tx,
      id: 'mayor-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newTx.id);
    all.unshift(newTx);
    saveToStorage(this.getTransactionsMayorKey(m), all);

    if (newTx.paid_account_id && newTx.amount_ves > 0) {
      const accounts = this.getAccounts(m);
      const paidAcc = accounts.find((a) => a.id === newTx.paid_account_id);
      const totalOut = newTx.amount_ves + commissionOutOfAccount(newTx, paidAcc?.currency);
      this.updateAccountBalance(newTx.paid_account_id, -totalOut, m);
    }
    const receivedAmt = newTx.amount_received !== undefined ? newTx.amount_received : 0;
    if (newTx.received_account_id && newTx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
      this.updateAccountBalance(newTx.received_account_id, receivedAmt, m);
    }

    const unpaid = Number(((newTx.total_to_pay || 0) - receivedAmt).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(newTx.client_name, unpaid, m);
    }

    SupabaseSyncService.upsertTransactionMayor(newTx, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'venta_mayor',
      entityId: newTx.id,
      summary: `Venta mayor a ${newTx.client_name}: ${newTx.amount_ves} ${newTx.currency || 'VES'}, ganancia ${newTx.profit_usd} USD`,
      data: newTx,
    });
    return newTx;
  },

  async deleteTransactionMayor(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsMayor(m);
    const tx = all.find((t) => t.id === id);
    if (tx) {
      this.assertDayOpen(tx.date, m, 'anular una venta');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'venta_mayor',
        entityId: id,
        summary: 'Anulado registro del ' + tx.date,
        data: tx,
      });
    }
    markAsDeleted(id);
    if (tx) {
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      const unpaid = Number(((tx.total_to_pay || 0) - receivedAmt).toFixed(2));
      if (unpaid > 0) {
        this.increaseClientDebt(tx.client_name, -unpaid, m);
      }
      if (tx.paid_account_id && tx.amount_ves > 0) {
        const accounts = this.getAccounts(m);
        const paidAcc = accounts.find((a) => a.id === tx.paid_account_id);
        const totalOut = tx.amount_ves + commissionOutOfAccount(tx, paidAcc?.currency);
        this.updateAccountBalance(tx.paid_account_id, totalOut, m);
      }
      if (tx.received_account_id && tx.received_account_id !== 'POR_COBRAR' && receivedAmt > 0) {
        this.updateAccountBalance(tx.received_account_id, -receivedAmt, m);
      }
    }
    saveToStorage(this.getTransactionsMayorKey(m), all.filter((tx) => tx.id !== id));
    await SupabaseSyncService.deleteTransactionMayor(id, m).catch(() => {});
  },

  // Corrige el cliente de una venta sin anularla. Si quedó fiada, la deuda pasa al cliente nuevo;
  // montos, tasas y cuentas no cambian.
  renameTransactionDetal(id: string, newClientName: string, mode?: AppMode): TransactionDetal | null {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsDetal(m);
    const tx = all.find((t) => t.id === id);
    const upperNew = newClientName.trim().toUpperCase();
    if (!tx || !upperNew) return null;
    if (tx.client_name.trim().toUpperCase() === upperNew) return tx;
    const unpaid = Number(((tx.total_to_pay || 0) - (tx.amount_received || 0)).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(tx.client_name, -unpaid, m);
      this.increaseClientDebt(upperNew, unpaid, m);
    }
    const client = this.getClients(m).find((c) => c.name.trim().toUpperCase() === upperNew);
    const updated: TransactionDetal = { ...tx, client_name: upperNew, client_id: client?.id };
    saveToStorage(this.getTransactionsDetalKey(m), all.map((t) => (t.id === id ? updated : t)));
    SupabaseSyncService.upsertTransactionDetal(updated, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'venta_detal',
      entityId: id,
      summary: `Venta detal del ${tx.date} pasada de ${tx.client_name} a ${upperNew}`,
      data: updated,
    });
    return updated;
  },

  renameTransactionMayor(id: string, newClientName: string, mode?: AppMode): TransactionMayor | null {
    const m = mode || this.getAppMode();
    const all = this.getTransactionsMayor(m);
    const tx = all.find((t) => t.id === id);
    const upperNew = newClientName.trim().toUpperCase();
    if (!tx || !upperNew) return null;
    if (tx.client_name.trim().toUpperCase() === upperNew) return tx;
    const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
    const unpaid = Number(((tx.total_to_pay || 0) - receivedAmt).toFixed(2));
    if (unpaid > 0) {
      this.increaseClientDebt(tx.client_name, -unpaid, m);
      this.increaseClientDebt(upperNew, unpaid, m);
    }
    const client = this.getClients(m).find((c) => c.name.trim().toUpperCase() === upperNew);
    const updated: TransactionMayor = { ...tx, client_name: upperNew, client_id: client?.id };
    saveToStorage(this.getTransactionsMayorKey(m), all.map((t) => (t.id === id ? updated : t)));
    SupabaseSyncService.upsertTransactionMayor(updated, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'venta_mayor',
      entityId: id,
      summary: `Venta mayor del ${tx.date} pasada de ${tx.client_name} a ${upperNew}`,
      data: updated,
    });
    return updated;
  },

  // Cambia la cuenta de un registro sin tocar el monto: lo que se aplicó en la cuenta vieja
  // (applied, con su signo) se devuelve y se aplica igual en la nueva. Solo entre cuentas de
  // la misma moneda, para que ningún número cambie.
  moveAccountEffect(oldId: string | undefined, newId: string, applied: number, mode: AppMode): void {
    if (!newId || oldId === newId) return;
    const accounts = this.getAccounts(mode);
    const oldAcc = accounts.find((a) => a.id === oldId);
    const newAcc = accounts.find((a) => a.id === newId);
    if (!newAcc) throw new Error('La cuenta nueva no existe.');
    if (oldAcc && oldAcc.currency !== newAcc.currency) {
      throw new Error(`La cuenta nueva debe ser en ${oldAcc.currency}, igual que la anterior.`);
    }
    if (!applied) return;
    if (oldAcc) this.updateAccountBalance(oldAcc.id, -applied, mode);
    this.updateAccountBalance(newAcc.id, applied, mode);
  },

  editTransactionDetal(
    id: string,
    changes: { client_name?: string; paid_account_id?: string; received_account_id?: string },
    mode?: AppMode
  ): TransactionDetal | null {
    const m = mode || this.getAppMode();
    let tx = this.getTransactionsDetal(m).find((t) => t.id === id);
    if (!tx) return null;
    const paidChanged = !!changes.paid_account_id && changes.paid_account_id !== tx.paid_account_id;
    const recvChanged = !!changes.received_account_id && changes.received_account_id !== tx.received_account_id;
    if (recvChanged && (!tx.received_account_id || tx.received_account_id === 'POR_COBRAR')) {
      throw new Error('Esta venta está Por Cobrar: registra un abono en vez de cambiar la cuenta.');
    }
    if (paidChanged || recvChanged) this.assertDayOpen(tx.date, m, 'cambiar la cuenta de una venta');
    if (paidChanged) {
      const out = tx.usdt_amount > 0 ? tx.usdt_amount + (tx.bank_fee || 0) : 0;
      this.moveAccountEffect(tx.paid_account_id, changes.paid_account_id!, -out, m);
    }
    if (recvChanged) {
      this.moveAccountEffect(tx.received_account_id, changes.received_account_id!, tx.amount_received > 0 ? tx.amount_received : 0, m);
    }
    if (paidChanged || recvChanged) {
      const updated: TransactionDetal = {
        ...tx,
        paid_account_id: paidChanged ? changes.paid_account_id! : tx.paid_account_id,
        received_account_id: recvChanged ? changes.received_account_id! : tx.received_account_id,
      };
      saveToStorage(
        this.getTransactionsDetalKey(m),
        this.getTransactionsDetal(m).map((t) => (t.id === id ? updated : t))
      );
      SupabaseSyncService.upsertTransactionDetal(updated, m).catch(() => {});
      AuditService.log({
        mode: m,
        action: 'editar',
        entity: 'venta_detal',
        entityId: id,
        summary: `Venta detal del ${tx.date}: cuentas cambiadas`,
        data: { antes: { paid: tx.paid_account_id, recv: tx.received_account_id }, despues: { paid: updated.paid_account_id, recv: updated.received_account_id } },
      });
      tx = updated;
    }
    if (changes.client_name) tx = this.renameTransactionDetal(id, changes.client_name, m) || tx;
    return tx;
  },

  editTransactionMayor(
    id: string,
    changes: { client_name?: string; paid_account_id?: string; received_account_id?: string },
    mode?: AppMode
  ): TransactionMayor | null {
    const m = mode || this.getAppMode();
    let tx = this.getTransactionsMayor(m).find((t) => t.id === id);
    if (!tx) return null;
    const paidChanged = !!changes.paid_account_id && changes.paid_account_id !== tx.paid_account_id;
    const recvChanged = !!changes.received_account_id && changes.received_account_id !== tx.received_account_id;
    if (recvChanged && (!tx.received_account_id || tx.received_account_id === 'POR_COBRAR')) {
      throw new Error('Esta venta está Por Cobrar: registra un abono en vez de cambiar la cuenta.');
    }
    if (paidChanged || recvChanged) this.assertDayOpen(tx.date, m, 'cambiar la cuenta de una venta');
    if (paidChanged) {
      const paidAcc = this.getAccounts(m).find((a) => a.id === tx!.paid_account_id);
      const out = tx.amount_ves > 0 ? tx.amount_ves + commissionOutOfAccount(tx, paidAcc?.currency) : 0;
      this.moveAccountEffect(tx.paid_account_id, changes.paid_account_id!, -out, m);
    }
    if (recvChanged) {
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      this.moveAccountEffect(tx.received_account_id, changes.received_account_id!, receivedAmt > 0 ? receivedAmt : 0, m);
    }
    if (paidChanged || recvChanged) {
      const updated: TransactionMayor = {
        ...tx,
        paid_account_id: paidChanged ? changes.paid_account_id! : tx.paid_account_id,
        received_account_id: recvChanged ? changes.received_account_id! : tx.received_account_id,
      };
      saveToStorage(
        this.getTransactionsMayorKey(m),
        this.getTransactionsMayor(m).map((t) => (t.id === id ? updated : t))
      );
      SupabaseSyncService.upsertTransactionMayor(updated, m).catch(() => {});
      AuditService.log({
        mode: m,
        action: 'editar',
        entity: 'venta_mayor',
        entityId: id,
        summary: `Venta mayor del ${tx.date}: cuentas cambiadas`,
        data: { antes: { paid: tx.paid_account_id, recv: tx.received_account_id }, despues: { paid: updated.paid_account_id, recv: updated.received_account_id } },
      });
      tx = updated;
    }
    if (changes.client_name) tx = this.renameTransactionMayor(id, changes.client_name, m) || tx;
    return tx;
  },

  // Transfers
  getTransfers(mode?: AppMode): BalanceTransfer[] {
    const m = mode || this.getAppMode();
    return getFromStorage<BalanceTransfer[]>(this.getTransfersKey(m), []);
  },

  addTransfer(transfer: Omit<BalanceTransfer, 'id' | 'created_at'>, mode?: AppMode): BalanceTransfer {
    const m = mode || this.getAppMode();
    this.assertDayOpen(transfer.date, m, 'registrar un traspaso');
    const all = this.getTransfers(m);
    const newTransfer: BalanceTransfer = {
      ...transfer,
      id: 'trf-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newTransfer.id);
    all.unshift(newTransfer);
    saveToStorage(this.getTransfersKey(m), all);

    const totalOut = newTransfer.amount_sent + (newTransfer.commission || 0);
    this.updateAccountBalance(newTransfer.from_account_id, -totalOut, m);
    this.updateAccountBalance(newTransfer.to_account_id, newTransfer.amount_received, m);

    SupabaseSyncService.upsertTransfer(newTransfer, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'traspaso',
      entityId: newTransfer.id,
      summary: `Traspaso de ${newTransfer.amount_sent} (recibido ${newTransfer.amount_received})${newTransfer.concept ? ': ' + newTransfer.concept : ''}`,
      data: newTransfer,
    });
    return newTransfer;
  },

  async deleteTransfer(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getTransfers(m);
    const transfer = all.find((t) => t.id === id);
    if (transfer) {
      this.assertDayOpen(transfer.date, m, 'anular un traspaso');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'traspaso',
        entityId: id,
        summary: 'Anulado registro del ' + transfer.date,
        data: transfer,
      });
    }
    markAsDeleted(id);
    if (transfer) {
      const totalOut = transfer.amount_sent + (transfer.commission || 0);
      this.updateAccountBalance(transfer.from_account_id, totalOut, m);
      this.updateAccountBalance(transfer.to_account_id, -transfer.amount_received, m);
    }
    saveToStorage(this.getTransfersKey(m), all.filter((t) => t.id !== id));
    await SupabaseSyncService.deleteTransfer(id, m).catch(() => {});
  },

  // Expenses & Extra Income
  getExpenses(mode?: AppMode): Expense[] {
    const m = mode || this.getAppMode();
    return getFromStorage<Expense[]>(this.getExpensesKey(m), []);
  },

  addExpense(exp: Omit<Expense, 'id' | 'created_at'>, mode?: AppMode): Expense {
    const m = mode || this.getAppMode();
    this.assertDayOpen(exp.date, m, 'registrar un gasto o ingreso');
    const all = this.getExpenses(m);
    const newExp: Expense = {
      ...exp,
      id: 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newExp.id);
    all.unshift(newExp);
    saveToStorage(this.getExpensesKey(m), all);

    if (newExp.account_id) {
      if (newExp.type === 'ingreso') {
        this.updateAccountBalance(newExp.account_id, newExp.amount, m);
      } else {
        this.updateAccountBalance(newExp.account_id, -newExp.amount, m);
      }
    }

    SupabaseSyncService.upsertExpense(newExp, m).catch(() => {});
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'gasto',
      entityId: newExp.id,
      summary: `${newExp.type === 'ingreso' ? 'Ingreso' : 'Gasto'} ${newExp.amount} ${newExp.currency}: ${newExp.description || newExp.concept}`,
      data: newExp,
    });
    return newExp;
  },

  async deleteExpense(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getExpenses(m);
    const exp = all.find((e) => e.id === id);
    if (exp) {
      this.assertDayOpen(exp.date, m, 'anular un gasto o ingreso');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'gasto',
        entityId: id,
        summary: 'Anulado registro del ' + exp.date,
        data: exp,
      });
    }
    markAsDeleted(id);
    if (exp && exp.account_id) {
      if (exp.type === 'ingreso') {
        this.updateAccountBalance(exp.account_id, -exp.amount, m);
      } else {
        this.updateAccountBalance(exp.account_id, exp.amount, m);
      }
    }
    saveToStorage(this.getExpensesKey(m), all.filter((e) => e.id !== id));
    await SupabaseSyncService.deleteExpense(id, m).catch(() => {});
  },

  // Daily Closures
  getClosures(mode?: AppMode): DailyClosure[] {
    const m = mode || this.getAppMode();
    return getFromStorage<DailyClosure[]>(this.getClosuresKey(m), []);
  },

  addClosure(
    closure: Omit<DailyClosure, 'id' | 'closed_at'>,
    accounts?: Account[],
    debtors?: Debtor[],
    mode?: AppMode
  ): DailyClosure {
    const m = mode || this.getAppMode();
    const all = this.getClosures(m);

    let accounts_snapshot = closure.accounts_snapshot;
    if (!accounts_snapshot) {
      const sourceAccounts = accounts || this.getAccounts(m);
      accounts_snapshot = sourceAccounts.map((a) => ({
        account_id: a.id,
        name: a.name,
        bank_name: a.bank_name,
        currency: a.currency,
        responsible: a.responsible,
        balance: Number((a.current_balance || 0).toFixed(2)),
      }));
    }

    let debtors_snapshot = closure.debtors_snapshot;
    if (!debtors_snapshot) {
      const sourceDebtors = debtors || this.getDebtors();
      debtors_snapshot = sourceDebtors
        .filter((d) => (d.current_debt || 0) !== 0)
        .map((d) => ({
          debtor_id: d.id,
          client_name: d.client_name,
          current_debt: Number((d.current_debt || 0).toFixed(2)),
          phone: d.phone,
        }));
    }

    const total_debtors_usd =
      closure.total_debtors_usd !== undefined
        ? closure.total_debtors_usd
        : debtors_snapshot.reduce((sum, d) => sum + (d.current_debt || 0), 0);

    const newClosure: DailyClosure = {
      ...closure,
      id: 'close-' + Date.now(),
      closed_at: new Date().toISOString(),
      accounts_snapshot,
      debtors_snapshot,
      total_debtors_usd: Number(total_debtors_usd.toFixed(2)),
    };
    unmarkDeleted(newClosure.id);
    const filtered = all.filter((c) => c.date !== closure.date);
    filtered.unshift(newClosure);
    saveToStorage(this.getClosuresKey(m), filtered);
    AuditService.log({
      mode: m,
      action: 'cierre',
      entity: 'cierre',
      entityId: newClosure.id,
      summary: `Cierre del día ${newClosure.date}: neto ${newClosure.total_net_profit} USD. Desde ahora el día queda bloqueado.`,
      data: { date: newClosure.date, total_net_profit: newClosure.total_net_profit },
    });

    SupabaseSyncService.upsertClosure(newClosure, m).catch(() => {});
    return newClosure;
  },

  // Reabrir un día = borrar su cierre. Solo ADMIN y con motivo; queda en la bitácora.
  async deleteClosure(id: string, mode?: AppMode, reason?: string): Promise<void> {
    const m = mode || this.getAppMode();
    if (!isActorAdmin()) {
      const msg = 'Solo un ADMIN puede reabrir un día cerrado.';
      if (typeof window !== 'undefined') window.alert(msg);
      throw new Error(msg);
    }
    const motivo = (reason || '').trim();
    if (!motivo) throw new Error('Para reabrir un día hace falta un motivo.');
    const all = this.getClosures(m);
    const closure = all.find((c) => c.id === id);
    AuditService.log({
      mode: m,
      action: 'reapertura',
      entity: 'cierre',
      entityId: id,
      summary: `Reabierto el día ${closure?.date || id} (se borró su cierre)`,
      reason: motivo,
      data: closure,
    });
    markAsDeleted(id);
    saveToStorage(
      this.getClosuresKey(m),
      all.filter((c) => c.id !== id)
    );
    await SupabaseSyncService.deleteClosure(id, m).catch(() => {});
  },

  // Debtors & Accounts Receivable - 100% aislados e independientes por modo
  syncDebtors(mode?: AppMode): Debtor[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    const tombstones = getDebtorTombstones(m);
    const rawDebtors = getFromStorage<Debtor[] | null>(this.getDebtorsKey(m), null);
    const debtors: Debtor[] = (rawDebtors === null ? (m === 'detal' ? [...INITIAL_DEBTORS] : []) : [...rawDebtors].filter(Boolean))
      .filter((d) => !isDebtorSuppressed(tombstones, d));
    const detalTxs = (getFromStorage<TransactionDetal[]>(this.getTransactionsDetalKey(m), []) || []).filter(Boolean);
    const mayorTxs = (getFromStorage<TransactionMayor[]>(this.getTransactionsMayorKey(m), []) || []).filter(Boolean);
    const payments = (getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []) || []).filter(Boolean);
    // Remesas fiadas (no anuladas): lo que el remitente quedó debiendo, en USD
    const remesasFiadas = this.getRemesas(m)
      .filter((r) => r && r.estado !== 'anulada' && (r.fiado_usd || 0) > 0)
      .map((r) => ({ client_name: r.remitente_name, created_at: r.created_at, date: r.date, fiado_usd: r.fiado_usd || 0 }));
    const lastActivity = lastActivityByName([...detalTxs, ...mayorTxs, ...payments, ...remesasFiadas]);

    const clientStats = new Map<string, { totalBought: number; totalPaidInTx: number }>();

    detalTxs.forEach((t) => {
      if (!t) return;
      const name = (t.client_name || '').trim().toUpperCase();
      if (!name) return;
      const st = clientStats.get(name) || { totalBought: 0, totalPaidInTx: 0 };
      st.totalBought += t.total_to_pay || 0;
      if (t.payment_status === 'PAGADO') {
        st.totalPaidInTx += t.total_to_pay || 0;
      } else if (t.payment_status === 'PARCIAL' && t.amount_received) {
        st.totalPaidInTx += t.amount_received;
      }
      clientStats.set(name, st);
    });

    mayorTxs.forEach((t) => {
      if (!t) return;
      const name = (t.client_name || '').trim().toUpperCase();
      if (!name) return;
      const st = clientStats.get(name) || { totalBought: 0, totalPaidInTx: 0 };
      st.totalBought += t.total_to_pay || 0;
      if (t.payment_status === 'PAGADO') {
        st.totalPaidInTx += t.total_to_pay || 0;
      } else if (t.payment_status === 'PARCIAL' && t.amount_received) {
        st.totalPaidInTx += t.amount_received;
      }
      clientStats.set(name, st);
    });

    remesasFiadas.forEach((r) => {
      const name = (r.client_name || '').trim().toUpperCase();
      if (!name) return;
      const st = clientStats.get(name) || { totalBought: 0, totalPaidInTx: 0 };
      st.totalBought += r.fiado_usd;
      clientStats.set(name, st);
    });

    // Incluir también clientes que tienen abonos registrados
    payments.forEach((p) => {
      if (!p) return;
      const name = (p.client_name || '').trim().toUpperCase();
      if (!name) return;
      if (!clientStats.has(name)) {
        clientStats.set(name, { totalBought: 0, totalPaidInTx: 0 });
      }
    });

    let hasChanges = false;
    clientStats.forEach((st, name) => {
      const clientAbonos = payments
        .filter((p) => p && (p.client_name || '').trim().toUpperCase() === name)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const existingIndex = debtors.findIndex(
        (d) => d && (d.client_name || '').trim().toUpperCase() === name
      );

      // Saldo neto: > 0 = Deuda por cobrar (cliente debe); < 0 = Saldo a Favor (crédito del cliente)
      const calculatedNetDebt = Number((st.totalBought - st.totalPaidInTx - clientAbonos).toFixed(2));
      const hasActivity = st.totalBought > 0 || clientAbonos > 0;

      if (existingIndex === -1) {
        const autoId = 'deb-auto-' + m + '-' + name.replace(/[^A-Z0-9]/g, '_');
        // Un deudor borrado a mano no se recrea a partir de ventas o abonos anteriores al borrado
        const suppressed = isDebtorSuppressed(
          tombstones,
          { id: autoId, client_name: name },
          lastActivity.get(name) ?? null
        );
        if (calculatedNetDebt !== 0 && !suppressed) {
          debtors.unshift({
            id: autoId,
            client_name: name,
            current_debt: calculatedNetDebt,
            notes: calculatedNetDebt > 0
              ? 'Sincronizado de operaciones por cobrar (' + m.toUpperCase() + ')'
              : 'Abono a favor registrado (' + m.toUpperCase() + ')',
            updated_at: new Date().toISOString(),
          });
          hasChanges = true;
        }
      } else if (hasActivity && debtors[existingIndex].current_debt !== calculatedNetDebt) {
        debtors[existingIndex].current_debt = calculatedNetDebt;
        debtors[existingIndex].updated_at = new Date().toISOString();
        hasChanges = true;
      }
    });

    // Limpiar deudores automáticos huérfanos cuyas transacciones u operaciones fueron borradas/reseteadas
    const orphanedIds: string[] = [];
    const filteredDebtors = debtors.filter((d) => {
      if (!d) return false;
      const isAuto = Boolean(d.id?.startsWith('deb-auto-') || (d.notes && d.notes.toLowerCase().includes('sincronizado de operaciones')));
      if (isAuto) {
        const name = (d.client_name || '').trim().toUpperCase();
        const hasActiveTx = clientStats.has(name) && ((clientStats.get(name)?.totalBought || 0) > 0 || (clientStats.get(name)?.totalPaidInTx || 0) > 0);
        const hasPayment = payments.some((p) => p && (p.client_name || '').trim().toUpperCase() === name);
        if (!hasActiveTx && !hasPayment) {
          orphanedIds.push(d.id);
          hasChanges = true;
          return false;
        }
      }
      return true;
    });

    // Deduplicar para garantizar un solo registro por cliente
    const uniqueMap = new Map<string, Debtor>();
    filteredDebtors.forEach((d) => {
      const key = (d.client_name || '').trim().toUpperCase();
      const kept = uniqueMap.get(key);
      if (!kept) {
        uniqueMap.set(key, d);
      } else {
        hasChanges = true;
        // Un duplicado con el mismo id que el conservado no se borra (borraría a ambos)
        if (d.id !== kept.id) orphanedIds.push(d.id);
      }
    });

    if (orphanedIds.length > 0) {
      // Limpieza automática: lápida solo por id, no por nombre, para no bloquear al cliente
      orphanedIds.forEach((id) => {
        recordDebtorDeletion(m, id);
        queueDebtorRemote({ op: 'delete', mode: m, id });
      });
      flushDebtorOutbox().catch(() => {});
    }

    debtors.length = 0;
    debtors.push(...Array.from(uniqueMap.values()));

    if (hasChanges || !rawDebtors || rawDebtors.length === 0) {
      saveToStorage(this.getDebtorsKey(m), debtors);
    }

    // Sincronizar automáticamente hacia el módulo de Clientes
    try {
      const currentClients = this.getClients(m);
      const clientNameSet = new Set(currentClients.map((c) => (c.name || '').trim().toUpperCase()));
      let clientsChanged = false;
      debtors.forEach((d) => {
        const norm = (d.client_name || '').trim().toUpperCase();
        if (norm && !clientNameSet.has(norm)) {
          clientNameSet.add(norm);
          const newClient: Client = {
            id: 'cli-deb-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: d.client_name.trim(),
            phone: d.phone || '',
            current_debt: d.current_debt || 0,
            created_at: new Date().toISOString(),
          };
          currentClients.push(newClient);
          clientsChanged = true;
          SupabaseSyncService.upsertClient(newClient, m).catch(() => {});
        }
      });
      if (clientsChanged) {
        this.saveClients(currentClients, m);
      }
    } catch {}

    return debtors.map((d) => ({
      ...d,
      notes: d.notes ? d.notes.replace(/\bdetal\b/gi, '').replace(/\s+/g, ' ').trim() : d.notes,
    })).sort((a, b) =>
      (a.client_name || '').localeCompare(b.client_name || '', 'es', { sensitivity: 'base' })
    );
  },

  getDebtors(mode?: AppMode): Debtor[] {
    const m = mode || this.getAppMode();
    return this.syncDebtors(m);
  },

  saveDebtors(debtors: Debtor[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const sorted = [...debtors].sort((a, b) =>
      (a.client_name || '').localeCompare(b.client_name || '', 'es', { sensitivity: 'base' })
    );
    saveToStorage(this.getDebtorsKey(m), sorted);
  },

  updateDebtorDebt(debtorId: string, delta: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const debtors = this.getDebtors(m);
    let updatedDebtor: Debtor | null = null;
    const updated = debtors.map((d) => {
      if (d.id === debtorId) {
        updatedDebtor = {
          ...d,
          current_debt: Number((d.current_debt + delta).toFixed(2)),
          updated_at: new Date().toISOString(),
        };
        return updatedDebtor;
      }
      return d;
    });
    this.saveDebtors(updated, m);
    if (updatedDebtor) {
      queueDebtorRemote({ op: 'upsert', mode: m, id: debtorId, debtor: updatedDebtor });
      flushDebtorOutbox().catch(() => {});
    }
  },

  increaseClientDebt(clientName: string, amount: number, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const upperName = clientName.trim().toUpperCase();
    const debtors = this.getDebtors(m);
    const existing = debtors.find((d) => d.client_name.trim().toUpperCase() === upperName);
    if (existing) {
      this.updateDebtorDebt(existing.id, amount, m);
    } else {
      this.addDebtor(
        {
          client_name: upperName,
          current_debt: Number(amount.toFixed(2)),
          notes: 'Generado automáticamente por venta a crédito (' + m.toUpperCase() + ')',
        },
        m
      );
    }
  },

  addDebtor(debtor: Omit<Debtor, 'id' | 'updated_at'>, mode?: AppMode): Debtor {
    const m = mode || this.getAppMode();
    const all = this.getDebtors(m);
    const upperName = (debtor.client_name || '').trim().toUpperCase();

    // PREVENCIÓN DE DUPLICADOS: Si el deudor ya existe, actualizar su deuda y datos
    const existingDebtor = all.find((d) => (d.client_name || '').trim().toUpperCase() === upperName);
    if (existingDebtor) {
      unmarkDeleted(existingDebtor.id);
      const newDebt = Number(((existingDebtor.current_debt || 0) + (debtor.current_debt || 0)).toFixed(2));
      const updated: Debtor = {
        ...existingDebtor,
        current_debt: newDebt,
        phone: debtor.phone || existingDebtor.phone,
        notes: debtor.notes || existingDebtor.notes,
        updated_at: new Date().toISOString(),
      };
      const updatedList = all.map((d) => (d.id === existingDebtor.id ? updated : d));
      this.saveDebtors(updatedList, m);
      queueDebtorRemote({ op: 'upsert', mode: m, id: updated.id, debtor: updated });
      flushDebtorOutbox().catch(() => {});

      // Sincronizar en Clientes
      try {
        const clients = this.getClients(m);
        const existingClient = clients.find((c) => (c.name || '').trim().toUpperCase() === upperName);
        if (existingClient) {
          const updates: Partial<Client> = {};
          if (updated.phone && !existingClient.phone) updates.phone = updated.phone;
          updates.current_debt = updated.current_debt;
          this.updateClient(existingClient.id, updates, m);
        }
      } catch {}

      return updated;
    }

    const newDebtor: Debtor = {
      ...debtor,
      client_name: upperName,
      id: 'deb-' + Date.now(),
      updated_at: new Date().toISOString(),
    };
    unmarkDeleted(newDebtor.id);
    all.unshift(newDebtor);
    this.saveDebtors(all, m);
    queueDebtorRemote({ op: 'upsert', mode: m, id: newDebtor.id, debtor: newDebtor });
    flushDebtorOutbox().catch(() => {});

    // AUTOMÁTICO: Asegurar que el deudor también se registre o actualice en Clientes
    try {
      const upperName = (debtor.client_name || '').trim().toUpperCase();
      if (upperName) {
        const clients = this.getClients(m);
        const existingClient = clients.find((c) => (c.name || '').trim().toUpperCase() === upperName);
        if (!existingClient) {
          this.addClient({
            name: debtor.client_name.trim(),
            phone: debtor.phone || '',
            current_debt: debtor.current_debt || 0,
            notes: debtor.notes || '',
          }, m);
        } else {
          const updates: Partial<Client> = {};
          if (debtor.phone && !existingClient.phone) updates.phone = debtor.phone;
          if (debtor.current_debt !== undefined && debtor.current_debt !== existingClient.current_debt) {
            updates.current_debt = debtor.current_debt;
          }
          if (Object.keys(updates).length > 0) {
            this.updateClient(existingClient.id, updates, m);
          }
        }
      }
    } catch {}

    return newDebtor;
  },

  // Debt Payments (Abonos de Deudores) - 100% aislados por modo
  getDebtPayments(mode?: AppMode): DebtPayment[] {
    const m = mode || this.getAppMode();
    this.migrateOldDataIfNeeded();
    return getFromStorage<DebtPayment[]>(this.getDebtPaymentsKey(m), []);
  },

  addDebtPayment(payment: Omit<DebtPayment, 'id' | 'created_at'>, mode?: AppMode): DebtPayment {
    const m = mode || this.getAppMode();
    this.assertDayOpen(payment.date, m, 'registrar un abono');
    const all = this.getDebtPayments(m);
    const newPayment: DebtPayment = {
      ...payment,
      id: 'debtpay-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newPayment.id);
    all.unshift(newPayment);
    saveToStorage(this.getDebtPaymentsKey(m), all);

    const upperName = newPayment.client_name.trim().toUpperCase();
    const debtors = this.getDebtors(m);
    const existing = debtors.find(
      (d) => d.id === newPayment.debtor_id || d.client_name.trim().toUpperCase() === upperName
    );
    if (existing) {
      this.updateDebtorDebt(existing.id, -newPayment.amount, m);
    } else {
      this.addDebtor(
        {
          client_name: upperName,
          current_debt: -newPayment.amount,
          notes: 'Creado por abono a deuda (' + m.toUpperCase() + ')',
        },
        m
      );
    }

    const amountToCredit =
      newPayment.amount_currency && newPayment.amount_currency > 0
        ? newPayment.amount_currency
        : newPayment.amount;

    if (newPayment.account_id && amountToCredit > 0) {
      this.updateAccountBalance(newPayment.account_id, amountToCredit, m);
    }

    pushDebtPayment(newPayment, m);
    AuditService.log({
      mode: m,
      action: 'crear',
      entity: 'abono_cliente',
      entityId: newPayment.id,
      summary: `Abono de ${newPayment.client_name}: ${newPayment.amount} USD`,
      data: newPayment,
    });
    return newPayment;
  },

  // Corrige el cliente de un abono sin anularlo: la deuda vuelve al cliente anterior y se
  // descuenta al nuevo. Monto, cuenta y fecha quedan igual, así que no toca saldos de cuentas.
  renameDebtPayment(id: string, newClientName: string, mode?: AppMode): DebtPayment | null {
    const m = mode || this.getAppMode();
    const upperNew = newClientName.trim().toUpperCase();
    const all = this.getDebtPayments(m);
    const pay = all.find((p) => p.id === id);
    if (!pay || !upperNew) return null;
    const upperOld = pay.client_name.trim().toUpperCase();
    if (upperOld === upperNew) return pay;

    const debtors = this.getDebtors(m);
    const oldDebtor = debtors.find(
      (d) => d.id === pay.debtor_id || d.client_name.trim().toUpperCase() === upperOld
    );
    if (oldDebtor) this.updateDebtorDebt(oldDebtor.id, pay.amount, m);

    let newDebtor = this.getDebtors(m).find((d) => d.client_name.trim().toUpperCase() === upperNew);
    if (newDebtor) {
      this.updateDebtorDebt(newDebtor.id, -pay.amount, m);
    } else {
      newDebtor = this.addDebtor(
        {
          client_name: upperNew,
          current_debt: -pay.amount,
          notes: 'Creado por abono a deuda (' + m.toUpperCase() + ')',
        },
        m
      );
    }

    const updated: DebtPayment = { ...pay, client_name: upperNew, debtor_id: newDebtor.id };
    saveToStorage(
      this.getDebtPaymentsKey(m),
      all.map((p) => (p.id === id ? updated : p))
    );
    pushDebtPayment(updated, m);
    AuditService.log({
      mode: m,
      action: 'editar',
      entity: 'abono_cliente',
      entityId: id,
      summary: `Abono de ${pay.amount} USD pasado de ${pay.client_name} a ${upperNew}`,
      data: updated,
    });
    return updated;
  },

  editDebtPayment(
    id: string,
    changes: { client_name?: string; account_id?: string },
    mode?: AppMode
  ): DebtPayment | null {
    const m = mode || this.getAppMode();
    let pay = this.getDebtPayments(m).find((p) => p.id === id);
    if (!pay) return null;
    if (changes.account_id && changes.account_id !== pay.account_id) {
      this.assertDayOpen(pay.date, m, 'cambiar la cuenta de un abono');
      const credited = pay.amount_currency && pay.amount_currency > 0 ? pay.amount_currency : pay.amount;
      this.moveAccountEffect(pay.account_id, changes.account_id, credited > 0 ? credited : 0, m);
      const updated: DebtPayment = { ...pay, account_id: changes.account_id };
      saveToStorage(
        this.getDebtPaymentsKey(m),
        this.getDebtPayments(m).map((p) => (p.id === id ? updated : p))
      );
      pushDebtPayment(updated, m);
      AuditService.log({
        mode: m,
        action: 'editar',
        entity: 'abono_cliente',
        entityId: id,
        summary: `Abono de ${pay.client_name}: cuenta cambiada`,
        data: { antes: pay.account_id, despues: changes.account_id },
      });
      pay = updated;
    }
    if (changes.client_name) pay = this.renameDebtPayment(id, changes.client_name, m) || pay;
    return pay;
  },

  async deleteDebtPayment(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getDebtPayments(m);
    const pay = all.find((p) => p.id === id);
    if (pay) {
      this.assertDayOpen(pay.date, m, 'anular un abono');
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'abono_cliente',
        entityId: id,
        summary: 'Anulado registro del ' + pay.date,
        data: pay,
      });
    }
    markAsDeleted(id);
    if (pay) {
      const upperName = pay.client_name.trim().toUpperCase();
      const debtors = this.getDebtors(m);
      const existing = debtors.find(
        (d) => d.id === pay.debtor_id || d.client_name.trim().toUpperCase() === upperName
      );
      if (existing) {
        this.updateDebtorDebt(existing.id, pay.amount, m);
      }

      const amountToRevert =
        pay.amount_currency && pay.amount_currency > 0
          ? pay.amount_currency
          : pay.amount;

      if (pay.account_id && amountToRevert > 0) {
        this.updateAccountBalance(pay.account_id, -amountToRevert, m);
      }
    }
    saveToStorage(this.getDebtPaymentsKey(m), all.filter((p) => p.id !== id));
    await SupabaseSyncService.deleteDebtPayment(id, m).catch(() => {});
  },

  async deleteDebtor(id: string, mode?: AppMode, clientName?: string): Promise<void> {
    const m = mode || this.getAppMode();
    const rawDebtors = getFromStorage<Debtor[]>(this.getDebtorsKey(m), []);
    let latestUpdate = 0;
    const filtered = rawDebtors.filter((d) => {
      if (!d) return false;
      const matches =
        (id && d.id === id) ||
        (clientName && (d.client_name || '').trim().toUpperCase() === clientName.trim().toUpperCase());
      if (matches) {
        latestUpdate = Math.max(latestUpdate, (d.updated_at ? new Date(d.updated_at).getTime() : 0) || 0);
        return false;
      }
      return true;
    });
    recordDebtorDeletion(m, id, clientName, latestUpdate + 1);
    saveToStorage(this.getDebtorsKey(m), filtered);
    // Si Supabase falla, el borrado queda en cola y se reintenta en cada sincronización
    queueDebtorRemote({ op: 'delete', mode: m, id, name: clientName ? normalizeDebtorName(clientName) : undefined });
    await flushDebtorOutbox().catch(() => {});
  },

  resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    saveToStorage(this.getAccountsKey('detal'), INITIAL_ACCOUNTS_DETAL);
    saveToStorage(this.getAccountsKey('mayor'), INITIAL_ACCOUNTS_MAYOR);
    saveToStorage(this.getClientsKey('detal'), INITIAL_CLIENTS_DETAL);
    saveToStorage(this.getClientsKey('mayor'), INITIAL_CLIENTS_MAYOR);
    saveToStorage(this.getSuppliersKey('detal'), INITIAL_SUPPLIERS_DETAL);
    saveToStorage(this.getSuppliersKey('mayor'), INITIAL_SUPPLIERS_MAYOR);
    saveToStorage(this.getDebtorsKey('detal'), INITIAL_DEBTORS);
    saveToStorage(this.getDebtorsKey('mayor'), []);
    saveToStorage(this.getDebtPaymentsKey('detal'), []);
    saveToStorage(this.getDebtPaymentsKey('mayor'), []);
    saveToStorage(this.getTransactionsDetalKey('detal'), []);
    saveToStorage(this.getTransactionsDetalKey('mayor'), []);
    saveToStorage(this.getTransactionsMayorKey('detal'), []);
    saveToStorage(this.getTransactionsMayorKey('mayor'), []);
    saveToStorage(this.getTransfersKey('detal'), []);
    saveToStorage(this.getTransfersKey('mayor'), []);
    saveToStorage(this.getExpensesKey('detal'), []);
    saveToStorage(this.getExpensesKey('mayor'), []);
    saveToStorage(this.getClosuresKey('detal'), []);
    saveToStorage(this.getClosuresKey('mayor'), []);
    saveToStorage(this.getSupplierPurchasesKey('detal'), []);
    saveToStorage(this.getSupplierPurchasesKey('mayor'), []);
    saveToStorage(this.getSupplierPaymentsKey('detal'), []);
    saveToStorage(this.getSupplierPaymentsKey('mayor'), []);
  },

  // Employees (Personal y Colaboradores)
  getEmployees(mode?: AppMode): Employee[] {
    const m = mode || this.getAppMode();
    return getFromStorage<Employee[]>(this.getEmployeesKey(m), []);
  },

  saveEmployees(employees: Employee[], mode?: AppMode): void {
    const m = mode || this.getAppMode();
    saveToStorage(this.getEmployeesKey(m), employees);
  },

  addEmployee(employee: Omit<Employee, 'id' | 'created_at'>, mode?: AppMode): Employee {
    const m = mode || this.getAppMode();
    const all = this.getEmployees(m);
    const newEmp: Employee = {
      ...employee,
      id: 'emp-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newEmp.id);
    all.unshift(newEmp);
    this.saveEmployees(all, m);
    SupabaseSyncService.upsertEmployee(newEmp, m).catch(() => {});
    return newEmp;
  },

  updateEmployee(id: string, updates: Partial<Employee>, mode?: AppMode): void {
    const m = mode || this.getAppMode();
    const all = this.getEmployees(m);
    let updatedEmp: Employee | null = null;
    const updated = all.map((e) => {
      if (e.id === id) {
        updatedEmp = { ...e, ...updates };
        return updatedEmp;
      }
      return e;
    });
    this.saveEmployees(updated, m);
    if (updatedEmp) {
      SupabaseSyncService.upsertEmployee(updatedEmp, m).catch(() => {});
    }
  },

  async deleteEmployee(id: string, mode?: AppMode): Promise<void> {
    markAsDeleted(id);
    const m = mode || this.getAppMode();
    const all = this.getEmployees(m);
    this.saveEmployees(all.filter((e) => e.id !== id), m);
    await SupabaseSyncService.deleteEmployee(id, m).catch(() => {});
  },

  // Payroll Payments (Pagos de Sueldos y Salarios)
  getPayrollPayments(mode?: AppMode): PayrollPayment[] {
    const m = mode || this.getAppMode();
    return getFromStorage<PayrollPayment[]>(this.getPayrollPaymentsKey(m), []);
  },

  addPayrollPayment(payment: Omit<PayrollPayment, 'id' | 'created_at'>, mode?: AppMode): PayrollPayment {
    const m = mode || this.getAppMode();
    const all = this.getPayrollPayments(m);

    // Registrar egreso contable automático para que cuadre con saldo de banco/wallet y Cierre Diario
    const exp = this.addExpense({
      date: payment.date,
      type: 'egreso',
      description: `[NÓMINA] ${payment.employee_name} (${payment.period})${payment.reference ? ' - Ref: ' + payment.reference : ''}`,
      amount: payment.amount_currency,
      currency: payment.currency,
      concept: 'NÓMINA',
      account_id: payment.account_id,
      amount_usd: payment.amount_usd,
    }, m);

    const newPay: PayrollPayment = {
      ...payment,
      id: 'pay-' + Date.now(),
      expense_id: exp.id,
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newPay.id);
    all.unshift(newPay);
    saveToStorage(this.getPayrollPaymentsKey(m), all);
    SupabaseSyncService.upsertPayrollPayment(newPay, m).catch(() => {});

    return newPay;
  },

  async deletePayrollPayment(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getPayrollPayments(m);
    const pay = all.find((p) => p.id === id);
    if (pay) this.assertDayOpen(pay.date, m, 'anular un pago de nómina');
    markAsDeleted(id);
    if (pay) {
      // Revertir en gastos y reintegrar dinero a la cuenta pagadora
      if (pay.expense_id) {
        await this.deleteExpense(pay.expense_id, m);
      } else {
        const allExpenses = this.getExpenses(m);
        const linkedExp = allExpenses.find((e) =>
          e.concept === 'NÓMINA' &&
          e.date === pay.date &&
          e.amount === pay.amount_currency &&
          e.description.includes(pay.employee_name)
        );
        if (linkedExp) {
          await this.deleteExpense(linkedExp.id, m);
        } else if (pay.account_id && pay.amount_currency > 0) {
          this.updateAccountBalance(pay.account_id, pay.amount_currency, m);
        }
      }
    }
    saveToStorage(this.getPayrollPaymentsKey(m), all.filter((p) => p.id !== id));
    await SupabaseSyncService.deletePayrollPayment(id, m).catch(() => {});
  },

  // Service Expenses (Servicios Públicos, Alquiler, Internet, etc.)
  getServiceExpenses(mode?: AppMode): ServiceExpense[] {
    const m = mode || this.getAppMode();
    return getFromStorage<ServiceExpense[]>(this.getServiceExpensesKey(m), []);
  },

  addServiceExpense(service: Omit<ServiceExpense, 'id' | 'created_at'>, mode?: AppMode): ServiceExpense {
    const m = mode || this.getAppMode();
    const all = this.getServiceExpenses(m);

    // Registrar egreso contable automático
    const catLabel = service.category.replace(/_/g, ' ');
    const exp = this.addExpense({
      date: service.date,
      type: 'egreso',
      description: `[SERVICIO - ${catLabel}] ${service.description}${service.invoice_number ? ' - Fac/Ref: ' + service.invoice_number : ''}`,
      amount: service.amount,
      currency: service.currency,
      concept: 'SERVICIOS: ' + service.category,
      account_id: service.account_id,
      amount_usd: service.amount_usd,
    }, m);

    const newServ: ServiceExpense = {
      ...service,
      id: 'srv-' + Date.now(),
      expense_id: exp.id,
      created_at: new Date().toISOString(),
    };
    unmarkDeleted(newServ.id);
    all.unshift(newServ);
    saveToStorage(this.getServiceExpensesKey(m), all);
    SupabaseSyncService.upsertServiceExpense(newServ, m).catch(() => {});

    return newServ;
  },

  async deleteServiceExpense(id: string, mode?: AppMode): Promise<void> {
    const m = mode || this.getAppMode();
    const all = this.getServiceExpenses(m);
    const srv = all.find((s) => s.id === id);
    if (srv) this.assertDayOpen(srv.date, m, 'anular un gasto de servicio');
    markAsDeleted(id);
    if (srv) {
      if (srv.expense_id) {
        await this.deleteExpense(srv.expense_id, m);
      } else {
        const allExpenses = this.getExpenses(m);
        const linkedExp = allExpenses.find((e) =>
          e.concept.startsWith('SERVICIOS') &&
          e.date === srv.date &&
          e.amount === srv.amount &&
          e.description.includes(srv.description)
        );
        if (linkedExp) {
          await this.deleteExpense(linkedExp.id, m);
        } else if (srv.account_id && srv.amount > 0) {
          this.updateAccountBalance(srv.account_id, srv.amount, m);
        }
      }
    }
    saveToStorage(this.getServiceExpensesKey(m), all.filter((s) => s.id !== id));
    await SupabaseSyncService.deleteServiceExpense(id, m).catch(() => {});
  },

  async masterResetToZero(targetMode: AppMode | 'both' = 'both'): Promise<void> {
    if (typeof window === 'undefined') return;
    const modes: AppMode[] = targetMode === 'both' ? ['detal', 'mayor'] : [targetMode];
    for (const m of modes) {
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'sistema',
        entityId: 'reset-total',
        summary: 'Reseteo maestro: se borraron todos los datos de ' + m.toUpperCase(),
      });
      saveToStorage(this.getAdjustmentsKey(m), []);
      saveToStorage(this.getRemesasKey(m), []);
      saveToStorage(this.getRemitentesKey(m), []);
      saveToStorage(this.getAccountsKey(m), []);
      saveToStorage(this.getClientsKey(m), []);
      saveToStorage(this.getSuppliersKey(m), []);
      saveToStorage(this.getDebtorsKey(m), []);
      saveToStorage(this.getDebtPaymentsKey(m), []);
      saveToStorage(this.getTransactionsDetalKey(m), []);
      saveToStorage(this.getTransactionsMayorKey(m), []);
      saveToStorage(this.getTransfersKey(m), []);
      saveToStorage(this.getExpensesKey(m), []);
      saveToStorage(this.getClosuresKey(m), []);
      saveToStorage(this.getSupplierPurchasesKey(m), []);
      saveToStorage(this.getSupplierPaymentsKey(m), []);
      saveToStorage(this.getEmployeesKey(m), []);
      saveToStorage(this.getPayrollPaymentsKey(m), []);
      saveToStorage(this.getServiceExpensesKey(m), []);
    }
    if (targetMode === 'both') {
      localStorage.removeItem('cambiosjk_accounts_v1');
      localStorage.removeItem('cambiosjk_clients_v1');
      localStorage.removeItem('cambiosjk_suppliers_v1');
      localStorage.removeItem('cambiosjk_detal_v1');
      localStorage.removeItem('cambiosjk_mayor_v1');
      localStorage.removeItem('cambiosjk_debtors_v1');
      localStorage.removeItem('cambiosjk_debt_payments_v1');
    }
    await SupabaseSyncService.truncateAllTables(targetMode).catch(() => {});
  },

  async resetBalancesToZero(targetMode: AppMode | 'both' = 'both'): Promise<void> {
    if (typeof window === 'undefined') return;
    const modes: AppMode[] = targetMode === 'both' ? ['detal', 'mayor'] : [targetMode];
    for (const m of modes) {
      AuditService.log({
        mode: m,
        action: 'eliminar',
        entity: 'sistema',
        entityId: 'reset-saldos',
        summary: 'Reseteo de saldos a cero y borrado de operaciones de ' + m.toUpperCase(),
      });
      saveToStorage(this.getAdjustmentsKey(m), []);
      saveToStorage(this.getRemesasKey(m), []);
      const accs = this.getAccounts(m).map((a) => ({ ...a, current_balance: 0, initial_balance: 0 }));
      saveToStorage(this.getAccountsKey(m), accs);

      const supps = this.getSuppliers(m).map((s) => ({ ...s, current_debt_usd: 0 }));
      saveToStorage(this.getSuppliersKey(m), supps);

      saveToStorage(this.getDebtorsKey(m), []);
      saveToStorage(this.getDebtPaymentsKey(m), []);
      saveToStorage(this.getTransactionsDetalKey(m), []);
      saveToStorage(this.getTransactionsMayorKey(m), []);
      saveToStorage(this.getTransfersKey(m), []);
      saveToStorage(this.getExpensesKey(m), []);
      saveToStorage(this.getClosuresKey(m), []);
      saveToStorage(this.getSupplierPurchasesKey(m), []);
      saveToStorage(this.getSupplierPaymentsKey(m), []);
      saveToStorage(this.getPayrollPaymentsKey(m), []);
      saveToStorage(this.getServiceExpensesKey(m), []);
    }
    if (targetMode === 'both') {
      localStorage.removeItem('cambiosjk_accounts_v1');
      localStorage.removeItem('cambiosjk_clients_v1');
      localStorage.removeItem('cambiosjk_suppliers_v1');
      localStorage.removeItem('cambiosjk_detal_v1');
      localStorage.removeItem('cambiosjk_mayor_v1');
      localStorage.removeItem('cambiosjk_debtors_v1');
      localStorage.removeItem('cambiosjk_debt_payments_v1');
    }
    await SupabaseSyncService.resetBalancesToZeroInSupabase(targetMode).catch(() => {});
  },
};

