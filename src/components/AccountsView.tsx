'use client';

import React, { useState, useMemo } from 'react';
import { Account, Currency, AccountType, CurrencyConfig, AppMode } from '@/types';
import { StorageService } from '@/lib/storage';
import { CurrencyService } from '@/lib/currencies';
import { COUNTRIES_LIST, getAccountCountry, CountryInfo } from '@/lib/countries';
import { INITIAL_ACCOUNTS_MAYOR } from '@/lib/initial-data';
import { ManageCurrenciesModal } from './ManageCurrenciesModal';
import { AccountStatementModal } from './AccountStatementModal';
import { EditAccountModal } from './EditAccountModal';
import { Wallet, Plus, Edit2, Trash2, CheckCircle, RefreshCw, Landmark, Coins, ArrowLeft, ChevronRight, Globe, FileText, GripVertical } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface AccountsProps {
  accounts: Account[];
  onDataChange: () => void;
  appMode?: AppMode;
}

export function AccountsView({ accounts, onDataChange, appMode }: AccountsProps) {
  const { isAdmin } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isManagingCurrencies, setIsManagingCurrencies] = useState(false);
  const [statementAccount, setStatementAccount] = useState<Account | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [adjustBalanceValue, setAdjustBalanceValue] = useState<string>('');
  const [systemCurrencies, setSystemCurrencies] = useState<CurrencyConfig[]>(
    CurrencyService.getCurrencies()
  );

  const refreshCurrencies = () => {
    setSystemCurrencies(CurrencyService.getCurrencies());
  };

  // País activo actual si hay uno seleccionado
  const activeCountryInfo = useMemo(() => {
    if (!selectedCountry) return null;
    return COUNTRIES_LIST.find((c) => c.id === selectedCountry) || null;
  }, [selectedCountry]);

  // Nuevo formulario de cuenta
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank_name: '',
    country: 'ECUADOR',
    currency: 'USD' as Currency,
    type: 'banco' as AccountType,
    responsible: '',
    account_number: '',
    account_subtype: '',
    notes: '',
    initial_balance: '0',
  });

  const handleOpenAddAccount = (preselectedCountryId?: string) => {
    const cId = preselectedCountryId || selectedCountry || 'ECUADOR';
    const cInfo = COUNTRIES_LIST.find((c) => c.id === cId);
    setNewAccount({
      name: '',
      bank_name: '',
      country: cId,
      currency: (cInfo ? cInfo.defaultCurrency : 'USD') as Currency,
      type: cId === 'CRIPTO' ? 'wallet' : 'banco',
      responsible: '',
      account_number: '',
      account_subtype: '',
      notes: '',
      initial_balance: '0',
    });
    setIsAddingAccount(true);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.responsible) {
      alert('Por favor complete el nombre de la cuenta y el responsable');
      return;
    }

    const currentMode = appMode || StorageService.getAppMode();
    const currentAccounts = StorageService.getAccounts(currentMode);
    const created: Account = {
      id: 'acc-' + Date.now(),
      name: newAccount.name.trim().toUpperCase(),
      bank_name: newAccount.bank_name.trim() || newAccount.name.trim(),
      currency: newAccount.currency,
      type: newAccount.type,
      responsible: newAccount.responsible.trim(),
      account_number: newAccount.account_number.trim(),
      account_subtype: newAccount.account_subtype.trim(),
      notes: newAccount.notes.trim(),
      current_balance: parseFloat(newAccount.initial_balance) || 0,
      is_active: true,
      country: newAccount.country,
      scope: currentMode,
    } as Account;

    StorageService.saveAccounts([...currentAccounts, created], currentMode);
    setIsAddingAccount(false);
    onDataChange();
  };

  const handleSaveAccount = (updated: Account) => {
    const currentMode = appMode || StorageService.getAppMode();
    StorageService.updateAccount(
      updated.id,
      { ...updated, scope: updated.scope || currentMode },
      currentMode
    );
    setAccountToEdit(null);
    onDataChange();
  };

  const handleDeleteAccount = (accountId: string) => {
    const currentMode = appMode || StorageService.getAppMode();
    StorageService.deleteAccount(accountId, currentMode);
    setAccountToEdit(null);
    onDataChange();
  };

  const handleSaveAdjust = (accId: string) => {
    const val = parseFloat(adjustBalanceValue);
    if (isNaN(val)) return;

    const all = StorageService.getAccounts();
    const updated = all.map((a) => (a.id === accId ? { ...a, current_balance: val } : a));
    StorageService.saveAccounts(updated);
    setEditingAccountId(null);
    setAdjustBalanceValue('');
    onDataChange();
  };

  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dragOverAccountId, setDragOverAccountId] = useState<string | null>(null);

  // Cuentas pertenecientes al país seleccionado (ordenadas por order_index personalizado o Excel original)
  const accountsInActiveCountry = useMemo(() => {
    if (!selectedCountry) return [];
    const filtered = accounts.filter((a) => getAccountCountry(a) === selectedCountry);

    // Mapeo de orden del Excel (de INITIAL_ACCOUNTS_MAYOR)
    const excelOrderMap = new Map<string, number>();
    INITIAL_ACCOUNTS_MAYOR.forEach((acc, idx) => {
      excelOrderMap.set(acc.id, idx);
      excelOrderMap.set(acc.name.trim().toUpperCase(), idx);
    });

    return [...filtered].sort((a, b) => {
      // Si ambos tienen order_index definido por el usuario, respetar ese orden
      const hasOrderA = a.order_index !== undefined && a.order_index !== null;
      const hasOrderB = b.order_index !== undefined && b.order_index !== null;
      if (hasOrderA && hasOrderB) {
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      }
      if (hasOrderA) return -1;
      if (hasOrderB) return 1;

      // Si no tienen order_index explícito, usar el orden de referencia del Excel
      const idxA = excelOrderMap.has(a.id)
        ? excelOrderMap.get(a.id)!
        : excelOrderMap.has(a.name.trim().toUpperCase())
        ? excelOrderMap.get(a.name.trim().toUpperCase())!
        : 9999;
      const idxB = excelOrderMap.has(b.id)
        ? excelOrderMap.get(b.id)!
        : excelOrderMap.has(b.name.trim().toUpperCase())
        ? excelOrderMap.get(b.name.trim().toUpperCase())!
        : 9999;
      return idxA - idxB;
    });
  }, [accounts, selectedCountry]);

  // Manejador para reordenar cuentas al soltar (Drag and Drop)
  const handleDropAccount = (targetAccountId: string) => {
    if (!draggedAccountId || draggedAccountId === targetAccountId) {
      setDraggedAccountId(null);
      setDragOverAccountId(null);
      return;
    }

    const currentMode = appMode || StorageService.getAppMode();
    const list = [...accountsInActiveCountry];
    const fromIndex = list.findIndex((a) => a.id === draggedAccountId);
    const toIndex = list.findIndex((a) => a.id === targetAccountId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedAccountId(null);
      setDragOverAccountId(null);
      return;
    }

    // Reubicar el elemento arrastrado a la nueva posición
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    // Asignar order_index secuencial a la lista del país
    const orderIndexMap = new Map<string, number>();
    list.forEach((acc, idx) => {
      orderIndexMap.set(acc.id, idx);
    });

    // Actualizar en la lista general de cuentas
    const allAccounts = StorageService.getAccounts(currentMode);
    const updatedAll = allAccounts.map((acc) => {
      if (orderIndexMap.has(acc.id)) {
        return { ...acc, order_index: orderIndexMap.get(acc.id)! };
      }
      return acc;
    });

    // Guardar en Storage y sincronizar a Supabase
    StorageService.saveAccounts(updatedAll, currentMode);
    list.forEach((acc, idx) => {
      const updatedAccountWithOrder = { ...acc, order_index: idx };
      StorageService.updateAccount(acc.id, { order_index: idx }, currentMode);
    });

    setDraggedAccountId(null);
    setDragOverAccountId(null);
    onDataChange();
  };

  // Cuentas filtradas por moneda dentro del país (o global)
  const displayedAccounts = useMemo(() => {
    return accountsInActiveCountry.filter((a) => {
      if (selectedCurrency === 'ALL') return true;
      return a.currency === selectedCurrency;
    });
  }, [accountsInActiveCountry, selectedCurrency]);

  // Monedas presentes en el país seleccionado
  const currencyFilterOptions = useMemo(() => {
    const used = Array.from(new Set(accountsInActiveCountry.map((a) => a.currency)));
    return ['ALL', ...used];
  }, [accountsInActiveCountry]);

  // Estadísticas y saldos agrupados por país para los botones principales
  const countryStats = useMemo(() => {
    const stats: Record<
      string,
      { count: number; balances: Record<string, number> }
    > = {};

    COUNTRIES_LIST.forEach((c) => {
      stats[c.id] = { count: 0, balances: {} };
    });

    accounts.forEach((acc) => {
      const cId = getAccountCountry(acc);
      if (!stats[cId]) {
        stats[cId] = { count: 0, balances: {} };
      }
      stats[cId].count += 1;
      stats[cId].balances[acc.currency] =
        (stats[cId].balances[acc.currency] || 0) + acc.current_balance;
    });

    return stats;
  }, [accounts]);

  return (
    <div className="space-y-6">
      {/* VISTA 1: LISTADO DE BOTONES DE PAÍSES (Si selectedCountry === null) */}
      {!selectedCountry ? (
        <div className="space-y-6">
          {/* Barra superior de países */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-black text-slate-900">Arqueo de Cuentas por País</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecciona un país para ver y gestionar sus cuentas bancarias, billeteras y saldos
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (accounts.length > 0) {
                    setStatementAccount(accounts[0]);
                    setIsStatementOpen(true);
                  }
                }}
                className="flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-blue-200 shadow-2xs cursor-pointer"
                title="Consultar extracto bancario de cualquier cuenta"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Estados de Cuenta</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsManagingCurrencies(true)}
                    className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="Administrar catálogo de monedas"
                  >
                    <Coins className="w-4 h-4 text-blue-600" />
                    <span>Gestionar Monedas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAddAccount()}
                    className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Nueva Cuenta</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Formulario para agregar cuenta rápida */}
          {isAddingAccount && (
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-md">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Agregar Nueva Cuenta o Billetera</span>
              </h3>
              <form
                onSubmit={handleAddAccount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                    e.preventDefault();
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">País *</label>
                  <select
                    value={newAccount.country}
                    onChange={(e) => {
                      const cId = e.target.value;
                      const cInfo = COUNTRIES_LIST.find((c) => c.id === cId);
                      setNewAccount({
                        ...newAccount,
                        country: cId,
                        currency: (cInfo ? cInfo.defaultCurrency : newAccount.currency) as Currency,
                        type: cId === 'CRIPTO' ? 'wallet' : newAccount.type,
                      });
                    }}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {COUNTRIES_LIST.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.flag} {c.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Cuenta *</label>
                  <input
                    type="text"
                    placeholder="ej. BANCO PICHINCHA JUAN"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Banco / Plataforma</label>
                  <input
                    type="text"
                    placeholder="ej. Pichincha, Binance, Banesco"
                    value={newAccount.bank_name}
                    onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Responsable *</label>
                  <input
                    type="text"
                    placeholder="ej. Kelvin, Dario, Glendys"
                    value={newAccount.responsible}
                    onChange={(e) => setNewAccount({ ...newAccount, responsible: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Moneda de la Cuenta</label>
                  <select
                    value={newAccount.currency}
                    onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value as Currency })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold"
                  >
                    {systemCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="banco">Banco Tradicional</option>
                    <option value="wallet">Wallet / Binance</option>
                    <option value="efectivo">Caja / Efectivo</option>
                    <option value="zelle">Zelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo de Apertura</label>
                  <input
                    type="number"
                    step="any"
                    value={newAccount.initial_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, initial_balance: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAccount(false)}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
                  >
                    Guardar Cuenta
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Cuadrícula de Botones de Países */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {COUNTRIES_LIST.map((country) => {
              const stat = countryStats[country.id] || { count: 0, balances: {} };
              const hasAccounts = stat.count > 0;

              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(country.id);
                    setSelectedCurrency('ALL');
                  }}
                  className={`group text-left p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                    hasAccounts
                      ? 'bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md'
                      : 'bg-slate-50/70 hover:bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      {country.iso2 ? (
                        <img
                          src={`https://flagcdn.com/w80/${country.iso2}.png`}
                          alt={country.name}
                          className="w-10 h-7 object-cover rounded shadow-xs border border-slate-200 group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-7 rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                          🌐
                        </div>
                      )}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          hasAccounts
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-200/70 text-slate-500'
                        }`}
                      >
                        {stat.count} {stat.count === 1 ? 'cuenta' : 'cuentas'}
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-base tracking-wide group-hover:text-blue-600 transition">
                      {country.name.toUpperCase()}
                    </h3>

                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {country.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs">
                      {hasAccounts ? (
                        <div className="space-y-0.5">
                          {Object.entries(stat.balances).map(([curr, bal]) => (
                            <div
                              key={curr}
                              className={`font-mono font-bold text-xs ${
                                bal < 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {bal < 0 ? '-' : bal > 0 ? '+' : ''}
                              {curr === 'USD' ? '$' : curr === 'VES' ? 'Bs. ' : `${curr} `}
                              {Math.abs(bal).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Sin cuentas aún</span>
                      )}
                    </div>

                    <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition ml-2 flex-shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA 2: CUENTAS DEL PAÍS SELECCIONADO */
        <div className="space-y-6">
          {/* Barra de cabecera con botón de retorno */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedCurrency('ALL');
                }}
                className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
                title="Regresar a la selección de países"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600" />
                <span>⬅ Volver a Países</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex items-center space-x-3">
                {activeCountryInfo?.iso2 ? (
                  <img
                    src={`https://flagcdn.com/w80/${activeCountryInfo.iso2}.png`}
                    alt={activeCountryInfo.name}
                    className="w-9 h-6 object-cover rounded shadow-xs border border-slate-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    🌐
                  </div>
                )}
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    Cuentas de {activeCountryInfo?.name.toUpperCase()}
                  </h2>
                  <p className="text-[11px] text-slate-500 flex items-center space-x-2">
                    <span>{accountsInActiveCountry.length} {accountsInActiveCountry.length === 1 ? 'cuenta activa' : 'cuentas activas'}</span>
                    {isAdmin && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-100 flex items-center space-x-1">
                        <GripVertical className="w-3 h-3 text-blue-500" />
                        <span>Puedes arrastrar las tarjetas para cambiar su orden</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por moneda dentro de este país */}
              {currencyFilterOptions.length > 2 && (
                <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs gap-1">
                  {currencyFilterOptions.map((curr) => (
                    <button
                      key={curr}
                      onClick={() => setSelectedCurrency(curr)}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        selectedCurrency === curr
                          ? 'bg-white text-slate-900 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {curr === 'ALL' ? 'Todas' : curr}
                    </button>
                  ))}
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenAddAccount(selectedCountry)}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nueva Cuenta en {activeCountryInfo?.name}</span>
                </button>
              )}
            </div>
          </div>

          {/* Formulario para agregar cuenta dentro de este país */}
          {isAddingAccount && (
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-md">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Agregar Cuenta en {activeCountryInfo?.name}</span>
              </h3>
              <form
                onSubmit={handleAddAccount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                    e.preventDefault();
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Cuenta *</label>
                  <input
                    type="text"
                    placeholder="ej. BANCO PICHINCHA JUAN"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Banco / Plataforma</label>
                  <input
                    type="text"
                    placeholder="ej. Pichincha, Binance, Banesco"
                    value={newAccount.bank_name}
                    onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Responsable *</label>
                  <input
                    type="text"
                    placeholder="ej. Kelvin, Dario, Glendys"
                    value={newAccount.responsible}
                    onChange={(e) => setNewAccount({ ...newAccount, responsible: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Moneda de la Cuenta</label>
                  <select
                    value={newAccount.currency}
                    onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value as Currency })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold"
                  >
                    {systemCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="banco">Banco Tradicional</option>
                    <option value="wallet">Wallet / Binance</option>
                    <option value="efectivo">Caja / Efectivo</option>
                    <option value="zelle">Zelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo de Apertura</label>
                  <input
                    type="number"
                    step="any"
                    value={newAccount.initial_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, initial_balance: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAccount(false)}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
                  >
                    Guardar Cuenta
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Grid de Cuentas del País */}
          {displayedAccounts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="flex justify-center">
                {activeCountryInfo?.iso2 ? (
                  <img
                    src={`https://flagcdn.com/w80/${activeCountryInfo.iso2}.png`}
                    alt={activeCountryInfo.name}
                    className="w-14 h-10 object-cover rounded-lg shadow-sm border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xl shadow-sm font-bold">
                    🌐
                  </div>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Aún no tienes cuentas registradas para {activeCountryInfo?.name}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Puedes registrar bancos, billeteras o cajas de efectivo en {activeCountryInfo?.name} con su moneda ({activeCountryInfo?.defaultCurrency}) para llevar su arqueo y balances en tiempo real.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenAddAccount(selectedCountry)}
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primera Cuenta en {activeCountryInfo?.name}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3">
              {displayedAccounts.map((acc) => {
                const isEditing = editingAccountId === acc.id;
                const isDragging = draggedAccountId === acc.id;
                const isDragOver = dragOverAccountId === acc.id;

                return (
                  <div
                    key={acc.id}
                    draggable={isAdmin}
                    onDragStart={(e) => {
                      if (!isAdmin) return;
                      setDraggedAccountId(acc.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', acc.id);
                    }}
                    onDragOver={(e) => {
                      if (!isAdmin || !draggedAccountId || draggedAccountId === acc.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverAccountId !== acc.id) {
                        setDragOverAccountId(acc.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverAccountId === acc.id) {
                        setDragOverAccountId(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (!isAdmin) return;
                      e.preventDefault();
                      handleDropAccount(acc.id);
                    }}
                    onDragEnd={() => {
                      setDraggedAccountId(null);
                      setDragOverAccountId(null);
                    }}
                    className={`bg-white p-3 sm:p-3.5 rounded-xl border shadow-2xs transition-all duration-150 flex flex-col justify-between ${
                      isDragging
                        ? 'opacity-40 scale-95 border-blue-400 dashed border-2 shadow-inner'
                        : isDragOver
                        ? 'border-blue-500 ring-2 ring-blue-400/40 shadow-md scale-[1.02] bg-blue-50/20'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1 flex-wrap gap-y-0.5">
                            {isAdmin && (
                              <div
                                className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500 transition mr-0.5"
                                title="Arrastrar para reordenar esta cuenta"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {activeCountryInfo?.iso2 ? (
                              <img
                                src={`https://flagcdn.com/w80/${activeCountryInfo.iso2}.png`}
                                alt={activeCountryInfo.name}
                                className="w-3.5 h-2.5 object-cover rounded-2xs border border-slate-200 inline-block"
                              />
                            ) : (
                              <span className="text-[11px]">🌐</span>
                            )}
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {acc.currency} • {acc.type}
                            </span>
                            {acc.account_subtype && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                {acc.account_subtype}
                              </span>
                            )}
                            {acc.is_active === false && (
                              <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Inactiva
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-[13px] mt-1 leading-snug truncate" title={acc.name}>
                            {acc.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate" title={`${acc.bank_name} • Resp: ${acc.responsible}`}>
                            {acc.bank_name} • <span className="text-slate-700 font-medium">Resp: {acc.responsible}</span>
                          </p>
                          {acc.account_number && (
                            <p className="text-[10px] font-mono text-slate-600 mt-0.5 flex items-center space-x-1 truncate">
                              <span className="text-slate-400">N°:</span>
                              <span className="font-semibold">{acc.account_number}</span>
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center space-x-0.5 shrink-0">
                            <button
                              onClick={() => setAccountToEdit(acc)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              title="Editar cuenta completa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`¿Estás seguro de que deseas eliminar la cuenta "${acc.name}"? Esta acción no se puede deshacer.`)) {
                                  handleDeleteAccount(acc.id);
                                }
                              }}
                              title="Eliminar cuenta"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Saldo:</span>
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="any"
                              value={adjustBalanceValue}
                              onChange={(e) => setAdjustBalanceValue(e.target.value)}
                              className="w-20 text-[11px] border border-blue-400 rounded px-1 py-0.5 font-mono focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveAdjust(acc.id)}
                              className="p-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                              title="Guardar ajuste"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`font-black font-mono text-xs sm:text-sm inline-flex items-center ${
                              acc.current_balance < 0
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            <span
                              className={`text-[9px] font-bold mr-1 px-1 py-0.2 rounded border font-sans ${
                                acc.current_balance < 0
                                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              {acc.currency}
                            </span>
                            <span>
                              {acc.current_balance < 0 ? '-' : acc.current_balance > 0 ? '+' : ''}
                              {systemCurrencies.find((c) => c.code === acc.currency)?.symbol || '$'}
                              {Math.abs(acc.current_balance).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botón para ver Estado de Cuenta Bancario */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setStatementAccount(acc);
                          setIsStatementOpen(true);
                        }}
                        className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 border border-blue-200/80 shadow-2xs cursor-pointer group"
                      >
                        <FileText className="w-3 h-3 text-blue-600 group-hover:scale-110 transition-transform" />
                        <span>Ver Estado de Cuenta</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Gestión de Monedas */}
      {isManagingCurrencies && (
        <ManageCurrenciesModal
          onClose={() => setIsManagingCurrencies(false)}
          onCurrenciesChange={refreshCurrencies}
        />
      )}

      {/* Modal de Estado de Cuenta Bancario */}
      {isStatementOpen && statementAccount && (
        <AccountStatementModal
          isOpen={isStatementOpen}
          onClose={() => {
            setIsStatementOpen(false);
            setStatementAccount(null);
          }}
          account={statementAccount}
          allAccounts={accounts}
          onSelectAccount={(acc) => setStatementAccount(acc)}
        />
      )}

      {/* Modal de Edición Completa de Cuenta */}
      {accountToEdit && (
        <EditAccountModal
          isOpen={!!accountToEdit}
          onClose={() => setAccountToEdit(null)}
          account={accountToEdit}
          currencies={systemCurrencies}
          onSave={handleSaveAccount}
          onDelete={handleDeleteAccount}
        />
      )}
    </div>
  );
}


