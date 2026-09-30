import React, { useCallback, useState } from 'react';
import { ModalEscolhaAssinatura } from '../assinaturas/ModalEscolhaAssinatura.jsx';
import { SolicitarAnamneseModal } from '../anamnese/SolicitarAnamneseModal.jsx';

/**
 * Solicitação de anamnese ao paciente a partir do hub da consulta.
 * Mesma sequência da Agenda (`AgendaDashboard` handleEnviarAnamnese + modais): escolha de canal → QR/WhatsApp.
 */
export function useSolicitarAnamneseConsulta({
  paciente,
  clinicaSlug,
  toast,
  onEnvioGerado,
  onEnvioLimpo,
  onRespondido,
}) {
  const [escolhaOpen, setEscolhaOpen] = useState(false);
  const [solicitacao, setSolicitacao] = useState(null);

  const pacienteId = paciente?.pacienteId;
  const nome = paciente?.nome;
  const cpf = paciente?.cpf;
  const telefone = paciente?.telefone;

  const abrirSolicitacao = useCallback(() => {
    if (!pacienteId) {
      toast?.error?.('Não foi possível identificar o paciente deste agendamento.');
      return;
    }
    if (!clinicaSlug) {
      toast?.error?.('Para enviar a anamnese, primeiro configure o identificador (slug) da clínica em Configurações > Anamnese.');
      return;
    }
    setSolicitacao({
      pacienteId: String(pacienteId),
      telefonePaciente: telefone || '',
      pacienteNome: nome || 'Paciente',
      pacienteCpf: cpf || '',
    });
    setEscolhaOpen(true);
  }, [pacienteId, clinicaSlug, telefone, nome, cpf, toast]);

  const escolherQr = useCallback(() => {
    setEscolhaOpen(false);
    setSolicitacao((curr) => (curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null } } : curr));
  }, []);

  const escolherWhatsApp = useCallback(() => {
    if (!solicitacao?.telefonePaciente) {
      toast?.error?.('Paciente sem telefone cadastrado.');
      return;
    }
    setEscolhaOpen(false);
    setSolicitacao((curr) => (curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' } } : curr));
  }, [solicitacao, toast]);

  const concluir = useCallback(() => {
    setSolicitacao(null);
    onRespondido?.();
  }, [onRespondido]);

  const modaisSolicitacao = (
    <>
      <ModalEscolhaAssinatura
        open={escolhaOpen}
        onClose={() => {
          setEscolhaOpen(false);
          setSolicitacao(null);
        }}
        opcoes={{ tablet: false, qrCode: true, link: true }}
        onSelectQrCode={escolherQr}
        onSelectLink={escolherWhatsApp}
      />
      <SolicitarAnamneseModal
        open={Boolean(solicitacao?.escolha)}
        escolha={solicitacao?.escolha}
        payload={solicitacao}
        onClose={() => setSolicitacao(null)}
        onCancelar={() => {
          setSolicitacao((curr) => (curr ? { ...curr, escolha: undefined } : null));
          setEscolhaOpen(true);
          onEnvioLimpo?.();
        }}
        onEnvioGerado={(data) => onEnvioGerado?.(data)}
        onEnvioExpirado={() => onEnvioLimpo?.()}
        onConcluido={concluir}
        onRecusado={concluir}
      />
    </>
  );

  return { abrirSolicitacao, modaisSolicitacao };
}
