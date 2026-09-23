'use client';

import React, { useState } from 'react';
import { StorageService } from '@/lib/storage';
import { AlertTriangle, Trash2, X, CheckCircle2 } from 'lucide-react';

interface MasterResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MasterResetModal({ isOpen, onClose, onSuccess }: MasterResetModalProps) {
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
      if (resetType === 'blank') {
        await StorageService.masterResetToZero();
        setSuccessMessage('¡Sistema reiniciado a CERO absoluto (lienzo en blanco) con éxito!');
      } else {
        await StorageService.resetBalancesToZero();
        setSuccessMessage('¡Todos los saldos y deudas se han puesto en 0.00 con éxito!');
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
              <h2 className="text-lg font-black text-white">Reinicio Maestro del Sistema</h2>
              <p className="text-xs text-rose-300/80">Operaci?n de limpieza profunda</p>
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
              <p className="text-xs text-slate-300 leading-relaxed">
                Esta acci?n te permite reiniciar todo el sistema contable de forma controlada.
                Elige el nivel de limpieza que deseas aplicar:
              </p>

              {/* Selector de Tipo de Reinicio */}
              <div className="grid grid-cols-1 gap-3">
                <label
                  onClick={() => setResetType('blank')}
                  className={
                    'p-3.5 rounded-xl border cursor-pointer transition flex items-start space-x-3 ' +
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
                    <span className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <span>Lienzo en Blanco Total (0 Cuentas, 0 Datos)</span>
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Borra todas las cuentas bancarias, clientes, transacciones, traspasos, gastos y cierres. Queda 100% limpio para crear tus cuentas reales desde cero.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setResetType('zero_balances')}
                  className={
                    'p-3.5 rounded-xl border cursor-pointer transition flex items-start space-x-3 ' +
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
                    <span className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <span>Conservar Nombres de Cuentas, pero en 0.00</span>
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mantiene los bancos y wallets pero deja sus saldos en $0.00. Borra todas las operaciones hist?ricas, deudas y gastos.
                    </p>
                  </div>
                </label>
              </div>

              {/* Confirmaci?n obligatoria */}
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
                  <span>Limpiar y Dejar en 0</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
