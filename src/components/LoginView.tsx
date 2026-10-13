'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';

export function LoginView() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor ingresa correo y contraseña');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await signIn(email, password);
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMessage('Correo o contraseña incorrectos. Verifica tus datos.');
      } else {
        setErrorMessage(error.message || 'Error al iniciar sesión');
      }
      setIsLoading(false);
    }
  };

  const handleQuickFill = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#061528] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Encabezado con Logo */}
        <div className="text-center mb-8">
          <div className="inline-block relative mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-jk-transparente.png`}
              alt="Logo Cambios JK"
              className="w-20 h-20 mx-auto object-contain drop-shadow-2xl"
            />
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full blur-sm opacity-30 -z-10" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            CAMBIOS JK
            <span className="text-xs uppercase font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
              Contable
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Sistema Seguro de Gestión Financiera y Cambios
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-[#0b1b33]/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center space-x-2 text-slate-200 font-bold text-base mb-6 border-b border-slate-800 pb-3">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>Iniciar Sesión en el Sistema</span>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de Correo */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cambiosjk.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Campo de Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Accesos Rápidos de Prueba */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Accesos Rápido Configurados:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin.cambiosjk@gmail.com', 'AdminJK2026*')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition cursor-pointer group"
              >
                <div className="flex items-center space-x-1.5 text-blue-400 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Administrador</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
                  Acceso Total
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('operador.cambiosjk@gmail.com', 'AdminJK2026*')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition cursor-pointer group"
              >
                <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Operador Taquilla</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 group-hover:text-slate-300">
                  Operativo (Sin ganancias)
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          © 2026 Inversiones Cambios JK. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
