import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function RegisterForm({ onBack, registerAndEnter }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nome.trim()) {
      setError('O nome é obrigatório.');
      return;
    }
    if (!email.trim()) {
      setError('O e-mail é obrigatório.');
      return;
    }
    if (!senha) {
      setError('A senha é obrigatória.');
      return;
    }
    if (senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await registerAndEnter({
        username: nome.trim(),
        email: email.trim(),
        password: senha,
      });
    } catch (err) {
      setError(err?.body?.message || err?.message || 'Não foi possível criar o usuário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
      <div className="w-full max-w-[420px] mx-4">
        <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/15 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#e6f7f5] to-[#f0fdfa] p-10 flex items-center justify-center border-b-[3px] border-[#00a88e]/15">
            <div className="bg-[#00a88e] p-4 rounded-2xl shadow-lg">
              <UserPlus className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
          </div>

          <div className="p-10">
            <h1 className="text-[28px] font-bold text-[#0f172a] mb-2">Criar Usuário</h1>
            <p className="text-[#64748b] text-[14px] mb-3 font-medium">Preencha os dados para criar uma nova conta</p>
            <p className="text-[#94a3b8] text-[12px] mb-8 font-medium leading-relaxed border-l-[3px] border-[#00a88e]/30 pl-3">
              Este passo <span className="font-bold text-[#64748b]">não cadastra a clínica</span>: só o usuário. A organização
              precisa existir no PostgreSQL (seed, admin ou API no backend). Depois do login, as chamadas usam{' '}
              <span className="font-bold text-[#64748b]">X-Org-Id</span> — alinhe{' '}
              <span className="font-mono text-[11px] text-[#0f766e]">VITE_DEFAULT_ORG_ID</span> no{' '}
              <span className="font-mono text-[11px] text-[#0f766e]">.env</span> ao UUID da sua clínica ou use a barra
              &quot;Contexto API&quot; (se o backend permitir trocar de org).
            </p>

            {error && (
              <div className="mb-6 bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-4 text-[13px] font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome do usuário"
                      className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-bold text-[#00a88e] block mb-2">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Crie uma senha segura"
                        className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] transition-all"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#00a88e] transition-colors"
                        disabled={submitting}
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
                    disabled={submitting}
                    className="w-full bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-bold text-[14px] transition-all shadow-md border-[3px] border-transparent mt-6 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" strokeWidth={2.5} />
                    {submitting ? 'Criando conta…' : 'Criar Usuário'}
                  </button>

                  <button
                    type="button"
                    onClick={onBack}
                    disabled={submitting}
                    className="w-full bg-transparent hover:bg-[#f0fdfa] disabled:opacity-60 disabled:cursor-not-allowed text-[#00a88e] py-3 px-4 rounded-xl font-bold text-[14px] transition-all border-[3px] border-[#00a88e]/30 hover:border-[#00a88e]/60 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
                    Voltar para o Login
                  </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
