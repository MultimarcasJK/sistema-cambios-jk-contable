import { AppMode } from '@/types';

// Recuerda en cada computadora la última cuenta donde entró un abono a deuda,
// para que el modal "Registrar Abono a Deuda" la traiga preseleccionada
// hasta que el operador elija otra. Se guarda aparte para Detal y Mayor.

const KEY_PREFIX = 'cambiosjk_ultima_cuenta_abono_';

function keyFor(appMode?: AppMode): string {
  return KEY_PREFIX + (appMode || 'detal');
}

/** Devuelve la última cuenta usada, solo si todavía existe en la lista; si no, '' (Caja General). */
export function getUltimaCuentaAbono(appMode: AppMode | undefined, accounts: { id: string }[]): string {
  if (typeof window === 'undefined') return '';
  try {
    const id = localStorage.getItem(keyFor(appMode)) || '';
    return id && accounts.some((a) => a.id === id) ? id : '';
  } catch {
    return '';
  }
}

/** Guarda la cuenta usada al confirmar un abono ('' = Caja General / sin cuenta). */
export function setUltimaCuentaAbono(appMode: AppMode | undefined, accountId: string): void {
  try {
    if (accountId) localStorage.setItem(keyFor(appMode), accountId);
    else localStorage.removeItem(keyFor(appMode));
  } catch {
    // almacenamiento bloqueado: simplemente no se recuerda
  }
}
