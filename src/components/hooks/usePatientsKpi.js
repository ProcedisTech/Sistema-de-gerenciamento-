import { useState, useEffect, useCallback, useRef } from 'react';
import { pacientesApi, agendasApi } from '../../services/api';
import { useAviso } from '../../contexts/useAviso.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';
import { mapBackendPatient } from '../../utils/patientMapping';
import {
  normalizeApiList,
  mapAgendaDtoToDashboardRow,
  isAgendaVisibleOnDashboard,
} from '../../utils/agendaDashboardMapping';
import { isKpiCountableAgendaDto } from '../../utils/agendaKpiDrilldown';
import { hojeDaClinica } from '../../utils/datasClinica.js';
import { useFusoClinica } from './useFusoClinica.js';
import {
  sortAgendamentosHojePulse,
  agruparAgendamentosHojePulse,
} from '../../utils/sortAgendamentosHojePulse.js';
import { sortSemPlanoByUltimaVinda } from '../../utils/sortSemPlanoByUltimaVinda.js';

/**
 * Resposta do byRange de hoje → linhas do painel "Agendamentos de hoje" (ordenadas).
 * @param {unknown} rawAgenda
 * @param {string} fuso IANA da clínica
 */
function mapearAgendaHoje(rawAgenda, fuso) {
  const agendaDtos = normalizeApiList(rawAgenda)
    .filter(isKpiCountableAgendaDto)
    .map(mapAgendaDtoToDashboardRow)
    .filter(Boolean)
    .filter(isAgendaVisibleOnDashboard)
    // Painel "Agendamentos de hoje" (Pacientes) não deve mostrar cancelados —
    // diferente da grade da Agenda, que os exibe riscados como referência.
    .filter((row) => row.status !== 'cancelado');
  return sortAgendamentosHojePulse(agendaDtos, fuso);
}

