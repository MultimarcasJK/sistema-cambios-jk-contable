'use client';

import React, { useState } from 'react';
import { CurrencyConfig } from '@/types';
import { CurrencyService, INITIAL_CURRENCIES } from '@/lib/currencies';
import { X, Plus, Trash2, RotateCcw, Coins, Check } from 'lucide-react';

interface ManageCurrenciesModalProps {
  onClose: () => void;
  onCurrenciesChange: () => void;
}

export function ManageCurrenciesModal({ onClose, onCurrenciesChange }: ManageCurrenciesModalProps) {
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>(CurrencyService.getCurrencies());
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) {
      alert('Código y nombre de moneda son requeridos');
      return;
    }

    const codeClean = newCode.trim().toUpperCase();
    if (currencies.some((c) => c.code === codeClean)) {
      alert(`La moneda ${codeClean} ya existe en el sistema`);
      return;
    }

    const newCurr: CurrencyConfig = {
      code: codeClean,
      name: newName.trim(),
      symbol: newSymbol.trim() || '$',
    };

    CurrencyService.addCurrency(newCurr);
    const updated = CurrencyService.getCurrencies();
    setCurrencies(updated);
    setNewCode('');
    setNewName('');
    setNewSymbol('');
    setFeedback(`Moneda ${codeClean} agregada con éxito`);
    setTimeout(() => setFeedback(null), 3000);
    onCurrenciesChange();
  };

  const handleDelete = (code: string) => {
    if (code === 'USD' || code === 'USDT') {
      alert('USD y USDT son monedas base del sistema y no pueden eliminarse');
      return;
    }

    if (confirm(`¿Deseas eliminar la moneda ${code} del catálogo?`)) {
      CurrencyService.deleteCurrency(code);
      const updated = CurrencyService.getCurrencies();
      setCurrencies(updated);
      onCurrenciesChange();
    }
  };

  const handleReset = () => {
    if (confirm('¿Deseas restablecer el catálogo a las 18 monedas oficiales por defecto?')) {
      CurrencyService.resetDefaults();
      const updated = CurrencyService.getCurrencies();
      setCurrencies(updated);
      onCurrenciesChange();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gestión de Monedas y Divisas</h3>
              <p className="text-xs text-slate-500">Agrega o elimina divisas utilizadas en compras, abonos y cuentas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario Agregar Moneda */}
        <form onSubmit={handleAdd} className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-xs font-bold text-slate-700 block mb-2">Registrar Nueva Moneda</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código (ISO 3 letras) *</label>
              <input
                type="text"
                placeholder="ej. CAD o GBP"
                maxLength={5}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nombre Completo *</label>
              <input
                type="text"
                placeholder="ej. Dólar Canadiense"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Símbolo</label>
              <input
                type="text"
                placeholder="ej. C$ o £"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            {feedback ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>{feedback}</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Moneda</span>
            </button>
          </div>
        </form>

        {/* Lista de Monedas Activas */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">
              Catálogo de Monedas Activas ({currencies.length})
            </span>
            <button
              onClick={handleReset}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer Monedas por Defecto</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currencies.map((c) => {
              const isBase = c.code === 'USD' || c.code === 'USDT';
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-11 h-7 rounded-lg bg-slate-100 font-mono font-bold text-xs flex items-center justify-center text-slate-800 border border-slate-200">
                      {c.code}
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 leading-tight">{c.name}</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Símbolo: {c.symbol}</span>
                    </div>
                  </div>

                  {isBase ? (
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                      Base
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(c.code)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={`Eliminar ${c.code}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}