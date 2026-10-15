import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PrototypeIcon } from './PrototypeIcon';
import './auditoria.css';
import { auditoriaApi, equipeApi, clinicaApi } from '../../services/api';
import { AuditoriaDetailsModal } from './AuditoriaDetailsModal';
import { dentroDoPeriodo, formatData, formatarEntidade, ACOES_MAP, auditReportClinic } from './AuditoriaUtils';
import { formatarInstante } from '../../utils/datasClinica';
import { useFusoClinica } from '../hooks/useFusoClinica';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';
import { usePapel } from '../../hooks/usePapel';
import { useToast } from '../../contexts/useToast.js';

const PERIODOS = [
  { value: '', label: 'Todo o período' },
  { value: '1h', label: 'Última hora' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'ano', label: 'Este ano' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
];

const ORDENACOES = [
  { value: 'desc', label: 'Mais recentes primeiro' },
  { value: 'asc', label: 'Mais antigas primeiro' },
];

const PAGE_SIZE = 5;

// ─── Componente principal ─────────────────────────────────────────────────────

export function AuditoriaView({ roleUserId } = {}) {
  const { canExportPdf } = usePapel();
  const toast = useToast();
  const { fuso } = useFusoClinica();

  const [registros, setRegistros] = useState([]);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [totalNoBanco, setTotalNoBanco] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [erroEquipe, setErroEquipe] = useState('');
  const [exportando, setExportando] = useState(false);
  const [equipe, setEquipe] = useState([]);
  const [clinica, setClinica] = useState(null);
  const [erroClinica, setErroClinica] = useState('');

  const [filtroRoleUserId, setFiltroRoleUserId] = useState(roleUserId || '');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroSuspeito, setFiltroSuspeito] = useState(false);
  const [ordenacao, setOrdenacao] = useState('desc');
  const [pagina, setPagina] = useState(1);
  const [selectedRegistro, setSelectedRegistro] = useState(null);

  useEffect(() => {
    fetchEquipe();
    fetchAuditoria();
    fetchClinica();
  }, []);

  useEffect(() => {
    if (roleUserId) setFiltroRoleUserId(roleUserId);
  }, [roleUserId]);

  useEffect(() => {
    setPagina(1);
  }, [filtroRoleUserId, filtroPeriodo, filtroAcao, busca, filtroSuspeito, ordenacao]);

  async function fetchEquipe() {
    setErroEquipe('');
    try {
      const res = await equipeApi.list();
      setEquipe(res || []);
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
      setErroEquipe('Não foi possível carregar a lista da equipe.');
    }
  }

  async function fetchClinica() {
    setErroClinica('');
    try {
      const res = await clinicaApi.buscar();
      setClinica(res);
    } catch (err) {
      console.error('Erro ao buscar clínica:', err);
      setErroClinica('Não foi possível carregar os dados da clínica para o relatório.');
    }
  }

  async function fetchAuditoria() {
    setLoading(true);
    setErro('');
    try {
      const res = await auditoriaApi.list({ page: 0, size: 200 });
      setRegistros(res?.content || []);
      setTotalNoBanco(res?.totalElements ?? (res?.content || []).length);
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err);
      setErro('Não foi possível carregar o histórico de auditoria. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const filtrados = useMemo(() => {
    let lista = registros;
    if (filtroPeriodo) {
      const agoraMs = Date.now();
      lista = lista.filter((r) => dentroDoPeriodo(r.criadoEm, filtroPeriodo, fuso, agoraMs));
    }
    if (filtroRoleUserId) {
      lista = lista.filter((r) => r.roleUserId === filtroRoleUserId);
    }
    if (filtroAcao) {
      lista = lista.filter((r) => r.acao === filtroAcao);
    }
    if (busca.trim()) {
      const q = busca.trim().toLocaleLowerCase('pt-BR');
      lista = lista.filter(r =>
        r.nomeUsuario?.toLowerCase().includes(q) ||
        r.papel?.toLowerCase().includes(q) ||
        r.perfilAcessoNome?.toLowerCase().includes(q) ||
        r.permissaoNome?.toLowerCase().includes(q) ||
        r.permissaoCodigo?.toLowerCase().includes(q) ||
        r.permissaoModulo?.toLowerCase().includes(q) ||
        r.acao?.toLowerCase().includes(q) ||
        ACOES_MAP[r.acao]?.label?.toLocaleLowerCase('pt-BR').includes(q) ||
        r.entidade?.toLowerCase().includes(q) ||
        r.descricao?.toLowerCase().includes(q) ||
        r.ipOrigem?.toLowerCase().includes(q) ||
        r.userAgent?.toLowerCase().includes(q) ||
        r.motivoSuspeita?.toLowerCase().includes(q)
      );
    }
    if (filtroSuspeito) {
      lista = lista.filter(r => (r.suspeito ?? r.isSuspeito) === true);
    }
    return [...lista].sort((a, b) => {
      const diff = new Date(b.criadoEm) - new Date(a.criadoEm);
      return ordenacao === 'asc' ? -diff : diff;
    });
  }, [registros, filtroPeriodo, filtroRoleUserId, filtroAcao, busca, filtroSuspeito, ordenacao, fuso]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const itensDaPagina = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);
  const registrosTruncados = totalNoBanco > registros.length;

  const selectCls = 'inp';
  const buttonCls = 'btn-s';
  const acoesDisponiveis = [...new Set([...Object.keys(ACOES_MAP), ...registros.map((r) => r.acao).filter(Boolean)])]
    .sort((a, b) => (ACOES_MAP[a]?.label || a).localeCompare(ACOES_MAP[b]?.label || b, 'pt-BR'));
  const pessoasDisponiveis = new Map(equipe.map((u) => [u.id, u.nomeCompleto]));
  registros.forEach((r) => { if (r.roleUserId && !pessoasDisponiveis.has(r.roleUserId)) pessoasDisponiveis.set(r.roleUserId, r.nomeUsuario || 'Nome não registrado'); });
  const suspeitas = filtrados.filter((r) => (r.suspeito ?? r.isSuspeito) === true).length;
  const pessoasAtivas = new Set(filtrados.map((r) => r.roleUserId).filter(Boolean)).size;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const limparFiltros = () => {
    setBusca(''); setFiltroPeriodo(''); setFiltroRoleUserId(roleUserId || ''); setFiltroAcao(''); setFiltroSuspeito(false); setOrdenacao('desc'); setPagina(1);
  };

function sanitizeForPdf(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2190-\u21FF\u2790-\u27BF]/g, ' -> ')
    .replace(/➔|➜|→|➡/g, ' -> ')
    .replace(/—|–/g, ' - ')
    .replace(/[•·]/g, ' | ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n/g, '\n')
    .trim();
}

