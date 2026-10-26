'use client';

import React, { useState, useEffect } from 'react';
import { Account, Currency, AccountType, CurrencyConfig } from '@/types';
import { COUNTRIES_LIST, getAccountCountry } from '@/lib/countries';
import {
  X,
  Check,
  Landmark,
  Trash2,
  AlertTriangle,
  Wallet,
  CreditCard,
  Globe,
  Coins,
  User,
  Hash,
  FileText,
  Building,
} from 'lucide-react';

export interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  currencies: CurrencyConfig[];
  onSave: (updatedAccount: Account) => void;
  onDelete?: (accountId: string) => void;
}

export function EditAccountModal({
  isOpen,
  onClose,
  account,
  currencies,
  onSave,
  onDelete,
}: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    responsible: '',
    account_number: '',
    account_subtype: '',
    type: 'banco' as AccountType,
    country: 'ECUADOR',
    currency: 'USD' as Currency,
    initial_balance: '0',
    current_balance: '0',
    notes: '',
    is_active: true,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        bank_name: account.bank_name || '',
        responsible: account.responsible || '',
        account_number: account.account_number || '',
        account_subtype: account.account_subtype || '',
        type: account.type || 'banco',
        country: getAccountCountry(account) || 'ECUADOR',
        currency: account.currency || 'USD',
        initial_balance: String(account.initial_balance ?? 0),
        current_balance: String(account.current_balance ?? 0),
        notes: account.notes || '',
        is_active: account.is_active ?? true,
      });
      setShowDeleteConfirm(false);
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.responsible.trim()) {
      alert('Por favor complete al menos el nombre de la cuenta y el nombre del titular/responsable.');
      return;
    }

    const updated: Account = {
      ...account,
      name: formData.name.trim().toUpperCase(),
      bank_name: formData.bank_name.trim() || formData.name.trim(),
      responsible: formData.responsible.trim(),
      account_number: formData.account_number.trim(),
      account_subtype: formData.account_subtype.trim(),
      type: formData.type,
      country: formData.country,
      currency: formData.currency,
      initial_balance: parseFloat(formData.initial_balance) || 0,
      current_balance: parseFloat(formData.current_balance) || 0,
      notes: formData.notes.trim(),
      is_active: formData.is_active,
    };

    onSave(updated);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && account) {
      onDelete(account.id);
      onClose();
    }
  };

  const selectedCountryInfo = COUNTRIES_LIST.find((c) => c.id === formData.country);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/30 text-blue-300 border border-blue-500/30">
                  Edición de Cuenta
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {account.id}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                {account.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario de Edición */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nombre de la Cuenta */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Nombre de la Cuenta *</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej. BANCO PICHINCHA JUAN"
                className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Identificador principal que se muestra en el sistema</span>
            </div>

            {/* Banco o Plataforma */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                <span>Banco o Plataforma *</span>
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="ej. Pichincha, Binance, Banesco, Guayaquil"
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Entidad financiera o plataforma</span>
            </div>

            {/* Nombre del Titular / Responsable */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Titular / Responsable *</span>
              </label>
              <input
                type="text"
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                placeholder="ej. Kelvin, Dario, Glendys"
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Persona a cargo o titular de la cuenta</span>
            </div>

            {/* Número de Cuenta / Teléfono / Wallet */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-600" />
                <span>Número de Cuenta / Teléfono / Wallet</span>
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                placeholder="ej. 2205678901 / Cédula / Correo Zelle"
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Datos para recibir o transferir fondos</span>
            </div>

            {/* País */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>País de la Cuenta</span>
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white font-medium focus:border-blue-500 focus:outline-none"
              >
                {COUNTRIES_LIST.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name} ({country.defaultCurrency})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ubicación y pestaña donde aparecerá la cuenta</span>
            </div>

            {/* Moneda de la Cuenta */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5 text-blue-600" />
                <span>Moneda de la Cuenta</span>
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Moneda de los movimientos y saldos</span>
            </div>

            {/* Tipo de Cuenta General */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                <span>Categoría / Tipo</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="banco">Banco Tradicional</option>
                <option value="wallet">Wallet / Binance</option>
                <option value="efectivo">Caja Efectivo</option>
                <option value="zelle">Zelle</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Tipo de Cuenta Detalle (Corriente, Ahorros, etc.) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Tipo Específico (Opcional)</span>
              </label>
              <input
                type="text"
                value={formData.account_subtype}
                onChange={(e) => setFormData({ ...formData, account_subtype: e.target.value })}
                placeholder="ej. Corriente, Ahorros, TRC20"
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Subtipo o red blockchain</span>
            </div>

            {/* Saldo Inicial / Apertura */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                <span>Saldo Inicial (Apertura)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {formData.currency}
                </span>
                <input
                  type="number"
                  step="any"
                  value={formData.initial_balance}
                  onChange={(e) => {
                    // El disponible se mueve al instante lo mismo que cambia el saldo inicial
                    const prevIni = parseFloat(formData.initial_balance) || 0;
                    const nextIni = parseFloat(e.target.value) || 0;
                    const current = parseFloat(formData.current_balance) || 0;
                    setFormData({
                      ...formData,
                      initial_balance: e.target.value,
                      current_balance: String(Number((current + nextIni - prevIni).toFixed(4))),
                    });
                  }}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl pl-12 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Saldo con el que inició la cuenta (0.00 por defecto)</span>
            </div>

            {/* Saldo Actual / Ajuste Directo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saldo Actual Disponible</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {formData.currency}
                </span>
                <input
                  type="number"
                  step="any"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl pl-12 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ajuste manual directo del saldo</span>
            </div>

            {/* Estado de la Cuenta */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado Operativo</label>
              <div className="flex items-center space-x-3 pt-1.5">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="is_active"
                    checked={formData.is_active === true}
                    onChange={() => setFormData({ ...formData, is_active: true })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Activa
                  </span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="is_active"
                    checked={formData.is_active === false}
                    onChange={() => setFormData({ ...formData, is_active: false })}
                    className="text-slate-400 focus:ring-slate-400"
                  />
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Inactiva
                  </span>
                </label>
              </div>
            </div>

            {/* Notas / Observaciones */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Notas u Observaciones</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ej. Límite diario de transferencias $5,000, solo para cobros detal..."
                rows={2}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Confirmación de Eliminación */}
          {showDeleteConfirm && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 text-rose-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>¿Está seguro de eliminar esta cuenta permanentemente?</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition shadow-2xs cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Botones de acción inferior */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {onDelete && !showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Cuenta</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
