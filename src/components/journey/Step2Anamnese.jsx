import React, { Fragment, useState, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, useRef } from 'react';
import {
  ClipboardList,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  Stethoscope,
  X,
} from 'lucide-react';
import { anamneseApi } from '../../services/api';
import { usePerfilClinico } from '../../hooks/usePerfilClinico';
import { PerfilClinicoBloco } from '../perfil-clinico/PerfilClinicoBloco';
import { DynamicQuestion } from '../anamnese/DynamicQuestion.jsx';
import {
  buildPerguntaTipoById,
  buildRespostaApiRow,
  groupItensByCategoria,
  isFullWidthItem,
  isRespostaPreenchida,
  mergeApiRespostasToMap,
} from '../anamnese/anamneseFichaUtils.js';

/** Mesmo padrão de `PatientProfileView` / payload gravado em `createPaciente`. */
function parseQueixaExpectativasObs(observacoes) {
  if (!observacoes || typeof observacoes !== 'string' || !observacoes.trim()) return null;
  const expMarker = '. Expectativas:';
  const expIdx = observacoes.indexOf(expMarker);
  if (expIdx !== -1) {
    const queixa = observacoes.slice(0, expIdx).replace(/^Queixa:\s*/i, '').trim();
    const expectativas = observacoes.slice(expIdx + expMarker.length).trim();
    return { queixa, expectativas };
  }
  if (/^Queixa:\s*/i.test(observacoes)) {
    return { queixa: observacoes.replace(/^Queixa:\s*/i, '').trim(), expectativas: '' };
  }
  if (/^Expectativas:\s*/i.test(observacoes)) {
    return { queixa: '', expectativas: observacoes.replace(/^Expectativas:\s*/i, '').trim() };
  }
  return null;
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

export const Step2Anamnese = forwardRef(function Step2Anamnese({
  queixa, setQueixa,
  expectativas, setExpectativas,
  pacienteId = null,
  pacienteSexo = null,
  roleUserId = null,
  step2Errors = {},
  setStep2Errors = () => {},
  savedAnamneseState = null,
  onSavedAnamneseStateChange = () => {},
  respostasAnamnese = {},
  salvarRespostaAnamnese = () => {},
  setRespostasAnamnese = () => {},
  onQueixaVisibilityChange,
  perfilClinicoDraft = null,
  onPerfilClinicoDraftChange = () => {},
  consultaMode = false,
  onConcluirAnamnese,
  isConcluirAnamneseBusy = false,
  onAutoSaveAnamnese = null,
}, ref) {
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved'
  const [fichas, setFichas] = useState([]);
  const draftValido = savedAnamneseState?.pacienteId === pacienteId;
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState(
    () => (draftValido ? savedAnamneseState?.fichaSelecionadaId || '' : '')
  );
  const [fichaSelecionada, setFichaSelecionada] = useState(null);
  const [respostas, setRespostas] = useState(
    () => draftValido
      ? mergeInitialRespostas(savedAnamneseState?.respostas, respostasAnamnese)
      : {}
  );
  const [preenchimentoAnterior, setPreenchimentoAnterior] = useState(
    () => (draftValido ? savedAnamneseState?.preenchimentoAnterior || null : null)
  );
  const [modoVisualizacao, setModoVisualizacao] = useState(
    () => Boolean(draftValido && savedAnamneseState?.modoVisualizacao)
  );
  const [fichaDropdownNovo, setFichaDropdownNovo] = useState(
    () => (draftValido ? savedAnamneseState?.fichaDropdownNovo ?? '' : '')
  );
  const [errosObrigatorias, setErrosObrigatorias] = useState(() => new Set());

  // ── Perfil Clínico (Bloco 1) ─────────────────────────────
  const perfilClinico = usePerfilClinico(pacienteId, roleUserId, pacienteSexo, {
    draft: perfilClinicoDraft,
    onDraftChange: onPerfilClinicoDraftChange,
  });

  const itensOrdenados = useMemo(
    () =>
      fichaSelecionada?.itens
        ? [...fichaSelecionada.itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : [],
    [fichaSelecionada],
  );

  const itensPorSecao = useMemo(() => groupItensByCategoria(itensOrdenados), [itensOrdenados]);

  const mostrarQueixaExpectativas = !fichaSelecionada || itensOrdenados.length === 0;
  /** Ficha personalizada com perguntas: complemento opcional no final (motivo da visita). */
  const mostrarComplementoVisita = Boolean(fichaSelecionada && itensOrdenados.length > 0);

  useImperativeHandle(ref, () => ({
    getAnamneseData: () => {
      if (!fichaSelecionadaId || !fichaSelecionada) return null;
      const perguntaById = new Map(
        itensOrdenados.map((item) => [String(item.pergunta?.id), item.pergunta]),
      );
      const rows = [];
      for (const r of Object.values(respostas)) {
        const pergunta = perguntaById.get(String(r.perguntaId));
        if (!pergunta) continue;
        const row = buildRespostaApiRow(pergunta, r);
        if (row) rows.push(row);
      }
      return {
        anamneseId: fichaSelecionadaId,
        respostas: rows,
      };
    },
    /** Modo leitura ou reaproveitando preenchimento anterior — queixa opcional no UI. */
    skipQueixaExpectativas: () => Boolean(modoVisualizacao || preenchimentoAnterior),
    /** Valida perguntas obrigatórias da ficha (front-only; back não valida hoje). */
    validateObrigatorias: () => {
      if (modoVisualizacao || preenchimentoAnterior) return { ok: true, faltando: [] };
      if (!fichaSelecionada || itensOrdenados.length === 0) return { ok: true, faltando: [] };

      const faltando = [];
      for (const item of itensOrdenados) {
        if (!item.obrigatorio) continue;
        const pid = item.pergunta?.id;
        if (pid == null) continue;
        const resposta = respostas[pid] ?? respostas[String(pid)];
        if (!isRespostaPreenchida(item.pergunta, resposta)) faltando.push(pid);
      }
      setErrosObrigatorias(new Set(faltando.map(String)));
      if (faltando.length > 0) {
        const firstId = String(faltando[0]);
        requestAnimationFrame(() => {
          document.querySelector(`[data-pergunta-id="${firstId}"]`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
      }
      return { ok: faltando.length === 0, faltando };
    },
    /** Salva perfil clínico. Retorna { ok, error? }. */
    savePerfilClinico: () => perfilClinico.save(),
    /** Perfil tem edições não salvas. */
    isPerfilDirty: () => perfilClinico.isDirty,
    /** PUT perfil em andamento. */
    isPerfilSaving: () => perfilClinico.isSaving,
    /**
     * Retorna true se a anamnese tem dados preenchidos que ainda não foram salvos/concluídos.
     * Checamos apenas o estado interno: respostas da ficha e seleção de dropdown.
     * Queixa e expectativas são verificadas pelo AppRefactored via journeyState diretamente.
     */
    isDirty: () => {
      if (modoVisualizacao) return false;
      const hasRespostas = Object.keys(respostas).length > 0;
      const hasFichaDropdown = Boolean(fichaDropdownNovo);
      return hasRespostas || hasFichaDropdown;
    },
  }), [fichaSelecionadaId, fichaSelecionada, respostas, modoVisualizacao, preenchimentoAnterior, perfilClinico, itensOrdenados, fichaDropdownNovo]);
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
    console.debug('[Step2Anamnese] hydrate', {
      pacienteId,
      draftPacienteId: savedAnamneseState?.pacienteId,
      draftValido: savedAnamneseState?.pacienteId === pacienteId,
      historicoLen: historicoPaciente?.length,
    });
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

  const mostrarLinkAbrirUltima =
    pacienteId && !loadingHistoricoPaciente && ultimaAnamnese && !preenchimentoAnterior;

  /** Select / novo preenchimento: só template; sem histórico; evita reidratar respostas do pai. */
  const selecionarFichaParaNovo = useCallback(async (id) => {
    const idStr = id === '' || id == null ? '' : String(id);
    setRespostasAnamnese({});
    setFichaDropdownNovo(idStr);
    onSavedAnamneseStateChange({
      ...(savedAnamneseState || {}),
      pacienteId,
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
      pacienteId,
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
            const respostasCarregadas = mergeApiRespostasToMap(
              detalhes?.respostas,
              buildPerguntaTipoById(ficha),
            );
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
        pacienteId,
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

  // Reseta estado local ao trocar de paciente; na montagem inicial usa o draft se pacienteId bater
  const prevPacienteIdRef = useRef(pacienteId);
  useEffect(() => {
    const prev = prevPacienteIdRef.current;
    prevPacienteIdRef.current = pacienteId;
    if (prev === pacienteId) return; // mesmo paciente (inclui primeiro render)
    setFichaSelecionadaId('');
    setFichaSelecionada(null);
    setRespostas({});
    setPreenchimentoAnterior(null);
    setModoVisualizacao(false);
    setFichaDropdownNovo('');
    respostasRef.current = {};
    setErrosObrigatorias(new Set());
  }, [pacienteId]);

  const handleRespostaChange = useCallback((resposta) => {
    if (modoVisualizacao) return;
    const key = String(resposta.perguntaId);
    const normalized = { ...resposta, perguntaId: resposta.perguntaId };
    const next = { ...respostasRef.current, [key]: normalized };
    respostasRef.current = next;
    setRespostas(next);
    setErrosObrigatorias((prev) => {
      if (!prev.has(key)) return prev;
      const cleared = new Set(prev);
      cleared.delete(key);
      return cleared;
    });
    onSavedAnamneseStateChange({
      ...(savedDraftRef.current || {}),
      pacienteId,
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
      pacienteId,
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

  /** Ficha exibida no combobox — cobre seleção nova e abertura via histórico. */
  const selectedFichaLista = useMemo(() => {
    if (fichaDropdownNovo) {
      return fichas.find((f) => String(f.id) === String(fichaDropdownNovo)) ?? null;
    }
    if (fichaSelecionadaId) {
      return fichas.find((f) => String(f.id) === String(fichaSelecionadaId)) ?? fichaSelecionada ?? null;
    }
    return null;
  }, [fichas, fichaDropdownNovo, fichaSelecionadaId, fichaSelecionada]);

  function renderFichaItem(f) {
    const selected = String(fichaSelecionadaId) === String(f.id);
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
      <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <Stethoscope className="h-5 w-5 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-slate-800">Dados clínicos do paciente</h3>
          <p className="text-[12px] text-slate-500">Perfil permanente e ficha desta consulta</p>
        </div>
      </div>

      {/* Bloco 1 — Perfil Clínico Persistente */}
      {pacienteId && (
        <div className="mb-6 min-w-0 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
          <div className="rounded-t-[11px] border-b border-slate-200/80 bg-slate-100/60 px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Dados permanentes do paciente
            </p>
          </div>
          <div className="min-w-0 px-3 py-4 sm:px-4">
            <PerfilClinicoBloco
              state={perfilClinico.state}
              isLoading={perfilClinico.isLoading}
              isSaving={perfilClinico.isSaving}
              isDirty={perfilClinico.isDirty}
              error={perfilClinico.error}
              load={perfilClinico.load}
              addItem={perfilClinico.addItem}
              removeItem={perfilClinico.removeItem}
              updateObservacao={perfilClinico.updateObservacao}
              updateMedicamentoExtra={perfilClinico.updateMedicamentoExtra}
              buscarAlimentos={perfilClinico.buscarAlimentos}
              buscarPrincipiosAtivos={perfilClinico.buscarPrincipiosAtivos}
              buscarMedicamentos={perfilClinico.buscarMedicamentos}
              buscarAntecedentes={perfilClinico.buscarAntecedentes}
            />
          </div>
        </div>
      )}

      <div className="mb-5 mt-8 min-w-0 border-t-2 border-slate-300 pt-8">
        <div className="mb-4 flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#00a88e]" strokeWidth={2} aria-hidden />
          <div className="min-w-0 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
              Ficha de anamnese desta consulta
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Perguntas específicas desta consulta
            </p>
          </div>
        </div>

      {/* Bloco 2 — Anamnese da visita */}
      {pacienteId && loadingHistoricoPaciente && (
        <div className="mb-6 flex items-center gap-2 text-[#64748b] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Carregando histórico de anamneses do paciente…
        </div>
      )}

      {fichaSelecionadaId && preenchimentoAnterior && !estaAtualizadaUltima && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border-[2px] border-[#f59e0b]/50 bg-[#fffbeb] px-4 py-3">
          <span className="mt-0.5 text-[#f59e0b] text-[18px]">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#b45309]">Anamnese desatualizada</p>
            <p className="text-[12px] font-medium text-[#92400e] mt-0.5">
              O último preenchimento foi há mais de 6 meses. Recomendamos atualizar antes de continuar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModoVisualizacao(false);
              onSavedAnamneseStateChange({
                ...(savedDraftRef.current || {}),
                pacienteId,
                fichaSelecionadaId,
                fichaDropdownNovo,
                respostas: respostasRef.current,
                preenchimentoAnterior,
                modoVisualizacao: false,
              });
            }}
            className="shrink-0 rounded-lg bg-[#f59e0b] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#d97706] transition-colors"
          >
            Atualizar agora
          </button>
        </div>
      )}

      <div className="relative mb-6 min-w-0" ref={fichaMenuRef}>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
          {fichaSelecionadaId ? 'Ficha de anamnese' : 'Selecionar ficha de anamnese'}
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

        {mostrarLinkAbrirUltima && !fichaMenuOpen ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#64748b]">
                Este paciente já tem anamnese preenchida
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[#94a3b8]">
                {ultimaAnamnese.nome} · {dataLinhaUltima}
              </p>
            </div>
            <button
              type="button"
              onClick={() => consultarUltimoPreenchimento(ultimaAnamnese.fichaId)}
              className={`h-8 shrink-0 self-start rounded-lg px-3 text-[12px] font-semibold text-white transition-colors sm:self-center ${
                estaAtualizadaUltima
                  ? 'bg-[#00a88e] hover:bg-[#00967f]'
                  : 'bg-[#f59e0b] hover:bg-[#d97706]'
              }`}
            >
              Abrir último preenchimento
            </button>
          </div>
        ) : null}

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

        {fichaSelecionadaId &&
        fichaSelecionada &&
        !isConsultaBasicaFicha(fichaSelecionada) &&
        (fichaSelecionada.itens?.length || 0) > 0 &&
        !fichaMenuOpen ? (
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
        <div className="mb-6 w-full min-w-0 max-w-5xl xl:max-w-6xl">
          {/* Título da ficha — discreto */}
          <p className="mb-5 text-[15px] font-semibold text-slate-700">{fichaSelecionada.nome}</p>

          {/* Seções por categoriaNome */}
          {itensPorSecao.map(({ categoriaNome, itens: secaoItens }, secIdx) => (
            <div key={categoriaNome || `sec-${secIdx}`} className={secIdx > 0 ? 'mt-8' : ''}>
              {categoriaNome ? (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{categoriaNome}</p>
                  <div className="mt-1 border-b border-slate-100" />
                </div>
              ) : null}

              {/* Grid responsivo */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
                {secaoItens.map((item) => {
                  const isAlerta = item.pergunta?.prioridade === 'ALERTA';
                  const showObrigatorio = Boolean(item.obrigatorio);
                  const perguntaId = item.pergunta?.id;
                  const hasError = perguntaId != null && errosObrigatorias.has(String(perguntaId));
                  return (
                    <div
                      key={item.id}
                      data-pergunta-id={perguntaId != null ? String(perguntaId) : undefined}
                      className={`min-w-0 ${isFullWidthItem(item) ? 'md:col-span-2' : ''} ${
                        isAlerta ? 'border-l-2 border-l-red-400 pl-3' : ''
                      } ${hasError ? 'rounded-lg p-2 ring-1 ring-red-300' : ''}`}
                    >
                      <DynamicQuestion
                        numero={item.ordem ?? (itensOrdenados.findIndex((i) => i.id === item.id) + 1)}
                        pergunta={item.pergunta}
                        resposta={respostas[item.pergunta?.id] ?? respostas[String(item.pergunta?.id)]}
                        onChange={handleRespostaChange}
                        alerta={isAlerta}
                        obrigatorio={showObrigatorio}
                        readOnly={modoVisualizacao}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {preenchimentoAnterior && (
            <div className="mt-8 pt-4 border-t border-[#e2e8f0] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => selecionarFichaParaNovo('')}
                className="text-[12px] font-bold text-[#64748b] hover:text-[#f59e0b] transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Trocar ficha
              </button>
              <button
                type="button"
                onClick={toggleModoVisualizacao}
                className="text-[12px] font-bold text-[#64748b] hover:text-[#00a88e] transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {modoVisualizacao ? 'Modificar anamnese' : 'Cancelar modificação'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Complemento da visita — ficha personalizada: motivo opcional no final */}
      {mostrarComplementoVisita ? (
        <div className="mt-6 w-full min-w-0 max-w-5xl xl:max-w-6xl">
          <div className="border-t border-slate-100 pt-5">
            <label className="mb-2 block text-[13px] font-semibold text-slate-700" htmlFor="complemento-visita-queixa">
              Motivo da consulta
              <span className="ml-1.5 text-[12px] font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              id="complemento-visita-queixa"
              value={queixa}
              onChange={(e) => {
                setQueixa(e.target.value);
                setStep2Errors((prev) => ({ ...prev, queixa: false }));
              }}
              rows={3}
              readOnly={modoVisualizacao}
              className={`w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15 transition-colors ${
                modoVisualizacao ? 'cursor-default bg-slate-50 opacity-90' : 'bg-white'
              }`}
              placeholder="O que trouxe o paciente nesta consulta…"
            />
          </div>
        </div>
      ) : null}

      {/* Queixa/expectativas: só ficha básica ou sem perguntas */}
      {mostrarQueixaExpectativas ? (
        <form
          className={`space-y-6 bg-white border rounded-2xl p-6 ${
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
            <div className="relative">
              {saveStatus === 'saving' && (
                <div className="absolute right-2 top-1 flex items-center gap-1 text-[#94a3b8]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#94a3b8]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Salvando...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="absolute right-2 top-1 flex items-center gap-1 text-[#00a88e]">
                  <span className="text-[11px]">☁️</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Salvo</span>
                </div>
              )}
              <textarea
                value={queixa}
                onChange={(e) => {
                  setQueixa(e.target.value);
                  setStep2Errors((prev) => ({ ...prev, queixa: false }));
                }}
                onBlur={async () => {
                  if (!queixa?.trim() || typeof onAutoSaveAnamnese !== 'function') return;
                  setSaveStatus('saving');
                  await onAutoSaveAnamnese();
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus(''), 2500);
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
              onBlur={async () => {
                if (!expectativas?.trim() || typeof onAutoSaveAnamnese !== 'function') return;
                setSaveStatus('saving');
                await onAutoSaveAnamnese();
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(''), 2500);
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

      {consultaMode ? (
        <div className="mt-8 flex justify-end border-t border-app-border pt-6">
          <button
            type="button"
            onClick={() => onConcluirAnamnese?.()}
            disabled={isConcluirAnamneseBusy}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConcluirAnamneseBusy ? 'Salvando…' : 'Concluir Anamnese'}
          </button>
        </div>
      ) : null}
    </div>
  );
});
