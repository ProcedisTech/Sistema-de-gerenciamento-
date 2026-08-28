import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Edit2, CalendarClock, Phone, Mail, Crown, Stethoscope, Settings2, PartyPopper, CalendarDays, MessageCircle, Activity, Award, Eye } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch, configuracoesClinicaApi, getApiErrorDetail, getApiErrorToastMessage } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { usePapel } from '../../hooks/usePapel';
import DisponibilidadeProfissionalModal from './DisponibilidadeProfissionalModal';
import { AuditoriaView } from './AuditoriaView';
import { GestaoPerfisTab } from './GestaoPerfisTab';
import { formatCargoLabel } from './gestaoUsuariosUtils';
import { InviteModal } from './InviteModal';
import { EditRoleModal } from './EditRoleModal';
import { ConfigTableSkeleton } from '../shared/ConfigPanelSkeletons';
import { agendaEnterClass } from '../agenda/agendaEnterClasses.js';

export function GestaoUsuariosView({ onDisponibilidadeInvalidate }) {
  // eslint-disable-next-line no-unused-vars
  const { isAdmin, canSeeConfigEquipe } = usePapel();
  const { roleUserId: currentRoleUserId } = useOrg();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [especialidadesList, setEspecialidadesList] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalReadOnly, setEditModalReadOnly] = useState(false);
  const [showDispModal, setShowDispModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [activeTab, setActiveTab] = useState('membros'); // 'membros' | 'auditoria' | 'perfis'
  const [tipoOrg, setTipoOrg] = useState('clinica');
  const [perfilParaAbrirNaAba, setPerfilParaAbrirNaAba] = useState(null);

  const onEditarPerfilNaAba = useCallback((perfilAcessoId) => {
    setPerfilParaAbrirNaAba(perfilAcessoId);
    setActiveTab('perfis');
  }, []);
  
  // Filtros
  const [searchName, setSearchName] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showEntrance, setShowEntrance] = useState(true);

  useEffect(() => {
    if (!showEntrance) return undefined;
    const id = window.setTimeout(() => setShowEntrance(false), 1800);
    return () => window.clearTimeout(id);
  }, [showEntrance]);

  const fetchHeaders = useCallback(() => {
    return authHeadersForFetch({ needsOrg: true });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipeRes, rolesRes, perfisRes, especialidadesRes, permissoesRes] = await Promise.all([
        fetch(resolveApiUrl('/api/v1/equipe'), {
          headers: await fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/roles'), {
          headers: await fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/perfis-acesso'), {
          headers: await fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/especialidades'), {
          headers: await fetchHeaders(),
          credentials: 'include'
        }),
        fetch(resolveApiUrl('/api/v1/permissoes'), {
          headers: await fetchHeaders(),
          credentials: 'include'
        })
      ]);

      if (equipeRes.ok && rolesRes.ok && perfisRes.ok && especialidadesRes.ok && permissoesRes.ok) {
        const equipeData = await equipeRes.json();
        const rolesData = await rolesRes.json();
        const perfisData = await perfisRes.json();
        const especialidadesData = await especialidadesRes.json();
        const permissoesData = await permissoesRes.json();
        setUsuarios(Array.isArray(equipeData) ? equipeData : equipeData.content || []);
        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.content || []);
        setPerfisAcesso(Array.isArray(perfisData) ? perfisData : perfisData.content || []);
        setEspecialidadesList(Array.isArray(especialidadesData) ? especialidadesData : especialidadesData.content || []);
        setPermissoes(Array.isArray(permissoesData) ? permissoesData : permissoesData.content || []);
      } else {
        const badRes = !equipeRes.ok ? equipeRes : (!rolesRes.ok ? rolesRes : (!perfisRes.ok ? perfisRes : (!especialidadesRes.ok ? especialidadesRes : permissoesRes)));
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
    if (canSeeConfigEquipe) {
      loadData();
    }
  }, [canSeeConfigEquipe, loadData]);

  useEffect(() => {
    if (!canSeeConfigEquipe) return;
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
  }, [canSeeConfigEquipe]);

  // Lógica de aniversários e tempo de casa
  const [aniversariantesHoje, setAniversariantesHoje] = useState([]);
  const [proximoAniversariante, setProximoAniversariante] = useState(null);
  const [tempoCasaHoje, setTempoCasaHoje] = useState([]);

  useEffect(() => {
    if (!usuarios || usuarios.length === 0) return;

    const hoje = new Date();
    const currentMonth = hoje.getMonth() + 1;
    const currentDay = hoje.getDate();
    const currentYear = hoje.getFullYear();

    const hojeList = [];
    const tempoList = [];
    let prox = null;
    let minDaysDiff = Infinity;

    usuarios.forEach(u => {
      // 1. Tempo de Casa
      if (u.criadoEm) {
        const d = new Date(u.criadoEm);
        const startMonth = d.getMonth() + 1;
        const startDay = d.getDate();
        const startYear = d.getFullYear();
        if (startMonth === currentMonth && startDay === currentDay && startYear < currentYear) {
          const anos = currentYear - startYear;
          tempoList.push({ usuario: u, anos });
        }
      }

      // 2. Aniversários
      if (!u.dataNascimento) return;
      const parts = u.dataNascimento.split('-');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (month === currentMonth && day === currentDay) {
          hojeList.push(u);
        } else {
          let nextBDay = new Date(hoje.getFullYear(), month - 1, day);
          // Se o aniversário já passou este ano, calcula pro ano que vem
          if (nextBDay < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
            nextBDay = new Date(hoje.getFullYear() + 1, month - 1, day);
          }
          const diffTime = nextBDay - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < minDaysDiff) {
            minDaysDiff = diffDays;
            prox = { 
              usuario: u, 
              dias: diffDays, 
              dataStr: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
            };
          }
        }
      }
    });

    setAniversariantesHoje(hojeList);
    setProximoAniversariante(prox);
    setTempoCasaHoje(tempoList);
  }, [usuarios]);

  // Mini Dashboard Stats
  const stats = React.useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter(u => u.ativo !== false).length;
    const medicos = usuarios.filter(u => {
      const role = String(u.roleName || u.role?.nome || '').toUpperCase();
      const isNotAdminOrRecep = role && !['ADMINISTRADOR', 'ADMIN', 'RECEPCIONISTA', 'RECEPCAO', 'ATENDENTE'].includes(role);
      const isProfLevel = String(u.perfilAcessoCodigo || '').toUpperCase().match(/NIVEL_(3|4)/);
      return isNotAdminOrRecep || isProfLevel;
    }).length;
    return { total, ativos, medicos };
  }, [usuarios]);

  const handleDeactivate = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Tem certeza que deseja desativar este acesso?')) return;
    
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/equipe/${id}`), {
        method: 'DELETE',
        headers: await fetchHeaders(),
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

  if (!canSeeConfigEquipe) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="mt-4 text-slate-600 font-medium">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações & Abas Internas */}
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${agendaEnterClass(showEntrance, 'agenda-delay-100')}`}>
        <h2 className="sr-only">Gestão de Equipe</h2>

        {/* Abas Internas (Segmented Control) */}
        <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl border border-slate-200/50 w-full sm:inline-flex sm:w-auto relative z-10">
        <button
          onClick={() => setActiveTab('membros')}
          className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-2 sm:py-2.5 text-[12px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'membros' 
              ? 'bg-white text-[#00a88e] shadow-sm ring-1 ring-slate-900/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Users className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="text-center leading-tight">Membros <span className="hidden sm:inline">da Equipe</span></span>
        </button>
        <button
          onClick={() => setActiveTab('perfis')}
          className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-2 sm:py-2.5 text-[12px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'perfis'
              ? 'bg-white text-[#00a88e] shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Settings2 className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="text-center leading-tight">Perfis <span className="hidden sm:inline">de Acesso</span></span>
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-2 sm:py-2.5 text-[12px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'auditoria'
              ? 'bg-white text-[#00a88e] shadow-sm ring-1 ring-slate-900/5'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Shield className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="text-center leading-tight">Histórico <span className="hidden sm:inline">de Ações</span></span>
        </button>
      </div>
      </div>

      {activeTab === 'membros' ? (
        <>
          <div className={agendaEnterClass(showEntrance, 'agenda-delay-200')}>
          {/* Mini Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-teal-50 text-teal-600 p-3 rounded-xl shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total da Equipe</p>
                <h4 className="text-2xl font-bold text-slate-900">
                  {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-200" /> : stats.total}
                </h4>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-green-50 text-green-600 p-3 rounded-xl shrink-0">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Membros Ativos</p>
                <h4 className="text-2xl font-bold text-slate-900">
                  {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-200" /> : stats.ativos}
                </h4>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl shrink-0">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Profissionais/Médicos</p>
                <h4 className="text-2xl font-bold text-slate-900">
                  {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-200" /> : stats.medicos}
                </h4>
              </div>
            </div>
          </div>

          {/* Alertas de Aniversário e Tempo de Casa */}
          {!loading && tempoCasaHoje.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-md text-white mb-4 flex items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl shrink-0">
                <Award className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold tracking-tight mb-0.5 flex flex-wrap gap-1">
                  Dia de comemorar! 🏆
                </h4>
                <p className="text-orange-100 text-sm leading-relaxed">
                  {tempoCasaHoje.map(tc => {
                    const isMe = String(tc.usuario.id) === String(currentRoleUserId);
                    return isMe ? (
                      <span key={tc.usuario.id} className="block mt-1">
                        Hoje você completa <span className="font-bold">{tc.anos} ano(s)</span> com a gente! Parabéns pela trajetória! 🌟
                      </span>
                    ) : (
                      <span key={tc.usuario.id} className="block mt-1">
                        Parabéns para <span className="font-bold">{tc.usuario.nomeCompleto || tc.usuario.usuarioNome}</span> que completa <span className="font-bold">{tc.anos} ano(s)</span> de casa hoje!
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          )}

          {!loading && aniversariantesHoje.length > 0 && (
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 shadow-md text-white mb-4 flex items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl shrink-0">
                <PartyPopper className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold tracking-tight mb-0.5 flex flex-wrap gap-1">
                  Hoje é dia de festa! 🎉
                </h4>
                <p className="text-pink-100 text-sm leading-relaxed">
                  {aniversariantesHoje.map(u => {
                    const isMe = String(u.id) === String(currentRoleUserId);
                    return isMe ? (
                      <span key={u.id} className="block mt-1">
                        Feliz aniversário, <span className="font-bold">{u.nomeCompleto || u.usuarioNome}</span>! Desejamos um dia incrível e muito sucesso! 🎂🎁
                      </span>
                    ) : (
                      <span key={u.id} className="block mt-1">
                        Parabéns para <span className="font-bold">{u.nomeCompleto || u.usuarioNome}</span>! Não esqueça de parabenizar.
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          )}

          {!loading && aniversariantesHoje.length === 0 && proximoAniversariante && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 flex items-center gap-3">
              <div className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                Próximo aniversário da equipe: <span className="font-semibold text-slate-900">{proximoAniversariante.usuario.nomeCompleto || proximoAniversariante.usuario.usuarioNome}</span> em <span className="font-semibold text-blue-600">{proximoAniversariante.dataStr}</span> ({proximoAniversariante.dias} dias).
              </p>
            </div>
          )}

          </div>

          <div className={`space-y-6 ${agendaEnterClass(showEntrance, 'agenda-delay-250')}`}>
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
                  <option key={r.id} value={r.id}>{formatCargoLabel(r.nome)}</option>
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
          {loading ? (
            <ConfigTableSkeleton rows={6} mobileCards />
          ) : (() => {
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
                        </div>

                        {/* Name + badges */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <h4 className="font-bold text-base text-slate-900 leading-snug truncate">
                            {u.nomeCompleto || u.usuarioNome}
                            {String(u.id) === String(currentRoleUserId) && <span className="text-xs text-slate-400 ml-2 font-normal">(Você)</span>}
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
                        {(u.telefone || u.usuarioTelefone) && (() => {
                          const fone = u.telefone || u.usuarioTelefone;
                          const onlyNumbers = String(fone).replace(/\D/g, '');
                          const isMobile = onlyNumbers.length >= 10;
                          return (
                            <div className="flex items-center justify-between text-[13px] text-slate-600">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-900/5">
                                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                                </div>
                                <span className="font-medium">{fone}</span>
                              </div>
                              {isMobile && (
                                <a 
                                  href={`https://wa.me/${onlyNumbers.length <= 11 && !onlyNumbers.startsWith('55') ? '55' + onlyNumbers : onlyNumbers}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors font-semibold text-xs"
                                  title="Abrir no WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </a>
                              )}
                            </div>
                          );
                        })()}
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
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-50 px-2 py-2.5 text-xs font-bold text-[#00a88e] transition hover:bg-teal-100 active:scale-95 touch-manipulation"
                          >
                            <CalendarClock className="h-4 w-4 shrink-0" />
                            <span className="truncate">Agenda</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedUsuario(u); setEditModalReadOnly(true); setShowEditModal(true); }}
                          title="Ver dados do membro"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-2 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 touch-manipulation"
                        >
                          <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="truncate">Ver</span>
                        </button>
                        <button
                          onClick={() => { setSelectedUsuario(u); setEditModalReadOnly(false); setShowEditModal(true); }}
                          title="Editar membro"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 px-2 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 touch-manipulation"
                        >
                          <Edit2 className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="truncate">Editar</span>
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

          </div>

          {showInviteModal && (
            <InviteModal
              roles={roles}
              perfisAcesso={perfisAcesso}
              permissoes={permissoes}
              especialidadesList={especialidadesList}
              onClose={() => setShowInviteModal(false)}
              onSuccess={() => { setShowInviteModal(false); loadData(); }}
              fetchHeaders={fetchHeaders}
              onEditarPerfilNaAba={onEditarPerfilNaAba}
            />
          )}

          {showEditModal && selectedUsuario && (
            <EditRoleModal
              usuario={selectedUsuario}
              roles={roles}
              perfisAcesso={perfisAcesso}
              permissoes={permissoes}
              especialidadesList={especialidadesList}
              onClose={() => setShowEditModal(false)}
              onSuccess={() => { setShowEditModal(false); loadData(); }}
              fetchHeaders={fetchHeaders}
              readOnly={editModalReadOnly}
              onEditarPerfilNaAba={onEditarPerfilNaAba}
            />
          )}

          {showDispModal && selectedUsuario && (
            <DisponibilidadeProfissionalModal
              roleUserId={selectedUsuario.id}
              nome={selectedUsuario.nomeCompleto || selectedUsuario.usuarioNome}
              tipoOrg={null}
              onClose={() => { setShowDispModal(false); setSelectedUsuario(null); }}
              onSaved={() => {
                onDisponibilidadeInvalidate?.({
                  scope: 'role',
                  roleUserId: selectedUsuario.id,
                });
              }}
            />
          )}
        </>
      ) : activeTab === 'auditoria' ? (
        <div className={agendaEnterClass(showEntrance, 'agenda-delay-250')}>
          <AuditoriaView />
        </div>
      ) : (
        <div className={agendaEnterClass(showEntrance, 'agenda-delay-250')}>
        <GestaoPerfisTab
          perfisAcesso={perfisAcesso}
          permissoes={permissoes}
          roles={roles}
          usuarios={usuarios}
          onReload={loadData}
          fetchHeaders={fetchHeaders}
          tipoOrg={tipoOrg}
          perfilParaAbrir={perfilParaAbrirNaAba}
          onPerfilParaAbrirConsumido={() => setPerfilParaAbrirNaAba(null)}
        />
        </div>
      )}
    </div>
  );
}
