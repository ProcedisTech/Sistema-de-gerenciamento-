import { useEffect, useMemo, useState } from 'react';
import { anamneseApi } from '../services/api';
import { usePerfilClinico } from './usePerfilClinico';
import {
  getPerguntaIdFromResp,
  isRespostaCategoria,
  isRespostaPositiva,
  isRespostaPreocupante,
  isRespostaPrioridadeAlerta,
  renderRespostaValue,
  textoPerguntaResposta,
} from '../utils/anamneseAlertUtils';

/**
 * Alertas clínicos de um paciente: respostas de anamnese marcadas como ALERTA
 * (ou de categoria "alergias") mais itens do perfil clínico (alergias, alergias a
 * princípio ativo, medicamentos em uso, antecedentes). Busca de forma independente —
 * não depende de o PatientProfileView já ter sido montado para este paciente.
 *
 * `onAlergiasResumo(texto)` é chamado (se fornecido) sempre que o fetch encontra
 * respostas de alergia, com o resumo em texto já formatado — quem chamar o hook decide
 * o que fazer com isso (ex.: sincronizar de volta no paciente em memória).
 */
export function useAlertasClinicos(pacienteId, { sexoPaciente, onAlergiasResumo, refreshKey } = {}) {
  const [alertasAnamnese, setAlertasAnamnese] = useState([]);
  const [alertasAlergia, setAlertasAlergia] = useState([]);
  const [isLoadingAnamnese, setIsLoadingAnamnese] = useState(false);

  const perfilClinico = usePerfilClinico(pacienteId, null, sexoPaciente);

  useEffect(() => {
    if (!pacienteId) {
      setAlertasAnamnese([]);
      setAlertasAlergia([]);
      setIsLoadingAnamnese(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoadingAnamnese(true);
    (async () => {
      try {
        const list = await anamneseApi.listPaciente(pacienteId);
        const arr = Array.isArray(list) ? list : [];

        // Manter apenas o preenchimento mais recente por ficha (anamneseId/fichaId)
        const maisRecentePorFicha = new Map();
        for (const an of arr) {
          const fichaId = an.anamneseId ?? an.fichaId ?? an.anamneseFichaId ?? an.id;
          const ts = an.dataHora ? new Date(an.dataHora).getTime() : 0;
          const prev = maisRecentePorFicha.get(String(fichaId));
          if (!prev || ts > (prev.dataHora ? new Date(prev.dataHora).getTime() : 0)) {
            maisRecentePorFicha.set(String(fichaId), an);
          }
        }
        const arrFiltrado = Array.from(maisRecentePorFicha.values());

        const pairs = await Promise.all(
          arrFiltrado.map((an) =>
            anamneseApi
              .getPaciente(pacienteId, an.id)
              .then((det) => ({ an, det }))
              .catch(() => ({ an, det: null }))
          )
        );
        if (cancelled) return;
        const alergiasDetectadas = [];
        const itemsAlergia = [];
        const itemsGeral = [];
        for (const { an, det } of pairs) {
          if (!det || !Array.isArray(det.respostas)) continue;
          const ts = an.dataHora ? new Date(an.dataHora).getTime() : 0;
          const nome = an.anamneseNome || 'Anamnese';
          det.respostas.forEach((resp, rIdx) => {
            if (isRespostaCategoria(resp, 'alergias') && isRespostaPositiva(resp)) {
              const valorAlergia = renderRespostaValue(resp);
              const perguntaTexto = textoPerguntaResposta(resp);
              alergiasDetectadas.push(`${perguntaTexto}: ${valorAlergia}`);
              const pidA = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
              itemsAlergia.push({
                key: `${pidA}`,
                titulo: textoPerguntaResposta(resp),
                valor: renderRespostaValue(resp),
                fichaNome: nome,
                dataHora: an.dataHora,
                ts,
              });
            }
            if (!isRespostaPrioridadeAlerta(resp)) return;
            if (!isRespostaPreocupante(resp)) return;
            const pid = resp.id ?? getPerguntaIdFromResp(resp) ?? rIdx;
            itemsGeral.push({
              key: `${pid}`,
              titulo: textoPerguntaResposta(resp),
              valor: renderRespostaValue(resp),
              fichaNome: nome,
              dataHora: an.dataHora,
              ts,
            });
          });
        }
        itemsAlergia.sort((a, b) => b.ts - a.ts);
        itemsGeral.sort((a, b) => b.ts - a.ts);
        const seen = new Set();
        const merged = [];
        for (const it of [...itemsAlergia, ...itemsGeral]) {
          if (seen.has(it.key)) continue;
          seen.add(it.key);
          merged.push(it);
        }
        merged.sort((a, b) => b.ts - a.ts);
        if (!cancelled) setAlertasAlergia(itemsAlergia);
        if (!cancelled) setAlertasAnamnese(merged);

        if (alergiasDetectadas.length > 0 && typeof onAlergiasResumo === 'function') {
          onAlergiasResumo(alergiasDetectadas.join(' · '));
        }
      } catch {
        if (!cancelled) {
          setAlertasAnamnese([]);
          setAlertasAlergia([]);
        }
      } finally {
        if (!cancelled) setIsLoadingAnamnese(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, refreshKey]);

  const alertasPerfil = useMemo(() => {
    const s = perfilClinico.state;
    if (!s) return [];
    const items = [];
    (s.alergias ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-alergia-${chip.id ?? chip.nome}`, titulo: 'Alergia alimentar', valor: val, secao: 'alergias', origem: 'perfil' });
    });
    (s.alergiasPrincipioAtivo ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-pa-${chip.id ?? chip.nome}`, titulo: 'Alergia a princípio ativo', valor: val, secao: 'alergiasPrincipioAtivo', origem: 'perfil' });
    });
    (s.medicamentosEmUso ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const parts = [chip.nome];
      if (chip.dose) parts.push(chip.dose);
      if (chip.frequencia) parts.push(chip.frequencia);
      if (chip.observacao) parts.push(chip.observacao);
      items.push({ key: `perfil-med-${chip.id ?? chip.nome}`, titulo: 'Medicamento em uso', valor: parts.join(' · '), secao: 'medicamentos', origem: 'perfil' });
    });
    (s.antecedentes ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-ant-${chip.id ?? chip.nome}`, titulo: 'Antecedente', valor: val, secao: 'antecedentes', origem: 'perfil' });
    });
    return items;
  }, [perfilClinico.state]);

  return {
    alertasAnamnese,
    alertasAlergia,
    alertasPerfil,
    isLoading: isLoadingAnamnese || perfilClinico.isLoading,
    totalCount: alertasPerfil.length + alertasAnamnese.length,
  };
}
