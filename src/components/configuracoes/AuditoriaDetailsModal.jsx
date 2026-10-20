import React, { useEffect, useRef } from 'react';
import { PrototypeIcon } from './PrototypeIcon';
import './equipePrototypeBase.css';
import './auditoria.css';
import { formatData, formatarEntidade, ACOES_MAP, auditReportClinic } from './AuditoriaUtils';
import { useFusoClinica } from '../hooks/useFusoClinica';

function tryParseJSON(jsonString) {
  try {
    const o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
        return o;
    }
  } catch (e) { // eslint-disable-line no-unused-vars
    // ignorar
  }
  return false;
}

const FIELD_LABELS = {
  nome: 'Nome',
  nomeCompleto: 'Nome Completo',
  nome_completo: 'Nome Completo',
  cpf: 'CPF',
  email: 'E-mail',
  telefone: 'Telefone',
  celular: 'Celular',
  dataNascimento: 'Data de Nascimento',
  data_nascimento: 'Data de Nascimento',
  estadoCivil: 'Estado Civil',
  estadoCivilId: 'Estado Civil',
  estado_civil_id: 'Estado Civil',
  profissao: 'Profissão',
  profissaoId: 'Profissão',
  profissao_id: 'Profissão',
  role: 'Cargo',
  roleId: 'Cargo',
  role_id: 'Cargo',
  perfilAcesso: 'Perfil de Acesso',
  perfilAcessoId: 'Perfil de Acesso',
  perfil_acesso_id: 'Perfil de Acesso',
  especialidades: 'Especialidades',
  ativo: 'Status',
  cep: 'CEP',
  logradouro: 'Endereço / Logradouro',
  enderecoRua: 'Rua',
  numero: 'Número',
  enderecoNumero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  enderecoBairro: 'Bairro',
  cidade: 'Cidade',
  enderecoCidade: 'Cidade',
  uf: 'UF / Estado',
  enderecoEstado: 'UF / Estado',
  observacoes: 'Observações',
  observacao: 'Observação',
  horaInicio: 'Horário de Início',
  horaFim: 'Horário de Término',
  dataAgendamento: 'Data do Agendamento',
  descricao: 'Descrição',
  titulo: 'Título',
  preco: 'Preço / Valor',
  valor: 'Valor'
};

function formatFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

const renderFormattedValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim (Ativo)' : 'Não (Inativo)';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

function extractDiffsFromDescricao(desc) {
  if (!desc || typeof desc !== 'string') return [];
  const diffs = [];

  // Padrão 1: Nome ('antigo' ➔ 'novo') ou ('antigo' -> 'novo')
  // Suporta setas Unicode: ➔ (\u2794), ➜ (\u279c), → (\u2192), ➡ (\u27a1), ->
  const arrowRegex = /([a-zA-ZÀ-ÿ0-9\s._\-/]+)\s*\('(.*?)'\s*(?:[\u2190-\u21FF\u2790-\u27BF]|->|➔|➜|→|➡)\s*'(.*?)'\)/g;
  let match;
  while ((match = arrowRegex.exec(desc)) !== null) {
    const campo = match[1].trim();
    const antigo = match[2];
    const novo = match[3];
    diffs.push({ campo, antigo, novo });
  }

  // Padrão 2: Nome alterado de 'X' para 'Y'
  if (diffs.length === 0) {
    const alteradoRegex = /([a-zA-ZÀ-ÿ0-9\s._\-/]+)\s+alterado(?:a)?\s+de\s+'(.*?)'\s+para\s+'(.*?)'/gi;
    let matchAlt;
    while ((matchAlt = alteradoRegex.exec(desc)) !== null) {
      const campo = matchAlt[1].trim();
      const antigo = matchAlt[2];
      const novo = matchAlt[3];
      diffs.push({ campo, antigo, novo });
    }
  }

  return diffs;
}

function getCleanDescricao(desc) {
  if (!desc || typeof desc !== 'string') return '';
  if (desc.includes(' — Alterado:')) {
    return desc.split(' — Alterado:')[0].trim();
  }
  if (desc.includes(' - Alterado:')) {
    return desc.split(' - Alterado:')[0].trim();
  }
  if (desc.includes(' (Nome alterado de ')) {
    return desc.split(' (Nome alterado de ')[0].trim();
  }
  return desc;
}

