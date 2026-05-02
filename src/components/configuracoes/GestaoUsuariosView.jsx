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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#0f172a]">Gestão de Usuários</h3>
          <p className="text-sm text-slate-500">Gerencie quem tem acesso à sua clínica.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 rounded-xl bg-[#00a88e] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00967f]"
        >
          <UserPlus className="h-4 w-4" />
          Convidar / Criar Acesso
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                    <span className={`inline-flex h-2 w-2 rounded-full ${u.ativo ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="ml-2 font-medium text-slate-600">{u.ativo ? 'Ativo' : 'Inativo'}</span>
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
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                        title="Editar papel"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
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
  const [form, setForm] = useState({ nome: '', email: '', senha: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roleId) return toast.error('Selecione um papel.');
    
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
          telefone: null
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Novo Acesso</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Nome Completo</label>
            <input 
              required
              value={form.nome}
              onChange={e => setForm({...form, nome: e.target.value})}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">E-mail</label>
            <input 
              required
              type="email"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Senha Temporária</label>
            <input 
              required
              type="password"
              value={form.senha}
              onChange={e => setForm({...form, senha: e.target.value})}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Papel / Acesso</label>
            <select 
              required
              value={form.roleId}
              onChange={e => setForm({...form, roleId: e.target.value})}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            >
              <option value="">Selecione...</option>
              {roles.filter(r => r.nome !== 'ADMIN').map(r => (
                <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">Editar Papel</h3>
        <p className="mb-5 text-sm text-slate-500">Alterando acesso de {usuario.usuarioNome || usuario.usuario?.nomeCompleto}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-teal-700">Novo Papel</label>
            <select 
              required
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            >
              <option value="">Selecione...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 text-sm font-bold text-slate-500">Voltar</button>
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
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
