import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.js';

export function LoginForm({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  handleLogin,
  loginSubmitting,
  loginError,
}) {
  const [mode, setMode] = useState('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signUpSubmitting, setSignUpSubmitting] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setSignUpError('');
    setSignUpSuccess(false);
    setConfirmPassword('');
  };

  const onSubmitLogin = (e) => {
    setSignUpError('');
    setSignUpSuccess(false);
    handleLogin(e);
  };

  const onSubmitRegister = async (e) => {
    e.preventDefault();
    setSignUpError('');
    setSignUpSuccess(false);

    const email = username.trim();
    if (!email) {
      setSignUpError('Informe o e-mail.');
      return;
    }
    if (!password || password.length < 6) {
      setSignUpError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setSignUpError('A confirmação de senha não confere.');
      return;
    }

    setSignUpSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setSignUpError(error.message || 'Não foi possível criar a conta.');
        return;
      }
      setSignUpSuccess(true);
    } catch (err) {
      setSignUpError(err?.message || 'Não foi possível criar a conta.');
    } finally {
      setSignUpSubmitting(false);
    }
  };

  const isRegister = mode === 'register';
  const submitting = isRegister ? signUpSubmitting : loginSubmitting;
  const bannerError = isRegister ? signUpError : loginError;
  const disabled = submitting;

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
      <div className="w-full max-w-[420px] mx-4">
        <div className="bg-white rounded-2xl border border-app-border shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#e6f7f5] to-[#f0fdfa] p-10 flex items-center justify-center border-b border-app-border">
            <div className="bg-[#00a88e] p-4 rounded-2xl shadow-lg">
              <Shield className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
          </div>

          <div className="p-10">
            <h1 className="text-[28px] font-bold text-[#0f172a] mb-2">Procedi</h1>
            <p className="text-[#64748b] text-[14px] mb-3 font-medium">Sistema de Gerenciamento Premium</p>
            <p className="mb-6 flex items-center gap-2 text-[12px] font-semibold text-[#0f766e]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a88e] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a88e]" />
              </span>
              <Wifi className="h-3.5 w-3.5 opacity-90" strokeWidth={2.5} aria-hidden />
              Servidor da API conectado — você pode entrar.
            </p>

            <p className="mb-6 text-center text-[13px] font-medium text-[#64748b]">
              {isRegister ? 'Crie sua conta' : 'Acesse com seu e-mail e senha'}
            </p>

            {signUpSuccess ? (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-[#f0fdf4] p-4 text-[13px] font-semibold text-[#166534]">
                Conta criada! Verifique seu e-mail para confirmar o cadastro.
              </div>
            ) : null}

            {bannerError ? (
              <div className="mb-6 bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 text-[13px] font-bold">
                {bannerError}
              </div>
            ) : null}

            {isRegister ? (
              <form onSubmit={onSubmitRegister} className="space-y-4">
                <div>
                  <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                    disabled={disabled}
                    required
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                    Senha <span className="text-red-500">*</span>{' '}
                    <span className="text-[11px] font-medium text-[#64748b]">(mín. 6 caracteres)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                      disabled={disabled}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00a88e] transition-colors"
                      disabled={disabled}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" strokeWidth={2} />
                      ) : (
                        <Eye className="w-5 h-5" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                    Confirmar senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                      disabled={disabled}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00a88e] transition-colors"
                      disabled={disabled}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" strokeWidth={2} />
                      ) : (
                        <Eye className="w-5 h-5" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={disabled}
                  className="w-full bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold text-[14px] transition-all shadow-md border border-transparent mt-6 flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" strokeWidth={2.5} />
                  {signUpSubmitting ? 'Criando conta…' : 'Cadastrar'}
                </button>
              </form>
            ) : (
              <form onSubmit={onSubmitLogin} className="space-y-4">
                <div>
                  <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                    E-mail ou nome completo
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="E-mail ou nome cadastrado"
                    className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                    disabled={disabled}
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
                      className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00a88e] transition-colors"
                      disabled={disabled}
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
                  disabled={disabled}
                  className="w-full bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold text-[14px] transition-all shadow-md border border-transparent mt-6 flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" strokeWidth={2.5} />
                  {loginSubmitting ? 'Entrando…' : 'Entrar no Sistema'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={toggleMode}
              className="mt-6 w-full text-center text-[13px] font-semibold text-[#00a88e] hover:text-[#00967f] hover:underline transition-colors"
              disabled={submitting}
            >
              {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
