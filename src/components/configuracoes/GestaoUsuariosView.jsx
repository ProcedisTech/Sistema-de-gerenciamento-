import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Edit2, Loader2, X, AlertCircle, CalendarClock, Phone, Mail, Crown } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch, configuracoesClinicaApi, getApiErrorDetail, getApiErrorToastMessage } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { usePapel } from '../../hooks/usePapel';
import DisponibilidadeProfissionalModal from './DisponibilidadeProfissionalModal';
import { AuditoriaView } from './AuditoriaView';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi, parsePhoneFromApi } from '../../utils/phoneUtils';

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
  
  // Filtros
  const [searchName, setSearchName] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-teal-50 rounded-xl">
              <Users className="h-6 w-6 text-[#00a88e]" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 truncate tracking-tight">Gestão de Equipe</h3>
          </div>
          <p className="text-sm text-slate-500 truncate pl-12 sm:pl-0 sm:mt-1">Gerencie os membros da equipe e níveis de acesso da sua clínica.</p>
        </div>
        {activeTab === 'membros' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="group flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/30 transition-all duration-300 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:scale-95 touch-manipulation sm:w-auto"
          >
            <UserPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="whitespace-nowrap">Convidar / Criar Acesso</span>
          </button>
        )}
      </div>
      
      {/* Abas Internas (Segmented Control) */}
      <div className="inline-flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl border border-slate-200/50 w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('membros')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
            activeTab === 'membros' 
              ? 'bg-white text-[#00a88e] shadow-sm ring-1 ring-slate-900/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Users className="h-4 w-4" />
          Membros da Equipe
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
            activeTab === 'auditoria' 
              ? 'bg-white text-[#00a88e] shadow-sm ring-1 ring-slate-900/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Shield className="h-4 w-4" />
          Histórico de Ações
        </button>
      </div>

      {activeTab === 'membros' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 appearance-none"
              >
                <option value="">Todos os cargos</option>
                {roles.filter(r => !['ADMIN', 'ADMINISTRADOR'].includes((r.nome || '').toUpperCase())).map(r => (
                  <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-48">
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 appearance-none"
              >
                <option value="">Todos os níveis</option>
                {perfisAcesso.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Unified Rich Card Grid */}
          {(() => {
            const filteredUsers = usuarios.filter(u => {
              const matchName = searchName === '' || (u.nomeCompleto || u.usuarioNome || '').toLowerCase().includes(searchName.toLowerCase());
              const matchRole = filterRole === '' || String(u.roleId || u.role?.id) === String(filterRole);
              const matchLevel = filterLevel === '' || String(u.perfilAcessoId) === String(filterLevel);
              return matchName && matchRole && matchLevel;
            });

            if (filteredUsers.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Nenhum membro encontrado</h4>
                    <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm mx-auto">Não há membros correspondentes aos filtros aplicados.</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredUsers.map((u) => {

                const isDono = (u.perfilAcessoCodigo || '').toUpperCase() === 'DONO';
                const isProfissional = (u.roleName || '').toUpperCase().includes('PROFISSIONAL');
                const perfilData = perfisAcesso.find(p => String(p.id) === String(u.perfilAcessoId)) || {};
                const nivelNome = u.perfilAcessoNome || perfilData.nome || (isDono ? 'Dono' : 'Nível não definido');
                // Generate avatar initials from full name
                const initials = (u.nomeCompleto || u.usuarioNome || '?')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(w => w[0].toUpperCase())
                  .join('');
                // Avatar background color based on role
                const avatarBg = isDono
                  ? 'from-amber-400 to-orange-500'
                  : isProfissional
                  ? 'from-[#00a88e] to-teal-500'
                  : 'from-slate-400 to-slate-500';

                return (
                  <div
                    key={u.id}
                    className={`group relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 ${
                      u.ativo ? 'border-slate-100' : 'border-slate-100 opacity-60 grayscale-[0.2]'
                    }`}
                  >
                    {/* Status strip at top */}
                    <div className={`h-1.5 w-full rounded-t-2xl ${
                      u.ativo ? (isDono ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-[#00a88e] to-teal-400') : 'bg-slate-300'
                    }`} />

                    <div className="flex flex-col gap-5 p-5">
                      {/* Header row: avatar + name + status */}
                      <div className="flex items-start gap-3.5">
                        {/* Avatar */}
                        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white text-base font-bold shadow-md bg-gradient-to-br ring-2 ring-white ${avatarBg}`}>
                          {isDono ? <Crown className="h-6 w-6" /> : initials}
                          {u.ativo && (
                            <span className="absolute -bottom-1 -right-1 block h-4 w-4 rounded-full bg-green-500 ring-2 ring-white"></span>
                          )}
                        </div>

                        {/* Name + badges */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <h4 className="font-bold text-base text-slate-900 leading-snug truncate">
                            {u.nomeCompleto || u.usuarioNome}
                          </h4>
                          {/* Role badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {/* Nível Badge */}
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isDono 
                                ? 'bg-amber-50 border-amber-200/60 text-amber-700' 
                                : 'bg-indigo-50 border-indigo-200/60 text-indigo-700'
                            }`}>
                              {isDono && <Crown className="h-3 w-3 mr-1" />}
                              {nivelNome}
                            </span>
                            
                            {u.roleName && (
                              <span className="inline-flex items-center rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                                {u.roleName === 'PROFISSIONAL' ? 'Profissional' : u.roleName}
                              </span>
                            )}
                            {!isDono && !u.roleName && (
                              <span className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Sem cargo
                              </span>
                            )}
                            {!u.ativo && (
                              <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                Inativo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact info */}
                      <div className="space-y-2.5 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                        {u.email && (
                          <div className="flex items-center gap-2.5 text-[13px] text-slate-600 min-w-0">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-900/5">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="truncate font-medium">{u.email}</span>
                          </div>
                        )}
                        {(u.telefone || u.usuarioTelefone) && (
                          <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-900/5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="font-medium">{u.telefone || u.usuarioTelefone}</span>
                          </div>
                        )}
                        {!u.email && !(u.telefone || u.usuarioTelefone) && (
                          <p className="text-[12px] text-slate-400 italic py-1 text-center">Sem contato cadastrado</p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        {tipoOrg === 'clinica' && isProfissional && (
                          <button
                            onClick={() => { setSelectedUsuario(u); setShowDispModal(true); }}
                            title="Configurar disponibilidade"
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-bold text-[#00a88e] transition hover:bg-teal-100 active:scale-95 touch-manipulation"
                          >
                            <CalendarClock className="h-4 w-4" />
                            <span className="hidden sm:inline">Agenda</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedUsuario(u); setShowEditModal(true); }}
                          title="Editar membro"
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 touch-manipulation"
                        >
                          <Edit2 className="h-4 w-4 text-slate-400" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          title="Desativar acesso"
                          className="flex flex-none items-center justify-center rounded-xl bg-white border border-slate-200 p-2.5 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 touch-manipulation"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

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
      { id: 'pacientes_ver', label: 'Visualizar Pacientes', minNivel: 1, descricao: 'Permite visualizar a lista e os dados cadastrais dos pacientes.' },
      { id: 'pacientes_criar', label: 'Cadastrar Novos Pacientes', minNivel: 2, descricao: 'Permite cadastrar novos pacientes no sistema.' },
      { id: 'pacientes_editar', label: 'Editar Dados de Pacientes', minNivel: 2, descricao: 'Permite alterar informações na ficha do paciente (nome, telefone, endereço, etc).' },
      { id: 'pacientes_excluir', label: 'Inativar / Excluir Pacientes', minNivel: 3, descricao: 'Permite inativar ou excluir o cadastro de um paciente. Requer confirmação de senha.' }
    ]
  },
  {
    categoria: 'Atendimento e Prontuário',
    itens: [
      { id: 'atendimento_iniciar', label: 'Iniciar Atendimento (Anamnese)', minNivel: 2, descricao: 'Permite iniciar um atendimento e preencher a anamnese do paciente.' },
      { id: 'prontuario_ver', label: 'Ver Prontuário Completo', minNivel: 2, descricao: 'Permite acessar o prontuário e o histórico de procedimentos do paciente.' },
      { id: 'prontuario_escrever', label: 'Criar/Editar Notas no Prontuário', minNivel: 2, descricao: 'Permite adicionar e editar notas rápidas no prontuário do paciente.' },
      { id: 'prontuario_procedimentos', label: 'Registrar Procedimentos', minNivel: 3, descricao: 'Permite lançar procedimentos realizados no prontuário do paciente.' }
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

const maskTelefone = (value) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
    .substring(0, 15);
};

function InviteModal({ roles, perfisAcesso, onClose, onSuccess, fetchHeaders }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cpf: '', roleId: '', perfilAcessoId: '' });
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState([]);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState('BR');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneTouched, setTelefoneTouched] = useState(false);

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
          telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
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

  const sectionCardCls = (err, cls) => `transition-all duration-300 shadow-sm ${cls} ${err ? 'border-red-300 ring-2 ring-red-100' : 'hover:shadow-md hover:border-slate-300'}`;
  const sectionHeadingCls = (cls) => `font-bold tracking-tight ${cls}`;
  const sectionMb = "mb-5";
  const gridGapClass = "gap-x-6 gap-y-5";

  const phoneWrapClass = () => `flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-all shadow-sm ${
    telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero)
      ? 'border-red-300 ring-4 ring-red-100'
      : 'border-slate-200 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10'
  }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto [webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl rounded-3xl bg-white p-5 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 my-4 md:my-auto transition-all duration-300 min-h-[70vh] max-h-none md:max-h-[95vh] flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-xl">
              <UserPlus className="h-6 w-6 text-[#00a88e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Novo Acesso</h3>
              <p className="text-sm text-slate-500 mt-0.5">Cadastre e configure um novo membro para a sua equipe.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 transition-colors touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-visible md:overflow-y-auto [webkit-overflow-scrolling:touch] pr-1 pb-4 space-y-6">
            {/* Seção 1: Dados Básicos */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-teal-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#00a88e]')}>Dados Básicos</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Nome Completo</label>
                  <input 
                    required
                    maxLength={80}
                    value={form.nome}
                    onChange={e => setForm({...form, nome: e.target.value})}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CPF</label>
                  <input 
                    required
                    value={form.cpf}
                    onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})}
                    placeholder="123.456.789-10"
                    maxLength={14}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  2
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Contato</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">E-mail</label>
                  <input 
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="exemplo@google.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Telefone Celular <span className="font-normal text-slate-400 normal-case">(Opcional)</span>
                  </label>
                  <div className={phoneWrapClass()}>
                    <select
                      value={telefoneCountryCode}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero('');
                      }}
                      className="w-16 bg-transparent text-[14px] font-medium text-slate-700 outline-none cursor-pointer"
                    >
                      {COUNTRY_PHONE_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.code}
                        </option>
                      ))}
                    </select>
                    <div className="h-5 w-px bg-slate-200 mx-1"></div>
                    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                      <span className="flex items-center text-[14px] text-slate-500 font-medium pt-0.5">
                        {getDdi(telefoneCountryCode)}
                      </span>
                      <input
                        type="tel"
                        value={telefoneNumero}
                        onChange={(e) => setTelefoneNumero(formatPhoneAsYouType(telefoneCountryCode, e.target.value))}
                        onBlur={() => setTelefoneTouched(true)}
                        placeholder="99999-9999"
                        className="w-full min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder-slate-400 outline-none"
                      />
                    </div>
                  </div>
                  {telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero) && (
                    <span className="mt-1.5 ml-1 block text-[11px] font-semibold text-red-500">Telefone inválido para {countrySelectDisplayLabel(getCountryByCode(telefoneCountryCode))}.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 3: Acesso e Permissões */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                  3
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Acesso</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Senha Temporária</label>
                  <input 
                    required
                    type="password"
                    minLength={8}
                    value={form.senha}
                    onChange={e => setForm({...form, senha: e.target.value})}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div className="hidden md:block"></div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cargo</label>
                  <select 
                    required
                    value={form.roleId}
                    onChange={e => handleRoleChangeInvite(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  >
                    <option value="">Selecione...</option>
                    {roles.filter(r => !['ADMIN', 'ADMINISTRADOR'].includes((r.nome || '').toUpperCase())).map(r => (
                      <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Nível de Permissão</label>
                  <select 
                    required
                    value={form.perfilAcessoId}
                    onChange={e => handlePerfilChangeInvite(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
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
            
            {/* Seção 4: Personalização de Funções */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-amber-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
                  4
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#d97706]')}>Personalizar Funções</h4>
              </div>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed max-w-2xl">
                O nível de permissão selecionado preenche as funções recomendadas abaixo, mas você pode marcar ou desmarcar livremente sem alterar o nível oficial.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end border-t border-slate-100 pt-5 shrink-0 bg-white md:bg-transparent">
            <button 
              type="button" 
              onClick={onClose}
              className="w-full sm:w-32 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95 touch-manipulation"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-48 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:pointer-events-none touch-manipulation"
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
  
  const parsedPhone = parsePhoneFromApi(usuario.telefone || usuario.usuarioTelefone);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState(parsedPhone.countryCode);
  const [telefoneNumero, setTelefoneNumero] = useState(parsedPhone.number);
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  
  const [email, setEmail] = useState(usuario.email || '');
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState([]);

  const isUserOwner = (usuario.perfilAcessoCodigo || '').toUpperCase() === 'DONO';
  const isSelfEdit = String(usuario.id) === String(currentRoleUserId);
  const isDono = papel === 'DONO';
  // O DONO pode ter um cargo (role) na clínica — apenas o nível de acesso (perfilAcesso) fica bloqueado
  const lockNivelField = isUserOwner;
  // E-mail também fica bloqueado para o próprio dono editando a si mesmo
  const lockEmailField = isUserOwner || (isSelfEdit && isDono);

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
      level = 5; // DONO sempre tem nível máximo de funções
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
    // Não altera o nível de acesso do DONO — ele fica sempre bloqueado
    if (isUserOwner) return;
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
          telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
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

  const sectionCardCls = (err, cls) => `transition-all duration-300 shadow-sm ${cls} ${err ? 'border-red-300 ring-2 ring-red-100' : 'hover:shadow-md hover:border-slate-300'}`;
  const sectionHeadingCls = (cls) => `font-bold tracking-tight ${cls}`;
  const sectionMb = "mb-5";
  const gridGapClass = "gap-x-6 gap-y-5";

  const phoneWrapClass = () => `flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-all shadow-sm ${
    telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero)
      ? 'border-red-300 ring-4 ring-red-100'
      : 'border-slate-200 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10'
  }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto [webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl rounded-3xl bg-white p-5 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 my-4 md:my-auto transition-all duration-300 max-h-none md:max-h-[95vh] flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl">
              <Edit2 className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Editar Acesso</h3>
              <p className="text-sm text-slate-500 mt-0.5">Atualize as informações e permissões do membro da equipe.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 transition-colors touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-visible md:overflow-y-auto [webkit-overflow-scrolling:touch] pr-1 space-y-6">
            {/* Seção 1: Dados Básicos */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-teal-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#00a88e]')}>Dados Básicos</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Nome Completo</label>
                  <input 
                    required
                    maxLength={80}
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1">CPF (Não editável)</label>
                  <input 
                    disabled
                    value={usuario.cpf || 'Não informado'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[14px] text-slate-500 outline-none cursor-not-allowed shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  2
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Contato</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wider ml-1 ${lockEmailField ? 'text-slate-400' : 'text-teal-700'}`}>
                    E-mail {lockEmailField && '(Dono)'}
                  </label>
                  <input 
                    required
                    type="email"
                    disabled={lockEmailField}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${lockEmailField ? 'bg-slate-50/70 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Telefone Celular <span className="font-normal text-slate-400 normal-case">(Opcional)</span>
                  </label>
                  <div className={phoneWrapClass()}>
                    <select
                      value={telefoneCountryCode}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero('');
                      }}
                      className="w-16 bg-transparent text-[14px] font-medium text-slate-700 outline-none cursor-pointer"
                    >
                      {COUNTRY_PHONE_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.code}
                        </option>
                      ))}
                    </select>
                    <div className="h-5 w-px bg-slate-200 mx-1"></div>
                    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                      <span className="flex items-center text-[14px] text-slate-500 font-medium pt-0.5">
                        {getDdi(telefoneCountryCode)}
                      </span>
                      <input
                        type="tel"
                        value={telefoneNumero}
                        onChange={(e) => setTelefoneNumero(formatPhoneAsYouType(telefoneCountryCode, e.target.value))}
                        onBlur={() => setTelefoneTouched(true)}
                        placeholder="99999-9999"
                        className="w-full min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder-slate-400 outline-none"
                      />
                    </div>
                  </div>
                  {telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero) && (
                    <span className="mt-1.5 ml-1 block text-[11px] font-semibold text-red-500">Telefone inválido para {countrySelectDisplayLabel(getCountryByCode(telefoneCountryCode))}.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 3: Acesso e Permissões */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                  3
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Acesso</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Cargo na Clínica
                  </label>
                  <select 
                    value={roleId}
                    onChange={e => handleRoleChangeEdit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  >
                    <option value="">Sem cargo específico</option>
                    {roles.filter(r => !['ADMIN', 'ADMINISTRADOR'].includes((r.nome || '').toUpperCase())).map(r => (
                      <option key={r.id} value={r.id}>{r.nome === 'PROFISSIONAL' ? 'Profissional / Médico' : r.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wider ml-1 ${lockNivelField ? 'text-slate-400' : 'text-teal-700'}`}>
                    Nível de Acesso {lockNivelField && '(Dono)'}
                  </label>
                  {isUserOwner ? (
                    <input 
                      disabled
                      value="Dono — acesso total"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[14px] text-slate-500 outline-none cursor-not-allowed shadow-sm"
                    />
                  ) : (
                    <select 
                      required
                      value={perfilAcessoId}
                      onChange={e => setPerfilAcessoId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
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
              
            {/* Seção 4: Personalização de Funções */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-amber-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
                  4
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#d97706]')}>Personalizar Funções</h4>
              </div>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed max-w-2xl">
                {isUserOwner 
                  ? 'O Dono possui acesso total ao sistema. As funções abaixo são apenas informativas.' 
                  : 'O nível de permissão selecionado preenche as funções recomendadas abaixo, mas você pode marcar ou desmarcar livremente sem alterar o nível oficial.'
                }
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    isUserOwner 
                                      ? 'cursor-not-allowed opacity-60' 
                                      : 'cursor-pointer hover:bg-slate-100/50'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isUserOwner}
                                    onChange={() => {
                                      if (isUserOwner) return;
                                      setSelectedFuncs(prev => 
                                        prev.includes(item.id) 
                                          ? prev.filter(id => id !== item.id) 
                                          : [...prev, item.id]
                                      );
                                    }}
                                    className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${
                                      isUserOwner ? 'cursor-not-allowed' : 'cursor-pointer'
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
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end border-t border-slate-100 pt-5 shrink-0 bg-white md:bg-transparent">
            <button type="button" onClick={onClose} className="w-full sm:w-32 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95 touch-manipulation">Voltar</button>
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-48 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:pointer-events-none touch-manipulation"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
