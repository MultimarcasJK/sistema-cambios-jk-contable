'use client';

import React, { useState, useRef, useEffect } from 'react';
import { exportFullAccountingToExcel } from '@/lib/excel-export';
import { exportFullAccountingToPdf } from '@/lib/pdf-export';
import {
  Download,
  ShieldCheck,
  Database,
  RefreshCw,
  RotateCcw,
  User,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Sun,
  Moon,
  Check,
  Settings,
  LogOut,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AppMode } from '@/types';
import { MasterResetModal } from './MasterResetModal';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps {
  appMode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
  onSyncRates?: () => void;
  isSyncingRates?: boolean;
  lastRatesSync?: string | null;
  onResetSuccess?: () => void;
}

export function Header({
  appMode = 'detal',
  onModeChange = () => {},
  onSyncRates = () => {},
  isSyncingRates = false,
  lastRatesSync = null,
  onResetSuccess,
}: HeaderProps) {
  const { user, profile, isAdmin, isOperator, signOut } = useAuth();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isExportSubmenuOpen, setIsExportSubmenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Cerrar menú al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const userDisplayName = profile?.nombre || user?.email?.split('@')[0] || 'Usuario JK';
  const userInitials = profile?.nombre
    ? profile.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'JK';

  return (
    <header
      className="border-b border-[#0a1628] text-white sticky top-0 z-40 px-3 sm:px-6 py-2.5 shadow-md"
      style={{ background: 'rgba(6, 25, 52, 0.98)' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Marca */}
        <div className="flex items-center space-x-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-jk-transparente.png`}
            alt="Logo Cambios JK"
            className="w-10 h-10 object-contain drop-shadow-lg"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight">CAMBIOS JK</h1>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                Contable
              </span>
            </div>
            <p className="text-[11px] text-slate-400 capitalize hidden sm:block">
              {currentDate}
            </p>
          </div>
        </div>

        {/* Botón de Perfil & Configuración en la parte superior derecha */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center space-x-2.5 bg-slate-800/90 hover:bg-slate-700/90 text-white pl-2 pr-3 py-1.5 rounded-xl border border-slate-700 shadow-sm transition cursor-pointer group"
            title="Abrir menú de configuración y perfil"
          >
            {/* Avatar circular con badge de estado */}
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-xs ${
                  isAdmin
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                }`}
              >
                {userInitials}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#061934] ${
                  isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                title={isSupabaseConfigured ? 'Supabase Conectado' : 'Modo Local'}
              />
            </div>

            {/* Texto de Perfil y Modo Actual */}
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-tight text-white group-hover:text-emerald-300 transition truncate max-w-[160px]">
                {userDisplayName}
              </div>
              <div className="text-[10px] leading-tight flex items-center gap-1.5 mt-0.5">
                <span className={isAdmin ? 'text-blue-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {isAdmin ? 'ADMIN' : 'OPERADOR'}
                </span>
                <span className="text-slate-400">•</span>
                <span
                  className={`font-black uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded shadow-xs ${
                    appMode === 'mayor'
                      ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40'
                      : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  }`}
                >
                  {appMode === 'mayor' ? 'Mayor' : 'Detal'}
                </span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-300 group-hover:text-white transition-transform duration-200 ${
                isProfileMenuOpen ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          {/* Menú Desplegable Flotante */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#0c192c] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Cabecera del Menú */}
              <div className="p-3.5 bg-slate-800/60 border-b border-slate-700/80 flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-md ${
                    isAdmin
                      ? 'bg-gradient-to-tr from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-tr from-emerald-500 to-teal-600'
                  }`}
                >
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">
                    {userDisplayName}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span
                      className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                        isAdmin
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {isAdmin ? 'ADMINISTRADOR' : 'OPERADOR DE TAQUILLA'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {/* 1. Selector de Modo: Detal vs Mayor */}
                {(!profile?.modo_permitido || profile.modo_permitido === 'ambos') ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Modo del Sistema
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          onModeChange('detal');
                          setIsProfileMenuOpen(false);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                          appMode === 'detal'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Modo Detal</span>
                        {appMode === 'detal' && <Check className="w-3 h-3 ml-0.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onModeChange('mayor');
                          setIsProfileMenuOpen(false);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                          appMode === 'mayor'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Modo Mayor</span>
                        {appMode === 'mayor' && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Módulo Asignado
                    </label>
                    <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 ${
                      profile.modo_permitido === 'detal'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                    }`}>
                      {profile.modo_permitido === 'detal' ? (
                        <Sun className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-blue-400" />
                      )}
                      <span>Acceso Exclusivo: Modo {profile.modo_permitido === 'detal' ? 'Detal' : 'Mayor'}</span>
                    </div>
                  </div>
                )}

                {/* 2. Sincronización de Tasas JK */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onSyncRates();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <RefreshCw
                        className={`w-4 h-4 text-blue-400 ${
                          isSyncingRates ? 'animate-spin text-blue-300' : ''
                        }`}
                      />
                      <span className="font-semibold">Sincronizar Tasas JK</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </button>
                  {lastRatesSync && (
                    <p className="text-[10px] text-slate-400 mt-1 text-right">
                      Última sync: {new Date(lastRatesSync).toLocaleTimeString('es-ES')}
                    </p>
                  )}
                </div>

                {/* 3. Exportar Reportes (Excel y PDF) */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Exportar Reportes
                  </label>

                  <div className="space-y-1.5">
                    {/* Opción 1: Exportar a Excel */}
                    <button
                      type="button"
                      onClick={() => {
                        exportFullAccountingToExcel();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-100 border border-emerald-800/60 flex items-center justify-between transition cursor-pointer group"
                      title="Descargar libro contable completo en formato Excel (.xlsx)"
                    >
                      <div className="flex items-center space-x-2 font-bold">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span>Exportar a Excel (.xlsx)</span>
                      </div>
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    {/* Opción 2: Exportar / Imprimir PDF */}
                    <button
                      type="button"
                      onClick={() => {
                        exportFullAccountingToPdf();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 hover:text-blue-100 border border-blue-800/60 flex items-center justify-between transition cursor-pointer group"
                      title="Imprimir balance o guardar como PDF oficial"
                    >
                      <div className="flex items-center space-x-2 font-bold">
                        <FileText className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span>Exportar a PDF / Imprimir</span>
                      </div>
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  </div>
                </div>

                {/* 4. Mantenimiento del Sistema (Solo Administrador) */}
                {isAdmin && (
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsResetModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-white border border-rose-900/50 flex items-center justify-between transition cursor-pointer group"
                      title="Reinicio Maestro del Sistema a CERO"
                    >
                      <div className="flex items-center space-x-2 font-bold">
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400 group-hover:-rotate-90 transition-transform" />
                        <span>Reinicio Maestro a 0</span>
                      </div>
                      <span className="text-[10px] text-rose-400 font-semibold uppercase">Peligro</span>
                    </button>
                  </div>
                )}

                {/* 5. Cerrar Sesión */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-rose-900/60 text-slate-300 hover:text-rose-100 border border-slate-700/80 flex items-center justify-between transition cursor-pointer group"
                    title="Cerrar sesión en este dispositivo"
                  >
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400 transition-colors" />
                      <span>Cerrar Sesión</span>
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-rose-300 font-semibold uppercase">Salir</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MasterResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        currentMode={appMode}
        onSuccess={() => {
          onResetSuccess?.();
        }}
      />
    </header>
  );
}