/** Marca de chamada que falhou (diferente de uma resposta vazia). */
const FALHOU = Symbol('falhou');

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
  /** Cards do painel (simples ou grupo), com o mesmo agrupamento da Agenda. */
  const [entradasHoje, setEntradasHoje] = useState([]);
  const [semPlanoList, setSemPlanoList] = useState([]);
  const [totalSemPlano, setTotalSemPlano] = useState(null);
  const [loading, setLoading] = useState(false);
  const { fuso } = useFusoClinica();
  /** Geração da busca da agenda de hoje: resposta de uma busca mais antiga é descartada. */
  const geracaoAgendaRef = useRef(0);
  /** Geração da busca completa (KPIs + listas): resposta de uma busca completa mais antiga é descartada. */
  const geracaoKpiRef = useRef(0);

  const aplicarAgendaHoje = useCallback(
    (rawAgenda) => {
      const linhas = mapearAgendaHoje(rawAgenda, fuso);
      setAgendamentosHoje(linhas);
      setEntradasHoje(agruparAgendamentosHojePulse(linhas, fuso));
    },
    [fuso],
  );

  /**
   * Busca KPIs, listas e a agenda de hoje.
   * `{ silencioso: true }` (avisos AGENDA): não liga o `loading`, não limpa nada antes e descarta resposta velha.
   */
  const fetchAll = useCallback(async (opts) => {
    const silencioso = opts?.silencioso === true;
    const geracao = ++geracaoAgendaRef.current;
    const geracaoKpi = ++geracaoKpiRef.current;
    if (!authEnabled) {
      setTotalAtivos(null);
      setTotalEmRisco(null);
      setTotalPlanosAtivos(null);
      setTotalNovos(null);
      setTotalAniversariantes(null);
      setAniversariantesList([]);
      setAgendamentosHoje([]);
      setEntradasHoje([]);
      setSemPlanoList([]);
      setTotalSemPlano(null);
      setLoading(false);
      return;
    }

    if (!silencioso) setLoading(true);
    const hoje = hojeDaClinica(fuso);
    const mapOpts = { fuso, hojeIso: hoje };
    const mapPaciente = (dto) => mapBackendPatient(dto, mapOpts);

    const safe = async (fn) => {
      try {
        return await fn();
      } catch {
        return FALHOU;
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

    /**
     * Aplica o resultado de uma chamada. Carga normal: erro vira `null` (como sempre foi).
     * Silenciosa: chamada que falhou mantém o que está na tela.
     */
    const aplicar = (resultado, setter) => {
      if (resultado === FALHOU) {
        if (!silencioso) setter(null);
        return;
      }
      setter(resultado);
    };

    // Uma busca completa mais nova já saiu: esta resposta é velha e não sobrescreve a tela.
    if (geracaoKpi === geracaoKpiRef.current) {
      aplicar(pageAtivos, (p) => setTotalAtivos(p?.totalElements ?? null));
      aplicar(pageEmRisco, (p) => setTotalEmRisco(p?.totalElements ?? null));
      aplicar(pagePlanos, (p) => setTotalPlanosAtivos(p?.totalElements ?? null));
      aplicar(pageNovos, (p) => setTotalNovos(p?.totalElements ?? null));
      aplicar(pageAniversariantesMes, (p) => setTotalAniversariantes(p?.totalElements ?? null));
      aplicar(pageProximosAniversarios, (p) =>
        setAniversariantesList(Array.isArray(p?.content) ? p.content.map(mapPaciente).filter(Boolean) : []),
      );
      aplicar(pageSemPlanoLista, (p) =>
        setSemPlanoList(
          Array.isArray(p?.content)
            ? sortSemPlanoByUltimaVinda(p.content.map(mapPaciente).filter(Boolean)).slice(0, 5)
            : [],
        ),
      );
      aplicar(pageSemPlanoTotal, (p) => setTotalSemPlano(p?.totalElements ?? null));
    }

    if (geracao === geracaoAgendaRef.current) {
      aplicar(rawAgenda, aplicarAgendaHoje);
    }

    if (!silencioso) setLoading(false);
  }, [authEnabled, fuso, aplicarAgendaHoje]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, bump]);

  /** Recarrega só a agenda de hoje, sem ligar o loading (após Confirmar). */
  const recarregarAgendaHoje = useCallback(async () => {
    if (!authEnabled) return;
    const geracao = ++geracaoAgendaRef.current;
    const hoje = hojeDaClinica(fuso);
    let rawAgenda;
    try {
      rawAgenda = await agendasApi.byRange(hoje, hoje, { excluirCancelado: true });
    } catch {
      return; // mantém o que está na tela
    }
    if (geracao !== geracaoAgendaRef.current) return;
    aplicarAgendaHoje(rawAgenda);
  }, [authEnabled, fuso, aplicarAgendaHoje]);

  /** Aviso AGENDA: contadores, listas e agenda de hoje, tudo sem ligar o loading. */
  const recarregarPorAviso = useCallback(() => fetchAll({ silencioso: true }), [fetchAll]);
  useAviso(PREFIXO_AVISO.AGENDA, recarregarPorAviso, { debounceMs: 400 });
  /**
   * Aviso PACIENTE (criado/editado): contadores (Todos ativos, Sem agenda, Planos ativos, Novos, Aniversariantes) e listas.
   * Ignora o `recarregar` do canal: o handler de AGENDA acima já faz a busca completa (senão seriam duas).
   */
  const recarregarPorAvisoPaciente = useCallback(
    (msg) => {
      if (msg?.tipo === 'recarregar') return;
      recarregarPorAviso();
    },
    [recarregarPorAviso],
  );
  useAviso(PREFIXO_AVISO.PACIENTE, recarregarPorAvisoPaciente, { debounceMs: 400 });

  return {
    totalAtivos,
    totalEmRisco,
    totalPlanosAtivos,
    totalNovos,
    totalAniversariantes,
    aniversariantesList,
    agendamentosHoje,
    entradasHoje,
    semPlanoList,
    totalSemPlano,
    loading,
    refresh: fetchAll,
    recarregarAgendaHoje,
  };
}
