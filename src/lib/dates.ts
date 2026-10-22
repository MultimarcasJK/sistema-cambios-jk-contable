// Fechas del negocio en hora LOCAL (Venezuela, UTC-4).
// No usar toISOString().slice(0, 10): eso da la fecha en UTC, y después de las 8 p.m. ya es "mañana".

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha local (YYYY-MM-DD) de una marca de tiempo ISO como created_at. */
export function localDateOf(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : localDateStr(d);
}

/** Hora local (HH:MM) de una marca de tiempo ISO como created_at. */
export function localTimeOf(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(11, 16);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
