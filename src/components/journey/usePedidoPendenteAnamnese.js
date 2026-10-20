import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { anamneseEnvioApi } from '../../services/api';
import { useAviso } from '../../contexts/useAviso.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';
import { useBuscaNoVencimento } from '../hooks/useBuscaNoVencimento.js';
import {
  carregarEnvioAtivoDocumento,
  escolherFichaEmBrancoPendente,
  montarPedidoPendente,
  pedidoVencido,
} from './step2PedidoPendente.js';

/**
 * Pedido de anamnese em branco pendente do paciente (consulta).
 * Fonte: ficha em branco da lista + `envioAtivo` do documento dela; enquanto houver pedido,
 * consulta o status do envio ao abrir, a cada aviso ANAMNESE do envio e no vencimento.
 * Sem pedido conhecido, qualquer aviso ANAMNESE do paciente faz uma nova leitura do envio ativo.
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
  /** Sobe a cada aviso ANAMNESE sem envio conhecido: relê o envio ativo da ficha em branco. */
  const [recarga, setRecarga] = useState(0);

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
  }, [ativo, pacienteId, candidataId, recarga]);

  const pedidoLista = candidataId && resolvido.fichaId === candidataId ? resolvido.pedido : null;
  const pedido = ativo ? (pedidoLista ?? pedidoSolicitacao) : null;

  const pedidoRef = useRef(pedido);
  useEffect(() => { pedidoRef.current = pedido; }, [pedido]);

  const limpar = useCallback(() => {
    setResolvido({ fichaId: null, pedido: null });
    setPedidoSolicitacao(null);
  }, []);

  const envioId = ativo && pacienteId ? (pedido?.envioId ?? null) : null;
  /** Envio já encerrado (respondido, expirado, cancelado ou vencido): não consulta de novo. */
  const encerradoRef = useRef(null);

  const verificarStatus = useCallback(async () => {
    const id = envioId;
    if (!id || encerradoRef.current === id) return;
    const encerrar = (callbackRef) => {
      encerradoRef.current = id;
      limpar();
      callbackRef.current?.();
    };
    if (pedidoVencido(pedidoRef.current)) {
      encerrar(onEncerradoRef);
      return;
    }
    try {
      const statusData = await anamneseEnvioApi.status(id);
      if (encerradoRef.current === id || pedidoRef.current?.envioId !== id) return;
      if (statusData?.status === 'CONCLUIDO') {
        encerrar(onRespondidoRef);
      } else if (statusData?.status === 'EXPIRADO' || statusData?.status === 'CANCELADO') {
        encerrar(onEncerradoRef);
      }
    } catch (err) {
      console.error('Erro ao consultar status do pedido de anamnese', err);
    }
  }, [envioId, limpar]);

  useEffect(() => {
    verificarStatus();
  }, [verificarStatus]);

  /** Sem envio conhecido (ex.: pedido feito em outro aparelho), qualquer aviso ANAMNESE relê o pedido ativo. */
  const aoAvisoAnamnese = useCallback(() => {
    if (envioId) {
      verificarStatus();
    } else if (ativo && pacienteId) {
      setRecarga((n) => n + 1);
    }
  }, [envioId, verificarStatus, ativo, pacienteId]);

  useAviso(PREFIXO_AVISO.ANAMNESE, aoAvisoAnamnese, { registroId: envioId });
  useBuscaNoVencimento(envioId ? pedido?.expiraEm : null, verificarStatus);

  const registrar = useCallback((data) => {
    if (data?.envioId) {
      encerradoRef.current = null;
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
