'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Archivo del código de la página principal. Cambia de nombre con cada versión publicada.
const PAGE_CHUNK = /chunks\/app\/page-[a-z0-9]+\.js/;

function loadedChunk(): string | null {
  if (typeof document === 'undefined') return null;
  for (const s of Array.from(document.scripts)) {
    const m = (s.src || '').match(PAGE_CHUNK);
    if (m) return m[0];
  }
  return null;
}

// Si se publicó una versión nueva del sistema, avisa para recargar. Así todas las computadoras
// usan las mismas reglas (por ejemplo, cómo se calcula la deuda de los proveedores).
export function UpdateBanner() {
  const [hayNueva, setHayNueva] = useState(false);

  useEffect(() => {
    const actual = loadedChunk();
    if (!actual) return;
    let cancel = false;
    const revisar = async () => {
      try {
        const res = await fetch(window.location.pathname + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const m = (await res.text()).match(PAGE_CHUNK);
        if (!cancel && m && m[0] !== actual) setHayNueva(true);
      } catch {
        // sin internet: se revisa en la próxima vuelta
      }
    };
    revisar();
    const id = window.setInterval(revisar, 2 * 60 * 1000);
    return () => {
      cancel = true;
      window.clearInterval(id);
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
