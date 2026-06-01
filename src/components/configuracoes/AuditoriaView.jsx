import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Calendar,
  FileText,
  History,
  Activity,
  Clock,
} from 'lucide-react';
import { auditoriaApi, equipeApi } from '../../services/api';

// ─── Constantes de domínio ───────────────────────────────────────────────────

const ACOES_MAP = {
  // Paciente
  CRIAR_PACIENTE:         { label: 'Criou paciente',        cor: 'green' },
  EDITAR_PACIENTE:        { label: 'Editou paciente',        cor: 'blue' },
  DESATIVAR_PACIENTE:     { label: 'Inativou paciente',      cor: 'red' },
  REATIVAR_PACIENTE:      { label: 'Reativou paciente',      cor: 'green' },
  
  // Agenda & Agendamento
  CRIAR_AGENDAMENTO:      { label: 'Criou agendamento',      cor: 'green' },
  REMOVER_AGENDAMENTO:    { label: 'Removeu agendamento',    cor: 'red' },
  CRIAR_AGENDA:           { label: 'Criou agenda',           cor: 'green' },
  EDITAR_AGENDA:          { label: 'Editou agenda',          cor: 'blue' },
  CANCELAR_AGENDA:        { label: 'Cancelou agenda',        cor: 'red' },
  REAGENDAR_AGENDA:       { label: 'Reagendou agenda',       cor: 'purple' },
  
  // Procedimento & Notas
  INICIAR_PROCEDIMENTO:   { label: 'Iniciou procedimento',   cor: 'blue' },
  FINALIZAR_PROCEDIMENTO: { label: 'Finalizou procedimento', cor: 'purple' },
  CRIAR_NOTA:             { label: 'Criou nota',             cor: 'green' },
  EDITAR_NOTA:            { label: 'Editou nota',            cor: 'blue' },
  REMOVER_NOTA:           { label: 'Removeu nota',           cor: 'red' },
  
  // Anamnese
  PREENCHER_ANAMNESE:     { label: 'Preencheu anamnese',     cor: 'blue' },
  FINALIZAR_ANAMNESE:     { label: 'Finalizou anamnese',     cor: 'purple' },
  CRIAR_CATEGORIA_ANAMNESE:   { label: 'Criou categoria',    cor: 'green' },
  EDITAR_CATEGORIA_ANAMNESE:  { label: 'Editou categoria',   cor: 'blue' },
  DESATIVAR_CATEGORIA_ANAMNESE: { label: 'Desativou categoria', cor: 'red' },
  CRIAR_PERGUNTA_ANAMNESE:    { label: 'Criou pergunta',     cor: 'green' },
  EDITAR_PERGUNTA_ANAMNESE:   { label: 'Editou pergunta',    cor: 'blue' },
  DESATIVAR_PERGUNTA_ANAMNESE: { label: 'Desativou pergunta', cor: 'red' },
  CRIAR_FICHA_ANAMNESE:       { label: 'Criou ficha',        cor: 'green' },
  EDITAR_FICHA_ANAMNESE:      { label: 'Editou ficha',       cor: 'blue' },
  DESATIVAR_FICHA_ANAMNESE:   { label: 'Desativou ficha',    cor: 'red' },
  
  // Equipe & Usuário
  CRIAR_PROFISSIONAL:     { label: 'Criou profissional',    cor: 'green' },
  EDITAR_PROFISSIONAL:    { label: 'Editou profissional',   cor: 'blue' },
  DESATIVAR_PROFISSIONAL: { label: 'Desativou profissional', cor: 'red' },
  CRIAR_USUARIO:          { label: 'Criou login',           cor: 'green' },
  EDITAR_USUARIO:         { label: 'Editou login',          cor: 'blue' },
  DESATIVAR_USUARIO:      { label: 'Desativou login',       cor: 'red' },
  UPLOAD_FOTO_PERFIL:     { label: 'Alterou foto perfil',   cor: 'blue' },
  EDITAR_PERFIL_PROPRIO:  { label: 'Editou próprio perfil', cor: 'blue' },
  EDITAR_ASSINATURA_PERFIL: { label: 'Alterou assinatura',  cor: 'blue' },
  
  // Clínica & Termos
  EDITAR_DADOS_CLINICA:   { label: 'Editou dados clínica',  cor: 'blue' },
  UPLOAD_LOGO_CLINICA:    { label: 'Alterou logo clínica',  cor: 'blue' },
  EDITAR_HORARIO_CLINICA: { label: 'Editou horários clínica', cor: 'blue' },
  CRIAR_TERMO_CONSENTIMENTO: { label: 'Criou termo',         cor: 'green' },
  EDITAR_TERMO_CONSENTIMENTO: { label: 'Editou termo',        cor: 'blue' },
  REMOVER_TERMO_CONSENTIMENTO: { label: 'Removeu termo',      cor: 'red' },
  ASSINAR_TERMO:          { label: 'Assinou termo',          cor: 'purple' },

  // Agenda Config
  EDITAR_HORARIO_AGENDA:  { label: 'Editou horários profissional', cor: 'blue' },
  SINCRONIZAR_HORARIO_AGENDA: { label: 'Sincronizou horários', cor: 'blue' },
  CRIAR_FERIADO:          { label: 'Criou feriado',          cor: 'green' },
  DESATIVAR_FERIADO:      { label: 'Removeu feriado',        cor: 'red' },
  EDITAR_TEMPLATE_LEMBRETE: { label: 'Editou lembrete',      cor: 'blue' },
  EDITAR_TEMPLATE_CONFIRMACAO: { label: 'Editou confirmação', cor: 'blue' },
};

