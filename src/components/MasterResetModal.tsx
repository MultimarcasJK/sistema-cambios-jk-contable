'use client';

import React, { useState } from 'react';
import { StorageService } from '@/lib/storage';
import { AppMode } from '@/types';
import { AlertTriangle, Trash2, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface MasterResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentMode?: AppMode;
}

export function MasterResetModal({ isOpen, onClose, onSuccess, currentMode = 'detal' }: MasterResetModalProps) {
  const [resetScope, setResetScope] = useState<AppMode | 'both'>(currentMode);
  const [resetType, setResetType] = useState<'blank' | 'zero_balances'>('blank');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async () => {
    if (confirmationInput.trim().toUpperCase() !== 'REINICIAR') {
      return;
    }

    setIsProcessing(true);
    try {
      const scopeLabel =
        resetScope === 'detal'
          ? 'Grupo DETAL (Cripto/Dólar)'
          : resetScope === 'mayor'
          ? 'Grupo MAYOR (Monedas Regionales)'
          : 'TODO EL SISTEMA (Detal y Mayor)';

      if (resetType === 'blank') {
        await StorageService.masterResetToZero(resetScope);
        setSuccessMessage(`¡${scopeLabel} reiniciado a CERO absoluto (lienzo en blanco) con éxito!`);
      } else {
        await StorageService.resetBalancesToZero(resetScope);
        setSuccessMessage(`¡Saldos y deudas del ${scopeLabel} puestos en 0.00 con éxito!`);
      }

      onSuccess();
      setTimeout(() => {
        setIsProcessing(false);
        setSuccessMessage(null);
        setConfirmationInput('');
        onClose();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1200);
    } catch (err) {
      console.error('Error en reinicio maestro:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-rose-950/80 to-slate-900 p-5 border-b border-rose-900/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Reinicio Controlado del Sistema</h2>
              <p className="text-xs text-rose-300/80">Limpieza por entorno o global</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5">
          {successMessage ? (
            <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-center space-x-3 text-emerald-400 text-sm font-bold">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 animate-bounce" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              {/* Paso 1: Ámbito / Entorno */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  1. Selecciona el Entorno a Reiniciar:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetScope('detal')}
                    className={
                      'p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ' +
                      (resetScope === 'detal'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')
                    }
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span>Solo DETAL</span>
                    <span className="text-[10px] text-slate-400 font-normal">Cripto / Dólar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetScope('mayor')}
                    className={
                      'p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ' +
                      (resetScope === 'mayor'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')
                    }
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span>Solo MAYOR</span>
                    <span className="text-[10px] text-slate-400 font-normal">Regionales</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetScope('both')}
                    className={
                      'p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ' +
                      (resetScope === 'both'
                        ? 'bg-rose-950/50 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600')
                    }
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                    <span>TODO</span>
                    <span className="text-[10px] text-slate-400 font-normal">Detal + Mayor</span>
                  </button>
                </div>

                {/* Nota de seguridad del entorno protegido */}
                <div className="mt-2 p-2 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center space-x-2 text-[11px]">
                  <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">
                    {resetScope === 'detal' && (
                      <>El grupo <strong className="text-amber-400 font-semibold">MAYOR queda 100% intacto y protegido</strong>.</>
                    )}
                    {resetScope === 'mayor' && (
                      <>El grupo <strong className="text-emerald-400 font-semibold">DETAL queda 100% intacto y protegido</strong>.</>
                    )}
                    {resetScope === 'both' && (
                      <span className="text-rose-400 font-semibold">Atención: Se limpiarán tanto Detal como Mayor.</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Paso 2: Tipo de Reinicio */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  2. Nivel de Limpieza:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  <label
                    onClick={() => setResetType('blank')}
                    className={
                      'p-3 rounded-xl border cursor-pointer transition flex items-start space-x-3 ' +
                      (resetType === 'blank'
                        ? 'bg-rose-950/30 border-rose-500/60 ring-1 ring-rose-500'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600')
                    }
                  >
                    <input
                      type="radio"
                      name="resetType"
                      checked={resetType === 'blank'}
                      onChange={() => setResetType('blank')}
                      className="mt-1 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white">
                        Lienzo en Blanco (0 Cuentas, 0 Datos)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Borra todas las cuentas, clientes, transacciones y cierres del entorno seleccionado. Queda 100% limpio.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setResetType('zero_balances')}
                    className={
                      'p-3 rounded-xl border cursor-pointer transition flex items-start space-x-3 ' +
                      (resetType === 'zero_balances'
                        ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600')
                    }
                  >
                    <input
                      type="radio"
                      name="resetType"
                      checked={resetType === 'zero_balances'}
                      onChange={() => setResetType('zero_balances')}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white">
                        Conservar Nombres de Cuentas, pero en $0.00
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mantiene las cuentas bancarias pero deja saldos en $0.00 y elimina las operaciones del entorno seleccionado.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Paso 3: Confirmación obligatoria */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Para confirmar, escribe la palabra <span className="text-rose-400 font-black">REINICIAR</span>:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="Escribe REINICIAR"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-rose-500 uppercase tracking-widest placeholder:text-slate-600"
                />
              </div>
            </>
          )}
        </div>

        {/* Botones */}
        {!successMessage && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleReset}
              disabled={confirmationInput.trim().toUpperCase() !== 'REINICIAR' || isProcessing}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-rose-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Limpiando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {resetScope === 'detal'
                      ? 'Reiniciar Solo Detal'
                      : resetScope === 'mayor'
                      ? 'Reiniciar Solo Mayor'
                      : 'Reiniciar Todo'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
