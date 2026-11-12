import { useEffect, useRef, useState } from 'react';
import { pacientesApi } from '../services/api.js';
import { useOrg } from '../contexts/OrgContext.jsx';
import { useFusoClinica } from '../components/hooks/useFusoClinica.js';
import { hojeDaClinica } from '../utils/datasClinica.js';
import { mapBackendPatient } from '../utils/patientMapping.js';

const VAZIO = { paciente: null, carregando: false, naoEncontrado: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_BUSCA ={ id: null, ...VAZIO };

/** Resolve o paciente do endereço (/pacientes/:pacienteId): primeiro na lista já carregada, senão na API. */
export function usePacientePorId(pacienteId, patients) {
  const doCache = pacienteId == null
    ? null
    : (patients || []).find((p) => String(p.id) === String(pacienteId)) ?? null;
  const [busca, setBusca] = useState({ id: null, ...VAZIO });
  const token = useRef(0);
  const { orgId, contextStatus } = useOrg();
  const { fuso } = useFusoClinica();
  const pronto = !!orgId && contextStatus === 'ready'; // sem clínica a API recusa (ORG_REQUIRED): espera

  useEffect(() => {
    const meu = ++token.current;
    if (pacienteId == null || doCache || !pronto) return undefined;
    pacientesApi.get(pacienteId).then(
      (dto) => {
        if (meu !== token.current) return; // resposta velha: o id mudou no meio
        setBusca({ id: String(pacienteId), paciente: mapBackendPatient(dto, { fuso, hojeIso: fuso ? hojeDaClinica(fuso) : undefined }), carregando: false, naoEncontrado: false });
      },
      (err) => {
        if (meu !== token.current) return;
        // id que nem é UUID: o servidor responde 400/500, e isso também é "não encontrado".
        const nao = err?.status === 403 || err?.status === 404
          || ((err?.status === 400 || err?.status === 500) && !UUID.test(String(pacienteId)));
        if (!nao) console.warn('usePacientePorId: falha ao buscar paciente', err?.status ?? err);
        setBusca({ id: String(pacienteId), paciente: null, carregando: false, naoEncontrado: nao });
      },
    );
    return () => { token.current++; };
  }, [pacienteId, doCache, pronto, fuso]);

  if (pacienteId == null) return VAZIO;
  // Cópia guardada vale só até o paciente entrar em `patients`: se ele sumir depois (refresh da 1ª página), busca de novo em vez de devolver a velha.
  if (doCache && busca.id != null) setBusca(SEM_BUSCA);
  if (doCache) return { paciente: doCache, carregando: false, naoEncontrado: false };
  // Enquanto o efeito não rodou para este id, o estado é de outro id: reporta carregando.
  if (busca.id !== String(pacienteId)) return { paciente: null, carregando: true, naoEncontrado: false };
  return { paciente: busca.paciente, carregando: busca.carregando, naoEncontrado: busca.naoEncontrado };
}
