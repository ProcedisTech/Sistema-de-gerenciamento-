import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Edit2, Loader2, X, AlertCircle, CalendarClock } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch, configuracoesClinicaApi, getApiErrorDetail, getApiErrorToastMessage } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { usePapel } from '../../hooks/usePapel';
import DisponibilidadeProfissionalModal from './DisponibilidadeProfissionalModal';
import { AuditoriaView } from './AuditoriaView';

export function GestaoUsuariosView() {
  const { isAdmin } = usePapel();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDispModal, setShowDispModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [activeTab, setActiveTab] = useState('membros'); // 'membros' | 'auditoria'
  const [tipoOrg, setTipoOrg] = useState('clinica');

  const fetchHeaders = useCallback(() => {
    return authHeadersForFetch({ needsOrg: true });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipeRes, rolesRes, perfisRes] = await Promise.all([
        fetch(resolveApiUrl('/api/v1/equipe'), {
          headers: fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/roles'), {
          headers: fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/perfis-acesso'), {
          headers: fetchHeaders(),
          credentials: 'include'
        })
      ]);

      if (equipeRes.ok && rolesRes.ok && perfisRes.ok) {
        const equipeData = await equipeRes.json();
        const rolesData = await rolesRes.json();
        const perfisData = await perfisRes.json();
        setUsuarios(Array.isArray(equipeData) ? equipeData : equipeData.content || []);
        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.content || []);
        setPerfisAcesso(Array.isArray(perfisData) ? perfisData : perfisData.content || []);
      } else {
        const badRes = !equipeRes.ok ? equipeRes : (!rolesRes.ok ? rolesRes : perfisRes);
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

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      try {
        const dto = await configuracoesClinicaApi.buscar();
        if (alive) setTipoOrg(dto?.tipoOrg || 'clinica');
      } catch {
        /* mantém default 'clinica'; falha aqui não deve quebrar a tela de equipe */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

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
          <h3 className="text-xl font-bold text-[#0f172a] sm:text-lg truncate">Gestão de Equipe</h3>
          <p className="text-sm text-slate-500 truncate">Gerencie os membros da equipe e níveis de acesso da sua clínica.</p>
        </div>
        {activeTab === 'membros' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#00967f] active:scale-95 touch-manipulation sm:w-auto sm:py-2.5"
          >
            <UserPlus className="h-4 w-4" />
            <span className="whitespace-nowrap">Convidar / Criar Acesso</span>
          </button>
        )}
      </div>
      
      {/* Abas Internas */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('membros')}
          className={`px-6 py-3 text-sm font-bold transition-colors relative ${
            activeTab === 'membros' ? 'text-[#00a88e]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Membros da Equipe
          {activeTab === 'membros' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a88e]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`px-6 py-3 text-sm font-bold transition-colors relative ${
            activeTab === 'auditoria' ? 'text-[#00a88e]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Histórico de Ações
          {activeTab === 'auditoria' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a88e]" />
          )}
        </button>
      </div>

      {activeTab === 'membros' ? (
        <>
          {/* Desktop Table View */}
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
                          {(u.perfilAcessoCodigo || '').toUpperCase() === 'DONO' ? 'Dono' : u.roleName}
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
                          {tipoOrg === 'clinica' && (u.roleName || '').toUpperCase().includes('PROFISSIONAL') && (
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

          {/* Mobile/Tablet Card View */}
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
                        {(u.perfilAcessoCodigo || '').toUpperCase() === 'DONO' ? 'Dono' : u.roleName}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-auto">
                    {tipoOrg === 'clinica' && (u.roleName || '').toUpperCase().includes('PROFISSIONAL') && (
                      <button
                        onClick={() => { setSelectedUsuario(u); setShowDispModal(true); }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-[#00a88e] active:bg-teal-100 touch-manipulation"
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        Disponibilidade
                      </button>
                    )}
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
              perfisAcesso={perfisAcesso}
              onClose={() => setShowInviteModal(false)} 
              onSuccess={() => { setShowInviteModal(false); loadData(); }}
              fetchHeaders={fetchHeaders}
            />
          )}

          {showEditModal && selectedUsuario && (
            <EditRoleModal 
              usuario={selectedUsuario}
              roles={roles}
              perfisAcesso={perfisAcesso}
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
        </>
      ) : (
        <AuditoriaView />
      )}
    </div>
  );
}

const FUNCOES_SISTEMA = [
  {
    categoria: 'Agenda',
    itens: [
      { id: 'agenda_ver', label: 'Visualizar Agenda', minNivel: 1, descricao: 'Permite visualizar os horários e agendamentos.' },
      { id: 'agenda_criar', label: 'Criar Agendamento', minNivel: 2, descricao: 'Permite cadastrar novos agendamentos na agenda da clínica.' },
      { id: 'agenda_editar', label: 'Editar/Cancelar Agendamento', minNivel: 2, descricao: 'Permite alterar horários, status ou cancelar agendamentos.' },
      { id: 'agenda_config', label: 'Configurar Agenda', minNivel: 5, descricao: 'Permite configurar horários de funcionamento, feriados e templates.' }
    ]
  },
  {
    categoria: 'Pacientes',
    itens: [
      { id: 'pacientes_ver', label: 'Visualizar Pacientes', minNivel: 1, descricao: 'Permite visualizar a lista e as fichas dos pacientes.' },
      { id: 'pacientes_criar', label: 'Cadastrar Novos Pacientes', minNivel: 2, descricao: 'Permite cadastrar novos pacientes e preencher dados.' },
      { id: 'pacientes_editar', label: 'Editar Dados de Pacientes', minNivel: 2, descricao: 'Permite alterar informações na ficha do paciente.' }
    ]
  },
  {
    categoria: 'Configurações e Sistema',
    itens: [
      { id: 'config_anamnese', label: 'Configurar Modelos de Anamnese', minNivel: 3, descricao: 'Permite gerenciar categorias e perguntas de anamnese.' },
      { id: 'config_procedimentos', label: 'Configurar Catálogo de Procedimentos', minNivel: 4, descricao: 'Permite gerenciar os procedimentos oferecidos.' },
      { id: 'config_termos', label: 'Configurar Termos e Documentos', minNivel: 4, descricao: 'Permite gerenciar termos de consentimento e contratos.' },
      { id: 'config_perfil', label: 'Configurar Perfil do Profissional', minNivel: 4, descricao: 'Permite ajustar o perfil de atendimento.' },
      { id: 'config_clinica', label: 'Configurar Dados da Clínica', minNivel: 5, descricao: 'Permite gerenciar dados institucionais da clínica.' },
      { id: 'config_equipe', label: 'Gerenciar Equipe e Permissões', minNivel: 5, descricao: 'Permite criar, editar e desativar acessos da equipe.' },
      { id: 'config_auditoria', label: 'Visualizar Logs de Auditoria', minNivel: 5, descricao: 'Permite visualizar o histórico de ações do sistema.' }
    ]
  }
];

const getLevelFromPerfilAcessoId = (perfilId, perfis) => {
  if (!perfilId || !perfis) return 0;
  const perfil = perfis.find(p => String(p.id) === String(perfilId));
  if (!perfil) return 0;
  const code = (perfil.codigo || '').toUpperCase();
  const name = (perfil.nome || '').toLowerCase();
  
  if (code.includes('NIVEL_5') || name.includes('administrador') || name.includes('adm')) return 5;
  if (code.includes('NIVEL_4') || name.includes('sênior') || name.includes('senior')) return 4;
  if (code.includes('NIVEL_3') || name.includes('padrão') || name.includes('padrao') || name.includes('profissional')) return 3;
  if (code.includes('NIVEL_2') || name.includes('recepção') || name.includes('recepcao') || name.includes('recepcionista')) return 2;
  if (code.includes('NIVEL_1') || name.includes('leitura') || name.includes('auxiliar')) return 1;
  return 0;
};

const getPresetProfileId = (roleName, perfis) => {
  if (!roleName) return null;
  const nameLower = roleName.toLowerCase();
  
  if (nameLower.includes('administrador') || nameLower === 'adm') {
    // Nível 5 - Administrador
    const match = perfis.find(p => 
      (p.nome || '').toLowerCase().includes('administrador') || 
      (p.codigo || '').toLowerCase().includes('nivel_5')
    );
    return match ? match.id : null;
  }
  
  if (nameLower.includes('medico') || nameLower.includes('esteticista')) {
    // Nível 4 - Profissional Sênior
    const match = perfis.find(p => 
      (p.nome || '').toLowerCase().includes('sênior') || 
      (p.nome || '').toLowerCase().includes('senior') || 
      (p.codigo || '').toLowerCase().includes('nivel_4')
    );
    return match ? match.id : null;
  }
  
  if (nameLower.includes('profissional')) {
    // Nível 3 - Profissional Padrão
    const match = perfis.find(p => 
      (p.nome || '').toLowerCase().includes('padrão') || 
      (p.nome || '').toLowerCase().includes('padrao') || 
      (p.codigo || '').toLowerCase().includes('nivel_3')
    );
    return match ? match.id : null;
  }
  
  if (nameLower.includes('recepcionista') || nameLower.includes('recepcao')) {
    // Nível 2 - Recepção
    const match = perfis.find(p => 
      (p.nome || '').toLowerCase().includes('recepção') || 
      (p.nome || '').toLowerCase().includes('recepcao') || 
      (p.codigo || '').toLowerCase().includes('nivel_2')
    );
    return match ? match.id : null;
  }
  
  return null;
};

function InviteModal({ roles, perfisAcesso, onClose, onSuccess, fetchHeaders }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cpf: '', roleId: '', perfilAcessoId: '' });
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState([]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  const handleRoleChangeInvite = (selectedRoleId) => {
    let nextPerfilAcessoId = form.perfilAcessoId;
    const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));
    if (selectedRole) {
      const presetId = getPresetProfileId(selectedRole.nome, perfisAcesso);
      if (presetId) {
        nextPerfilAcessoId = presetId;
      }
    }
    setForm({ ...form, roleId: selectedRoleId, perfilAcessoId: nextPerfilAcessoId });
    
    if (nextPerfilAcessoId) {
      const level = getLevelFromPerfilAcessoId(nextPerfilAcessoId, perfisAcesso);
      const defaultFuncs = [];
      FUNCOES_SISTEMA.forEach(cat => {
        cat.itens.forEach(item => {
          if (item.minNivel <= level) {
            defaultFuncs.push(item.id);
          }
        });
      });
      setSelectedFuncs(defaultFuncs);
    }
  };

  const handlePerfilChangeInvite = (selectedPerfilId) => {
    setForm({ ...form, perfilAcessoId: selectedPerfilId });
    if (selectedPerfilId) {
      const level = getLevelFromPerfilAcessoId(selectedPerfilId, perfisAcesso);
      const defaultFuncs = [];
      FUNCOES_SISTEMA.forEach(cat => {
        cat.itens.forEach(item => {
          if (item.minNivel <= level) {
            defaultFuncs.push(item.id);
          }
        });
      });
      setSelectedFuncs(defaultFuncs);
    }
  };

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
    if (!form.perfilAcessoId) return toast.error('Selecione um nível de permissão.');
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
          roleId: form.roleId,
          perfilAcessoId: form.perfilAcessoId
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
    <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/40 p-2 sm:p-4 md:p-6 backdrop-blur-sm overflow-y-auto [webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl rounded-2xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl my-4 md:my-auto transition-all duration-300 max-h-none md:max-h-[90vh] flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Novo Acesso</h3>
            <p className="text-sm text-slate-500 mt-1">Cadastre e configure um novo membro para a sua equipe.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 active:bg-slate-200 transition touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-visible md:overflow-y-auto [webkit-overflow-scrolling:touch] pr-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
              {/* Coluna Esquerda: Dados Básicos (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">Nome Completo</label>
                  <input 
                    required
                    maxLength={80}
                    value={form.nome}
                    onChange={e => setForm({...form, nome: e.target.value})}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">CPF</label>
                  <input 
                    required
                    value={form.cpf}
                    onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})}
                    placeholder="123.456.789-10"
                    maxLength={14}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">E-mail</label>
                  <input 
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="exemplo@google.com"
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">Senha Temporária</label>
                  <input 
                    required
                    type="password"
                    minLength={8}
                    value={form.senha}
                    onChange={e => setForm({...form, senha: e.target.value})}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">Cargo</label>
                    <select 
                      required
                      value={form.roleId}
                      onChange={e => handleRoleChangeInvite(e.target.value)}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                    >
                      <option value="">Selecione...</option>
                      {roles.filter(r => r.nome !== 'ADMIN').map(r => (
                        <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">Nível de Permissão</label>
                    <select 
                      required
                      value={form.perfilAcessoId}
                      onChange={e => handlePerfilChangeInvite(e.target.value)}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                    >
                      <option value="">Selecione...</option>
                      {[...perfisAcesso]
                        .filter(p => (p.codigo || '').toUpperCase() !== 'DONO' && (p.nome || '').toLowerCase() !== 'dono')
                        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Coluna Direita: Personalização de Funções (col-span-7) */}
              <div className="md:col-span-7 border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6 lg:pl-8 border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-teal-700">
                      Personalizar Funções do Usuário
                    </label>
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full uppercase">
                      Customizável
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    O nível selecionado preenche as funções recomendadas, mas você pode marcar ou desmarcar livremente sem alterar o nível oficial.
                  </p>
                  
                  <div className="space-y-3 max-h-none overflow-y-visible md:max-h-[320px] lg:max-h-[340px] md:overflow-y-auto pr-2 select-none scrollbar-thin">
                    <div className="grid grid-cols-1 gap-3">
                      {FUNCOES_SISTEMA.map(cat => (
                        <div key={cat.categoria} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2 border-b border-slate-200/60 pb-1">
                            {cat.categoria}
                          </span>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {cat.itens.map(item => {
                              const isChecked = selectedFuncs.includes(item.id);
                              return (
                                <label key={item.id} className="flex items-start gap-2.5 p-2 sm:p-1.5 rounded-lg transition cursor-pointer hover:bg-slate-100/50">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedFuncs(prev =>
                                        prev.includes(item.id)
                                          ? prev.filter(id => id !== item.id)
                                          : [...prev, item.id]
                                      );
                                    }}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                  />
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-slate-700 block leading-snug">
                                      {item.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug">
                                      {item.descricao}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col gap-2 sm:flex-row justify-end border-t border-slate-100 pt-4 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="w-full sm:w-32 rounded-xl border-2 border-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 touch-manipulation"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-44 flex items-center justify-center gap-2 rounded-xl bg-[#00a88e] hover:bg-[#00967f] py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60 touch-manipulation"
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

function EditRoleModal({ usuario, roles, perfisAcesso, onClose, onSuccess, fetchHeaders }) {
  const { roleUserId: currentRoleUserId, papel } = useOrg();
  const toast = useToast();
  const [roleId, setRoleId] = useState(usuario.roleId || usuario.role?.id || '');
  const [perfilAcessoId, setPerfilAcessoId] = useState(usuario.perfilAcessoId || '');
  const [nome, setNome] = useState(usuario.nomeCompleto || usuario.usuarioNome || '');
  const [email, setEmail] = useState(usuario.email || '');
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState([]);

  const isUserOwner = (usuario.perfilAcessoCodigo || '').toUpperCase() === 'DONO';
  const isSelfEdit = String(usuario.id) === String(currentRoleUserId);
  const isDono = papel === 'DONO';
  const lockSensitiveFields = isUserOwner || (isSelfEdit && isDono);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  useEffect(() => {
    let level = 0;
    if (isUserOwner) {
      level = 5;
    } else if (perfilAcessoId) {
      level = getLevelFromPerfilAcessoId(perfilAcessoId, perfisAcesso);
    }
    
    if (level > 0) {
      const defaultFuncs = [];
      FUNCOES_SISTEMA.forEach(cat => {
        cat.itens.forEach(item => {
          if (item.minNivel <= level) {
            defaultFuncs.push(item.id);
          }
        });
      });
      setSelectedFuncs(defaultFuncs);
    } else {
      setSelectedFuncs([]);
    }
  }, [perfilAcessoId, perfisAcesso, isUserOwner]);

  const handleRoleChangeEdit = (selectedRoleId) => {
    setRoleId(selectedRoleId);
    const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));
    if (selectedRole) {
      const presetId = getPresetProfileId(selectedRole.nome, perfisAcesso);
      if (presetId) {
        setPerfilAcessoId(presetId);
      }
    }
  };

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
          roleId,
          perfilAcessoId
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
    <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/40 p-2 sm:p-4 md:p-6 backdrop-blur-sm overflow-y-auto [webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl rounded-2xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl my-4 md:my-auto transition-all duration-300 max-h-none md:max-h-[90vh] flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Editar Acesso</h3>
            <p className="text-sm text-slate-500 mt-1">Atualize as informações e permissões do membro da equipe.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 active:bg-slate-200 transition touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-visible md:overflow-y-auto [webkit-overflow-scrolling:touch] pr-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
              {/* Coluna Esquerda: Campos (col-span-5) */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-teal-700">Nome Completo</label>
                  <input 
                    required
                    maxLength={80}
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">CPF (Não editável)</label>
                  <input 
                    disabled
                    value={usuario.cpf || 'Não informado'}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50/50 px-3 py-2 text-sm outline-none text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className={`mb-1 block text-xs font-bold uppercase tracking-wider ${lockSensitiveFields ? 'text-slate-400' : 'text-teal-700'}`}>
                    E-mail {lockSensitiveFields && '(Dono)'}
                  </label>
                  <input 
                    required
                    type="email"
                    disabled={lockSensitiveFields}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white ${lockSensitiveFields ? 'cursor-not-allowed opacity-70' : ''}`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`mb-1 block text-xs font-bold uppercase tracking-wider ${lockSensitiveFields ? 'text-slate-400' : 'text-teal-700'}`}>
                      Novo Cargo
                    </label>
                    {isUserOwner ? (
                      <input 
                        disabled
                        value="Dono"
                        className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none text-slate-500 cursor-not-allowed"
                      />
                    ) : (
                      <select 
                        required
                        disabled={lockSensitiveFields}
                        value={roleId}
                        onChange={e => handleRoleChangeEdit(e.target.value)}
                        className={`w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white ${lockSensitiveFields ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        <option value="">Selecione...</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs font-bold uppercase tracking-wider ${lockSensitiveFields ? 'text-slate-400' : 'text-teal-700'}`}>
                      Novo Nível
                    </label>
                    {isUserOwner ? (
                      <input 
                        disabled
                        value="Dono"
                        className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none text-slate-500 cursor-not-allowed"
                      />
                    ) : (
                      <select 
                        required
                        disabled={lockSensitiveFields}
                        value={perfilAcessoId}
                        onChange={e => setPerfilAcessoId(e.target.value)}
                        className={`w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:bg-white ${lockSensitiveFields ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        <option value="">Selecione...</option>
                        {[...perfisAcesso]
                          .filter(p => (p.codigo || '').toUpperCase() !== 'DONO' && (p.nome || '').toLowerCase() !== 'dono')
                          .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))
                        }
                      </select>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Coluna Direita: Personalização (col-span-7) */}
              <div className="md:col-span-7 border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6 lg:pl-8 border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-teal-700">
                      Personalizar Funções do Usuário
                    </label>
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full uppercase">
                      Customizável
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    {lockSensitiveFields 
                      ? 'As funções do Dono principal não podem ser customizadas.' 
                      : 'O nível selecionado preenche as funções recomendadas, mas você pode marcar ou desmarcar livremente sem alterar o nível oficial.'
                    }
                  </p>
                  
                  <div className="space-y-3 max-h-none overflow-y-visible md:max-h-[320px] lg:max-h-[340px] md:overflow-y-auto pr-2 select-none scrollbar-thin">
                    <div className="grid grid-cols-1 gap-3">
                      {FUNCOES_SISTEMA.map(cat => (
                        <div key={cat.categoria} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2 border-b border-slate-200/60 pb-1">
                            {cat.categoria}
                          </span>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {cat.itens.map(item => {
                              const isChecked = selectedFuncs.includes(item.id);
                              return (
                                <label 
                                  key={item.id} 
                                  className={`flex items-start gap-2.5 p-2 sm:p-1.5 rounded-lg transition ${
                                    lockSensitiveFields 
                                      ? 'cursor-not-allowed opacity-60' 
                                      : 'cursor-pointer hover:bg-slate-100/50'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={lockSensitiveFields}
                                    onChange={() => {
                                      if (lockSensitiveFields) return;
                                      setSelectedFuncs(prev => 
                                        prev.includes(item.id) 
                                          ? prev.filter(id => id !== item.id) 
                                          : [...prev, item.id]
                                      );
                                    }}
                                    className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${
                                      lockSensitiveFields ? 'cursor-not-allowed' : 'cursor-pointer'
                                    }`}
                                  />
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-slate-700 block leading-snug">
                                      {item.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug">
                                      {item.descricao}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col gap-2 sm:flex-row justify-end border-t border-slate-100 pt-4 shrink-0">
            <button type="button" onClick={onClose} className="w-full sm:w-32 rounded-xl border-2 border-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 touch-manipulation">Voltar</button>
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-44 flex items-center justify-center gap-2 rounded-xl bg-[#00a88e] hover:bg-[#00967f] py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60 touch-manipulation"
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
