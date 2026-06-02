import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Clock,
  Search,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { auditoriaApi, equipeApi } from '../../services/api';
import { AuditoriaDetailsModal } from './AuditoriaDetailsModal';
import { formatData, formatarEntidade, getIconForEntidade, ACOES_MAP, BADGE_CORES } from './AuditoriaUtils';

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

function calcularDataLimite(periodo) {
  const agora = new Date();
  if (periodo === '1h')     return new Date(agora - 60 * 60 * 1000);
  if (periodo === 'hoje')   return new Date(agora.setHours(0, 0, 0, 0));
  if (periodo === 'semana') return new Date(agora - 7 * 24 * 60 * 60 * 1000);
  if (periodo === 'mes')    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  if (periodo === 'ano')    return new Date(agora.getFullYear(), 0, 1);
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AuditoriaView() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [equipe, setEquipe]       = useState([]);

  const [filtroRoleUserId, setFiltroRoleUserId] = useState('');
  const [filtroPeriodo, setFiltroPeriodo]       = useState('');
  const [busca, setBusca]                       = useState('');
  const [filtroSuspeito, setFiltroSuspeito]     = useState(false);
  const [ordenacao, setOrdenacao]               = useState('desc');
  const [pagina, setPagina]                     = useState(1);
  const [selectedRegistro, setSelectedRegistro] = useState(null);

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
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(r => 
        r.nomeUsuario?.toLowerCase().includes(q) ||
        r.acao?.toLowerCase().includes(q) ||
        r.entidade?.toLowerCase().includes(q) ||
        r.descricao?.toLowerCase().includes(q) ||
        r.ipOrigem?.toLowerCase().includes(q)
      );
    }
    if (filtroSuspeito) {
      lista = lista.filter(r => r.suspeito === true);
    }
    return [...lista].sort((a, b) => {
      const diff = new Date(b.criadoEm) - new Date(a.criadoEm);
      return ordenacao === 'asc' ? -diff : diff;
    });
  }, [registros, filtroPeriodo, filtroRoleUserId, busca, filtroSuspeito, ordenacao]);

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

  const exportarParaPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(18);
        doc.text('Relatório de Auditoria e Segurança', 14, 22);
        
        doc.setFontSize(11);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

        const tableColumn = ["Data", "Profissional", "Ação", "Módulo", "Descrição", "IP", "Suspeito?"];
        const tableRows = [];

        filtrados.forEach(item => {
          const rowData = [
            formatData(item.criadoEm),
            item.nomeUsuario,
            item.acao,
            item.entidade,
            item.descricao || '-',
            item.ipOrigem || 'Desconhecido',
            item.suspeito ? 'SIM' : 'NÃO'
          ];
          tableRows.push(rowData);
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 35,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [0, 168, 142] }
        });

        doc.save('relatorio_auditoria.pdf');
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Botões de Ação ── */}
      <div className="flex justify-end">
        <button
          onClick={exportarParaPDF}
          disabled={loading || filtrados.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          Exportar para PDF
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        
        {/* Busca */}
        <div className="flex flex-col gap-2 lg:col-span-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
            Busca Rápida
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Ex: Deletar, IP, Nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`${selectCls} pl-10`}
            />
          </div>
        </div>
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
        {/* Ações Suspeitas */}
        <div className="flex flex-col gap-2 justify-end sm:col-span-2 lg:col-span-5 border-t border-slate-100 pt-3 mt-1">
          <label className="flex items-center gap-2 cursor-pointer w-max">
            <input 
              type="checkbox" 
              className="hidden" 
              checked={filtroSuspeito} 
              onChange={() => setFiltroSuspeito(!filtroSuspeito)} 
            />
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${filtroSuspeito ? 'bg-red-500' : 'bg-slate-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${filtroSuspeito ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-bold text-slate-700 select-none">
              Mostrar apenas Ações Suspeitas
            </span>
          </label>
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
              {item.suspeito && (
                <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-100 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  AÇÃO SUSPEITA DETECTADA
                </div>
              )}

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

              {/* linha 3: descrição + botão de detalhes */}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[13px] text-slate-500 leading-relaxed truncate max-w-[70%]" title={item.descricao || ''}>
                  {item.descricao || '-'}
                </p>
                <button
                  onClick={() => setSelectedRegistro(item)}
                  className="shrink-0 text-teal-600 hover:text-teal-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-teal-100 bg-teal-50/50 hover:bg-teal-100/50 transition-colors"
                >
                  Ver Detalhes
                </button>
              </div>
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
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Descrição</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Ações</th>
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
                        {item.suspeito && (
                          <div className="mt-1 flex items-center gap-1 text-red-600 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" /> SUSPEITO
                          </div>
                        )}
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
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedRegistro(item)}
                          className="text-teal-600 hover:text-teal-700 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-teal-100 bg-teal-50/50 hover:bg-teal-100/50 transition-colors uppercase tracking-wider"
                        >
                          Detalhes
                        </button>
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

      <AuditoriaDetailsModal 
        registro={selectedRegistro} 
        onClose={() => setSelectedRegistro(null)} 
      />
    </div>
  );
}
