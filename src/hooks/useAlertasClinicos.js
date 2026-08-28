import { useEffect, useMemo, useState } from 'react';
import { perfilClinicoApi } from '../services/api';

export const EMPTY_RESUMO = Object.freeze({
  temVigente: false,
  vigenteEm: null,
  vigenteAssinada: false,
  alergiasAlimentares: [],
  alergiasPrincipioAtivo: [],
  medicamentosEmUso: [],
  condicoesSaude: [],
  declaracoesCriticas: [],
  declaracoesDemais: [],
  historicoFamiliar: [],
  historico: [],
});

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function valorItem(item) {
  if (!item?.nome) return '';
  const parts = [item.nome];
  if (item.dose) parts.push(item.dose);
  if (item.frequencia) parts.push(item.frequencia);
  if (item.observacao) parts.push(item.observacao);
  return parts.join(' · ');
}

export function normalizeResumo(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_RESUMO };
  }
  return {
    temVigente: raw.temVigente === true,
    vigenteEm: raw.vigenteEm ?? null,
    vigenteAssinada: raw.vigenteAssinada === true,
    alergiasAlimentares: asList(raw.alergiasAlimentares),
    alergiasPrincipioAtivo: asList(raw.alergiasPrincipioAtivo),
    medicamentosEmUso: asList(raw.medicamentosEmUso),
    condicoesSaude: asList(raw.condicoesSaude),
    declaracoesCriticas: asList(raw.declaracoesCriticas),
    declaracoesDemais: asList(raw.declaracoesDemais),
    historicoFamiliar: asList(raw.historicoFamiliar),
    historico: asList(raw.historico),
  };
}

function chipsPerfil(lista, secao, titulo, keyPrefix) {
  return lista
    .filter((chip) => chip?.nome)
    .map((chip) => ({
      key: `${keyPrefix}-${chip.id ?? chip.nome}`,
      titulo,
      valor: valorItem(chip),
      secao,
      origem: 'perfil',
      nome: chip.nome,
    }));
}

/**
 * Deriva os arrays legados da sidebar/modal a partir do resumo (já filtrado pelo vigente).
 * `criticosCount` = alergias alimentares + PA + declarações críticas — mesmo critério do selo da faixa.
 */
export function mapResumoToLegacy(resumo) {
  const r = normalizeResumo(resumo);
  const alertasPerfil = [
    ...chipsPerfil(r.alergiasAlimentares, 'alergias', 'Alergia alimentar', 'perfil-alergia'),
    ...chipsPerfil(r.alergiasPrincipioAtivo, 'alergiasPrincipioAtivo', 'Alergia a princípio ativo', 'perfil-pa'),
    ...chipsPerfil(r.medicamentosEmUso, 'medicamentos', 'Medicamento em uso', 'perfil-med'),
    ...chipsPerfil(r.condicoesSaude, 'antecedentes', 'Antecedente', 'perfil-ant'),
  ];
  const alertasAnamnese = [
    ...r.declaracoesCriticas.map((texto, idx) => ({
      key: `fato-critica-${idx}`,
      titulo: texto,
      valor: texto,
      origem: 'anamnese',
      severidade: 'critica',
      familiar: false,
    })),
    ...r.declaracoesDemais.map((texto, idx) => ({
      key: `fato-alerta-${idx}`,
      titulo: texto,
      valor: texto,
      origem: 'anamnese',
      severidade: 'alerta',
      familiar: false,
    })),
    ...r.historicoFamiliar.map((texto, idx) => ({
      key: `fato-familiar-${idx}`,
      titulo: `Histórico familiar: ${texto}`,
      valor: `Histórico familiar: ${texto}`,
      origem: 'anamnese',
      severidade: 'alerta',
      familiar: true,
    })),
  ];
  const criticosCount =
    r.alergiasAlimentares.length + r.alergiasPrincipioAtivo.length + r.declaracoesCriticas.length;
  return {
    resumo: r,
    alertasPerfil,
    alertasAnamnese,
    alertasAlergia: [],
    criticosCount,
    temAnamneseVigente: r.temVigente,
    vigenteEm: r.vigenteEm,
    vigenteAssinada: r.vigenteAssinada,
    totalCount: alertasPerfil.length + alertasAnamnese.length,
  };
}

const resumoClinicoCache = new Map();

export function clearResumoClinicoCache(pacienteId) {
  if (pacienteId) resumoClinicoCache.delete(String(pacienteId));
  else resumoClinicoCache.clear();
}

/**
 * Fonte única da faixa clínica: GET /resumo-clinico (só o declarado no vigente).
 * Utiliza cache SWR em memória para exibição instantânea (0ms) sem travar a interface.
 */
export function useAlertasClinicos(pacienteId, { refreshKey } = {}) {
  const cached = pacienteId ? resumoClinicoCache.get(String(pacienteId)) : null;
  const [resumoRaw, setResumoRaw] = useState(cached ?? null);
  const [isLoading, setIsLoading] = useState(Boolean(pacienteId && !cached));

  useEffect(() => {
    if (!pacienteId) {
      setIsLoading(false);
      return undefined;
    }
    const currentCached = resumoClinicoCache.get(String(pacienteId));
    if (currentCached && !refreshKey) {
      setResumoRaw(currentCached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    let cancelled = false;
    (async () => {
      try {
        const dto = await perfilClinicoApi.resumo(pacienteId);
        if (!cancelled) {
          resumoClinicoCache.set(String(pacienteId), dto);
          setResumoRaw(dto);
        }
      } catch {
        if (!cancelled && !currentCached) setResumoRaw(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pacienteId, refreshKey]);

  const mapped = useMemo(() => mapResumoToLegacy(resumoRaw), [resumoRaw]);

  return {
    ...mapped,
    isLoading,
  };
}
