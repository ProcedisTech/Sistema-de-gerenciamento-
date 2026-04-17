import React, { Fragment, useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, useRef } from 'react';
import {
  ClipboardList,
  Square,
  CheckSquare,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  X,
} from 'lucide-react';
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

function isConsultaBasicaFicha(f) {
  if (!f) return false;
  const n = (f.nome || '').trim().toLowerCase();
  return n === 'consulta básica' || n === 'consulta basica';
}

function formatRelativo(dataHora) {
  if (!dataHora) return '';
  const dias = Math.floor(
    (Date.now() - new Date(dataHora).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'há 1 mês';
  return `há ${meses} meses`;
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

function respostasMapHasEntries(m) {
  return m && typeof m === 'object' && Object.keys(m).length > 0;
}

/** Hidratação inicial: evita `{}` truthy em `draft || mapa` esconder `respostasAnamnese`. */
function mergeInitialRespostas(draftRespostas, respostasAnamneseMap) {
  if (respostasMapHasEntries(draftRespostas)) return draftRespostas;
  if (respostasMapHasEntries(respostasAnamneseMap)) return respostasAnamneseMap;
  if (draftRespostas && typeof draftRespostas === 'object') return draftRespostas;
  return respostasAnamneseMap || {};
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
  const qLabel = `text-[13px] font-bold ml-1 ${alerta ? 'text-[#1f2937]' : 'text-[#0f766e]'}`;
  const qTitle = 'text-[14px] font-bold text-[#1f2937]';
  const fieldBase = 'w-full p-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]';

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
        <div className="flex w-full gap-3 md:max-w-[480px]">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, respostaBoolean: true }); }}
            className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
              valor === true ? 'border-[#00a88e] bg-[#e6f7f5] text-[#0f766e]' : 'border-gray-200 text-gray-400 hover:border-[#00a88e]/50'
            } md:min-w-[120px] md:max-w-[200px]`}
          >
            Sim
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { if (readOnly) return; onChange({ perguntaId: pergunta.id, respostaBoolean: false }); }}
            className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
              valor === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:border-red-300'
            } md:min-w-[120px] md:max-w-[200px]`}
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
                className={`flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                  readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                }${
                  ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-[3px] flex items-center justify-center flex-shrink-0 ${
                    ativa ? 'border-[#00a88e]' : 'border-[#94a3b8]'
                  }`}
                >
                  {ativa && <div className="w-2.5 h-2.5 rounded-full bg-[#00a88e]" />}
                </div>
                <span className={`text-[14px] font-medium ${ativa ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{alt.alternativa}</span>
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
                className={`flex items-center gap-3 p-3 border-[3px] rounded-xl transition-all ${
                  readOnly ? 'cursor-default opacity-95 ' : 'cursor-pointer '
                }${
                  ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                }`}
              >
                {ativa
                  ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
                  : <Square className="w-5 h-5 text-[#94a3b8]" strokeWidth={2} />
                }
                <span className={`text-[14px] font-medium ${ativa ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{alt.alternativa}</span>
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
        alerta ? 'bg-[#fff5f5] border-red-300 text-[#1f2937]' : 'bg-[#f8fbfb] border-[#e2e8f0] text-[#64748b]'
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
  savedAnamneseState = null,
  onSavedAnamneseStateChange = () => {},
  respostasAnamnese = {},
  salvarRespostaAnamnese = () => {},
  setRespostasAnamnese = () => {},
  onQueixaVisibilityChange,
}, ref) {
  const [fichas, setFichas] = useState([]);
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState(
    () => savedAnamneseState?.fichaSelecionadaId || ''
  );
  const [fichaSelecionada, setFichaSelecionada] = useState(null);
  const [respostas, setRespostas] = useState(
    () => mergeInitialRespostas(savedAnamneseState?.respostas, respostasAnamnese)
  );
  const [preenchimentoAnterior, setPreenchimentoAnterior] = useState(
    () => savedAnamneseState?.preenchimentoAnterior || null
  );
  const [modoVisualizacao, setModoVisualizacao] = useState(
    () => Boolean(savedAnamneseState?.modoVisualizacao)
  );
  const [fichaDropdownNovo, setFichaDropdownNovo] = useState(
    () => savedAnamneseState?.fichaDropdownNovo ?? ''
  );

  const itensOrdenados = useMemo(
    () =>
      fichaSelecionada?.itens
        ? [...fichaSelecionada.itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : [],
    [fichaSelecionada],
  );

  const mostrarQueixaExpectativas = !fichaSelecionada || itensOrdenados.length === 0;

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
    /** Modo leitura ou reaproveitando preenchimento anterior — queixa opcional no UI. */
    skipQueixaExpectativas: () => Boolean(modoVisualizacao || preenchimentoAnterior),
  }), [fichaSelecionadaId, fichaSelecionada, respostas, modoVisualizacao, preenchimentoAnterior]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [historicoPaciente, setHistoricoPaciente] = useState([]);
  const [loadingHistoricoPaciente, setLoadingHistoricoPaciente] = useState(false);
  const [fichaMenuOpen, setFichaMenuOpen] = useState(false);
  const [fichaSearch, setFichaSearch] = useState('');
  const fichaMenuRef = useRef(null);
  const fichaSearchInputRef = useRef(null);

  const queixaOpcional = modoVisualizacao || preenchimentoAnterior != null;

  useEffect(() => {
    if (!mostrarQueixaExpectativas) {
      setStep2Errors((prev) => ({ ...prev, queixa: false, expectativas: false }));
    }
  }, [mostrarQueixaExpectativas, setStep2Errors]);

  useEffect(() => {
    onQueixaVisibilityChange?.(mostrarQueixaExpectativas);
  }, [mostrarQueixaExpectativas, onQueixaVisibilityChange]);

  useEffect(() => {
    if (!fichaMenuOpen) return undefined;
    const handler = (e) => {
      if (fichaMenuRef.current && !fichaMenuRef.current.contains(e.target)) {
        setFichaMenuOpen(false);
        setFichaSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fichaMenuOpen]);

  useEffect(() => {
    if (fichaMenuOpen) {
      fichaSearchInputRef.current?.focus();
    }
  }, [fichaMenuOpen]);

  const respostasRef = useRef(respostas);
  respostasRef.current = respostas;
  const savedDraftRef = useRef(savedAnamneseState);
  savedDraftRef.current = savedAnamneseState;

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

  const ultimaAnamnese = resumoPreenchimentosPorFicha[0] ?? null;
  const mesesAtrasUltima = ultimaAnamnese?.dataHora
    ? (Date.now() - new Date(ultimaAnamnese.dataHora).getTime()) / (1000 * 60 * 60 * 24 * 30)
    : null;
  const estaAtualizadaUltima = mesesAtrasUltima !== null && mesesAtrasUltima < 6;
  const dataLinhaUltima =
    ultimaAnamnese && ultimaAnamnese.dataHora
      ? `${new Date(ultimaAnamnese.dataHora).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })} · ${formatRelativo(ultimaAnamnese.dataHora)}`
      : ultimaAnamnese
        ? 'data não registrada'
        : '';

  /** Select / novo preenchimento: só template; sem histórico; evita reidratar respostas do pai. */
  const selecionarFichaParaNovo = useCallback(async (id) => {
    const idStr = id === '' || id == null ? '' : String(id);
    setRespostasAnamnese({});
    setFichaDropdownNovo(idStr);
    onSavedAnamneseStateChange({
      ...(savedAnamneseState || {}),
      fichaSelecionadaId: idStr,
      fichaDropdownNovo: idStr,
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    setFichaSelecionadaId(idStr);
    setPreenchimentoAnterior(null);
    setModoVisualizacao(false);
    setRespostas({});
    respostasRef.current = {};
    if (!idStr) {
      setFichaSelecionada(null);
      return;
    }
    setLoadingFicha(true);
    try {
      const ficha = await anamneseApi.getFicha(idStr);
      setFichaSelecionada(ficha);
    } catch {
      setFichaSelecionada(null);
    } finally {
      setLoadingFicha(false);
    }
  }, [onSavedAnamneseStateChange, savedAnamneseState, setRespostasAnamnese]);

  /** Botão Abrir: último preenchimento da ficha + modo leitura quando existir. */
  const consultarUltimoPreenchimento = useCallback(async (fichaId) => {
    const id = String(fichaId);
    setFichaDropdownNovo('');
    onSavedAnamneseStateChange({
      ...(savedAnamneseState || {}),
      fichaSelecionadaId: id,
      fichaDropdownNovo: '',
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    setFichaSelecionadaId(id);
    setPreenchimentoAnterior(null);
    setModoVisualizacao(false);
    setRespostas({});
    respostasRef.current = {};
    setLoadingFicha(true);
    let syncedRespostas = {};
    let syncedPreenchimento = null;
    let syncedModo = false;
    try {
      const ficha = await anamneseApi.getFicha(id);
      setFichaSelecionada(ficha);
      setRespostas({});
      respostasRef.current = {};

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
            syncedRespostas = respostasCarregadas;
            const dh =
              preenchimento.dataHora
              ?? preenchimento.dataPreenchimento
              ?? preenchimento.createdAt
              ?? preenchimento.dataCriacao
              ?? null;
            syncedPreenchimento = { id: preenchimento.id, dataHora: dh };
            syncedModo = true;
            setRespostas(respostasCarregadas);
            respostasRef.current = respostasCarregadas;
            setPreenchimentoAnterior(syncedPreenchimento);
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

      onSavedAnamneseStateChange({
        ...(savedDraftRef.current || {}),
        fichaSelecionadaId: id,
        fichaDropdownNovo: '',
        respostas: syncedRespostas,
        preenchimentoAnterior: syncedPreenchimento,
        modoVisualizacao: syncedModo,
      });
    } catch {
      setFichaSelecionada(null);
    } finally {
      setLoadingFicha(false);
    }
  }, [onSavedAnamneseStateChange, pacienteId, setExpectativas, setQueixa]);

  const handleRespostaChange = useCallback((resposta) => {
    if (modoVisualizacao) return;
    const key = String(resposta.perguntaId);
    const normalized = { ...resposta, perguntaId: resposta.perguntaId };
    const next = { ...respostasRef.current, [key]: normalized };
    respostasRef.current = next;
    setRespostas(next);
    onSavedAnamneseStateChange({
      ...(savedDraftRef.current || {}),
      fichaSelecionadaId,
      fichaDropdownNovo,
      respostas: next,
      preenchimentoAnterior,
      modoVisualizacao,
    });
    salvarRespostaAnamnese(key, normalized);
  }, [
    modoVisualizacao,
    salvarRespostaAnamnese,
    onSavedAnamneseStateChange,
    fichaSelecionadaId,
    fichaDropdownNovo,
    preenchimentoAnterior,
  ]);

  const toggleModoVisualizacao = useCallback(() => {
    const next = !modoVisualizacao;
    setModoVisualizacao(next);
    onSavedAnamneseStateChange({
      ...(savedDraftRef.current || {}),
      fichaSelecionadaId,
      fichaDropdownNovo,
      respostas: respostasRef.current,
      preenchimentoAnterior,
      modoVisualizacao: next,
    });
  }, [
    modoVisualizacao,
    onSavedAnamneseStateChange,
    fichaSelecionadaId,
    fichaDropdownNovo,
    preenchimentoAnterior,
  ]);

  useEffect(() => {
    if (!fichaSelecionadaId || fichaSelecionada) return;
    let cancelled = false;
    setLoadingFicha(true);
    anamneseApi
      .getFicha(fichaSelecionadaId)
      .then((ficha) => {
        if (!cancelled) setFichaSelecionada(ficha || null);
      })
      .catch(() => {
        if (!cancelled) setFichaSelecionada(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFicha(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fichaSelecionadaId, fichaSelecionada]);

  const fichasFiltered = useMemo(
    () =>
      fichas.filter((f) => (f.nome || '').toLowerCase().includes(fichaSearch.toLowerCase())),
    [fichas, fichaSearch],
  );

  const selectedFichaLista = useMemo(
    () => fichas.find((f) => String(f.id) === String(fichaDropdownNovo)),
    [fichas, fichaDropdownNovo],
  );

  function renderFichaItem(f) {
    const selected = String(fichaDropdownNovo) === String(f.id);
    const esp = (f.especialidadeNome || f.especialidade?.nome || '').trim();
    const nPerg = Array.isArray(f.itens) ? f.itens.length : 0;
    let iconWrap = 'bg-[#f1f5f9]';
    let iconColor = 'text-[#64748b]';
    if (selected) {
      iconWrap = 'bg-[#00a88e]';
      iconColor = 'text-white';
    } else if (esp) {
      iconWrap = 'bg-[#eff6ff]';
      iconColor = 'text-[#3b82f6]';
    }
    return (
      <button
        type="button"
        onClick={() => {
          selecionarFichaParaNovo(f.id);
          setFichaMenuOpen(false);
          setFichaSearch('');
        }}
        className="flex min-h-[56px] w-full items-center gap-3 border-b border-[#f8fafc] px-3 py-2.5 text-left transition-colors duration-100 last:border-0 hover:bg-[#f8fafc] sm:min-h-0"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <ClipboardList className={`h-5 w-5 ${iconColor}`} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[#0f172a]">{f.nome || '—'}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {esp ? (
              <span className="rounded-md bg-[#eff6ff] px-1.5 py-0.5 text-[11px] font-semibold text-[#3b82f6]">
                {esp}
              </span>
            ) : null}
            {nPerg > 0 ? (
              <span className="text-[12px] text-[#64748b]">· {nPerg} perguntas</span>
            ) : (
              <span className="text-[11px] text-[#94a3b8]">Ficha básica — só queixa e expectativas</span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {selected ? (
            <Check className="h-4 w-4 text-[#00a88e]" strokeWidth={2.5} aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#cbd5e1]" strokeWidth={2} aria-hidden />
          )}
        </div>
      </button>
    );
  }

  const basicaFichaFiltered = fichasFiltered.find(isConsultaBasicaFicha);
  const fichasCustomFiltered = fichasFiltered.filter((f) => !isConsultaBasicaFicha(f));
  const showSplitSections = fichas.length > 1;

  return (
    <div className="min-w-0">
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

      {pacienteId && !loadingHistoricoPaciente && ultimaAnamnese ? (
        <div className="mb-5">
          <div className="flex min-h-[56px] flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-bold text-[#0f172a]">{ultimaAnamnese.nome}</p>
                  {estaAtualizadaUltima ? (
                    <span className="shrink-0 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                      ✓ Atualizada
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-[#fde68a] bg-[#fef9c3] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                      ⚠ Desatualizada
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748b]">{dataLinhaUltima}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => consultarUltimoPreenchimento(ultimaAnamnese.fichaId)}
              className={`h-8 shrink-0 self-end rounded-lg px-3 text-[12px] font-semibold text-white transition-colors sm:self-center ${
                estaAtualizadaUltima
                  ? 'bg-[#00a88e] hover:bg-[#00967f]'
                  : 'bg-[#f59e0b] hover:bg-[#d97706]'
              }`}
            >
              Abrir
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-5 border-t border-[#e2e8f0] pt-5" aria-hidden />

      <div className="relative mb-6" ref={fichaMenuRef}>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
          Selecionar ficha de anamnese
        </p>
        <button
          type="button"
          onClick={() => setFichaMenuOpen((o) => !o)}
          className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-150 ${
            fichaMenuOpen
              ? 'border-[#00a88e] bg-[#f0fdfa] ring-2 ring-[#00a88e]/20'
              : selectedFichaLista
                ? 'border-[#00a88e] bg-[#f0fdfa]'
                : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/40 hover:bg-[#f8fafc]'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedFichaLista ? 'bg-[#00a88e]' : 'bg-[#f1f5f9]'
            }`}
          >
            <ClipboardList
              className={`h-4 w-4 ${selectedFichaLista ? 'text-white' : 'text-[#94a3b8]'}`}
              strokeWidth={2}
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1 text-left">
            {selectedFichaLista ? (
              <>
                <p className="text-[14px] font-semibold text-[#0f172a]">{selectedFichaLista.nome || '—'}</p>
                <p className="text-[12px] text-[#64748b]">
                  {(selectedFichaLista.especialidadeNome || selectedFichaLista.especialidade?.nome || '').trim()
                    ? `${(selectedFichaLista.especialidadeNome || selectedFichaLista.especialidade?.nome || '').trim()} · `
                    : ''}
                  {Array.isArray(selectedFichaLista.itens) ? selectedFichaLista.itens.length : 0} perguntas
                </p>
              </>
            ) : (
              <p className="text-[14px] text-[#94a3b8]">Selecione uma ficha de anamnese</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {selectedFichaLista ? (
              <Check className="h-4 w-4 text-[#00a88e]" strokeWidth={2.5} aria-hidden />
            ) : null}
            <ChevronDown
              className={`h-4 w-4 text-[#94a3b8] transition-transform duration-150 ${fichaMenuOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        </button>

        {fichaMenuOpen ? (
          <div className="flex max-h-[min(100dvh,100%)] flex-col overflow-hidden bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 max-sm:fixed max-sm:inset-0 max-sm:z-[200] sm:absolute sm:left-0 sm:right-0 sm:top-full sm:z-50 sm:mt-2 sm:max-h-none sm:rounded-xl sm:border sm:border-[#e2e8f0]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 py-3 sm:hidden">
              <span className="text-[15px] font-bold text-[#0f172a]">Selecionar ficha</span>
              <button
                type="button"
                onClick={() => {
                  setFichaMenuOpen(false);
                  setFichaSearch('');
                }}
                className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-lg text-[#64748b] active:bg-[#f1f5f9]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="sticky top-0 z-10 border-b border-[#f1f5f9] bg-white px-3 pb-2 pt-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  ref={fichaSearchInputRef}
                  type="search"
                  placeholder="Buscar ficha..."
                  value={fichaSearch}
                  onChange={(e) => setFichaSearch(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#e2e8f0] py-2 pl-9 pr-3 text-[16px] outline-none placeholder:text-[#cbd5e1] focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/10 sm:h-9 sm:text-[13px]"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] sm:max-h-[280px] sm:flex-none">
              {loadingFichas ? (
                <>
                  <div className="mx-3 my-2 h-16 animate-pulse rounded-lg bg-[#f1f5f9]" />
                  <div className="mx-3 my-2 h-16 animate-pulse rounded-lg bg-[#f1f5f9]" />
                </>
              ) : fichas.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-[#64748b]">Nenhuma ficha cadastrada ainda.</p>
                  <p className="mt-1 text-[12px] text-[#94a3b8]">Crie fichas em Configurações → Anamnese</p>
                </div>
              ) : fichasFiltered.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[#94a3b8]">Nenhuma ficha encontrada</p>
                </div>
              ) : showSplitSections && basicaFichaFiltered ? (
                <>
                  <div className="bg-[#f8fafc] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                    Padrão do sistema
                  </div>
                  {renderFichaItem(basicaFichaFiltered)}
                  {fichasCustomFiltered.length > 0 ? (
                    <>
                      <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                        Suas fichas
                      </div>
                      {fichasCustomFiltered.map((f) => (
                        <Fragment key={f.id}>{renderFichaItem(f)}</Fragment>
                      ))}
                    </>
                  ) : null}
                </>
              ) : showSplitSections && !basicaFichaFiltered && fichasCustomFiltered.length > 0 ? (
                <>
                  <div className="bg-[#f8fafc] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                    Suas fichas
                  </div>
                  {fichasCustomFiltered.map((f) => (
                    <Fragment key={f.id}>{renderFichaItem(f)}</Fragment>
                  ))}
                </>
              ) : (
                fichasFiltered.map((f) => (
                  <Fragment key={f.id}>{renderFichaItem(f)}</Fragment>
                ))
              )}
            </div>
          </div>
        ) : null}

        {fichaDropdownNovo &&
        fichaSelecionada &&
        !isConsultaBasicaFicha(fichaSelecionada) &&
        (fichaSelecionada.itens?.length || 0) > 0 ? (
          <div className="mt-2 flex items-center gap-2 text-[12px] font-medium text-[#0f766e]">
            <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Ficha selecionada — as perguntas aparecerão abaixo
          </div>
        ) : null}
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
            onClick={toggleModoVisualizacao}
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
        <div className="space-y-5 mb-6 p-6 bg-white border-[3px] border-[#a855f7]/20 rounded-2xl">
          <h4 className="text-[16px] font-bold text-[#0f172a] mb-2">{fichaSelecionada.nome}</h4>
          {itensOrdenados.map((item) => {
            const isAlerta = item.pergunta?.prioridade === 'ALERTA';
            const showObrigatorio = Boolean(item.obrigatorio);
            return (
              <div
                key={item.id}
                className={isAlerta
                  ? 'rounded-xl border-[2px] border-red-300 border-l-[4px] border-l-red-500 bg-[#fff5f5] p-4'
                  : 'rounded-xl border-[2px] border-[#00a88e]/15 bg-white p-4'}
              >
                {(isAlerta || showObrigatorio) && (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {isAlerta ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-700 bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        <span aria-hidden>⚠</span>
                        Alerta
                      </span>
                    ) : <span aria-hidden className="w-1" />}
                    {showObrigatorio ? (
                      <span className="inline-flex shrink-0 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap shadow-sm">
                        obrigatório
                      </span>
                    ) : <span aria-hidden className="w-1" />}
                  </div>
                )}
                <div>
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

      {/* Queixa/expectativas: só ficha básica ou sem perguntas; ficha com itens usa só perguntas */}
      {mostrarQueixaExpectativas ? (
        <form
          className={`space-y-6 bg-white border-[3px] rounded-2xl p-6 ${
            step2Errors.queixa || step2Errors.expectativas ? 'border-red-300' : 'border-[#00a88e]/25'
          }`}
        >
          <div>
            <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Queixa e Expectativas</h4>
            {queixaOpcional ? (
              <p className="text-[12px] font-medium text-[#64748b]">(opcional se anamnese já preenchida)</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-[13px] font-bold text-[#00a88e]">
              Queixa Principal
              {!queixaOpcional ? <span className="text-red-500"> *</span> : null}
            </label>
            <textarea
              value={queixa}
              onChange={(e) => {
                setQueixa(e.target.value);
                setStep2Errors((prev) => ({ ...prev, queixa: false }));
              }}
              rows={4}
              readOnly={modoVisualizacao}
              className={`w-full rounded-xl border-[2px] p-3 text-[16px] font-medium outline-none focus:ring-2 focus:ring-[#00a88e]/25 sm:text-[14px] ${
                modoVisualizacao ? 'cursor-default bg-slate-50 opacity-95' : 'bg-[#f8fbfb]'
              } ${
                step2Errors.queixa
                  ? 'border-red-500 bg-red-50 focus:border-red-600'
                  : 'border-[#e2e8f0] focus:border-[#00a88e]'
              }`}
              placeholder="Descreva o motivo da consulta..."
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-[13px] font-bold text-[#00a88e]">
              Expectativas do Paciente
              {!queixaOpcional ? <span className="text-red-500"> *</span> : null}
            </label>
            <textarea
              value={expectativas}
              onChange={(e) => {
                setExpectativas(e.target.value);
                setStep2Errors((prev) => ({ ...prev, expectativas: false }));
              }}
              rows={4}
              readOnly={modoVisualizacao}
              className={`w-full rounded-xl border-[2px] p-3 text-[16px] font-medium outline-none focus:ring-2 focus:ring-[#00a88e]/25 sm:text-[14px] ${
                modoVisualizacao ? 'cursor-default bg-slate-50 opacity-95' : 'bg-[#f8fbfb]'
              } ${
                step2Errors.expectativas
                  ? 'border-red-500 bg-red-50 focus:border-red-600'
                  : 'border-[#e2e8f0] focus:border-[#00a88e]'
              }`}
              placeholder="O que o paciente espera do procedimento..."
            />
          </div>
        </form>
      ) : null}
    </div>
  );
});
