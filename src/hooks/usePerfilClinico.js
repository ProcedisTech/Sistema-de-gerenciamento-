import { useState, useCallback, useRef, useEffect } from 'react';
import { perfilClinicoApi, catalogoClinicoApi, getApiErrorToastMessage } from '../services/api';

/**
 * Normaliza sexo para o parâmetro da API de catálogo de antecedentes.
 * Retorna 'M', 'F' ou undefined (omitido).
 */
function normalizeSexoForApi(sexo) {
  if (!sexo) return undefined;
  const s = String(sexo).trim().toUpperCase();
  if (s === 'M' || s === 'MASCULINO' || s === 'MALE') return 'M';
  if (s === 'F' || s === 'FEMININO' || s === 'FEMALE') return 'F';
  return undefined;
}

/**
 * Mapeia a resposta do GET /perfil-clinico para o estado da UI.
 * `id` = id do catálogo (contrato back).
 * @param {object} data — PerfilClinicoResponseDTO
 */
export function mapGetToState(data) {
  const toChips = (arr) =>
    Array.isArray(arr)
      ? arr.map((item) => ({
          id: item.id ?? item.codigo,
          codigo: item.codigo,
          nome: item.nome,
          observacao: item.observacao ?? '',
          tipoCodigo: item.tipoCodigo ?? undefined,
          dose: item.dose ?? '',
          frequencia: item.frequencia ?? '',
          usoContinuo: item.usoContinuo ?? true,
          origemDeclaracao: item.origemDeclaracao ?? null,
          confirmadoEm: item.confirmadoEm ?? null,
          reacaoAdversaId: item.reacaoAdversaId ?? null,
          reacaoNome: item.reacaoNome ?? null,
        }))
      : [];

  return {
    alergias: toChips(data?.alergias),
    alergiasPrincipioAtivo: toChips(data?.alergiasPrincipioAtivo),
    medicamentosEmUso: toChips(data?.medicamentosEmUso),
    antecedentes: toChips(data?.antecedentes),
  };
}

/**
 * Mensagem amigável para erros de carregamento do perfil clínico.
 * Perfil vazio = GET 200 com listas vazias (não passa por aqui).
 */
export function classifyPerfilError(err) {
  const status = err != null && typeof err === 'object' ? err.status : undefined;
  if (status === 403) {
    return 'Paciente não pertence a esta clínica.';
  }
  if (status === 404) {
    return 'Paciente não encontrado.';
  }
  return getApiErrorToastMessage(
    err,
    'Não foi possível carregar o perfil clínico. Tente novamente.',
  );
}

/**
 * Monta o body do PUT. Sempre envia as 4 listas (regra 1 do plano).
 */
function mapStateToPutBody(state, roleUserId) {
  const toPayload = (arr) =>
    Array.isArray(arr)
      ? arr.map((item) => ({
          id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          observacao: item.observacao || null,
          reacaoAdversaId: item.reacaoAdversaId || null,
          dose: item.dose || null,
          frequencia: item.frequencia || null,
          usoContinuo: item.usoContinuo ?? null,
        }))
      : [];

  return {
    roleUserId,
    alergias: toPayload(state.alergias),
    alergiasPrincipioAtivo: toPayload(state.alergiasPrincipioAtivo),
    medicamentosEmUso: toPayload(state.medicamentosEmUso),
    antecedentes: toPayload(state.antecedentes),
  };
}

const EMPTY_STATE = {
  alergias: [],
  alergiasPrincipioAtivo: [],
  medicamentosEmUso: [],
  antecedentes: [],
};

/**
 * Hook de estado do Perfil Clínico de um paciente.
 */
