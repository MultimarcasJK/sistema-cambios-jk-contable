'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Monitor, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Estado compartido a nivel de módulo para no perder el evento si cambia la vista (Login -> Dashboard)
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let swRegistered = false;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((fn) => fn());
}

function registerServiceWorkerOnce() {
  if (swRegistered || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  swRegistered = true;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const swUrl = `${basePath}/sw.js`;
  const scope = `${basePath}/`;
  navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
    // Si el navegador bloquea el SW (ej. modo incógnito estricto), no interrumpir la app
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    nav.standalone === true
  );
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

interface InstallAppButtonProps {
  variant?: 'header' | 'login';
}

export function InstallAppButton({ variant = 'header' }: InstallAppButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsInstalled(checkIsStandalone());
    setIsIOS(checkIsIOS());
    setHasNativePrompt(Boolean(sharedDeferredPrompt));

    registerServiceWorkerOnce();

    const syncPrompt = () => setHasNativePrompt(Boolean(sharedDeferredPrompt));
    promptListeners.add(syncPrompt);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      sharedDeferredPrompt = e as BeforeInstallPromptEvent;
      notifyPromptListeners();
    };

    const handleAppInstalled = () => {
      sharedDeferredPrompt = null;
      notifyPromptListeners();
      setIsInstalled(true);
      setJustInstalled(true);
      setShowHelpModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(syncPrompt);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!mounted || isInstalled) return null;

  const handleInstallClick = async () => {
    if (sharedDeferredPrompt) {
      try {
        await sharedDeferredPrompt.prompt();
        const choice = await sharedDeferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          sharedDeferredPrompt = null;
          notifyPromptListeners();
          setIsInstalled(true);
          setJustInstalled(true);
        }
        return;
      } catch {
        // Si falla el prompt nativo, mostrar instrucciones manuales
      }
    }
    setShowHelpModal(true);
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-500/40 shadow-sm transition cursor-pointer text-xs font-bold"
          title="Instalar Cambios JK como acceso directo en tu dispositivo"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Instalar App</span>
          <span className="md:hidden">Instalar</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full mt-4 py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700/90 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Instalar acceso directo en este dispositivo</span>
        </button>
      )}

      {justInstalled && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>¡Cambios JK instalada como acceso directo!</span>
        </div>
      )}

      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-[#0b1b33] border border-slate-700 rounded-2xl max-w-sm w-full p-5 text-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                {isIOS ? (
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Monitor className="w-5 h-5 text-emerald-400" />
                )}
                <h3 className="font-bold text-white text-sm">Instalar Cambios JK</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>Para crear el acceso directo en tu iPhone o iPad desde Safari:</p>
                <ol className="space-y-2 list-decimal list-inside">
                  <li className="flex items-center gap-1.5">
                    <span>1. Toca el botón</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white font-semibold">
                      <Share className="w-3.5 h-3.5 text-blue-400" /> Compartir
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span>2. Elige</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white font-semibold">
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-400" /> Agregar a inicio
                    </span>
                  </li>
                  <li>3. Toca <strong className="text-white">Agregar</strong> arriba a la derecha.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  {hasNativePrompt
                    ? 'Confirma la ventana de instalación de tu navegador.'
                    : 'Puedes crear el acceso directo desde el menú de Chrome o Edge:'}
                </p>
                <ol className="space-y-2">
                  <li>
                    <strong className="text-white">1. En PC (Chrome / Edge):</strong> haz clic en el ícono de{' '}
                    <strong className="text-emerald-300">Instalar</strong> en el extremo derecho de la barra de direcciones, o en el menú <strong className="text-white">⋮ → Guardar y compartir → Instalar página como app</strong>.
                  </li>
                  <li>
                    <strong className="text-white">2. En Android (Chrome):</strong> toca el menú{' '}
                    <strong className="text-white">⋮</strong> arriba a la derecha y elige{' '}
                    <strong className="text-emerald-300">Instalar aplicación</strong> o{' '}
                    <strong className="text-emerald-300">Agregar a la pantalla principal</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
