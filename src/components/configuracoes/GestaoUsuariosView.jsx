import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Edit2, Loader2, X, AlertCircle, CalendarClock, Phone, Mail, Crown, MapPin, Stethoscope, Settings2, PartyPopper, CalendarDays, MessageCircle, Activity, Award, Clock, Eye, EyeOff } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch, configuracoesClinicaApi, getApiErrorDetail, getApiErrorToastMessage, equipeApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { usePapel } from '../../hooks/usePapel';
import DisponibilidadeProfissionalModal from './DisponibilidadeProfissionalModal';
import { AuditoriaView } from './AuditoriaView';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi, parsePhoneFromApi } from '../../utils/phoneUtils';

export function GestaoUsuariosView({ onDisponibilidadeInvalidate }) {
  const { isAdmin } = usePapel();
  const { roleUserId: currentRoleUserId } = useOrg();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [especialidadesList, setEspecialidadesList] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalReadOnly, setEditModalReadOnly] = useState(false);
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
      const [equipeRes, rolesRes, perfisRes, especialidadesRes] = await Promise.all([
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
        }),
        fetch(resolveApiUrl('/api/v1/dimensoes/especialidades'), {
          headers: fetchHeaders(),
          credentials: 'include'
        })
      ]);

      if (equipeRes.ok && rolesRes.ok && perfisRes.ok && especialidadesRes.ok) {
        const equipeData = await equipeRes.json();
        const rolesData = await rolesRes.json();
        const perfisData = await perfisRes.json();
        const especialidadesData = await especialidadesRes.json();
        setUsuarios(Array.isArray(equipeData) ? equipeData : equipeData.content || []);
        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.content || []);
        setPerfisAcesso(Array.isArray(perfisData) ? perfisData : perfisData.content || []);
        setEspecialidadesList(Array.isArray(especialidadesData) ? especialidadesData : especialidadesData.content || []);
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

      {activeTab === 'membros' ? (
        <>
          {/* Mini Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-teal-50 text-teal-600 p-3 rounded-xl shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total da Equipe</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.total}</h4>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-green-50 text-green-600 p-3 rounded-xl shrink-0">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Membros Ativos</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.ativos}</h4>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl shrink-0">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Profissionais/Médicos</p>
                <h4 className="text-2xl font-bold text-slate-900">{stats.medicos}</h4>
              </div>
            </div>
          </div>

          {/* Alertas de Aniversário e Tempo de Casa */}
          {tempoCasaHoje.length > 0 && (
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

          {aniversariantesHoje.length > 0 && (
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

          {aniversariantesHoje.length === 0 && proximoAniversariante && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 flex items-center gap-3">
              <div className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                Próximo aniversário da equipe: <span className="font-semibold text-slate-900">{proximoAniversariante.usuario.nomeCompleto || proximoAniversariante.usuario.usuarioNome}</span> em <span className="font-semibold text-blue-600">{proximoAniversariante.dataStr}</span> ({proximoAniversariante.dias} dias).
              </p>
            </div>
          )}

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

          {showInviteModal && (
            <InviteModal 
              roles={roles} 
              perfisAcesso={perfisAcesso}
              especialidadesList={especialidadesList}
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
              especialidadesList={especialidadesList}
              onClose={() => setShowEditModal(false)}
              onSuccess={() => { setShowEditModal(false); loadData(); }}
              fetchHeaders={fetchHeaders}
              readOnly={editModalReadOnly}
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
      { id: 'AGENDA_VER', label: 'Visualizar Agenda', minNivel: 1, descricao: 'Permite visualizar os horários e agendamentos.' },
      { id: 'AGENDA_CRIAR', label: 'Criar Agendamento', minNivel: 2, descricao: 'Permite cadastrar novos agendamentos na agenda da clínica.' },
      { id: 'AGENDA_EDITAR', label: 'Editar/Cancelar Agendamento', minNivel: 2, descricao: 'Permite alterar horários, status ou cancelar agendamentos.' },
      { id: 'HORARIO_EDITAR', label: 'Configurar Agenda', minNivel: 5, descricao: 'Permite configurar horários de funcionamento, feriados e templates.' }
    ]
  },
  {
    categoria: 'Pacientes',
    itens: [
      { id: 'PACIENTE_VER', label: 'Visualizar Pacientes', minNivel: 1, descricao: 'Permite visualizar a lista e os dados cadastrais dos pacientes.' },
      { id: 'PACIENTE_CRIAR', label: 'Cadastrar Novos Pacientes', minNivel: 2, descricao: 'Permite cadastrar novos pacientes no sistema.' },
      { id: 'PACIENTE_EDITAR', label: 'Editar Dados de Pacientes', minNivel: 2, descricao: 'Permite alterar informações na ficha do paciente (nome, telefone, endereço, etc).' },
      { id: 'PACIENTE_EXCLUIR', label: 'Inativar / Excluir Pacientes', minNivel: 3, descricao: 'Permite inativar ou excluir o cadastro de um paciente. Requer confirmação de senha.' }
    ]
  },
  {
    categoria: 'Atendimento e Prontuário',
    itens: [
      { id: 'ANAMNESE_PREENCHIMENTO_CRIAR', label: 'Iniciar Atendimento (Anamnese)', minNivel: 3, descricao: 'Permite iniciar um atendimento e preencher a anamnese do paciente.' },
      { id: 'PRONTUARIO_VER', label: 'Ver Prontuário Completo', minNivel: 3, descricao: 'Permite acessar o prontuário e o histórico de procedimentos do paciente.' },
      { id: 'PACIENTE_NOTA_CRIAR', label: 'Criar/Editar Notas no Prontuário', minNivel: 3, descricao: 'Permite adicionar e editar notas rápidas no prontuário do paciente.' },
      { id: 'PRONTUARIO_CRIAR', label: 'Registrar Procedimentos', minNivel: 2, descricao: 'Permite lançar procedimentos realizados no prontuário do paciente.' },
      { id: 'PACIENTE_GALERIA_VER', label: 'Acessar Galeria de Imagens', minNivel: 3, descricao: 'Permite acessar a galeria de fotos e arquivos anexados do paciente.' },
      { id: 'PACIENTE_DOCUMENTO_VER', label: 'Gerenciar Documentos Assinados', minNivel: 2, descricao: 'Permite acessar, enviar e gerenciar os documentos do paciente.' }
    ]
  },
  {
    categoria: 'Configurações e Sistema',
    itens: [
      { id: 'ANAMNESE_MODELO_VER', label: 'Configurar Modelos de Anamnese', minNivel: 3, descricao: 'Permite gerenciar categorias e perguntas de anamnese.' },
      { id: 'CATALOGO_VER', label: 'Configurar Catálogo de Procedimentos', minNivel: 4, descricao: 'Permite gerenciar os procedimentos oferecidos.' },
      { id: 'DOC_MODELO_VER', label: 'Configurar Termos e Documentos', minNivel: 4, descricao: 'Permite gerenciar termos de consentimento e contratos.' },
      { id: 'CLINICA_EDITAR', label: 'Configurar Dados da Clínica', minNivel: 5, descricao: 'Permite gerenciar dados institucionais da clínica.' },
      { id: 'USUARIO_VER', label: 'Gerenciar Equipe e Permissões', minNivel: 5, descricao: 'Permite criar, editar e desativar acessos da equipe.' },
      { id: 'AUDITORIA_VER', label: 'Visualizar Logs de Auditoria', minNivel: 5, descricao: 'Permite visualizar o histórico de ações do sistema.' }
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

const _maskTelefone = (value) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
    .substring(0, 15);
};

function InviteModal({ roles, perfisAcesso, especialidadesList, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({ 
    nome: '', email: '', senha: '', cpf: '', roleId: '', perfilAcessoId: '',
    dataNascimento: '', estadoCivil: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', especialidades: []
  });
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState([]);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState('BR');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  const handleCepChange = async (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let formattedCep = rawValue;
    if (rawValue.length > 5) {
      formattedCep = rawValue.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setForm(prev => ({...prev, cep: formattedCep}));

    if (rawValue.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            uf: data.uf || ''
          }));
          document.getElementById('invite-numero')?.focus();
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

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
          cpf: form.cpf,
          dataNascimento: form.dataNascimento || null,
          estadoCivil: form.estadoCivil || null,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          especialidades: form.especialidades
        })
      });
      
      if (!profileRes.ok) {
        const profileErr = await profileRes.json().catch(() => ({}));
        throw new Error(profileErr.message || 'Usuário criado no Supabase, mas erro ao completar perfil no backend.');
      }

      // 3. Vincular à Equipe
      try {
        await equipeApi.create({
          usuarioId,
          roleId: form.roleId,
          perfilAcessoId: form.perfilAcessoId,
          customizouPermissoes: true,
          permissoesCustomizadas: selectedFuncs
        });
      } catch (err) {
        throw new Error(getApiErrorToastMessage(err) || 'Perfil completado, mas erro ao vincular à equipe.');
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
    <div 
      className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto [webkit-overflow-scrolling:touch]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[95vw] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto rounded-3xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 my-4 md:my-auto transition-all duration-300 min-h-[70vh] max-h-none md:max-h-[95vh] flex flex-col">
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
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Data de Nascimento <span className="font-normal text-slate-400 normal-case">(Opcional)</span></label>
                  <input 
                    type="date"
                    value={form.dataNascimento}
                    onChange={e => setForm({...form, dataNascimento: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Estado Civil <span className="font-normal text-slate-400 normal-case">(Opcional)</span></label>
                  <select
                    value={form.estadoCivil}
                    onChange={e => setForm({...form, estadoCivil: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                    <option value="Separado(a)">Separado(a)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Nova Seção: Especialidades */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-teal-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1b
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#00a88e]')}>Especialidades (Opcional)</h4>
              </div>
              <div className="grid grid-cols-1">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Especialidades de Estética / Saúde</label>
                  <div className="flex flex-wrap gap-2">
                    {(especialidadesList || []).map(esp => (
                      <label key={esp.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={form.especialidades.includes(esp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({...form, especialidades: [...form.especialidades, esp.id]});
                            } else {
                              setForm({...form, especialidades: form.especialidades.filter(id => id !== esp.id)});
                            }
                          }}
                          className="h-4 w-4 text-[#00a88e] rounded border-slate-300 focus:ring-[#00a88e]"
                        />
                        <span className="text-[13px] font-medium text-slate-700">{esp.nome}</span>
                      </label>
                    ))}
                  </div>
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

            {/* Nova Seção: Endereço */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  2b
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Endereço (Opcional)</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CEP</label>
                  <input 
                    value={form.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Logradouro</label>
                  <input 
                    value={form.logradouro}
                    onChange={e => setForm({...form, logradouro: e.target.value})}
                    placeholder="Ex: Rua das Flores"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Número</label>
                  <input 
                    id="invite-numero"
                    value={form.numero}
                    onChange={e => setForm({...form, numero: e.target.value})}
                    placeholder="Ex: 123"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Complemento</label>
                  <input 
                    value={form.complemento}
                    onChange={e => setForm({...form, complemento: e.target.value})}
                    placeholder="Ex: Apto 42"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Bairro</label>
                  <input 
                    value={form.bairro}
                    onChange={e => setForm({...form, bairro: e.target.value})}
                    placeholder="Ex: Centro"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cidade</label>
                    <input 
                      value={form.cidade}
                      onChange={e => setForm({...form, cidade: e.target.value})}
                      placeholder="Ex: São Paulo"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">UF</label>
                    <input 
                      value={form.uf}
                      onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})}
                      placeholder="Ex: SP"
                      maxLength={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                    />
                  </div>
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
                  <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    <span>Senha Temporária</span>
                    <button 
                      type="button" 
                      onClick={() => setShowSenha(!showSenha)}
                      className="text-teal-600 hover:text-teal-700 p-0.5 transition-colors focus:outline-none"
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </label>
                  <input 
                    required
                    type={showSenha ? "text" : "password"}
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
                                <label key={item.id} className="flex items-start gap-2.5 p-2 sm:p-1.5 rounded-lg cursor-pointer hover:bg-slate-100/50 transition">
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
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({ usuario, roles, perfisAcesso, especialidadesList, onClose, onSuccess, readOnly = false }) {
  const { roleUserId: currentRoleUserId, papel } = useOrg();
  const toast = useToast();
  const [roleId, setRoleId] = useState(usuario.roleId || usuario.role?.id || '');
  const [perfilAcessoId, setPerfilAcessoId] = useState(usuario.perfilAcessoId || '');
  const [nome, setNome] = useState(usuario.nomeCompleto || usuario.usuarioNome || '');
  const [showCpf, setShowCpf] = useState(false);
  
  const parsedPhone = parsePhoneFromApi(usuario.telefone || usuario.usuarioTelefone);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState(parsedPhone.countryCode);
  const [telefoneNumero, setTelefoneNumero] = useState(parsedPhone.nationalNumber);
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  
  const [email, setEmail] = useState(usuario.email || '');
  const [dataNascimento, setDataNascimento] = useState(usuario.dataNascimento || '');
  const [estadoCivil, setEstadoCivil] = useState(usuario.estadoCivil || '');
  const [cep, setCep] = useState(usuario.cep || '');
  const [logradouro, setLogradouro] = useState(usuario.logradouro || '');
  const [numero, setNumero] = useState(usuario.numero || '');
  const [complemento, setComplemento] = useState(usuario.complemento || '');
  const [bairro, setBairro] = useState(usuario.bairro || '');
  const [cidade, setCidade] = useState(usuario.cidade || '');
  const [uf, setUf] = useState(usuario.uf || '');
  const [especialidades, setEspecialidades] = useState(usuario.especialidades || []);
  const [saving, setSaving] = useState(false);
  const [selectedFuncs, setSelectedFuncs] = useState(usuario.customizouPermissoes ? (usuario.permissoes || []) : []);
  const [hasUserChangedLevel, setHasUserChangedLevel] = useState(false);
  const isCustomizedRef = React.useRef(usuario.customizouPermissoes);

  const isUserOwner = (usuario.perfilAcessoCodigo || '').toUpperCase() === 'DONO';
  const isSelfEdit = String(usuario.id) === String(currentRoleUserId);
  const isDono = papel === 'DONO';
  // O DONO pode ter um cargo (role) na clínica — apenas o nível de acesso (perfilAcesso) fica bloqueado
  const lockNivelField = isUserOwner;
  // E-mail também fica bloqueado para o próprio dono editando a si mesmo
  const lockEmailField = isUserOwner || (isSelfEdit && isDono);

  const handleCepChangeEdit = async (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let formattedCep = rawValue;
    if (rawValue.length > 5) {
      formattedCep = rawValue.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setCep(formattedCep);

    if (rawValue.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setUf(data.uf || '');
          // foca no número
          document.getElementById('edit-numero')?.focus();
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  useEffect(() => {
    // Se o usuário tinha permissões customizadas E o dropdown de nível nunca foi tocado, manter os dados do BD
    if (isCustomizedRef.current && !hasUserChangedLevel) {
      return;
    }
    
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
  }, [perfilAcessoId, perfisAcesso, isUserOwner, hasUserChangedLevel]);

  const handleRoleChangeEdit = (selectedRoleId) => {
    setRoleId(selectedRoleId);
    // Não altera o nível de acesso do DONO — ele fica sempre bloqueado
    if (isUserOwner) return;
    const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));
    if (selectedRole) {
      const presetId = getPresetProfileId(selectedRole.nome, perfisAcesso);
      if (presetId) {
        setHasUserChangedLevel(true);
        setPerfilAcessoId(presetId);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await equipeApi.update(usuario.id, {
        usuarioId: usuario.usuarioId || usuario.usuario?.id,
        nomeCompleto: nome,
        email: email,
        telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || "",
        roleId: roleId || null,
        perfilAcessoId: perfilAcessoId || null,
        dataNascimento: dataNascimento || null,
        estadoCivil: estadoCivil || "",
        cep: cep || "",
        logradouro: logradouro || "",
        numero: numero || "",
        complemento: complemento || "",
        bairro: bairro || "",
        cidade: cidade || "",
        uf: uf || "",
        especialidades: especialidades,
        customizouPermissoes: true,
        permissoesCustomizadas: selectedFuncs
      });
      toast.success('Acesso atualizado com sucesso.');
      onSuccess();
    } catch (err) {
      console.error('Erro ao atualizar papel:', err);
      toast.error(getApiErrorToastMessage(err, 'Erro ao atualizar acesso.'));
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
    <div 
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4 md:p-6 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full h-[100dvh] sm:h-auto max-w-full sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto rounded-none sm:rounded-3xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 transition-all duration-300 sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl">
              <Edit2 className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{readOnly ? 'Visualizar Acesso' : 'Editar Acesso'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{readOnly ? 'Visualize as informações do membro da equipe.' : 'Atualize as informações e permissões do membro da equipe.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 transition-colors touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto [webkit-overflow-scrolling:touch] pr-1 space-y-6 pb-4">
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
                    disabled={readOnly}
                    maxLength={80}
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1">
                    <span>CPF (Não editável)</span>
                    {usuario.cpf && (
                      <button 
                        type="button" 
                        onClick={() => setShowCpf(!showCpf)}
                        className="text-teal-600 hover:text-teal-700 p-0.5"
                      >
                        {showCpf ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input 
                      disabled
                      value={usuario.cpf || 'Não informado'}
                      className={`w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[14px] text-slate-500 outline-none cursor-not-allowed shadow-sm ${!showCpf && usuario.cpf ? 'filter blur-sm select-none' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Data de Nascimento</label>
                  <input 
                    type="date"
                    disabled={readOnly}
                    value={dataNascimento}
                    onChange={e => setDataNascimento(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Estado Civil</label>
                  <select 
                    value={estadoCivil}
                    disabled={readOnly}
                    onChange={e => setEstadoCivil(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm appearance-none ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  >
                    <option value="">Selecione...</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIUVO">Viúvo(a)</option>
                    <option value="SEPARADO">Separado(a)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Nova Seção: Endereço */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-indigo-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[14px] font-bold text-white shadow-sm">
                  <MapPin className="h-4 w-4" />
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-indigo-600')}>Endereço</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CEP</label>
                  <input 
                    maxLength={9}
                    disabled={readOnly}
                    placeholder="00000-000"
                    value={cep}
                    onChange={handleCepChangeEdit}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Logradouro</label>
                  <input 
                    maxLength={150}
                    disabled={readOnly}
                    value={logradouro}
                    onChange={e => setLogradouro(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Número</label>
                  <input 
                    id="edit-numero"
                    maxLength={20}
                    disabled={readOnly}
                    value={numero}
                    onChange={e => setNumero(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Complemento</label>
                  <input 
                    maxLength={100}
                    disabled={readOnly}
                    value={complemento}
                    onChange={e => setComplemento(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Bairro</label>
                  <input 
                    maxLength={100}
                    disabled={readOnly}
                    value={bairro}
                    onChange={e => setBairro(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cidade</label>
                  <input 
                    maxLength={100}
                    disabled={readOnly}
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">UF</label>
                  <select 
                    value={uf}
                    disabled={readOnly}
                    onChange={e => setUf(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm appearance-none ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  >
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  <Phone className="h-4 w-4" />
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
                    disabled={readOnly || lockEmailField}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${(readOnly || lockEmailField) ? 'bg-slate-50/70 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Telefone Celular <span className="font-normal text-slate-400 normal-case">(Opcional)</span>
                  </label>
                  <div className={phoneWrapClass()}>
                    <select
                      value={telefoneCountryCode}
                      disabled={readOnly}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero('');
                      }}
                      className={`w-16 bg-transparent text-[14px] font-medium text-slate-700 outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
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
                        disabled={readOnly}
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

            {/* Seção Especialidades (Opcional) */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-pink-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-[14px] font-bold text-white shadow-sm">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h4 className={sectionHeadingCls('text-[18px] font-bold text-pink-600')}>Especialidades Clínicas</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione as especialidades de atuação (opcional).</p>
                </div>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                {especialidadesList && especialidadesList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {especialidadesList.map(esp => {
                      const isSelected = especialidades.includes(esp.id);
                      return (
                        <label 
                          key={esp.id} 
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-pink-300 bg-pink-50 text-pink-900 shadow-sm' 
                              : 'border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/30'
                          }`}
                        >
                          <div className="flex items-center h-5">
                            <input 
                              type="checkbox"
                              disabled={readOnly}
                              className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEspecialidades([...especialidades, esp.id]);
                                } else {
                                  setEspecialidades(especialidades.filter(id => id !== esp.id));
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{esp.nome}</span>
                            <span className="text-[11px] text-slate-500 leading-tight mt-0.5">{esp.descricao}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    Nenhuma especialidade cadastrada no sistema.
                  </div>
                )}
              </div>
            </div>

            {/* Seção 3: Acesso e Permissões */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                  <Shield className="h-4 w-4" />
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
                    disabled={readOnly}
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
                      disabled={readOnly}
                      onChange={e => {
                        setHasUserChangedLevel(true);
                        setPerfilAcessoId(e.target.value);
                      }}
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
                  <Settings2 className="h-4 w-4" />
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
                                    isUserOwner || readOnly
                                      ? 'cursor-not-allowed opacity-60' 
                                      : 'cursor-pointer hover:bg-slate-100/50'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isUserOwner || readOnly}
                                    onChange={() => {
                                      if (isUserOwner || readOnly) return;
                                      setSelectedFuncs(prev => 
                                        prev.includes(item.id) 
                                          ? prev.filter(id => id !== item.id) 
                                          : [...prev, item.id]
                                      );
                                    }}
                                    className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${
                                      isUserOwner || readOnly ? 'cursor-not-allowed' : 'cursor-pointer'
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
          
          <div className="mt-4 border-t border-slate-100 pt-4 shrink-0 bg-white md:bg-transparent">
            {readOnly ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="w-full sm:w-32 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-all touch-manipulation">Fechar</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