export function usePerfilClinico(pacienteId, roleUserId, sexoPaciente, { draft = null, onDraftChange = () => {} } = {}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [tiposByCodigo, setTiposByCodigo] = useState({});
  const [reacoesAdversas, setReacoesAdversas] = useState([]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const sexoNorm = normalizeSexoForApi(sexoPaciente);

  const load = useCallback(async () => {
    if (!pacienteId) return;
    if (draftRef.current?.pacienteId === pacienteId && draftRef.current?.isDirty) {
      setState(draftRef.current.state ?? EMPTY_STATE);
      setIsDirty(true);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await perfilClinicoApi.get(pacienteId);
      const mapped = mapGetToState(data);
      setState(mapped);
      setIsDirty(false);
      onDraftChange({ pacienteId, state: mapped, isDirty: false });
    } catch (err) {
      if (draftRef.current?.pacienteId === pacienteId && draftRef.current?.isDirty) {
        setState(draftRef.current.state ?? EMPTY_STATE);
        setIsDirty(true);
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    catalogoClinicoApi.tiposAntecedente()
      .then((d) => {
        if (cancelled || !Array.isArray(d)) return;
        const map = {};
        d.forEach((t) => {
          if (t?.codigo) map[t.codigo] = t.nome;
        });
        setTiposByCodigo(map);
      })
      .catch(() => {
        if (!cancelled) setTiposByCodigo({});
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    catalogoClinicoApi.reacoesAdversas()
      .then((d) => {
        if (cancelled || !Array.isArray(d)) return;
        setReacoesAdversas(d);
      })
      .catch(() => {
        if (!cancelled) setReacoesAdversas([]);
      });
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async () => {
    if (!pacienteId || !roleUserId) {
      return { ok: false, error: new Error('pacienteId ou roleUserId ausente') };
    }
    setIsSaving(true);
    try {
      const body = mapStateToPutBody(stateRef.current, roleUserId);
      const response = await perfilClinicoApi.put(pacienteId, body);
      const mapped = response ? mapGetToState(response) : stateRef.current;
      setState(mapped);
      stateRef.current = mapped;
      setIsDirty(false);
      onDraftChange({ pacienteId, state: mapped, isDirty: false });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, roleUserId]);

  const updateState = useCallback((updater) => {
    const prev = stateRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    setIsDirty(true);
    onDraftChange({ pacienteId, state: next, isDirty: true });
  }, [pacienteId, onDraftChange]);

  const addItem = useCallback((section, item) => {
    updateState((prev) => {
      const list = prev[section] ?? [];
      if (list.some((i) => i.id === item.id)) return prev;
      return { ...prev, [section]: [...list, item] };
    });
  }, [updateState]);

  const removeItem = useCallback((section, itemId) => {
    updateState((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).filter((i) => i.id !== itemId),
    }));
  }, [updateState]);

  const updateObservacao = useCallback((section, itemId, observacao) => {
    updateState((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).map((i) =>
        i.id === itemId ? { ...i, observacao } : i
      ),
    }));
  }, [updateState]);

  const updateMedicamentoExtra = useCallback((itemId, fields) => {
    updateState((prev) => ({
      ...prev,
      medicamentosEmUso: (prev.medicamentosEmUso ?? []).map((i) =>
        i.id === itemId ? { ...i, ...fields } : i
      ),
    }));
  }, [updateState]);

  const updateReacaoAdversa = useCallback((itemId, reacaoAdversaId, reacaoNome) => {
    updateState((prev) => ({
      ...prev,
      alergiasPrincipioAtivo: (prev.alergiasPrincipioAtivo ?? []).map((i) =>
        i.id === itemId ? { ...i, reacaoAdversaId, reacaoNome } : i
      ),
    }));
  }, [updateState]);

  const buscarAlimentos = useCallback((q) =>
    catalogoClinicoApi.alimentos(q).then((d) => Array.isArray(d) ? d : []).catch(() => []),
  []);

  const buscarPrincipiosAtivos = useCallback((q) =>
    catalogoClinicoApi.principiosAtivos(q).then((d) => Array.isArray(d) ? d : []).catch(() => []),
  []);

  const buscarMedicamentos = useCallback((q) =>
    catalogoClinicoApi.medicamentos(q).then((d) => Array.isArray(d) ? d : []).catch(() => []),
  []);

  const buscarAntecedentes = useCallback((q) =>
    catalogoClinicoApi.antecedentesPessoais(q, sexoNorm).then((d) => Array.isArray(d) ? d : []).catch(() => []),
  [sexoNorm]);

  return {
    state,
    isLoading,
    isSaving,
    error,
    isDirty,
    load,
    save,
    addItem,
    removeItem,
    updateObservacao,
    updateMedicamentoExtra,
    updateReacaoAdversa,
    buscarAlimentos,
    buscarPrincipiosAtivos,
    buscarMedicamentos,
    buscarAntecedentes,
    tiposByCodigo,
    reacoesAdversas,
  };
}
