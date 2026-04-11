import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ClipboardList, Square, CheckSquare, Loader2, FileText, CheckCircle } from 'lucide-react';
import { anamneseApi } from '../../services/api';

/** Mesmo padrão de `PatientProfileView` / payload gravado em `createPaciente`. */
function parseQueixaExpectativasObs(observacoes) {
  if (!observacoes || typeof observacoes !== 'string') return null;
  const marker = '. Expectativas:';
  const idx = observacoes.indexOf(marker);
  if (idx === -1) return null;
  const queixa = observacoes.slice(0, idx).replace(/^Queixa:\s*/i, '').trim();
  const expectativas = observacoes.slice(idx + marker.length).trim();
  return { queixa: queixa || '', expectativas: expectativas || '' };
}

function resolveFichaTemplateIdFromEntry(entry) {
  const v = entry?.anamneseId ?? entry?.fichaId ?? entry?.anamneseFichaId;
  return v != null && v !== '' ? String(v) : null;
}

function historicoEntryMatchesFichaId(entry, fichaId) {
  const eid = resolveFichaTemplateIdFromEntry(entry);
  return eid != null && eid === String(fichaId);
}

function historicoTimestamp(entry) {
  const raw = entry.dataHora ?? entry.dataPreenchimento ?? entry.createdAt ?? entry.dataCriacao ?? null;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** Converte resposta da API para o estado usado em `DynamicQuestion` / `getAnamneseData`. */
function mapApiRespostaToEstado(r) {
  const perguntaId = r.perguntaId ?? r.pergunta?.id;
  if (perguntaId == null) return null;
  const row = { perguntaId };
  if (r.respostaTexto != null && r.respostaTexto !== '') row.respostaTexto = r.respostaTexto;
  if (r.respostaNumero !== null && r.respostaNumero !== undefined && r.respostaNumero !== '') {
    const n = typeof r.respostaNumero === 'number' ? r.respostaNumero : Number(r.respostaNumero);
    row.respostaNumero = Number.isFinite(n) ? n : null;
  }
  if (r.respostaBoolean === true || r.respostaBoolean === false) row.respostaBoolean = r.respostaBoolean;
  const po = r.perguntaOpcaoId ?? r.opcaoId ?? r.pergunta_opcao_id;
  if (po != null && po !== '') row.perguntaOpcaoId = po;
  const multi = r.opcoesSelecionadas ?? r.opcoes_selecionadas;
  if (Array.isArray(multi) && multi.length > 0) {
    row.opcoesSelecionadas = multi.map((x) => (typeof x === 'object' && x != null && x.id != null ? x.id : x));
  }
  return row;
}

function DynamicQuestion({ pergunta, resposta, onChange, alerta = false, readOnly = false }) {
  const tipo = pergunta.tipoResposta;
  const qLabel = alerta ? 'text-[13px] font-bold text-red-950 ml-1' : 'text-[13px] font-bold text-[#0f766e] ml-1';
  const qTitle = alerta ? 'text-[14px] font-bold text-red-950' : 'text-[14px] font-bold text-[#475569]';
  const fieldBase = alerta
    ? 'w-full p-3 bg-white border-[3px] border-red-400 rounded-xl text-[14px] font-medium text-neutral-900 placeholder:text-neutral-500 focus:ring-4 outline-none focus:ring-red-200 focus:border-red-700'
    : 'w-full p-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]';

  if (tipo === 'texto') {
    return (
      <div className="space-y-1.5">
        <label className={qLabel}>{pergunta.descricao}</label>
        <textarea
          value={resposta?.respostaTexto || ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaTexto: e.target.value })}
          rows={2}
          readOnly={readOnly}
          className={`${fieldBase}${readOnly ? ' cursor-default opacity-90' : ''}`}
          placeholder="Digite a resposta..."
        />
      </div>
    );
  }

  if (tipo === 'numero') {
    return (
      <div className="space-y-1.5">
        <label className={qLabel}>{pergunta.descricao}</label>
        <input
          type="number"
          value={resposta?.respostaNumero ?? ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaNumero: e.target.value === '' ? null : Number(e.target.value) })}
          readOnly={readOnly}
          className={`${fieldBase}${readOnly ? ' cursor-default opacity-90' : ''}`}
          placeholder="0"
        />
      </div>
    );
  }

  if (tipo === 'booleano') {
    const valor = resposta?.respostaBoolean ?? null;
    return (
      <div className="flex flex-col gap-2">
        <span className={qTitle}>{pergunta.descricao}</span>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, respostaBoolean: true }); }}
            className={
              alerta
                ? `flex-1 py-2 rounded-xl border-[3px] font-bold text-sm transition-all ${
                    valor === true
                      ? 'border-red-800 bg-red-700 text-white shadow-sm'
                      : 'border-red-300 bg-white text-red-800 hover:border-red-500 hover:bg-red-50'
                  }`
                : `flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                    valor === true ? 'border-[#00a88e] bg-[#e6f7f5] text-[#0f766e]' : 'border-gray-200 text-gray-400 hover:border-[#00a88e]/50'
                  }`
            }
          >
            Sim
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, respostaBoolean: false }); }}
            className={
              alerta
                ? `flex-1 py-2 rounded-xl border-[3px] font-bold text-sm transition-all ${
                    valor === false
                      ? 'border-red-900 bg-red-900 text-white shadow-sm'
                      : 'border-red-300 bg-white text-red-800 hover:border-red-600 hover:bg-red-50'
                  }`
                : `flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                    valor === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:border-red-300'
                  }`
            }
          >
            Não
          </button>
        </div>
      </div>
    );
  }

  if (tipo === 'escolha_unica') {
    const selecionada = resposta?.perguntaOpcaoId || null;
    return (
      <div className="space-y-2">
        <label className={qLabel}>{pergunta.descricao}</label>
        <div className="space-y-2">
          {[...(pergunta.alternativas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((alt) => {
            const ativa = String(selecionada) === String(alt.id);
            return (
              <div
                key={alt.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                onClick={() => {
                  if (readOnly) return;
                  onChange({ perguntaId: pergunta.id, perguntaOpcaoId: alt.id });
                }}
                onKeyDown={(e) => {
                  if (readOnly) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange({ perguntaId: pergunta.id, perguntaOpcaoId: alt.id });
                  }
                }}
                className={
                  alerta
                    ? `flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                        readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                      }${
                        ativa
                          ? 'border-red-800 bg-red-200/90 shadow-sm'
                          : 'border-red-400/80 bg-white hover:bg-red-50'
                      }`
                    : `flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                        readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                      }${
                        ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                      }`
                }
              >
                <div
                  className={`w-5 h-5 rounded-full border-[3px] flex items-center justify-center flex-shrink-0 ${
                    alerta ? (ativa ? 'border-red-900' : 'border-red-400') : ativa ? 'border-[#00a88e]' : 'border-[#94a3b8]'
                  }`}
                >
                  {ativa && <div className={`w-2.5 h-2.5 rounded-full ${alerta ? 'bg-red-900' : 'bg-[#00a88e]'}`} />}
                </div>
                <span className={`text-[14px] font-medium ${ativa ? (alerta ? 'text-red-950' : 'text-[#0f766e]') : alerta ? 'text-red-900' : 'text-[#475569]'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === 'multipla_escolha') {
    const selecionadas = (resposta?.opcoesSelecionadas || []).map((x) => String(x));
    return (
      <div className="space-y-2">
        <label className={qLabel}>{pergunta.descricao}</label>
        <div className="space-y-2">
          {[...(pergunta.alternativas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((alt) => {
            const ativa = selecionadas.includes(String(alt.id));
            const toggle = () => {
              if (readOnly) return;
              const idStr = String(alt.id);
              const next = ativa
                ? selecionadas.filter((id) => id !== idStr)
                : [...selecionadas, idStr];
              onChange({ perguntaId: pergunta.id, opcoesSelecionadas: next });
            };
            return (
              <div
                key={alt.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (readOnly) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={
                  alerta
                    ? `flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                        readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                      }${
                        ativa ? 'border-red-800 bg-red-200/90 shadow-sm' : 'border-red-400/80 bg-white hover:bg-red-50'
                      }`
                    : `flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                        readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                      }${
                        ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                      }`
                }
              >
                {ativa
                  ? <CheckSquare className={`w-5 h-5 ${alerta ? 'text-red-900' : 'text-[#00a88e]'}`} strokeWidth={2.5} />
                  : <Square className={`w-5 h-5 ${alerta ? 'text-red-400' : 'text-[#94a3b8]'}`} strokeWidth={2} />
                }
                <span className={`text-[14px] font-medium ${ativa ? (alerta ? 'text-red-950' : 'text-[#0f766e]') : alerta ? 'text-red-900' : 'text-[#475569]'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 border-[3px] rounded-xl text-[13px] ${
        alerta ? 'bg-red-50 border-red-400 text-red-950' : 'bg-[#f8fbfb] border-[#e2e8f0] text-[#64748b]'
      }`}
    >
      Tipo de resposta não suportado: {tipo}
    </div>
  );
}

export const Step2Anamnese = forwardRef(function Step2Anamnese({
  queixa, setQueixa,
  expectativas, setExpectativas,
  pacienteId = null,
  step2Errors = {},
  setStep2Errors = () => {},
}, ref) {
  const [fichas, setFichas] = useState([]);
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState('');
  const [fichaSelecionada, setFichaSelecionada] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [preenchimentoAnterior, setPreenchimentoAnterior] = useState(null);
  const [modoVisualizacao, setModoVisualizacao] = useState(false);

  useImperativeHandle(ref, () => ({
    getAnamneseData: () => {
      if (!fichaSelecionadaId || !fichaSelecionada) return null;
      return {
        anamneseId: fichaSelecionadaId,
        respostas: Object.values(respostas).map((r) => {
          const row = {
            perguntaId: r.perguntaId,
            perguntaOpcaoId: r.perguntaOpcaoId || undefined,
            respostaTexto: r.respostaTexto || undefined,
            respostaNumero: r.respostaNumero ?? undefined,
            respostaBoolean: r.respostaBoolean ?? undefined,
          };
          if (Array.isArray(r.opcoesSelecionadas) && r.opcoesSelecionadas.length > 0) {
            row.opcoesSelecionadas = r.opcoesSelecionadas;
          }
          return row;
        }),
      };
    },
  }), [fichaSelecionadaId, fichaSelecionada, respostas]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [historicoPaciente, setHistoricoPaciente] = useState([]);
  const [loadingHistoricoPaciente, setLoadingHistoricoPaciente] = useState(false);

  useEffect(() => {
    anamneseApi.listFichas()
      .then((data) => setFichas(Array.isArray(data) ? data : []))
      .catch(() => setFichas([]))
      .finally(() => setLoadingFichas(false));
  }, []);

  useEffect(() => {
    if (!pacienteId) {
      setHistoricoPaciente([]);
      setLoadingHistoricoPaciente(false);
      return;
    }
    let cancelled = false;
    setLoadingHistoricoPaciente(true);
    anamneseApi
      .listPaciente(pacienteId)
      .then((data) => {
        if (!cancelled) setHistoricoPaciente(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setHistoricoPaciente([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistoricoPaciente(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pacienteId]);

  const resumoPreenchimentosPorFicha = useMemo(() => {
    if (!Array.isArray(historicoPaciente) || historicoPaciente.length === 0) return [];
    const ultimoPorFicha = new Map();
    for (const h of historicoPaciente) {
      const fid = resolveFichaTemplateIdFromEntry(h);
      if (!fid) continue;
      const prev = ultimoPorFicha.get(fid);
      if (!prev || historicoTimestamp(h) >= historicoTimestamp(prev)) {
        ultimoPorFicha.set(fid, h);
      }
    }
    const rows = Array.from(ultimoPorFicha.entries()).map(([fichaId, ultimo]) => {
      const f = fichas.find((x) => String(x.id) === fichaId);
      const nome =
        f?.nome
        ?? ultimo.anamneseNome
        ?? ultimo.fichaNome
        ?? ultimo.nomeFicha
        ?? ultimo.nome
        ?? 'Ficha de anamnese';
      const dataHora =
        ultimo.dataHora
        ?? ultimo.dataPreenchimento
        ?? ultimo.createdAt
        ?? ultimo.dataCriacao
        ?? null;
      return { fichaId, nome, dataHora, ultimo };
    });
    rows.sort((a, b) => historicoTimestamp(b.ultimo) - historicoTimestamp(a.ultimo));
    return rows;
  }, [historicoPaciente, fichas]);

  const handleSelecionarFicha = useCallback(async (id) => {
    setFichaSelecionadaId(id);
    setPreenchimentoAnterior(null);
    setModoVisualizacao(false);
    if (!id) {
      setFichaSelecionada(null);
      return;
    }
    setLoadingFicha(true);
    try {
      const ficha = await anamneseApi.getFicha(id);
      setFichaSelecionada(ficha);
      setRespostas({});

      if (pacienteId) {
        try {
          const historicoRaw = await anamneseApi.listPaciente(pacienteId);
          const historico = Array.isArray(historicoRaw) ? historicoRaw : [];
          const candidatos = historico.filter((h) => historicoEntryMatchesFichaId(h, id));
          const preenchimento = [...candidatos].sort((a, b) => historicoTimestamp(b) - historicoTimestamp(a))[0];

          if (preenchimento) {
            const detalhes = await anamneseApi.getPaciente(pacienteId, preenchimento.id);
            const respostasCarregadas = {};
            (detalhes?.respostas || []).forEach((r) => {
              const mapped = mapApiRespostaToEstado(r);
              if (mapped) respostasCarregadas[String(mapped.perguntaId)] = mapped;
            });
            setRespostas(respostasCarregadas);
            const dh =
              preenchimento.dataHora
              ?? preenchimento.dataPreenchimento
              ?? preenchimento.createdAt
              ?? preenchimento.dataCriacao
              ?? null;
            setPreenchimentoAnterior({ id: preenchimento.id, dataHora: dh });
            setModoVisualizacao(true);
            const parsed = parseQueixaExpectativasObs(detalhes?.observacoes);
            if (parsed && (parsed.queixa || parsed.expectativas)) {
              setQueixa(parsed.queixa);
              setExpectativas(parsed.expectativas);
            }
          }
        } catch (histErr) {
          console.warn('[Step2Anamnese] Histórico de anamnese do paciente:', histErr?.message || histErr);
        }
      }
    } catch {
      setFichaSelecionada(null);
    } finally {
      setLoadingFicha(false);
    }
  }, [pacienteId, setQueixa, setExpectativas]);

  const handleRespostaChange = useCallback((resposta) => {
    if (modoVisualizacao) return;
    const key = String(resposta.perguntaId);
    setRespostas((prev) => ({ ...prev, [key]: { ...resposta, perguntaId: resposta.perguntaId } }));
  }, [modoVisualizacao]);

  const itensOrdenados = fichaSelecionada?.itens
    ? [...fichaSelecionada.itens].sort((a, b) => a.ordem - b.ordem)
    : [];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25">
          <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Anamnese Completa</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Histórico médico e contraindicações</p>
        </div>
      </div>

      {pacienteId && loadingHistoricoPaciente && (
        <div className="mb-6 flex items-center gap-2 text-[#64748b] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Carregando histórico de anamneses do paciente…
        </div>
      )}

      {pacienteId && !loadingHistoricoPaciente && resumoPreenchimentosPorFicha.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-[13px] font-bold text-[#0f172a]">Preenchimentos anteriores</p>
          <div className="space-y-2">
            {resumoPreenchimentosPorFicha.map((row) => (
              <div
                key={row.fichaId}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border-[3px] border-[#00a88e]/20 bg-white shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <CheckCircle className="w-5 h-5 text-[#00a88e] flex-shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#0f172a] break-words">{row.nome}</p>
                    <p className="text-[12px] text-[#64748b] font-medium mt-0.5">
                      Último preenchimento:{' '}
                      {row.dataHora
                        ? new Date(row.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                        : 'data não registrada'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelecionarFicha(row.fichaId)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[#00a88e] text-white border-[3px] border-transparent hover:bg-[#00967f] transition-colors flex-shrink-0"
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seletor de ficha */}
      <div className="mb-6 p-4 bg-[#f0fdfa] border-[3px] border-[#00a88e]/20 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-5 h-5 text-[#00a88e]" strokeWidth={2} />
          <label className="text-[14px] font-bold text-[#0f766e]">Ficha de Anamnese</label>
        </div>
        {loadingFichas ? (
          <div className="flex items-center gap-2 text-[#64748b] text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando fichas...
          </div>
        ) : fichas.length === 0 ? (
          <p className="text-[13px] text-[#94a3b8]">Nenhuma ficha disponível. Crie fichas na aba Anamnese do menu.</p>
        ) : (
          <select
            value={fichaSelecionadaId}
            onChange={(e) => handleSelecionarFicha(e.target.value)}
            className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
          >
            <option value="">Selecione uma ficha...</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} {f.especialidadeNome ? `(${f.especialidadeNome})` : ''} — {f.itens?.length || 0} perguntas
              </option>
            ))}
          </select>
        )}
      </div>

      {preenchimentoAnterior && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-[#e6f7f5] border border-[#00a88e] rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2 text-[#0f766e] text-sm font-medium min-w-0">
            <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} aria-hidden />
            <span>
              Preenchida em{' '}
              {preenchimentoAnterior.dataHora
                ? new Date(preenchimentoAnterior.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : 'data não registrada'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setModoVisualizacao((v) => !v)}
            className="text-sm font-bold text-[#00a88e] hover:underline text-left sm:text-right flex-shrink-0"
          >
            {modoVisualizacao ? 'Modificar' : 'Cancelar'}
          </button>
        </div>
      )}

      {/* Perguntas dinâmicas da ficha */}
      {loadingFicha && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
          <span className="ml-2 text-[#64748b] text-[13px]">Carregando perguntas...</span>
        </div>
      )}

      {fichaSelecionada && itensOrdenados.length > 0 && (
        <div className="space-y-4 mb-6 p-6 bg-white border-[3px] border-[#a855f7]/20 rounded-2xl">
          <h4 className="text-[16px] font-bold text-[#0f172a] mb-2">{fichaSelecionada.nome}</h4>
          {itensOrdenados.map((item) => {
            const isAlerta = item.pergunta?.prioridade === 'ALERTA';
            return (
              <div
                key={item.id}
                className={
                  isAlerta
                    ? 'relative rounded-xl overflow-hidden border-[3px] border-red-800 shadow-lg shadow-red-900/10 ring-1 ring-red-700/30'
                    : 'relative'
                }
              >
                {isAlerta && (
                  <div className="flex items-center gap-2 bg-red-800 px-3 py-2.5 text-[12px] font-bold text-white">
                    <span className="text-base leading-none" aria-hidden>⚠️</span>
                    <span>Pergunta de alerta</span>
                  </div>
                )}
                <div className={`relative ${isAlerta ? 'bg-gradient-to-b from-red-100 to-red-50 p-4' : ''}`}>
                  {item.obrigatorio && (
                    <span
                      className={`absolute z-[1] text-[10px] font-bold text-white rounded px-1.5 py-0.5 shadow-sm ${
                        isAlerta ? 'top-2 right-2 bg-red-700' : '-top-2 -right-2 bg-red-500'
                      }`}
                    >
                      obrigatório
                    </span>
                  )}
                  <DynamicQuestion
                    pergunta={item.pergunta}
                    resposta={
                      respostas[item.pergunta?.id] ?? respostas[String(item.pergunta?.id)]
                    }
                    onChange={handleRespostaChange}
                    alerta={isAlerta}
                    readOnly={modoVisualizacao}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campos fixos originais */}
      <form
        className={`space-y-6 bg-white border-[3px] rounded-2xl p-6 ${
          step2Errors.queixa || step2Errors.expectativas ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Queixa Principal <span className="text-red-500">*</span></label>
          <textarea
            value={queixa}
            onChange={(e) => {
              setQueixa(e.target.value);
              setStep2Errors((prev) => ({ ...prev, queixa: false }));
            }}
            rows={3}
            readOnly={modoVisualizacao}
            className={`w-full p-4 border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 ${
              modoVisualizacao ? 'bg-slate-50 cursor-default opacity-95' : 'bg-[#f8fbfb]'
            } ${
              step2Errors.queixa
                ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200'
                : 'border-[#00a88e]/25 focus:border-[#00a88e]'
            }`}
            placeholder="Descreva o motivo da consulta..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Expectativas do Paciente <span className="text-red-500">*</span></label>
          <textarea
            value={expectativas}
            onChange={(e) => {
              setExpectativas(e.target.value);
              setStep2Errors((prev) => ({ ...prev, expectativas: false }));
            }}
            rows={3}
            readOnly={modoVisualizacao}
            className={`w-full p-4 border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 ${
              modoVisualizacao ? 'bg-slate-50 cursor-default opacity-95' : 'bg-[#f8fbfb]'
            } ${
              step2Errors.expectativas
                ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-200'
                : 'border-[#00a88e]/25 focus:border-[#00a88e]'
            }`}
            placeholder="O que o paciente espera do procedimento..."
          />
        </div>
      </form>
    </div>
  );
});
