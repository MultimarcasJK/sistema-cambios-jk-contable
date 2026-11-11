// Versión con la que se cargó esta pestaña (el commit publicado).
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

// Lee la versión publicada de version.json. Devuelve null si no se pudo leer.
export function versionPublicada(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const v = (data as { version?: unknown }).version;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// Hay versión nueva si la publicada es distinta a la cargada (y ninguna es de desarrollo).
export function hayVersionNueva(cargada: string, publicada: string | null): boolean {
  if (!publicada || !cargada || cargada === 'dev' || publicada === 'dev') return false;
  return publicada !== cargada;
}
