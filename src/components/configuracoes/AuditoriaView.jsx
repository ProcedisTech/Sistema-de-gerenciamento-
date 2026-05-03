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
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
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
    'h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#0f172a] focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]';

  // ── Estado vazio / loading compartilhado ──
  const emptyState = loading ? (
    <div className="flex flex-col items-center gap-2 py-16 text-[#64748b]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a88e] border-t-transparent" />
      <span className="text-sm font-medium">Carregando histórico...</span>
    </div>
  ) : itensDaPagina.length === 0 ? (
    <div className="flex flex-col items-center gap-3 py-16 text-[#94a3b8]">
      <History className="h-10 w-10 opacity-20" />
      <span className="text-sm font-medium">Nenhuma ação encontrada</span>
    </div>
  ) : null;

  // ── Rodapé de paginação ──
  const paginacaoFooter = !loading && (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
      <span className="text-xs text-gray-500">
        {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
        {filtroPeriodo || filtroRoleUserId ? ' encontrados' : ' no total'}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina === 1}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          {pagina}/{totalPaginas}
        </span>
        <button
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={pagina >= totalPaginas}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          Próxima →
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 gap-3 border-b border-[#e2e8f0] pb-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Profissional */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Profissional
          </label>
          <select
            value={filtroRoleUserId}
            onChange={(e) => setFiltroRoleUserId(e.target.value)}
            className={selectCls}
          >
            <option value="">Todos</option>
            {equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nomeCompleto}
              </option>
            ))}
          </select>
        </div>

        {/* Período */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Período
          </label>
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

        {/* Ordenação */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Ordenação
          </label>
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

      {/* ── MOBILE: Cards (até md) ── */}
      <div className="flex flex-col gap-2 lg:hidden">
        {emptyState ?? itensDaPagina.map((item) => {
          const acao = ACOES_MAP[item.acao] ?? { label: item.acao, cor: 'blue' };
          return (
            <div
              key={item.id}
              className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm"
            >
              {/* linha 1: avatar + nome + badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {item.nomeUsuario?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-[#0f172a] truncate">
                      {item.nomeUsuario}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{item.papel}</div>
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_CORES[acao.cor]}`}>
                  {acao.label}
                </span>
              </div>

              {/* linha 2: data + entidade */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatData(item.criadoEm)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  {getIconForEntidade(item.entidade)}
                  {formatarEntidade(item.entidade)}
                </span>
              </div>

              {/* linha 3: descrição (se existir) */}
              {item.descricao && (
                <p className="mt-2 text-xs text-gray-400 leading-relaxed border-t border-gray-50 pt-2">
                  {item.descricao}
                </p>
              )}
            </div>
          );
        })}

        {/* paginação mobile */}
        {!loading && itensDaPagina.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-500">
              {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                ←
              </button>
              <span className="text-xs text-gray-500 tabular-nums">{pagina}/{totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP: Tabela (md+) ── */}
      <div className="hidden lg:block rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#f8fafc]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Data/Hora</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Usuário</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Ação</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Entidade</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#64748b]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a88e] border-t-transparent" />
                    <span className="font-medium">Carregando histórico...</span>
                  </div>
                </td>
              </tr>
            ) : itensDaPagina.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#94a3b8]">
                    <History className="h-10 w-10 opacity-20" />
                    <span className="font-medium text-[14px]">Nenhuma ação encontrada</span>
                  </div>
                </td>
              </tr>
            ) : (
              itensDaPagina.map((item) => {
                const acao = ACOES_MAP[item.acao] ?? { label: item.acao, cor: 'blue' };
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-[#0f172a]">
                      {formatData(item.criadoEm)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {item.nomeUsuario?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-[#0f172a]">{item.nomeUsuario}</div>
                          <div className="text-xs text-gray-400">{item.papel}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${BADGE_CORES[acao.cor]}`}>
                        {acao.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 text-[#64748b]">
                        {getIconForEntidade(item.entidade)}
                        <span className="font-medium">{formatarEntidade(item.entidade)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400 leading-relaxed max-w-[300px]">
                      {item.descricao || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {paginacaoFooter}
      </div>
    </div>
  );
}
