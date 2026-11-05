import { useSyncExternalStore } from 'react';
import { AppMode } from '@/types';

// Aspecto de la pantalla, elegido en cada computadora (no se sincroniza).
// 'auto' = como siempre: Mayor oscuro y Detal claro.
export type ThemeChoice = 'auto' | 'oscuro' | 'claro';

const KEY = 'cambiosjk_tema_v1';
const listeners = new Set<() => void>();

export function getThemeChoice(): ThemeChoice {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(KEY);
    return v === 'oscuro' || v === 'claro' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // bloqueado: el cambio dura solo hasta recargar
  }
  listeners.forEach((l) => l());
}

export function isDarkFor(appMode: AppMode | undefined): boolean {
  const choice = getThemeChoice();
  if (choice === 'oscuro') return true;
  if (choice === 'claro') return false;
  return appMode === 'mayor';
}

// Valor que usa globals.css en data-theme: "mayor" pinta oscuro y "detal" claro.
export function themeAttrFor(appMode: AppMode | undefined): AppMode {
  return isDarkFor(appMode) ? 'mayor' : 'detal';
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getThemeChoice,
    () => 'auto'
  );
}
