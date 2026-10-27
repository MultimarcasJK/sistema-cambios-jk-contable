'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { AppMode, Beneficiario } from '@/types';
import { StorageService } from '@/lib/storage';
import { COUNTRIES_LIST } from '@/lib/countries';
import { SearchableSelect } from './SearchableSelect';

const PAISES = COUNTRIES_LIST.filter((c) => c.id !== 'CRIPTO');

interface Props {
  clientName: string;
  identification?: string;
  phone?: string;
  appMode?: AppMode;
}

const vacio = { country: 'VENEZUELA', name: '', identification: '', bank: '', account_number: '', phone: '' };

// Beneficiarios de un cliente: la misma lista que usa Remesas (remitente con el mismo nombre)
export function BeneficiariosCliente({ clientName, identification, phone, appMode }: Props) {
  const [tick, setTick] = useState(0);
  const [editId, setEditId] = useState<string | null>(null); // 'nuevo' para agregar
  const [draft, setDraft] = useState(vacio);

  const remitente = useMemo(
    () =>
      StorageService.getRemitentes(appMode).find(
        (r) => r.name.trim().toUpperCase() === clientName.trim().toUpperCase(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientName, appMode, tick],
  );
  const lista = remitente?.beneficiarios || [];
  const pais = (id: string) => PAISES.find((p) => p.id === id);

  const empezar = (b?: Beneficiario) => {
    setEditId(b ? b.id : 'nuevo');
    setDraft(
      b
        ? {
            country: b.country,
            name: b.name,
            identification: b.identification || '',
            bank: b.bank || '',
            account_number: b.account_number || '',
            phone: b.phone || '',
          }
        : vacio,
    );
  };

  const guardar = () => {
    if (!draft.name.trim()) {
      window.alert('Escribe el nombre del beneficiario.');
      return;
    }
    const ben: Beneficiario = {
      id: editId === 'nuevo' ? '' : editId || '',
      country: draft.country,
      name: draft.name,
      identification: draft.identification.trim(),
      bank: draft.bank.trim(),
      account_number: draft.account_number.trim(),
      phone: draft.phone.trim(),
    };
    try {
      if (editId === 'nuevo' || !remitente) {
        StorageService.saveRemitente({ name: clientName, identification, phone }, ben, appMode);
      } else {
        StorageService.updateBeneficiario(remitente.id, ben, appMode);
      }
      setEditId(null);
      setTick((t) => t + 1);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const borrar = (b: Beneficiario) => {
    if (!remitente) return;
    if (
      !window.confirm(
        `¿Borrar a ${b.name} de los beneficiarios de ${remitente.name}? Las remesas anteriores no cambian.`,
      )
    )
      return;
    StorageService.deleteBeneficiario(remitente.id, b.id, appMode);
    if (editId === b.id) setEditId(null);
    setTick((t) => t + 1);
  };

  const input = 'w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5';

  const formulario = (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
      <SearchableSelect value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className={input}>
        {PAISES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.flag} {p.name}
          </option>
        ))}
      </SearchableSelect>
      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Nombre *"
        className={input + ' uppercase'}
        autoFocus
      />
      <input
        value={draft.identification}
        onChange={(e) => setDraft({ ...draft, identification: e.target.value })}
        placeholder="Documento"
        className={input}
      />
      <input
        value={draft.bank}
        onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
        placeholder="Banco"
        className={input}
      />
      <input
        value={draft.account_number}
        onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
        placeholder="Cuenta o pago móvil"
        className={input}
      />
      <input
        value={draft.phone}
        onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
        placeholder="Teléfono"
        className={input}
      />
      <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditId(null)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" /> Guardar beneficiario
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-600">Beneficiarios de remesas</div>
          <div className="text-[11px] text-slate-400">Los mismos que te salen al hacer una remesa a este cliente</div>
        </div>
        {editId === null && (
          <button
            type="button"
            onClick={() => empezar()}
            className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs rounded-lg border border-blue-300 text-blue-700 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar beneficiario
          </button>
        )}
      </div>

      {lista.length === 0 && editId !== 'nuevo' && (
        <p className="text-[11px] text-slate-400">Este cliente no tiene beneficiarios guardados.</p>
      )}

      <div className="space-y-1.5">
        {lista.map((b) =>
          editId === b.id ? (
            <div key={b.id}>{formulario}</div>
          ) : (
            <div key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-xs">
              <span title={pais(b.country)?.name || b.country}>{pais(b.country)?.flag || '🌐'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 truncate">{b.name}</div>
                <div className="text-slate-500 truncate">
                  {[b.bank, b.account_number, b.identification, b.phone].filter(Boolean).join(' · ') ||
                    'Sin datos de pago'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => empezar(b)}
                title="Editar beneficiario"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => borrar(b)}
                title="Borrar beneficiario"
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ),
        )}
        {editId === 'nuevo' && formulario}
      </div>
    </div>
  );
}
