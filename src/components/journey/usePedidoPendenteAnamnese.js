import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { anamneseEnvioApi } from '../../services/api';
import {
  carregarEnvioAtivoDocumento,
  escolherFichaEmBrancoPendente,
  montarPedidoPendente,
  pedidoVencido,
} from './step2PedidoPendente.js';

const INTERVALO_STATUS_MS = 3000;

/**
 * Pedido de anamnese em branco pendente do paciente (consulta).
 * Fonte: ficha em branco da lista + `envioAtivo` do documento dela; enquanto houver pedido,
 * consulta o status do envio (provisório até o SSE do hub).
 */
export function usePedidoPendenteAnamnese({
  ativo,
  pacienteId,
  historicoPaciente,
  onRespondido,
  onEncerrado,
}) {
  const [resolvido, setResolvido] = useState({ fichaId: null, pedido: null });
  const [pedidoSolicitacao, setPedidoSolicitacao] = useState(null);
  const [pacienteAtual, setPacienteAtual] = useState(pacienteId);
  if (pacienteAtual !== pacienteId) {
    setPacienteAtual(pacienteId);
    setResolvido({ fichaId: null, pedido: null });
    setPedidoSolicitacao(null);
  }

  const onRespondidoRef = useRef(onRespondido);
  const onEncerradoRef = useRef(onEncerrado);
  useEffect(() => { onRespondidoRef.current = onRespondido; }, [onRespondido]);
  useEffect(() => { onEncerradoRef.current = onEncerrado; }, [onEncerrado]);

  const candidata = useMemo(
    () => (ativo ? escolherFichaEmBrancoPendente(historicoPaciente) : null),
    [ativo, historicoPaciente],
  );
  const candidataId = candidata?.id ?? null;

  useEffect(() => {
    if (!ativo || !pacienteId || !candidataId) return undefined;
    let cancelado = false;
    carregarEnvioAtivoDocumento(pacienteId, candidataId).then((envio) => {
      if (cancelado) return;
      const pedido = montarPedidoPendente(candidata, envio);
      setResolvido({ fichaId: candidataId, pedido });
      if (!pedido) {
        setPedidoSolicitacao((curr) => (curr?.preenchimentoId === candidataId ? null : curr));
      }
    });
    return () => {
      cancelado = true;
    };
    // `candidata` muda de identidade a cada recarga da lista; só o id dispara nova leitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, pacienteId, candidataId]);

  const pedidoLista = candidataId && resolvido.fichaId === candidataId ? resolvido.pedido : null;
  const pedido = ativo ? (pedidoLista ?? pedidoSolicitacao) : null;

  const pedidoRef = useRef(pedido);
  useEffect(() => { pedidoRef.current = pedido; }, [pedido]);

  const limpar = useCallback(() => {
    setResolvido({ fichaId: null, pedido: null });
    setPedidoSolicitacao(null);
  }, []);

  const envioId = pedido?.envioId ?? null;

  useEffect(() => {
    if (!ativo || !pacienteId || !envioId) return undefined;
    let encerrado = false;
    const interval = setInterval(async () => {
      if (encerrado) return;
      const encerrar = (callbackRef) => {
        encerrado = true;
        clearInterval(interval);
        limpar();
        callbackRef.current?.();
      };
      if (pedidoVencido(pedidoRef.current)) {
        encerrar(onEncerradoRef);
        return;
      }
      try {
        const statusData = await anamneseEnvioApi.status(envioId);
        if (encerrado) return;
        if (statusData?.status === 'CONCLUIDO') {
          encerrar(onRespondidoRef);
        } else if (statusData?.status === 'EXPIRADO' || statusData?.status === 'CANCELADO') {
          encerrar(onEncerradoRef);
        }
      } catch (err) {
        console.error('Erro no polling do pedido de anamnese', err);
      }
    }, INTERVALO_STATUS_MS);
    return () => {
      encerrado = true;
      clearInterval(interval);
    };
  }, [ativo, pacienteId, envioId, limpar]);

  const registrar = useCallback((data) => {
    if (data?.envioId) {
      setPedidoSolicitacao({
        envioId: data.envioId,
        preenchimentoId: data.preenchimentoAnamneseId ?? null,
        enviadoEm: null,
        expiraEm: null,
      });
    } else {
      limpar();
    }
    onEncerradoRef.current?.();
  }, [limpar]);

  const cancelar = useCallback(async () => {
    const id = pedidoRef.current?.envioId;
    if (!id) return;
    if (!window.confirm('Cancelar o link enviado? O paciente não poderá mais usar este link.')) return;
    try {
      await anamneseEnvioApi.cancelar(id);
    } catch (err) {
      console.warn('[usePedidoPendenteAnamnese] Falha ao cancelar envio:', err?.message || err);
    }
    limpar();
    onEncerradoRef.current?.();
  }, [limpar]);

  return { pedido, registrar, cancelar, limpar };
}
