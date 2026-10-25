'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Scale, ListOrdered, History, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Account, AppMode, AuditEntry } from '@/types';
import { StorageService } from '@/lib/storage';
import { AuditService } from '@/lib/audit';
import { useAuth } from '@/lib/auth-context';
import { buildLedger, entryIsBalanced, accountKey, ORIGIN_LABELS, LedgerEntry } from '@/lib/ledger';
import { formatRegionalAmount } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';

interface ContabilidadProps {
  appMode: AppMode;
  // Cambian cuando cambian los datos; sirven para recalcular el libro
  accounts: Account[];
  dataVersion: unknown;
  onDataChange: () => void;
}

type SubTab = 'cuadre' | 'diario' | 'mayor' | 'bitacora';

const ACTION_LABELS: Record<string, string> = {
  crear: 'Registro',
  eliminar: 'Anulación',
  editar: 'Edición',
  ajuste_saldo: 'Ajuste de saldo',
  cierre: 'Cierre de día',
  reapertura: 'Reapertura',
  bloqueado: 'Intento bloqueado',
};

// Campos donde los registros guardan la cuenta (banco, wallet o caja) que movieron
const AUDIT_ACCOUNT_FIELDS = [
  'account_id',
  'received_account_id',
  'paid_account_id',
  'from_account_id',
  'to_account_id',
  'cuenta_cobro_id',
  'cuenta_pago_id',
];

