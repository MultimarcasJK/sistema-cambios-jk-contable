'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_VERSION, hayVersionNueva, versionPublicada } from '@/lib/version-check';

// Respaldo: archivo del código de la página principal, que cambia de nombre con cada versión.
const PAGE_CHUNK = /chunks\/app\/page-[a-z0-9]+\.js/;
const CADA = 60 * 1000;

function loadedChunk(): string | null {
  if (typeof document === 'undefined') return null;
  for (const s of Array.from(document.scripts)) {
    const m = (s.src || '').match(PAGE_CHUNK);
    if (m) return m[0];
  }
  return null;
}

async function revisarVersion(): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const sinCache = { cache: 'no-store' as RequestCache };
  // 1) version.json: cambia con cualquier cambio publicado, aunque sea en otra parte del código.
  try {
    const res = await fetch(`${base}/version.json?t=${Date.now()}`, sinCache);
    if (res.ok) {
      const publicada = versionPublicada(await res.json());
      if (publicada) return hayVersionNueva(APP_VERSION, publicada);
    }
  } catch {
    // sigue con el respaldo
  }
  // 2) Respaldo: comparar el archivo de la página principal.
  const actual = loadedChunk();
  if (!actual) return false;
  const res = await fetch(window.location.pathname + '?v=' + Date.now(), sinCache);
  if (!res.ok) return false;
  const m = (await res.text()).match(PAGE_CHUNK);
  return !!m && m[0] !== actual;
}

// Si se publicó una versión nueva del sistema, avisa para recargar. Así todas las computadoras
// usan las mismas reglas. Revisa cada minuto y también al volver a la pestaña o a la ventana.
export function UpdateBanner() {
  const [hayNueva, setHayNueva] = useState(false);

  useEffect(() => {
    let cancel = false;
    let revisando = false;
    const revisar = async () => {
      if (revisando || cancel) return;
      revisando = true;
      try {
        if (await revisarVersion()) {
          if (!cancel) setHayNueva(true);
        }
      } catch {
        // sin internet: se revisa en la próxima vuelta
      } finally {
        revisando = false;
      }
    };
    const alVolver = () => {
      if (document.visibilityState === 'visible') revisar();
    };
    revisar();
    const id = window.setInterval(revisar, CADA);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', revisar);
    window.addEventListener('online', revisar);
    return () => {
      cancel = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', revisar);
      window.removeEventListener('online', revisar);
    };
  }, []);

  if (!hayNueva) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-32px)] flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500 text-slate-900 shadow-2xl text-sm font-bold">
      <span>Hay una versión nueva del sistema. Recarga para que esta computadora quede igual que las demás.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Actualizar
      </button>
    </div>
  );
}
