import { StorageService } from './storage';
import { isActorAdmin } from './actor';
import type { AppMode, DebtPayment } from '@/types';

// Botón de papelera de un abono. Si el día del abono ya está cerrado, el ADMIN puede anularlo
// igual escribiendo un motivo: la cuenta y la deuda se corrigen hoy y los cierres no se tocan.
// Devuelve true si el abono se anuló.
export async function anularAbono(pay: DebtPayment, mode?: AppMode, confirmText?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  let motivo: string | undefined;

  if (StorageService.isDayLocked(pay.date, mode) && isActorAdmin()) {
    const r = window.prompt(
      `El ${pay.date} ya está cerrado.\n\n` +
        `Vas a ANULAR el abono de ${pay.client_name} ($${pay.amount}). ` +
        'Se le resta a la cuenta donde entró y se le devuelve la deuda al cliente, con fecha de hoy. ' +
        'Los cierres guardados no se tocan.\n\n' +
        'Escribe el motivo (ej. "abono duplicado, ya está en otra cuenta"):'
    );
    if (r === null) return false;
    if (!r.trim()) {
      window.alert('Para anular un abono de un día cerrado hace falta un motivo.');
      return false;
    }
    motivo = r.trim();
  } else if (!window.confirm(confirmText || `¿Eliminar este registro de abono de ${pay.client_name}?`)) {
    return false;
  }

  try {
    await StorageService.deleteDebtPayment(pay.id, mode, motivo);
    return true;
  } catch {
    // El aviso de día cerrado ya se mostró en pantalla
    return false;
  }
}