const BADGE_CORES = {
  green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
  blue:   'bg-blue-50 border-blue-100 text-blue-700',
  red:    'bg-rose-50 border-rose-100 text-rose-700',
  purple: 'bg-indigo-50 border-indigo-100 text-indigo-700',
};

const PERIODOS = [
  { value: '',       label: 'Todos' },
  { value: '1h',     label: 'Última hora' },
  { value: 'hoje',   label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes',    label: 'Este mês' },
  { value: 'ano',    label: 'Este ano' },
];

const ORDENACOES = [
  { value: 'desc', label: 'Mais recentes primeiro' },
  { value: 'asc',  label: 'Mais antigas primeiro' },
];

const PAGE_SIZE = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcularDataLimite(periodo) {
  const agora = new Date();
  if (periodo === '1h')     return new Date(agora - 60 * 60 * 1000);
  if (periodo === 'hoje')   return new Date(agora.setHours(0, 0, 0, 0));
  if (periodo === 'semana') return new Date(agora - 7 * 24 * 60 * 60 * 1000);
  if (periodo === 'mes')    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  if (periodo === 'ano')    return new Date(agora.getFullYear(), 0, 1);
  return null;
}

function formatarEntidade(ent) {
  if (!ent) return '-';
  const normalized = ent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized === 'clinica') return 'Clínica';
  return ent
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIconForEntidade(ent) {
  switch (ent?.toLowerCase()) {
    case 'paciente':     return <User className="h-3.5 w-3.5" />;
    case 'agenda':       return <Calendar className="h-3.5 w-3.5" />;
    case 'agendamento':  return <Calendar className="h-3.5 w-3.5" />;
    case 'procedimento': return <Activity className="h-3.5 w-3.5" />;
    default:             return <FileText className="h-3.5 w-3.5" />;
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AuditoriaView() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [equipe, setEquipe]       = useState([]);

  const [filtroRoleUserId, setFiltroRoleUserId] = useState('');
  const [filtroPeriodo, setFiltroPeriodo]       = useState('');
  const [ordenacao, setOrdenacao]               = useState('desc');
  const [pagina, setPagina]                     = useState(1);

  useEffect(() => {
    fetchEquipe();
    fetchAuditoria();
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [filtroRoleUserId, filtroPeriodo, ordenacao]);

  async function fetchEquipe() {
    try {
      const res = await equipeApi.list();
      setEquipe(res || []);
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    }
  }

  async function fetchAuditoria() {
    setLoading(true);
    try {
      const res = await auditoriaApi.list({ page: 0, size: 200 });
      setRegistros(res?.content || []);
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtrados = useMemo(() => {
    let lista = registros;
    if (filtroPeriodo) {
      const limite = calcularDataLimite(filtroPeriodo);
      if (limite) lista = lista.filter((r) => new Date(r.criadoEm) >= limite);
    }
    if (filtroRoleUserId) {
      lista = lista.filter((r) => r.roleUserId === filtroRoleUserId);
    }
    return [...lista].sort((a, b) => {
      const diff = new Date(b.criadoEm) - new Date(a.criadoEm);
      return ordenacao === 'asc' ? -diff : diff;
    });
  }, [registros, filtroPeriodo, filtroRoleUserId, ordenacao]);

  const totalPaginas  = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const itensDaPagina = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const selectCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 appearance-none shadow-sm';

  // ── Estado vazio / loading compartilhado ──
  const emptyState = loading ? (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
      <span className="text-[15px] font-semibold text-slate-700">Carregando histórico...</span>
    </div>
  ) : itensDaPagina.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-20 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <History className="h-8 w-8 text-slate-400" />
      </div>
      <div>
        <h4 className="text-lg font-bold text-slate-900">Nenhuma ação encontrada</h4>
        <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm mx-auto">Nenhum registro de auditoria corresponde aos filtros aplicados.</p>
      </div>
    </div>
  ) : null;

  // ── Rodapé de paginação ──
  const paginacaoFooter = !loading && (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-6 py-4 rounded-b-2xl">
      <span className="text-sm font-medium text-slate-500">
        {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
        {filtroPeriodo || filtroRoleUserId ? ' encontrados' : ' no total'}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina === 1}
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          ← Anterior
        </button>
        <span className="px-2 text-sm font-bold text-slate-600 tabular-nums">
          {pagina} / {totalPaginas}
        </span>
        <button
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={pagina >= totalPaginas}
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          Próxima →
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        {/* Profissional */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
            Profissional
          </label>
          <div className="relative">
            <select
              value={filtroRoleUserId}
              onChange={(e) => setFiltroRoleUserId(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos os profissionais</option>
              {equipe.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nomeCompleto}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Período */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
            Período
          </label>
          <div className="relative">
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className={selectCls}
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ordenação */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
            Ordenação
          </label>
          <div className="relative">
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className={selectCls}
            >
              {ORDENACOES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── MOBILE: Cards (até md) ── */}
      <div className="flex flex-col gap-4 lg:hidden">
        {emptyState ?? itensDaPagina.map((item) => {
          const acao = ACOES_MAP[item.acao] ?? { label: item.acao?.replace(/_/g, ' ') || 'Ação', cor: 'blue' };
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              {/* linha 1: avatar + nome + badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a88e] to-teal-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {item.nomeUsuario?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-base text-slate-900 truncate leading-tight">
                      {item.nomeUsuario}
                    </div>
                    <div className="text-xs font-medium text-slate-400 truncate mt-0.5">{item.papel}</div>
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 border rounded-md text-[10px] uppercase tracking-wider font-bold ${BADGE_CORES[acao.cor]}`}>
                  {acao.label}
                </span>
              </div>

              {/* linha 2: data + entidade */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50/80 p-3 border border-slate-100/50">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {formatData(item.criadoEm)}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                  <div className="text-slate-400">{getIconForEntidade(item.entidade)}</div>
                  {formatarEntidade(item.entidade)}
                </span>
              </div>

              {/* linha 3: descrição (se existir) */}
              {item.descricao && (
                <p className="mt-3 text-[13px] text-slate-500 leading-relaxed">
                  {item.descricao}
                </p>
              )}
            </div>
          );
        })}

        {/* paginação mobile */}
        {!loading && itensDaPagina.length > 0 && (
          <div className="flex items-center justify-between pt-2 px-1">
            <span className="text-xs font-medium text-slate-500">
              {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                ←
              </button>
              <span className="text-xs font-bold text-slate-600 tabular-nums">{pagina} / {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP: Tabela (md+) ── */}
      <div className="hidden lg:block rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data e Hora</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Profissional</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ação Realizada</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Módulo / Entidade</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
                      </div>
                      <span className="text-[15px] font-semibold text-slate-700">Carregando histórico...</span>
                    </div>
                  </td>
                </tr>
              ) : itensDaPagina.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-sm ring-1 ring-slate-900/5">
                        <History className="h-8 w-8 text-slate-400" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[16px] font-bold text-slate-900">Nenhuma ação encontrada</span>
                        <span className="text-sm font-medium text-slate-500">Nenhum registro de auditoria corresponde aos filtros aplicados.</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                itensDaPagina.map((item) => {
                  const acao = ACOES_MAP[item.acao] ?? { label: item.acao?.replace(/_/g, ' ') || 'Ação', cor: 'blue' };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-600">
                        {formatData(item.criadoEm)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00a88e] to-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                            {item.nomeUsuario?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-[14px] text-slate-900 group-hover:text-teal-700 transition-colors">{item.nomeUsuario}</span>
                            <span className="text-[12px] font-medium text-slate-400">{item.papel}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${BADGE_CORES[acao.cor]}`}>
                          {acao.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                          <div className="text-slate-400">{getIconForEntidade(item.entidade)}</div>
                          {formatarEntidade(item.entidade)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-slate-500 max-w-xs truncate" title={item.descricao || ''}>
                        {item.descricao || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {paginacaoFooter}
      </div>
    </div>
  );
}
