import { useEffect, useState } from 'react';
import { termosApi, termoAssinaturaApi } from '../services/api';
import { isAssinaturaResolvida } from '../utils/termoResolucao';

const LGPD_VIRTUAL_TITULO = 'Termo de Consentimento LGPD (Padrão Procedi)';

/**
 * Termos que precisam de atenção no Hub: obrigatórios sem assinatura válida,
 * ou termos que o profissional já colocou na fila de assinatura deste
 * atendimento (`termosSelecionadosIds`, vindo de useJourneyState). Um termo
 * comum que nunca foi selecionado nesta consulta não gera pendência aqui —
 * ele só aparece quando o profissional abre a tela de Termos e decide tratá-lo.
 * Uma assinatura expirada volta a contar como pendente; uma recusada continua
 * pendente. Quando a clínica não tem nenhum termo próprio, considera o
 * consentimento LGPD virtual usado em Step4LGPD.jsx (assinatura gravada com
 * termoId null) — como é o único termo disponível, sempre é relevante.
 */
export function useTermosPendentes(pacienteId, { termosSelecionadosIds = [] } = {}) {
  const [pendentes, setPendentes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pacienteId) {
      setPendentes([]);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const [termosRaw, assinaturasRaw] = await Promise.all([
          termosApi.list(),
          termoAssinaturaApi.listarPorPaciente(pacienteId),
        ]);
        if (cancelled) return;
        const termos = Array.isArray(termosRaw) ? termosRaw : termosRaw?.content ?? [];
        const ativos = termos.filter((t) => t.ativo !== false);
        const assinaturas = Array.isArray(assinaturasRaw) ? assinaturasRaw : assinaturasRaw?.content ?? [];
        const selecionados = new Set((termosSelecionadosIds || []).map(String));

        const result = [];
        if (ativos.length === 0) {
          const resolvidoLgpd = assinaturas.some((a) => a.termoId == null && isAssinaturaResolvida(a));
          if (!resolvidoLgpd) {
            result.push({ id: '__lgpd_padrao', titulo: LGPD_VIRTUAL_TITULO });
          }
        } else {
          for (const termo of ativos) {
            const relevante = termo.obrigatorio === true || selecionados.has(String(termo.id));
            if (!relevante) continue;
            const resolvido = assinaturas.some((a) => a.termoId === termo.id && isAssinaturaResolvida(a));
            if (!resolvido) result.push({ id: termo.id, titulo: termo.titulo });
          }
        }
        setPendentes(result);
      } catch {
        if (!cancelled) setPendentes([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pacienteId, termosSelecionadosIds]);

  return { pendentes, count: pendentes.length, isLoading };
}
