import React from 'react';
import { Shield, Eye, EyeOff, Wifi } from 'lucide-react';

export function LoginForm({ username, setUsername, password, setPassword, showPassword, setShowPassword, handleLogin, loginSubmitting, loginError }) {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
      <div className="w-full max-w-[420px] mx-4">
        <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/15 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#e6f7f5] to-[#f0fdfa] p-10 flex items-center justify-center border-b-[3px] border-[#00a88e]/15">
            <div className="bg-[#00a88e] p-4 rounded-2xl shadow-lg">
              <Shield className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
          </div>

          <div className="p-10">
            <h1 className="text-[28px] font-bold text-[#0f172a] mb-2">Procedi</h1>
            <p className="text-[#64748b] text-[14px] mb-3 font-medium">Sistema de Gerenciamento Premium</p>
            <p className="mb-8 flex items-center gap-2 text-[12px] font-semibold text-[#0f766e]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a88e] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a88e]" />
              </span>
              <Wifi className="h-3.5 w-3.5 opacity-90" strokeWidth={2.5} aria-hidden />
              Servidor da API conectado — você pode entrar.
            </p>

            {loginError && (
              <div className="mb-6 bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-4 text-[13px] font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                  E-mail ou nome completo
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="E-mail ou nome cadastrado"
                  className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                  disabled={loginSubmitting}
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                    disabled={loginSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00a88e] transition-colors"
                    disabled={loginSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" strokeWidth={2} />
                    ) : (
                      <Eye className="w-5 h-5" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold text-[14px] transition-all shadow-md border-[3px] border-transparent mt-6 flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" strokeWidth={2.5} />
                {loginSubmitting ? 'Entrando…' : 'Entrar no Sistema'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

