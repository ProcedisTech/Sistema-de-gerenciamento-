import { useCallback, useEffect, useState } from 'react';
import { planejamentosApi, getApiErrorDetail } from '../../services/api.js';
import { normalizeListaPlanos } from '../../utils/planejamentoNormalize.js';

export function usePlanosPaciente({ pacienteId, roleUserId, enabled = true }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    const pid = String(pacienteId ?? '').trim();
    if (!enabled || !pid) {
      setPlanos([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await planejamentosApi.listarPorPaciente(pid);
      const normalized = normalizeListaPlanos(data);
      setPlanos(normalized);
      return normalized;
    } catch (e) {
      setPlanos([]);
      setError(getApiErrorDetail(e) || e?.message || 'Não foi possível carregar os planos.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [pacienteId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runMutation = useCallback(async (fn) => {
    setMutating(true);
    setError('');
    try {
      const result = await fn();
      await refresh();
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
        await refresh();
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
