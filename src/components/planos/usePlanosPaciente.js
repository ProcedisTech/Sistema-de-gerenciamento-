import { useCallback, useEffect, useRef, useState } from 'react';
import { planejamentosApi, getApiErrorDetail } from '../../services/api.js';
import { normalizeListaPlanos } from '../../utils/planejamentoNormalize.js';
import { useAviso } from '../../contexts/useAviso.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';

export function usePlanosPaciente({ pacienteId, roleUserId, enabled = true, chaveRebusca }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && String(pacienteId ?? '').trim()));
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);

  // Guarda de ordem: só o último pedido aplica resultado (troca de paciente também descarta).
  const pedidoRef = useRef(0);

  const refresh = useCallback(async (opts = {}) => {
    const meu = ++pedidoRef.current;
    const pid = String(pacienteId ?? '').trim();
    if (!enabled || !pid) {
      setPlanos([]);
      setError('');
      setLoading(false);
      return;
    }
    const isSilent = Boolean(opts?.silent);
    if (!isSilent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await planejamentosApi.listarPorPaciente(pid);
      const normalized = normalizeListaPlanos(data);
      if (meu === pedidoRef.current) setPlanos(normalized);
      return normalized;
    } catch (e) {
      // Releitura silenciosa que falha deixa a lista atual na tela.
      if (!isSilent && meu === pedidoRef.current) {
        setPlanos([]);
        setError(getApiErrorDetail(e) || e?.message || 'Não foi possível carregar os planos.');
      }
      return [];
    } finally {
      if (meu === pedidoRef.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }, [pacienteId, enabled]);

  const chave = chaveRebusca ?? 0;
  useEffect(() => {
    refresh();
  }, [refresh, chave]);

  // Quem passa chaveRebusca já relê no "recarregar" por conta própria.
  const temChave = chaveRebusca !== undefined;
  const reler = useCallback((msg) => {
    if (msg?.tipo === 'recarregar' && temChave) return;
    refresh({ silent: true });
  }, [refresh, temChave]);
  const relerPorAgenda = useCallback((msg) => {
    if (msg?.tipo === 'recarregar') return; // o de PLANEJAMENTO já relê no "recarregar"
    refresh({ silent: true });
  }, [refresh]);
  useAviso(PREFIXO_AVISO.PLANEJAMENTO, reler, { registroId: pacienteId });
  useAviso(PREFIXO_AVISO.AGENDA, relerPorAgenda); // aviso de agenda leva agendaId: sem filtro por paciente

  const runMutation = useCallback(async (fn) => {
    setMutating(true);
    setError('');
    try {
      const result = await fn();
      await refresh({ silent: true });
      return result;
    } catch (e) {
      const msg = getApiErrorDetail(e) || e?.message || 'Operação falhou.';
      setError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const criarPlano = useCallback(
    (observacao = '') =>
      runMutation(async () => {
        const pid = String(pacienteId ?? '').trim();
        if (!pid) throw new Error('Paciente inválido.');
        const body = { pacienteId: pid, observacao: String(observacao ?? '').trim() };
        const rid = String(roleUserId ?? '').trim();
        if (/^[0-9a-f-]{36}$/i.test(rid)) body.roleUserId = rid;
        return planejamentosApi.criar(body);
      }),
    [pacienteId, roleUserId, runMutation],
  );

  const adicionarItem = useCallback(
    (planoId, { catalogoProcedimentoSaudeId, valorOrcado, dataPlanejada }) =>
      runMutation(() => {
        const body = {
          catalogoProcedimentoSaudeId: String(catalogoProcedimentoSaudeId ?? '').trim(),
        };
        if (valorOrcado != null && String(valorOrcado).trim() !== '') {
          body.valorOrcado = Number(valorOrcado);
        }
        if (dataPlanejada != null && String(dataPlanejada).trim() !== '') {
          body.dataPlanejada = String(dataPlanejada).trim();
        }
        return planejamentosApi.adicionarItem(planoId, body);
      }),
    [runMutation],
  );

  const editarItem = useCallback(
    (planoId, itemId, patch) =>
      runMutation(() => {
        const body = {};
        if (patch?.valorOrcado !== undefined) {
          const v = patch.valorOrcado;
          body.valorOrcado =
            v == null || String(v).trim() === '' ? null : Number(v);
        }
        if (patch?.dataPlanejada !== undefined) {
          const d = patch.dataPlanejada;
          body.dataPlanejada = d == null || String(d).trim() === '' ? null : String(d).trim();
        }
        if (patch?.catalogoProcedimentoSaudeId) {
          body.catalogoProcedimentoSaudeId = String(patch.catalogoProcedimentoSaudeId).trim();
        }
        return planejamentosApi.atualizarItem(planoId, itemId, body);
      }),
    [runMutation],
  );

  const removerItem = useCallback(
    (planoId, itemId) => runMutation(() => planejamentosApi.removerItem(planoId, itemId)),
    [runMutation],
  );

  const alterarStatusPlano = useCallback(
    (planoId, codigo) =>
      runMutation(() => planejamentosApi.alterarStatus(planoId, { codigo })),
    [runMutation],
  );

  const patchItemStatusLocal = useCallback((planoId, itemId, patch) => {
    const pid = String(planoId ?? '').trim();
    const iid = String(itemId ?? '').trim();
    if (!pid || !iid) return;
    setPlanos((prev) =>
      (Array.isArray(prev) ? prev : []).map((plano) => {
        if (String(plano.id) !== pid) return plano;
        return {
          ...plano,
          itens: (plano.itens ?? []).map((item) =>
            String(item.id) === iid ? { ...item, ...patch } : item,
          ),
        };
      }),
    );
  }, []);

  const darBaixaItem = useCallback(
    async (planoId, itemId) => {
      setMutating(true);
      setError('');
      try {
        await planejamentosApi.darBaixaItem(planoId, itemId);
        patchItemStatusLocal(planoId, itemId, {
          statusItem: 'finalizado',
          statusItemNome: 'Realizado',
        });
        return await refresh();
      } catch (e) {
        const msg = getApiErrorDetail(e) || e?.message || 'Operação falhou.';
        setError(msg);
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [patchItemStatusLocal, refresh],
  );

  const salvarPlano = useCallback(async (planoId, body) => {
    return planejamentosApi.salvar(planoId, body);
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return {
    planos,
    loading,
    hasLoaded,
    error,
    mutating,
    refresh,
    clearError,
    criarPlano,
    adicionarItem,
    editarItem,
    removerItem,
    alterarStatusPlano,
    darBaixaItem,
    salvarPlano,
  };
}
