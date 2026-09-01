import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CheckCircle2 } from 'lucide-react';

import { ModalEscolhaAssinatura } from '../assinaturas/ModalEscolhaAssinatura.jsx';

import { SolicitarAnamneseModal } from './SolicitarAnamneseModal.jsx';

import { anamneseEnvioApi } from '../../services/api';

import { resolverEstadoAssinatura } from './anamneseAssinaturaUiState.js';



/**

 * Botão/badge de assinatura + modais (canal → envio). Só paciente assina.

 */

export function AnamneseAssinaturaActions({

  pacienteId,

  preenchimentoId,

  anamneseId = null,

  pacienteTelefone = '',

  pacienteNome = 'Paciente',

  pacienteCpf = '',

  assinada = false,

  imutavel = false,

  envioAtivo = null,

  onDocumentoRefresh,

  assinadoEm = null,

  formatStamp,

}) {

  const [escolhaOpen, setEscolhaOpen] = useState(false);

  const [solicitacao, setSolicitacao] = useState(null);

  const [processandoResposta, setProcessandoResposta] = useState(false);



  const envioStatus = envioAtivo?.status ?? null;

  const processandoRespostaUi = useMemo(() => {
    if (assinada) return false;
    if (processandoResposta && !envioAtivo?.id) return false;
    return processandoResposta;
  }, [assinada, processandoResposta, envioAtivo?.id]);

  const ui = useMemo(

    () =>

      resolverEstadoAssinatura({

        assinada,

        envioStatus,

        preenchimentoId,

        pacienteId,

        imutavel,

        processandoResposta: processandoRespostaUi,

      }),

    [assinada, envioStatus, preenchimentoId, pacienteId, imutavel, processandoRespostaUi],

  );



  useEffect(() => {

    const envioId = envioAtivo?.id;

    if (!envioId || envioStatus !== 'PENDENTE') return undefined;



    const interval = setInterval(async () => {

      try {

        const statusData = await anamneseEnvioApi.status(envioId);

        if (statusData.status === 'CONCLUIDO') {

          clearInterval(interval);

          setProcessandoResposta(true);

          onDocumentoRefresh?.();

        } else if (statusData.status === 'EXPIRADO' || statusData.status === 'CANCELADO') {

          clearInterval(interval);

          onDocumentoRefresh?.();

        }

      } catch (err) {

        console.error('Erro no polling da anamnese (documento)', err);

      }

    }, 3000);



    return () => clearInterval(interval);

  }, [envioAtivo?.id, envioStatus, onDocumentoRefresh]);



  const abrirSolicitar = useCallback(() => {

    if (!pacienteId || !preenchimentoId || !ui.podeSolicitar) return;

    setSolicitacao({

      pacienteId: String(pacienteId),

      telefonePaciente: pacienteTelefone || '',

      pacienteNome: pacienteNome || 'Paciente',

      pacienteCpf: pacienteCpf || '',

      preenchimentoAnamneseId: String(preenchimentoId),

      anamneseId: anamneseId ? String(anamneseId) : null,

    });

    setEscolhaOpen(true);

  }, [

    pacienteId,

    preenchimentoId,

    ui.podeSolicitar,

    pacienteTelefone,

    pacienteNome,

    pacienteCpf,

    anamneseId,

  ]);



  const handleEscolherQr = () => {

    setEscolhaOpen(false);

    setSolicitacao((curr) =>

      curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null } } : curr,

    );

  };



  const handleEscolherWhatsApp = () => {

    if (!solicitacao?.telefonePaciente) return;

    setEscolhaOpen(false);

    setSolicitacao((curr) =>

      curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' } } : curr,

    );

  };



  const handleCancelarEnvioAtivo = useCallback(async () => {

    const envioId = envioAtivo?.id;

    if (!envioId) return;

    if (!window.confirm('Cancelar o link enviado? O paciente não poderá mais usar este link.')) return;

    try {

      await anamneseEnvioApi.cancelar(envioId);

      onDocumentoRefresh?.();

    } catch (err) {

      console.error('Erro ao cancelar envio da anamnese', err);

    }

  }, [envioAtivo?.id, onDocumentoRefresh]);



  const stamp = typeof formatStamp === 'function' ? formatStamp(assinadoEm) : null;



  return (

    <>

      {assinada && stamp ? (

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#0f766e]">

          <CheckCircle2 className="h-3.5 w-3.5" />

          {stamp}

        </span>

      ) : ui.mostrarBadgeAtualizando ? (

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-800">

          Paciente respondeu — atualizando documento…

        </span>

      ) : ui.aguardandoPaciente ? (

        <div className="flex flex-col items-end gap-1">

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#1d4ed8]">

            Aguardando resposta do paciente

          </span>

          <button

            type="button"

            onClick={handleCancelarEnvioAtivo}

            className="text-[11px] font-bold text-[#1d4ed8] underline hover:text-[#1e40af]"

          >

            Cancelar envio e voltar a editar

          </button>

        </div>

      ) : ui.podeSolicitar ? (

        <button

          type="button"

          onClick={abrirSolicitar}

          className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00a88e]/30 bg-[#e6f7f5] px-4 py-1.5 text-[11px] font-bold tracking-wide text-[#0f766e] transition-colors hover:bg-[#d1f0eb]"

        >

          Solicitar assinatura do paciente

        </button>

      ) : (

        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-800">

          Aguardando assinatura do paciente

        </span>

      )}



      <ModalEscolhaAssinatura

        open={escolhaOpen}

        onClose={() => {

          setEscolhaOpen(false);

          setSolicitacao(null);

        }}

        opcoes={{ tablet: false, qrCode: true, link: true }}

        onSelectQrCode={handleEscolherQr}

        onSelectLink={handleEscolherWhatsApp}

      />



      <SolicitarAnamneseModal

        open={Boolean(solicitacao?.escolha)}

        escolha={solicitacao?.escolha}

        payload={solicitacao}

        onClose={() => {

          setSolicitacao(null);

          setProcessandoResposta(false);

        }}

        onCancelar={() => {

          setSolicitacao((curr) => (curr ? { ...curr, escolha: undefined } : null));

          setEscolhaOpen(true);

        }}

        onEnvioGerado={() => {

          onDocumentoRefresh?.();

        }}

        onEnvioExpirado={() => {

          setProcessandoResposta(false);

          onDocumentoRefresh?.();

        }}

        onConcluido={() => {

          setSolicitacao(null);

          setProcessandoResposta(true);

          onDocumentoRefresh?.();

        }}

      />

    </>

  );

}

