// Pide el nombre correcto de un cliente. Devuelve null si se cancela o no cambia.
export function askNewClientName(current: string, label = 'cliente'): string | null {
  const nuevo = prompt(`Nombre correcto del ${label} (actual: ${current}):`, current);
  if (!nuevo || !nuevo.trim()) return null;
  if (nuevo.trim().toUpperCase() === current.trim().toUpperCase()) return null;
  return nuevo.trim().toUpperCase();
}
