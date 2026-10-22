import { Remesa } from '@/types';

// Ganancia de remesas de un día: cuenta la remesa el día que se marcó pagada.
// Las anuladas o con el pago revertido no cuentan (ya no están en "pagada").
export function remesasPagadasEl(remesas: Remesa[], date: string): Remesa[] {
  return remesas.filter((r) => r && r.estado === 'pagada' && r.fecha_pago === date);
}

export function gananciaRemesasEl(remesas: Remesa[], date: string): number {
  return remesasPagadasEl(remesas, date).reduce((sum, r) => sum + (r.ganancia_usd || 0), 0);
}
