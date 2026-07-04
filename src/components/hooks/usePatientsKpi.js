import { useState, useEffect, useCallback } from 'react';
import { pacientesApi, agendasApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import {
  normalizeApiList,
  mapAgendaDtoToDashboardRow,
  isAgendaVisibleOnDashboard,
} from '../../utils/agendaDashboardMapping';
import { isKpiCountableAgendaDto } from '../../utils/agendaKpiDrilldown';
import { toLocalDateIso } from '../../utils/agendaDateUtils';
import { isSemRetornoMarcado } from '../patients/patientListStatusConfig.js';

/**
 * Busca os 5 KPIs da tela Pacientes + listas para o PulseSidebar em paralelo.
 * Erros individuais são silenciosos — o campo afetado fica null.
 *
 * @param {{ authEnabled?: boolean, bump?: number }} opts
 */
export function usePatientsKpi({ authEnabled = false, bump = 0 } = {}) {
  const [totalAtivos, setTotalAtivos] = useState(null);
  const [totalEmRisco, setTotalEmRisco] = useState(null);
  const [totalPlanosAtivos, setTotalPlanosAtivos] = useState(null);
  const [totalNovos, setTotalNovos] = useState(null);
  const [totalAniversariantes, setTotalAniversariantes] = useState(null);
  const [aniversariantesList, setAniversariantesList] = useState([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState([]);
  const [semRetornoMarcadoList, setSemRetornoMarcadoList] = useState([]);
  const [totalSemRetornoMarcado, setTotalSemRetornoMarcado] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!authEnabled) {
      setTotalAtivos(null);
      setTotalEmRisco(null);
      setTotalPlanosAtivos(null);
      setTotalNovos(null);
      setTotalAniversariantes(null);
      setAniversariantesList([]);
      setAgendamentosHoje([]);
      setSemRetornoMarcadoList([]);
      setTotalSemRetornoMarcado(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const hoje = toLocalDateIso();

    const safe = async (fn) => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    const [
      pageAtivos,
      pageEmRisco,
      pagePlanos,
      pageNovos,
      pageAniversariantesMes,
      rawAgenda,
      pagePacientesSidebar,
      pageProximosAniversarios,
    ] = await Promise.all([
      safe(() => pacientesApi.list({ size: 1 })),
      safe(() => pacientesApi.list({ size: 1, semRetorno: true })),
      safe(() => pacientesApi.list({ size: 1, statusPlano: 'plano_ativo' })),
      safe(() => pacientesApi.list({ size: 1, ehNovo: true })),
      safe(() => pacientesApi.list({ size: 1, ehAniversarianteMes: true })),
      safe(() => agendasApi.byRange(hoje, hoje, { excluirCancelado: true })),
      safe(() => pacientesApi.list({ size: 100, order: 'nome_asc' })),
      safe(() => pacientesApi.list({ size: 5, order: 'birthday_asc' })),
    ]);

    setTotalAtivos(pageAtivos?.totalElements ?? null);
    setTotalEmRisco(pageEmRisco?.totalElements ?? null);
    setTotalPlanosAtivos(pagePlanos?.totalElements ?? null);
    setTotalNovos(pageNovos?.totalElements ?? null);
    setTotalAniversariantes(pageAniversariantesMes?.totalElements ?? null);

    const proximosAniversarios = Array.isArray(pageProximosAniversarios?.content)
      ? pageProximosAniversarios.content.map(mapBackendPatient).filter(Boolean)
      : [];
    setAniversariantesList(proximosAniversarios);

    const pacientesSidebar = Array.isArray(pagePacientesSidebar?.content)
      ? pagePacientesSidebar.content.map(mapBackendPatient).filter(Boolean)
      : [];
    const semRetornoMarcado = pacientesSidebar.filter((p) =>
      isSemRetornoMarcado(p, { excluirPlanoAtivo: true })
    );
    setSemRetornoMarcadoList(semRetornoMarcado.slice(0, 5));
    setTotalSemRetornoMarcado(semRetornoMarcado.length);

    const agendaDtos = normalizeApiList(rawAgenda)
      .filter(isKpiCountableAgendaDto)
      .map(mapAgendaDtoToDashboardRow)
      .filter(Boolean)
      .filter(isAgendaVisibleOnDashboard)
      // Painel "Agendamentos de hoje" (Pacientes) não deve mostrar cancelados —
      // diferente da grade da Agenda, que os exibe riscados como referência.
      .filter((row) => row.status !== 'cancelado')
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    setAgendamentosHoje(agendaDtos);

    setLoading(false);
  }, [authEnabled]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, bump]);

  return {
    totalAtivos,
    totalEmRisco,
    totalPlanosAtivos,
    totalNovos,
    totalAniversariantes,
    aniversariantesList,
    agendamentosHoje,
    semRetornoMarcadoList,
    totalSemRetornoMarcado,
    loading,
    refresh: fetchAll,
  };
}
