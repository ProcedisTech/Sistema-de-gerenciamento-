import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Edit2, Loader2, X, AlertCircle, CalendarClock } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch, getApiErrorDetail, getApiErrorToastMessage } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { usePapel } from '../../hooks/usePapel';
import DisponibilidadeProfissionalModal from './DisponibilidadeProfissionalModal';

export function GestaoUsuariosView() {
  const { isAdmin } = usePapel();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDispModal, setShowDispModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);

  const fetchHeaders = useCallback(() => {
    return authHeadersForFetch({ needsOrg: true });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipeRes, rolesRes] = await Promise.all([
        fetch(resolveApiUrl('/api/v1/equipe'), {
          headers: fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/roles'), {
          headers: fetchHeaders(),
          credentials: 'include'
        })
      ]);

      if (equipeRes.ok && rolesRes.ok) {
        const equipeData = await equipeRes.json();
        const rolesData = await rolesRes.json();
        setUsuarios(Array.isArray(equipeData) ? equipeData : equipeData.content || []);
        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.content || []);
      } else {
        const badRes = !equipeRes.ok ? equipeRes : rolesRes;
        const body = await badRes.json().catch(() => ({}));
        toast.error(
          getApiErrorDetail({ body }) || (body?.message && String(body.message).trim()) || 'Erro ao carregar dados da equipe.'
        );
      }
    } catch (e) {
      toast.error(getApiErrorToastMessage(e, 'Falha de rede ao carregar equipe.'));
    } finally {
      setLoading(false);
    }
  }, [fetchHeaders, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const handleDeactivate = async (id) => {
    if (!window.confirm('Tem certeza que deseja desativar este acesso?')) return;
    
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/equipe/${id}`), {
        method: 'DELETE',
        headers: fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Acesso desativado com sucesso.');
        loadData();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(
          getApiErrorDetail({ body }) || (body?.message && String(body.message).trim()) || 'Erro ao desativar acesso.'
        );
      }
    } catch (error) {
      console.error('Erro ao buscar papéis:', error);
      toast.error(getApiErrorToastMessage(error, 'Erro ao desativar acesso.'));
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-slate-600 font-medium">Acesso restrito a administradores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Responsivo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-[#0f172a] sm:text-lg truncate">Gestão de Usuários</h3>
          <p className="text-sm text-slate-500 truncate">Gerencie quem tem acesso à sua clínica.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#00967f] active:scale-95 touch-manipulation sm:w-auto sm:py-2.5"
        >
          <UserPlus className="h-4 w-4" />
          <span className="whitespace-nowrap">Convidar / Criar Acesso</span>
        </button>
      </div>

      {/* Desktop Table View - Only for VERY large screens where there's enough space with sidebars */}
      <div className="hidden xl:block overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Papel</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-slate-400">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{u.nomeCompleto}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700">
                      {u.roleName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className={`inline-flex h-2 w-2 rounded-full ${u.ativo ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className={`ml-2 font-medium ${u.ativo ? 'text-slate-600' : 'text-slate-400'}`}>
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {(u.roleName || '').toUpperCase().includes('PROFISSIONAL') && (
                        <button
                          onClick={() => { setSelectedUsuario(u); setShowDispModal(true); }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-[#00a88e] transition"
                          title="Configurar disponibilidade"
                        >
                          <CalendarClock className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedUsuario(u); setShowEditModal(true); }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition touch-manipulation"
                        title="Editar papel"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition touch-manipulation"
                        title="Desativar"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Card View - Always 1 column on tablets with sidebar */}
      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {usuarios.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 bg-white">
            Nenhum usuário encontrado.
          </div>
        ) : (
          usuarios.map((u) => (
            <div key={u.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between mb-auto pb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate leading-tight">{u.nomeCompleto}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${u.ativo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.ativo ? 'Ativo' : 'Desativado'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 uppercase">
                    {u.roleName}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-auto">
                <button
                  onClick={() => { setSelectedUsuario(u); setShowEditModal(true); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 active:bg-slate-100 touch-manipulation"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeactivate(u.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-100 touch-manipulation"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Desativar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showInviteModal && (
        <InviteModal 
          roles={roles} 
          onClose={() => setShowInviteModal(false)} 
          onSuccess={() => { setShowInviteModal(false); loadData(); }}
          fetchHeaders={fetchHeaders}
        />
      )}

      {showEditModal && selectedUsuario && (
        <EditRoleModal 
          usuario={selectedUsuario}
          roles={roles}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => { setShowEditModal(false); loadData(); }}
          fetchHeaders={fetchHeaders}
        />
      )}

      {showDispModal && selectedUsuario && (
        <DisponibilidadeProfissionalModal
          roleUserId={selectedUsuario.id}
          nome={selectedUsuario.nomeCompleto || selectedUsuario.usuarioNome}
          tipoOrg={null}
          onClose={() => { setShowDispModal(false); setSelectedUsuario(null); }}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}

function InviteModal({ roles, onClose, onSuccess, fetchHeaders }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cpf: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const validateCPF = (cpf) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roleId) return toast.error('Selecione um papel.');
    if (form.senha.length < 8) return toast.error('A senha deve ter no mínimo 8 caracteres.');
    if (!validateCPF(form.cpf)) return toast.error('CPF inválido. Verifique os números digitados.');
    
    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      // Criamos um client temporário SEM persistência para não deslogar o admin atual
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } }
      );
      
      // 1. Criar usuário no Supabase usando o client temporário
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: {
          data: {
            nome_completo: form.nome
          }
        }
      });
      
      if (signUpError) throw signUpError;
      const usuarioId = signUpData.user?.id;
      if (!usuarioId) throw new Error('Falha ao obter ID do novo usuário no Supabase.');

      const token = signUpData.session?.access_token;

      // 2. Completar Perfil no Backend
      const profileRes = await fetch(resolveApiUrl('/api/auth/completar-perfil'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          nomeCompleto: form.nome,
          email: form.email,
          telefone: null,
          cpf: form.cpf
        })
      });
      
      if (!profileRes.ok) {
        const profileErr = await profileRes.json().catch(() => ({}));
        throw new Error(profileErr.message || 'Usuário criado no Supabase, mas erro ao completar perfil no backend.');
      }

      // 3. Vincular à Equipe
      const teamRes = await fetch(resolveApiUrl('/api/v1/equipe'), {
        method: 'POST',
        headers: { 
          ...fetchHeaders(),
          'Content-Type': 'application/json' 
        },
        credentials: 'include',
        body: JSON.stringify({
          usuarioId,
          roleId: form.roleId
        })
      });
      
      if (!teamRes.ok) {
        const teamErr = await teamRes.json().catch(() => ({}));
        throw new Error(teamErr.message || 'Perfil completado, mas erro ao vincular à equipe.');
      }
      
      toast.success('Acesso criado com sucesso!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Falha ao criar acesso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Novo Acesso</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 active:bg-slate-200 transition touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Nome Completo</label>
            <input 
              required
              maxLength={80}
              value={form.nome}
              onChange={e => setForm({...form, nome: e.target.value})}
              placeholder="Ex: João da Silva"
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">E-mail</label>
              <input 
                required
                type="email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="exemplo@google.com"
                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">CPF</label>
              <input 
                required
                value={form.cpf}
                onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})}
                placeholder="123.456.789-10"
                maxLength={14}
                className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Senha Temporária</label>
            <input 
              required
              type="password"
              minLength={8}
              value={form.senha}
              onChange={e => setForm({...form, senha: e.target.value})}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Papel / Acesso</label>
            <select 
              required
              value={form.roleId}
              onChange={e => setForm({...form, roleId: e.target.value})}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            >
              <option value="">Selecione...</option>
              {roles.filter(r => r.nome !== 'ADMIN').map(r => (
                <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-slate-100 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 sm:py-2.5 touch-manipulation"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-95 disabled:opacity-60 sm:py-2.5 touch-manipulation"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Criando...' : 'Criar Acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({ usuario, roles, onClose, onSuccess, fetchHeaders }) {
  const toast = useToast();
  const [roleId, setRoleId] = useState(usuario.roleId || usuario.role?.id || '');
  const [nome, setNome] = useState(usuario.nomeCompleto || usuario.usuarioNome || '');
  const [email, setEmail] = useState(usuario.email || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/equipe/${usuario.id}`), {
        method: 'PUT',
        headers: { 
          ...fetchHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          usuarioId: usuario.usuarioId || usuario.usuario?.id,
          nomeCompleto: nome,
          email: email,
          roleId 
        })
      });
      if (res.ok) {
        toast.success('Papel atualizado com sucesso.');
        onSuccess();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(
          getApiErrorDetail({ body }) || (body?.message && String(body.message).trim()) || 'Erro ao atualizar papel.'
        );
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error(getApiErrorToastMessage(error, 'Erro ao atualizar papel.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
        <h3 className="mb-1 text-lg font-bold text-slate-900">Editar Acesso</h3>
        <p className="mb-5 text-sm text-slate-500">Atualize as informações do membro da equipe.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Nome Completo</label>
            <input 
              required
              maxLength={80}
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">E-mail</label>
            <input 
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">CPF (Não editável)</label>
            <input 
              disabled
              value={usuario.cpf || 'Não informado'}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50/50 px-4 py-3 text-base outline-none text-slate-500 cursor-not-allowed sm:py-2.5 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Novo Papel</label>
            <select 
              required
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:bg-white sm:py-2.5 sm:text-sm"
            >
              <option value="">Selecione...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 active:bg-slate-50 rounded-xl sm:py-2.5 touch-manipulation">Voltar</button>
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-700 active:scale-95 disabled:opacity-60 sm:py-2.5 touch-manipulation"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
