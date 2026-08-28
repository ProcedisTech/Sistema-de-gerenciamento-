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
import { sortAgendamentosHojePulse } from '../../utils/sortAgendamentosHojePulse.js';
import { sortSemPlanoByUltimaVinda } from '../../utils/sortSemPlanoByUltimaVinda.js';

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
  const [semPlanoList, setSemPlanoList] = useState([]);
  const [totalSemPlano, setTotalSemPlano] = useState(null);
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
      setSemPlanoList([]);
      setTotalSemPlano(null);
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
      pageSemPlanoLista,
      pageSemPlanoTotal,
      pageProximosAniversarios,
    ] = await Promise.all([
      safe(() => pacientesApi.list({ size: 1 })),
      safe(() => pacientesApi.list({ size: 1, semAgendamentoFuturo: true })),
      safe(() => pacientesApi.list({ size: 1, statusPlano: 'plano_ativo' })),
      safe(() => pacientesApi.list({ size: 1, ehNovo: true })),
      safe(() => pacientesApi.list({ size: 1, ehAniversarianteMes: true })),
      safe(() => agendasApi.byRange(hoje, hoje, { excluirCancelado: true })),
      // size 50 + sort client: backend stablePageable ignora sort (sempre nome). Ranking global = ticket backend.
      safe(() => pacientesApi.list({ size: 50, statusPlano: 'sem_plano' })),
      safe(() => pacientesApi.list({ size: 1, statusPlano: 'sem_plano' })),
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

    const semPlano = Array.isArray(pageSemPlanoLista?.content)
      ? sortSemPlanoByUltimaVinda(pageSemPlanoLista.content.map(mapBackendPatient).filter(Boolean)).slice(0, 5)
      : [];
    setSemPlanoList(semPlano);
    setTotalSemPlano(pageSemPlanoTotal?.totalElements ?? null);

    const agendaDtos = normalizeApiList(rawAgenda)
      .filter(isKpiCountableAgendaDto)
      .map(mapAgendaDtoToDashboardRow)
      .filter(Boolean)
      .filter(isAgendaVisibleOnDashboard)
      // Painel "Agendamentos de hoje" (Pacientes) não deve mostrar cancelados —
      // diferente da grade da Agenda, que os exibe riscados como referência.
      .filter((row) => row.status !== 'cancelado');
    setAgendamentosHoje(sortAgendamentosHojePulse(agendaDtos));

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
    semPlanoList,
    totalSemPlano,
    loading,
    refresh: fetchAll,
  };
}