// Nombres de las cuentas que tocó un registro de la bitácora, para mostrarlos después del monto
function auditAccountNames(e: AuditEntry, accById: Map<string, Account>): string {
  const d = e.data as Record<string, unknown> | null | undefined;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return '';
  const names: string[] = [];
  AUDIT_ACCOUNT_FIELDS.forEach((f) => {
    const id = d[f];
    const acc = typeof id === 'string' ? accById.get(id) : undefined;
    const name = acc ? acc.name || acc.bank_name : '';
    if (name && !names.includes(name) && !e.summary.toUpperCase().includes(name.toUpperCase())) names.push(name);
  });
  return names.join(' → ');
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function amt(n: number, cur?: string): string {
  return formatRegionalAmount(n, cur || 'USD');
}

export function ContabilidadView({ appMode, accounts, dataVersion, onDataChange }: ContabilidadProps) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<SubTab>('cuadre');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(localDateStr());
  const [onlyThisUnit, setOnlyThisUnit] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [auditFilter, setAuditFilter] = useState('');

  const ledger = useMemo(
    () => buildLedger(StorageService.getLedgerSources()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, dataVersion]
  );
  const lockedThrough = StorageService.getLockedThrough(appMode);

  const unitAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);

  const cuadre = useMemo(
    () =>
      ledger.cuadre
        .filter((c) => unitAccountIds.has(c.account.id))
        .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)),
    [ledger, unitAccountIds]
  );
  const withDifference = cuadre.filter((c) => Math.abs(c.diferencia) >= 0.01);

  const diario = useMemo(
    () =>
      ledger.asientos
        .filter((e) => e.fecha >= from && e.fecha <= to)
        .filter((e) => !onlyThisUnit || e.unidad === appMode)
        .slice()
        .reverse(),
    [ledger, from, to, onlyThisUnit, appMode]
  );

  // Resultado del periodo: ingresos (4.x) menos gastos (5.x) por moneda
  const resultado = useMemo(() => {
    const byCur = new Map<string, { ingresos: number; gastos: number }>();
    diario.forEach((e) =>
      e.lineas.forEach((l) => {
        const def = ledger.cuentas.get(l.cuenta);
        if (!def || (def.tipo !== 'ingreso' && def.tipo !== 'gasto')) return;
        const r = byCur.get(l.moneda) || { ingresos: 0, gastos: 0 };
        if (def.tipo === 'ingreso') r.ingresos += l.haber - l.debe;
        else r.gastos += l.debe - l.haber;
        byCur.set(l.moneda, r);
      })
    );
    return Array.from(byCur.entries()).sort((a, b) => (a[0] === 'USD' ? -1 : b[0] === 'USD' ? 1 : a[0].localeCompare(b[0])));
  }, [diario, ledger]);

  const mayorRows = useMemo(() => {
    if (!selectedAccount) return [];
    const key = accountKey(selectedAccount);
    let running = 0;
    const rows: { entry: LedgerEntry; debe: number; haber: number; saldo: number }[] = [];
    ledger.asientos.forEach((e) =>
      e.lineas
        .filter((l) => l.cuenta === key)
        .forEach((l) => {
          running += l.debe - l.haber;
          rows.push({ entry: e, debe: l.debe, haber: l.haber, saldo: running });
        })
    );
    return rows.reverse();
  }, [ledger, selectedAccount]);

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const auditEntries: (AuditEntry & { cuentas: string })[] = useMemo(() => {
    const q = auditFilter.trim().toLowerCase();
    return AuditService.getEntries(appMode)
      .map((e) => ({ ...e, cuentas: auditAccountNames(e, accById) }))
      .filter(
        (e) =>
          !q ||
          e.summary.toLowerCase().includes(q) ||
          e.cuentas.toLowerCase().includes(q) ||
          (e.user_email || '').toLowerCase().includes(q) ||
          (e.reason || '').toLowerCase().includes(q) ||
          e.entity.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, auditFilter, dataVersion, accById]);

  const handleRecognize = (accountId: string, name: string, diff: number, currency: string) => {
    const reason = window.prompt(
      `La cuenta ${name} tiene ${amt(diff, currency)} ${currency} que no salen de ninguna operación ` +
        '(probablemente se editó el saldo a mano).\n\n' +
        'Al reconocerla, el libro registra un AJUSTE por esa cantidad y la cuenta queda cuadrada. ' +
        'El saldo no cambia. Escribe el motivo:'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert('Hace falta un motivo.');
      return;
    }
    try {
      StorageService.recognizeDifference(accountId, diff, reason, appMode);
      onDataChange();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const aperturas = useMemo(
    () => StorageService.getAperturaIncomes(appMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appMode, dataVersion, accounts]
  );

  const handleConvertAperturas = () => {
    if (
      !window.confirm(
        `Se pasarán ${aperturas.length} ingresos de APERTURA al saldo inicial de su cuenta y se borrarán ` +
          'de Ingresos/Gastos. El saldo de las cuentas no cambia. ¿Continuar?'
      )
    )
      return;
    try {
      const n = StorageService.convertAperturaIncomes(appMode);
      onDataChange();
      window.alert(`Listo: ${n} aperturas pasadas a saldo inicial.`);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const handleRestoreAll = () => {
    if (
      !window.confirm(
        `Se cambiará el saldo de ${withDifference.length} cuentas al "Saldo según libro" ` +
          '(saldo inicial + todas sus operaciones). Úsalo cuando los saldos se perdieron o quedaron mal. ' +
          'Cada cambio queda en la bitácora. ¿Continuar?'
      )
    )
      return;
    try {
      const n = StorageService.restoreBalancesFromLedger(
        withDifference.map((c) => ({ accountId: c.account.id, libro: c.libro })),
        appMode
      );
      onDataChange();
      window.alert(`Listo: ${n} cuentas restauradas.`);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const tabs: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: 'cuadre', label: 'Cuadre de cuentas', icon: Scale },
    { key: 'diario', label: 'Libro diario', icon: ListOrdered },
    { key: 'mayor', label: 'Libro mayor', icon: BookOpen },
    { key: 'bitacora', label: 'Bitácora', icon: History },
  ];

  const cuentaNombre = (key: string) => {
    const def = ledger.cuentas.get(key);
    return def ? `${def.codigo} ${def.nombre}` : key;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Contabilidad (partida doble)</h2>
            <p className="text-xs text-slate-500">
              Cada operación genera un asiento donde lo que entra (Debe) es igual a lo que sale (Haber).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Asientos en el libro</div>
            <div className="text-xl font-bold text-slate-900">{ledger.asientos.length}</div>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              withDifference.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Cuentas descuadradas</div>
            <div className={`text-xl font-bold ${withDifference.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {withDifference.length} de {cuadre.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
              <Lock className="w-3 h-3" /> Días cerrados
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {lockedThrough ? `Bloqueados hasta el ${lockedThrough}` : 'Ningún día cerrado todavía'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'cuadre' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          {isAdmin && (aperturas.length > 0 || withDifference.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {aperturas.length > 0 && (
                <button
                  onClick={handleConvertAperturas}
                  className="px-3 py-1.5 rounded-xl border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold"
                >
                  Pasar {aperturas.length} ingresos APERTURA a saldo inicial
                </button>
              )}
              {withDifference.length > 0 && (
                <button
                  onClick={handleRestoreAll}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Restaurar saldos según libro ({withDifference.length})
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-slate-600">
            <b>Saldo según libro</b> = saldo inicial + todas las operaciones registradas. Si no coincide con el
            saldo de la cuenta, alguien cambió el número a mano. Desde ahora los cambios de saldo se hacen con un
            ajuste con motivo, en la pestaña Cuentas.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-2">Cuenta</th>
                  <th className="py-2 px-2">Moneda</th>
                  <th className="py-2 px-2 text-right">Saldo de la cuenta</th>
                  <th className="py-2 px-2 text-right">Saldo según libro</th>
                  <th className="py-2 px-2 text-right">Diferencia</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuadre.map((c) => {
                  const ok = Math.abs(c.diferencia) < 0.01;
                  return (
                    <tr key={c.account.id}>
                      <td className="py-2 px-2 font-semibold text-slate-800">{c.account.name}</td>
                      <td className="py-2 px-2 text-slate-500">{c.account.currency}</td>
                      <td className="py-2 px-2 text-right">{amt(c.registrado, c.account.currency)}</td>
                      <td className="py-2 px-2 text-right">{amt(c.libro, c.account.currency)}</td>
                      <td className={`py-2 px-2 text-right font-bold ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {ok ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Cuadra
                          </span>
                        ) : (
                          (c.diferencia > 0 ? '+' : '') + amt(c.diferencia, c.account.currency)
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {!ok && isAdmin && (
                          <button
                            onClick={() =>
                              handleRecognize(c.account.id, c.account.name, c.diferencia, c.account.currency)
                            }
                            className="px-2 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold"
                          >
                            Reconocer diferencia
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'diario' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="text-sm border border-slate-300 rounded-xl px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm border border-slate-300 rounded-xl px-3 py-1.5"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
              <input type="checkbox" checked={onlyThisUnit} onChange={(e) => setOnlyThisUnit(e.target.checked)} />
              Solo {appMode === 'mayor' ? 'Mayor' : 'Detal'}
            </label>
          </div>

          {resultado.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Resultado del periodo</div>
              <div className="flex flex-wrap gap-4 text-xs">
                {resultado.map(([cur, r]) => (
                  <div key={cur}>
                    <span className="font-bold text-slate-700">{cur}</span>: ingresos {amt(r.ingresos, cur)} − gastos{' '}
                    {amt(r.gastos, cur)} ={' '}
                    <b className={r.ingresos - r.gastos >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {amt(r.ingresos - r.gastos, cur)}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diario.length === 0 && <p className="text-xs text-slate-500">No hay asientos en estas fechas.</p>}
          <div className="space-y-3">
            {diario.slice(0, 300).map((e) => {
              const balanced = entryIsBalanced(e);
              return (
                <div key={e.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 text-xs">
                    <div className="font-semibold text-slate-800">
                      {e.fecha} · {ORIGIN_LABELS[e.origen]} · {e.descripcion}
                    </div>
                    <div className="flex items-center gap-2">
                      {StorageService.isDayLocked(e.fecha, e.unidad) && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Lock className="w-3 h-3" /> cerrado
                        </span>
                      )}
                      {balanced ? (
                        <span className="text-emerald-600 font-semibold">Cuadra</span>
                      ) : (
                        <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Descuadrado
                        </span>
                      )}
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {e.lineas.map((l, i) => (
                        <tr key={i} className={l.cuenta === 'PUENTE' ? 'text-slate-400' : 'text-slate-700'}>
                          <td className={`py-1.5 px-3 ${l.haber > 0 ? 'pl-8' : ''}`}>
                            {cuentaNombre(l.cuenta)}
                            {l.tercero ? <span className="text-slate-400"> · {l.tercero}</span> : null}
                          </td>
                          <td className="py-1.5 px-2 text-slate-400 w-14">{l.moneda}</td>
                          <td className="py-1.5 px-2 text-right w-32">{l.debe ? amt(l.debe, l.moneda) : ''}</td>
                          <td className="py-1.5 px-3 text-right w-32">{l.haber ? amt(l.haber, l.moneda) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          {diario.length > 300 && (
            <p className="text-xs text-slate-500">Mostrando 300 de {diario.length} asientos. Acorta las fechas para ver el resto.</p>
          )}
        </div>
      )}

      {tab === 'mayor' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cuenta</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full sm:w-96 text-sm border border-slate-300 rounded-xl px-3 py-2"
            >
              <option value="">Elige una cuenta…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          {selectedAccount && mayorRows.length === 0 && (
            <p className="text-xs text-slate-500">Esta cuenta no tiene movimientos.</p>
          )}
          {mayorRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 px-2">Fecha</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2">Detalle</th>
                    <th className="py-2 px-2 text-right">Debe (entra)</th>
                    <th className="py-2 px-2 text-right">Haber (sale)</th>
                    <th className="py-2 px-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mayorRows.slice(0, 500).map((r, i) => {
                    const cur = accounts.find((a) => a.id === selectedAccount)?.currency;
                    return (
                      <tr key={r.entry.id + i}>
                        <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{r.entry.fecha}</td>
                        <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{ORIGIN_LABELS[r.entry.origen]}</td>
                        <td className="py-1.5 px-2 text-slate-700">{r.entry.descripcion}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-600">{r.debe ? amt(r.debe, cur) : ''}</td>
                        <td className="py-1.5 px-2 text-right text-rose-600">{r.haber ? amt(r.haber, cur) : ''}</td>
                        <td className="py-1.5 px-2 text-right font-semibold">{amt(r.saldo, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'bitacora' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <p className="text-xs text-slate-600">
            Registro de quién hizo cada cambio: ventas, anulaciones, ajustes de saldo, cierres y reaperturas.
          </p>
          <input
            type="text"
            placeholder="Buscar por usuario, cuenta, cliente o motivo…"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
          />
          {auditEntries.length === 0 && <p className="text-xs text-slate-500">Todavía no hay registros.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-2">Fecha y hora</th>
                  <th className="py-2 px-2">Usuario</th>
                  <th className="py-2 px-2">Acción</th>
                  <th className="py-2 px-2">Detalle</th>
                  <th className="py-2 px-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditEntries.slice(0, 500).map((e) => (
                  <tr key={e.id}>
                    <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">
                      {new Date(e.ts).toLocaleString('es-ES')}
                    </td>
                    <td className="py-1.5 px-2 text-slate-600">{e.user_email || '—'}</td>
                    <td
                      className={`py-1.5 px-2 font-semibold whitespace-nowrap ${
                        e.action === 'eliminar' || e.action === 'reapertura' || e.action === 'bloqueado'
                          ? 'text-rose-600'
                          : e.action === 'ajuste_saldo' || e.action === 'editar'
                          ? 'text-amber-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {ACTION_LABELS[e.action] || e.action}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700">
                      {e.summary}
                      {e.cuentas && <span className="font-semibold text-slate-900"> · {e.cuentas}</span>}
                    </td>
                    <td className="py-1.5 px-2 text-slate-500">{e.reason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
