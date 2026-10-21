import { AppMode, AuditAction, AuditEntry } from '@/types';
import { getActor } from './actor';
import { SupabaseSyncService } from './supabase-sync';

// Bitácora de auditoría: cada cambio que mueve dinero o saldos deja una fila.
// Se guarda en el navegador y se sube a Supabase ({modo}_auditoria) para verla desde cualquier equipo.

const MAX_LOCAL_ENTRIES = 3000;

function storageKey(mode: AppMode): string {
  return 'cambiosjk_' + mode + '_auditoria_v1';
}

function readLocal(mode: AppMode): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(mode));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(mode: AppMode, entries: AuditEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...entries].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, MAX_LOCAL_ENTRIES);
    localStorage.setItem(storageKey(mode), JSON.stringify(sorted));
  } catch (err) {
    console.error('Error guardando bitácora:', err);
  }
}

// Copia "plana" del registro para guardarla en la bitácora sin referencias vivas
function snapshot(data: unknown): unknown {
  if (data === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return undefined;
  }
}

export const AuditService = {
  log(params: {
    mode: AppMode;
    action: AuditAction;
    entity: string;
    entityId: string;
    summary: string;
    reason?: string;
    data?: unknown;
  }): AuditEntry {
    const actor = getActor();
    const entry: AuditEntry = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      ts: new Date().toISOString(),
      mode: params.mode,
      user_id: actor?.id,
      user_email: actor?.email,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      summary: params.summary,
      reason: params.reason,
      data: snapshot(params.data),
    };
    const all = readLocal(params.mode);
    all.unshift(entry);
    writeLocal(params.mode, all);
    SupabaseSyncService.insertAuditEntry(entry).catch(() => {});
    return entry;
  },

  getEntries(mode: AppMode): AuditEntry[] {
    return readLocal(mode);
  },

  // Une las filas remotas con las locales (las locales que aún no subieron se reintentan)
  mergeRemote(mode: AppMode, remote: AuditEntry[]): void {
    const local = readLocal(mode);
    const remoteIds = new Set(remote.map((e) => e.id));
    const pending = local.filter((e) => !remoteIds.has(e.id));
    pending.forEach((e) => {
      SupabaseSyncService.insertAuditEntry(e).catch(() => {});
    });
    writeLocal(mode, [...remote, ...pending]);
  },
};