export function AuditoriaDetailsModal({ registro, relatorio, onClose }) {
  const { fuso } = useFusoClinica();
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!registro && !relatorio) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]') || [])].filter((el) => !el.disabled);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [registro, relatorio, onClose]);
  const clinicIdentity = auditReportClinic(relatorio?.clinica);
  if (relatorio) return <div className="prototype-equipe prototype-auditoria-overlay eq-overlay audit-report-overlay"
    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="eq-dialog audit-report-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-report-title" tabIndex={-1}>
      <div className="eq-dialog-head">
        <span className="audit-report-icon"><PrototypeIcon name="file" size="l" /></span>
        <div><h2 id="audit-report-title">Relatório de auditoria</h2><p>Confira os registros selecionados antes de salvar o PDF.</p></div>
        <button className="ib" aria-label="Fechar relatório" onClick={onClose}><PrototypeIcon name="x" size="s" /></button>
      </div>
      <div className="audit-report-body">
        <div className="audit-report-paper">
          <div className="audit-report-heading">
            <div><span className="audit-report-kicker">HISTÓRICO / AUDITORIA</span><h3>Registro de atividades</h3><strong className="audit-report-clinic">{clinicIdentity.nome}</strong><span className="audit-report-cnpj">CNPJ: {clinicIdentity.cnpj}</span><p>Registros que correspondem aos filtros atuais.</p></div>
            <span className="audit-report-total"><b>{relatorio.rows.length}</b> registros</span>
          </div>
          <div className="audit-report-context"><span><PrototypeIcon name="shield" size="s" />{relatorio.suspeitas ? 'Apenas ações suspeitas' : 'Todas as sinalizações'}</span><span><PrototypeIcon name="hist" size="s" />{relatorio.ordem === 'asc' ? 'Mais antigas primeiro' : 'Mais recentes primeiro'}</span></div>
          {relatorio.limite && <div className="hint">{relatorio.limite}</div>}
          <div className="audit-export-wrap"><table className="audit-export"><thead><tr><th>Data e responsável</th><th>Ação realizada</th><th>Origem e sinalização</th></tr></thead>
            <tbody>{relatorio.rows.map((r) => <tr key={r.id}>
              <td data-label="Data e responsável"><span className="audit-report-date">{formatData(r.criadoEm, fuso)}</span><strong>{r.nomeUsuario || 'Não registrado'}</strong><span className="audit-report-muted">{r.perfilAcessoNome || r.papel || 'Perfil não registrado'}</span></td>
              <td data-label="Ação realizada"><strong>{ACOES_MAP[r.acao]?.label || r.acao?.replace(/_/g, ' ') || 'Ação'}</strong><span className="audit-report-module">{r.permissaoModulo || formatarEntidade(r.entidade) || 'Módulo não registrado'}</span>{r.descricao && <p className="audit-report-description">{r.descricao}</p>}</td>
              <td data-label="Origem e sinalização"><span className={`audit-report-status${(r.suspeito ?? r.isSuspeito) ? ' suspect' : ''}`}>{(r.suspeito ?? r.isSuspeito) ? 'Ação suspeita' : 'Sem sinalização'}</span>{(r.suspeito ?? r.isSuspeito) && <p className="audit-report-description">{r.motivoSuspeita || r.motivo || 'Conferir registro'}</p>}<span className="audit-report-origin"><b>IP</b> {r.ipOrigem || 'Não registrado'}</span><span className="audit-report-muted audit-report-device">{r.userAgent || 'Dispositivo não registrado'}</span></td>
            </tr>)}</tbody></table></div>
          <p className="audit-report-note">Sinalizações de ações suspeitas indicam necessidade de conferência e não confirmam uma irregularidade.</p>
        </div>
      </div>
      <div className="eq-dialog-foot"><span className="audit-report-footer-note">O PDF incluirá todos os {relatorio.rows.length} registros selecionados.</span><button className="btn-s" onClick={onClose}>Fechar</button>
        <button className="btn-p" onClick={relatorio.exportar} disabled={relatorio.exportando}>{relatorio.exportando ? 'Gerando PDF…' : 'Imprimir / Salvar PDF'}</button></div>
    </section>
  </div>;
  if (!registro) return null;

  const acao = ACOES_MAP[registro.acao] ?? { label: registro.acao?.replace(/_/g, ' ') || 'Ação', cor: 'blue' };
  
  let antigoObj = null;
  let novoObj = null;
  
  if (registro.dadosAntigos) {
    antigoObj = tryParseJSON(registro.dadosAntigos) || registro.dadosAntigos;
  }
  if (registro.dadosNovos) {
    novoObj = tryParseJSON(registro.dadosNovos) || registro.dadosNovos;
  }

  const hasDiffs = antigoObj && novoObj && typeof antigoObj === 'object' && typeof novoObj === 'object';
  
  let changedKeys = [];
  if (hasDiffs) {
    const allKeys = new Set([...Object.keys(antigoObj), ...Object.keys(novoObj)]);
    for (const key of allKeys) {
      if (JSON.stringify(antigoObj[key]) !== JSON.stringify(novoObj[key])) {
        changedKeys.push(key);
      }
    }
  }

  const descRaw = registro.descricao || registro.permissaoDescricao;
  const diffsDaDescricao = extractDiffsFromDescricao(descRaw);
  const cleanDescricao = getCleanDescricao(descRaw);
  const temDiffsDescricao = diffsDaDescricao.length > 0;
  const showDiffsInDescricao = temDiffsDescricao && (!hasDiffs || changedKeys.length === 0);

  const differences = changedKeys.length
    ? changedKeys.map((key) => ({ campo: formatFieldLabel(key), antigo: antigoObj[key], novo: novoObj[key] }))
    : showDiffsInDescricao ? diffsDaDescricao : [];
  return (
    <div className="prototype-equipe prototype-auditoria-overlay eq-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="eq-dialog" role="dialog" aria-modal="true"
        aria-labelledby="auditoria-detail-title" tabIndex={-1}>
        <div className="eq-dialog-head">
          <div><h2 id="auditoria-detail-title">Detalhes do registro</h2><p>{acao.label}</p></div>
          <button className="ib" onClick={onClose} aria-label="Fechar"><PrototypeIcon name="x" size="s" /></button>
        </div>
        {(registro.suspeito ?? registro.isSuspeito) && <div className="audit-warning">
          <b><PrototypeIcon name="info" size="s" />Ação suspeita · conferir</b>
          {registro.motivoSuspeita || registro.motivo || 'Registro sinalizado para conferência.'}<br />
          Esta sinalização não confirma uma irregularidade.
        </div>}
        <div className="audit-detail">
          <div><small>Cargo e perfil no momento da ação</small>{registro.papel || 'Não registrado'} · {registro.perfilAcessoNome || 'Não registrado'}</div>
          <div><small>Módulo</small>{registro.permissaoModulo || formatarEntidade(registro.entidade) || 'Não registrado'}</div>
          <div><small>Origem da ação</small>IP: <span>{registro.ipOrigem || 'Não registrado'}</span><br />
            Dispositivo / navegador: <span>{registro.userAgent || 'Não registrado'}</span></div>
        </div>
        <div className="audit-detail audit-detail-block">
          <div><small>Permissão exercida</small><b>{registro.permissaoNome || 'Ação interna do sistema'}</b>
            {registro.permissaoCodigo && <><br /><code>{registro.permissaoCodigo}</code></>}</div>
        </div>
        <div className="audit-detail">
          <div><small>Responsável</small><b>{registro.nomeUsuario || 'Não registrado'}</b></div>
          <div><small>Data e hora</small>{formatData(registro.criadoEm, fuso)}</div>
          <div><small>Pessoa ou item afetado</small><b>{registro.entidadeNome || registro.itemNome || formatarEntidade(registro.entidade) || 'Não registrado'}</b>
            {cleanDescricao && <p>{cleanDescricao}</p>}</div>
          {differences.length > 0 ? <>
            <div><small>Alterações detalhadas</small>{differences.length} campos alterados</div>
            {differences.map((diff, index) => <div key={index}><b>{diff.campo}</b><div className="audit-diff">
              <div><small>Antes</small>{renderFormattedValue(diff.antigo)}</div>
              <div><small>Depois</small>{renderFormattedValue(diff.novo)}</div>
            </div></div>)}
          </> : (antigoObj || novoObj) && <div className="audit-diff">
            <div><small>Antes</small>{renderFormattedValue(antigoObj)}</div>
            <div><small>Depois</small>{renderFormattedValue(novoObj)}</div>
          </div>}
        </div>
        <div className="eq-dialog-foot"><button className="btn-p" onClick={onClose} aria-label="Fechar detalhes">Fechar detalhes</button></div>
      </section>
    </div>
  );
}
