// Regla de todo el sistema: en las listas de registros lo más nuevo va arriba,
// pegado al encabezado, y lo más viejo abajo.

export interface Fechable {
  id?: string;
  date?: string;
  created_at?: string;
  time?: string;
}

// Momento de creación en milisegundos: created_at, o el id (prefijo-<milisegundos>), o la fecha
export function recordTime(r: Fechable | null | undefined): number {
  if (!r) return 0;
  const t = r.created_at ? Date.parse(r.created_at) : NaN;
  if (!Number.isNaN(t)) return t;
  const m = /-(\d{13})(?:\D|$)/.exec(String(r.id || ''));
  if (m) return Number(m[1]);
  const d = r.date ? Date.parse(r.date + 'T' + (r.time || '00:00')) : NaN;
  return Number.isNaN(d) ? 0 : d;
}

// Comparador: fecha del registro (más reciente primero) y, dentro del mismo día, hora de creación
export function compareNewestFirst(a: Fechable, b: Fechable): number {
  const da = a.date || (a.created_at || '').slice(0, 10);
  const db = b.date || (b.created_at || '').slice(0, 10);
  if (da !== db) return db.localeCompare(da);
  const diff = recordTime(b) - recordTime(a);
  if (diff) return diff;
  return String(b.id || '').localeCompare(String(a.id || ''));
}

export function newestFirst<T extends Fechable>(list: T[]): T[] {
  return [...list].sort(compareNewestFirst);
}
