import React from 'react';
import { X, User, Clock, MapPin, Activity, FileText, AlertTriangle, Shield } from 'lucide-react';
import { formatData, formatarEntidade, ACOES_MAP, BADGE_CORES } from './AuditoriaUtils';

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

const renderFormattedValue = (val) => {
  if (val === null || val === undefined || val === '') {
    return <span className="text-slate-400 italic">Vazio / Não informado</span>;
  }
  if (typeof val === 'boolean') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${val ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
        {val ? 'Sim (Ativo)' : 'Não (Inativo)'}
      </span>
    );
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-400 italic">Nenhum item selecionado</span>;
    if (val.every(item => typeof item === 'string' || typeof item === 'number')) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {val.map((item, idx) => (
            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-slate-800 text-xs font-medium border border-slate-200 shadow-2xs">
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <pre className="text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200 overflow-x-auto whitespace-pre-wrap font-mono">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }
  if (typeof val === 'object') {
    return (
      <pre className="text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200 overflow-x-auto whitespace-pre-wrap font-mono">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }
  return <span>{String(val)}</span>;
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

export function AuditoriaDetailsModal({ registro, onClose }) {
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

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-50 p-2 text-teal-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Detalhes da Ação</h2>
                {(registro.suspeito || registro.isSuspeito) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Suspeito
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">
                Auditoria de segurança e rastreabilidade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-200 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Responsável</h3>
              </div>
              <div className="font-semibold text-slate-900">{registro.nomeUsuario}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {registro.papel} {registro.perfilAcessoNome ? `• ${registro.perfilAcessoNome}` : ''}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700">Data e Hora</h3>
              </div>
              <div className="font-semibold text-slate-900">{formatData(registro.criadoEm)}</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">Ação / Módulo</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${BADGE_CORES[acao.cor]}`}>
                      {registro.permissaoNome || acao.label}
                    </span>
                    <span className="text-sm font-medium text-slate-600 ml-2">
                      Módulo: {registro.permissaoModulo || formatarEntidade(registro.entidade) || 'Geral'}
                    </span>
                  </div>
               </div>
            </div>

            {/* Autorização & Permissão (RBAC) */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-700">Autorização & Permissão (RBAC)</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-semibold text-xs block mb-1 uppercase tracking-wider">Permissão Exercida</span>
                  {registro.permissaoNome ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded">
                        {registro.permissaoCodigo}
                      </span>
                      <span className="font-medium text-slate-900 text-xs">
                        {registro.permissaoNome}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-xs">Ação interna de sistema ou acesso público externo</span>
                  )}
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-semibold text-xs block mb-1 uppercase tracking-wider">Módulo do Sistema</span>
                  <div className="font-semibold text-slate-900 text-xs">
                    {registro.permissaoModulo ? `Módulo ${registro.permissaoModulo}` : 'Geral / Sistema'}
                  </div>
                </div>
              </div>
            </div>

            {descRaw && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 sm:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-700">Descrição da Ação</h3>
                </div>

                {showDiffsInDescricao ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs leading-relaxed">
                      {cleanDescricao || descRaw}
                    </p>

                    <div className="space-y-3">
                      {diffsDaDescricao.map((diff, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            <span>Campo: {formatFieldLabel(diff.campo)}</span>
                          </div>

                          {/* Antes da edição */}
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-1.5">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Antes da edição:
                            </div>
                            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 text-xs sm:text-sm text-slate-700 font-medium break-words">
                              {renderFormattedValue(diff.antigo)}
                            </div>
                          </div>

                          {/* Após a edição */}
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-1.5">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Após a edição:
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs sm:text-sm text-slate-900 font-semibold break-words">
                              {renderFormattedValue(diff.novo)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-sm leading-relaxed">
                    {(hasDiffs && changedKeys.length > 0 ? cleanDescricao : null) || descRaw}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-blue-800">Origem da Ação</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600/70 font-semibold text-xs block mb-1 uppercase tracking-wider">Endereço IP</span>
                  <span className="font-medium text-blue-900 font-mono bg-blue-100/50 px-2 py-1 rounded-md">{registro.ipOrigem || 'Não registrado'}</span>
                </div>
                <div>
                  <span className="text-blue-600/70 font-semibold text-xs block mb-1 uppercase tracking-wider">Dispositivo / Navegador</span>
                  <span className="font-medium text-blue-900 break-all">{registro.userAgent || 'Não registrado'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alterações Detalhadas (Antes da edição vs Após a edição) */}
          {hasDiffs && changedKeys.length > 0 && (
            <div className="border-t border-slate-100 pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Alterações Detalhadas</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {changedKeys.length} {changedKeys.length === 1 ? 'campo alterado' : 'campos alterados'}
                  </span>
                </h3>
              </div>

              <div className="space-y-4">
                {changedKeys.map(k => (
                  <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3.5 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                        {formatFieldLabel(k)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {k}
                      </span>
                    </div>

                    {/* Antes da edição */}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Antes da edição:
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm text-slate-700 font-medium break-words">
                        {renderFormattedValue(antigoObj[k])}
                      </div>
                    </div>

                    {/* Após a edição */}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Após a edição:
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-slate-900 font-semibold break-words">
                        {renderFormattedValue(novoObj[k])}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {(!hasDiffs && (registro.dadosAntigos || registro.dadosNovos)) && (
            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">Dados da Alteração</h3>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                {registro.dadosAntigos && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Antes da edição:
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm text-slate-700 break-words">
                      {renderFormattedValue(antigoObj)}
                    </div>
                  </div>
                )}

                {registro.dadosNovos && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Após a edição:
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-slate-900 font-semibold break-words">
                      {renderFormattedValue(novoObj)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-95"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