function formatDescricaoForPdf(desc) {
  if (!desc) return '-';
  const clean = sanitizeForPdf(desc);
  if (clean.includes(' - Alterado: ')) {
    const parts = clean.split(' - Alterado: ');
    const titulo = parts[0];
    const diffs = parts[1];
    return `${titulo}\nAlterado: ${diffs}`;
  }
  return clean;
}

  const exportarParaPDF = async () => {
    if (!canExportPdf || exportando || loading || erro || !clinica || erroClinica || filtrados.length === 0) return;
    setExportando(true);
    try {
      await auditoriaApi.registrarExportacao();
    } catch (err) {
      console.error('Erro ao registrar exportação na auditoria:', err);
      toast.error('Não foi possível registrar a auditoria da exportação. PDF não gerado.');
      setExportando(false);
      return;
    }

    try {
      const doc = new jsPDF('landscape');
      const identity = auditReportClinic(clinica);
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      const margin = 16;
      doc.setFontSize(11);
      const clinicLines = doc.splitTextToSize(sanitizeForPdf(identity.nome), width - 2 * margin - 40);
      const context = `${filtroSuspeito ? 'Apenas ações suspeitas' : 'Todas as sinalizações'} | ${ordenacao === 'asc' ? 'Mais antigas primeiro' : 'Mais recentes primeiro'}`;
      const limitLines = registrosTruncados
        ? doc.splitTextToSize(`Mostrando as ${registros.length} ações mais recentes de ${totalNoBanco} no total.`, width - 2 * margin)
        : [];
      const headerBottom = 44 + clinicLines.length * 5 + limitLines.length * 4;
      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 127, 107);
        doc.text('HISTÓRICO / AUDITORIA', margin, 16);
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text('Registro de atividades', margin, 26);
        doc.setFontSize(11);
        doc.text(clinicLines, margin, 34);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`CNPJ: ${identity.cnpj}`, margin, 34 + clinicLines.length * 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(15, 23, 42);
        doc.text(String(filtrados.length), width - margin, 24, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('registros', width - margin, 30, { align: 'right' });
        doc.setDrawColor(0, 168, 142);
        doc.setLineWidth(.5);
        const lineY = 39 + clinicLines.length * 5;
        doc.line(margin, lineY, width - margin, lineY);
        doc.text(context, margin, lineY + 6);
        if (limitLines.length) doc.text(limitLines, margin, lineY + 11);
      };
      const rows = filtrados.map((item) => {
        const action = ACOES_MAP[item.acao]?.label || item.acao?.replace(/_/g, ' ') || 'Ação';
        const suspicious = (item.suspeito ?? item.isSuspeito) === true;
        return [
          `${formatData(item.criadoEm, fuso)}\n\n${sanitizeForPdf(item.nomeUsuario || 'Não registrado')}\n${sanitizeForPdf(item.perfilAcessoNome || item.papel || 'Perfil não registrado')}`,
          `${sanitizeForPdf(action)}\n${sanitizeForPdf(item.permissaoModulo || formatarEntidade(item.entidade))}\n\n${formatDescricaoForPdf(item.descricao || item.permissaoDescricao || '')}`,
          `${suspicious ? 'Ação suspeita' : 'Sem sinalização'}${suspicious ? '\n' + sanitizeForPdf(item.motivoSuspeita || item.motivo || 'Conferir registro') : ''}\n\nIP: ${sanitizeForPdf(item.ipOrigem || 'Não registrado')}\n${sanitizeForPdf(item.userAgent || 'Dispositivo não registrado')}`,
        ];
      });
      const reportCellLines = new WeakMap();
      autoTable(doc, {
        head: [['DATA E RESPONSÁVEL', 'AÇÃO REALIZADA', 'ORIGEM E SINALIZAÇÃO']],
        body: rows,
        theme: 'plain',
        startY: headerBottom + 8,
        margin: { left: margin, right: margin, top: headerBottom + 8, bottom: 24 },
        rowPageBreak: 'avoid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top', textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: { bottom: .2 } },
        headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: (width - 2 * margin) * .24 }, 1: { cellWidth: (width - 2 * margin) * .43 }, 2: { cellWidth: (width - 2 * margin) * .33, fontSize: 8 } },
        willDrawPage: drawHeader,
        willDrawCell: (data) => {
          if (data.section !== 'body') return;
          reportCellLines.set(data.cell, data.cell.text);
          data.cell.text = [];
        },
        didDrawCell: (data) => {
          if (data.section !== 'body') return;
          const lines = reportCellLines.get(data.cell) || [];
          const size = data.cell.styles.fontSize;
          const lineHeight = size / doc.internal.scaleFactor * doc.getLineHeightFactor();
          const x = data.cell.x + data.cell.padding('left');
          let y = data.cell.y + data.cell.padding('top');
          const nameIndex = data.column.index === 0 ? lines.indexOf('') + 1 : -1;
          lines.forEach((line, index) => {
            const moduleLine = data.column.index === 1 && line === rows[data.row.index]?.[1].split('\n')[1];
            const strong = (data.column.index === 0 && index === nameIndex) || (data.column.index === 1 && index === 0);
            doc.setFont('helvetica', strong || moduleLine ? 'bold' : 'normal');
            doc.setFontSize(size);
            doc.setTextColor(...(moduleLine ? [0, 127, 107] : strong ? [15, 23, 42] : data.cell.styles.textColor));
            if (moduleLine && line) {
              doc.setFillColor(226, 247, 242);
              doc.roundedRect(x - 1, y - .5, Math.min(doc.getTextWidth(line) + 2, data.cell.width - 8), lineHeight + 1, 1, 1, 'F');
            }
            if (line) doc.text(line, x, y, { baseline: 'top' });
            y += lineHeight;
          });
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2 && (filtrados[data.row.index]?.suspeito ?? filtrados[data.row.index]?.isSuspeito)) {
            data.cell.styles.fillColor = [255, 241, 242];
            data.cell.styles.textColor = [153, 27, 27];
          }
        },
      });
      const generatedAt = formatarInstante(Date.now(), fuso, { dateStyle: 'short', timeStyle: 'short' });
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Sinalizações de ações suspeitas indicam necessidade de conferência e não confirmam uma irregularidade.', margin, height - 15);
        doc.text(`Gerado em: ${generatedAt}`, margin, height - 9);
        doc.text(`Página ${page} de ${pages}`, width - margin, height - 9, { align: 'right' });
      }
      doc.save('relatorio_auditoria.pdf');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <section className="prototype-equipe prototype-auditoria" aria-label="Histórico de auditoria">
      {!loading && registrosTruncados && !erro && <div className="hint" role="status"><PrototypeIcon name="info" size="s" /><span>Mostrando as {registros.length} ações mais recentes de {totalNoBanco} no total. Os filtros são aplicados apenas às ações carregadas.</span></div>}
      <div className="audit-summary">
        <div className="box"><span><small>Registros encontrados</small><b>{loading || erro ? '—' : filtrados.length}</b></span><PrototypeIcon name="hist" size="l" /></div>
        <div className={`box${suspeitas > 0 ? " alert" : ""}`}><span><small>Ações suspeitas</small><b>{loading || erro ? '—' : suspeitas}</b></span><PrototypeIcon name="info" size="l" /></div>
        <div className="box"><span><small>Pessoas com atividade</small><b>{loading || erro ? '—' : pessoasAtivas}</b></span><PrototypeIcon name="users" size="l" /></div>
      </div>
      <div className="box audit-content">
        <div className="audit-filter-heading"><PrototypeIcon name="search" size="s" /><h3>Filtrar histórico</h3></div>
        <div className="audit-filters">
          <label>Buscar registro<input className={selectCls} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pessoa, ação, perfil, módulo ou IP" /></label>
          <label>Período<select className={selectCls} value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>{PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
          <label>Responsável<select className={selectCls} value={filtroRoleUserId} onChange={(e) => setFiltroRoleUserId(e.target.value)}><option value="">Todas as pessoas</option>{[...pessoasDisponiveis].map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
          <label>Ação<select className={selectCls} value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)}><option value="">Todas as ações</option>{acoesDisponiveis.map((acao) => <option key={acao} value={acao}>{ACOES_MAP[acao]?.label || acao.replace(/_/g, ' ')}</option>)}</select></label>
        </div>
        {erroClinica && <div className="audit-warning" role="alert">{erroClinica} <button className={buttonCls} onClick={fetchClinica}>Tentar novamente</button></div>}
        {erroEquipe && <div className="audit-warning" role="alert">{erroEquipe} <button className={buttonCls} onClick={fetchEquipe}>Tentar novamente</button></div>}
        <div className="audit-security">
          <label><input type="checkbox" checked={filtroSuspeito} onChange={(e) => setFiltroSuspeito(e.target.checked)} /><PrototypeIcon name="info" size="s" />Mostrar apenas ações suspeitas</label>
          <select aria-label="Ordenação" className={selectCls} value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>{ORDENACOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </div>
        <div className="audit-count">
          <span aria-live="polite">{loading ? 'Carregando registros…' : erro ? 'Histórico indisponível' : `${filtrados.length} registros encontrados`}</span>
          <div className="audit-actions">
          {canExportPdf && <button className="btn-p" onClick={() => setRelatorioAberto(true)} disabled={loading || !!erro || !clinica || !!erroClinica || exportando || filtrados.length === 0}><PrototypeIcon name="file" size="s" />{exportando ? 'Gerando PDF…' : 'Exportar / PDF'}</button>}
          <button className={buttonCls} onClick={limparFiltros}>Limpar filtros</button>
          </div>
        </div>
        <div className="box audit-list">
          {!loading && !erro && itensDaPagina.length > 0 && <div className="audit-list-heading" aria-hidden="true"><span>Data e hora</span><span>Responsável</span><span>Ação realizada</span><span /></div>}
          {loading ? <div className="audit-state" role="status" aria-label="Carregando histórico"><ConfigCardStackSkeleton count={4} className="h-20" /></div> : erro ? (
            <div role="alert" className="audit-state">{erro}<br /><button className={buttonCls} onClick={fetchAuditoria}>Tentar novamente</button></div>
          ) : itensDaPagina.length === 0 ? (
            <div className="empty"><PrototypeIcon name="hist" size="l" /><b>{registros.length ? 'Nenhum registro encontrado' : 'Nenhum registro de auditoria'}</b><span>{registros.length ? 'Tente outro período ou ajuste os filtros.' : 'As ações realizadas na clínica aparecerão aqui.'}</span></div>
          ) : itensDaPagina.map((item) => {
            const label = ACOES_MAP[item.acao]?.label || item.acao?.replace(/_/g, ' ') || 'Ação';
            const icon = label.startsWith('Convite') ? 'mail' : label.includes('perfil') || label.startsWith('Perfil') ? 'shield' : label.startsWith('Acesso') ? 'lock' : 'pen';
            return <button key={item.id} onClick={() => setSelectedRegistro(item)} className={`audit-row${(item.suspeito ?? item.isSuspeito) ? ' suspect' : ''}`} aria-label={`Ver detalhes: ${label} de ${item.nomeUsuario || 'usuário não informado'}`}>
              <time dateTime={item.criadoEm}>{formatarInstante(item.criadoEm, fuso, { day: '2-digit', month: '2-digit', year: 'numeric' })}<small>{formatarInstante(item.criadoEm, fuso, { hour: '2-digit', minute: '2-digit' })}</small></time>
              <span className="audit-meta"><span className="dot"><PrototypeIcon name={icon} /></span><span><b>{item.nomeUsuario || 'Nome não registrado'}</b><small>{item.perfilAcessoNome || item.papel || 'Perfil não registrado'}</small></span></span>
              <span className="audit-event"><b>{label}</b><small>{item.descricao || item.permissaoDescricao || formatarEntidade(item.entidade)} · {formatarEntidade(item.entidade || item.permissaoModulo)}</small>{(item.suspeito ?? item.isSuspeito) && <span className="audit-flag"><PrototypeIcon name="info" size="s" />Ação suspeita</span>}</span>
              <PrototypeIcon name="cr" size="s" />
            </button>;
          })}
        </div>
        {!loading && !erro && filtrados.length > 0 && <div className="audit-pager"><span>Página {paginaAtual} de {totalPaginas}</span><button className={buttonCls} onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1}><PrototypeIcon name="cl" size="s" />Anterior</button><button className={buttonCls} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual >= totalPaginas}>Próxima<PrototypeIcon name="cr" size="s" /></button></div>}
        <p className="invite-note">As sinalizações de ações suspeitas devem ser conferidas e não confirmam uma irregularidade.</p>
      </div>
      {relatorioAberto && canExportPdf && <AuditoriaDetailsModal relatorio={{ clinica, rows: filtrados, suspeitas: filtroSuspeito, ordem: ordenacao, exportar: exportarParaPDF, exportando,
        limite: registrosTruncados ? `Mostrando as ${registros.length} ações mais recentes de ${totalNoBanco} no total.` : '' }} onClose={() => setRelatorioAberto(false)} />}
      <AuditoriaDetailsModal registro={selectedRegistro} onClose={() => setSelectedRegistro(null)} />
    </section>
  );
}
