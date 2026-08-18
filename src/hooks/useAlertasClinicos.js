import { useEffect, useMemo, useState } from 'react';
import { anamneseApi } from '../services/api';
import { usePerfilClinico } from './usePerfilClinico';

/**
 * Alertas clínicos de um paciente: fatos do backend (GET fatos-clinicos) mais itens
 * do perfil clínico. Perfil é dono de alergia/med/antecedente persistente — fatos
 * com o mesmo texto não se repetem como “pergunta”.
 */
export function useAlertasClinicos(pacienteId, { sexoPaciente, refreshKey } = {}) {
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
        const fatos = await anamneseApi.listFatosClinicos(pacienteId);
        if (cancelled) return;
        const criticos = Array.isArray(fatos?.fatosCriticos) ? fatos.fatosCriticos : [];
        const alertas = Array.isArray(fatos?.fatosAlerta) ? fatos.fatosAlerta : [];
        const mapped = [...criticos, ...alertas].map((fato, idx) => ({
          key: `fato-${String(fato.texto || '').toLowerCase()}-${idx}`,
          titulo: fato.texto,
          valor: fato.texto,
          icone: fato.icone,
          origem: 'anamnese',
        }));
        setAlertasAnamnese(mapped);
        setAlertasAlergia([]);
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
  }, [pacienteId, refreshKey]);

  const alertasPerfil = useMemo(() => {
    const s = perfilClinico.state;
    if (!s) return [];
    const items = [];
    (s.alergias ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-alergia-${chip.id ?? chip.nome}`, titulo: 'Alergia alimentar', valor: val, secao: 'alergias', origem: 'perfil', nome: chip.nome });
    });
    (s.alergiasPrincipioAtivo ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-pa-${chip.id ?? chip.nome}`, titulo: 'Alergia a princípio ativo', valor: val, secao: 'alergiasPrincipioAtivo', origem: 'perfil', nome: chip.nome });
    });
    (s.medicamentosEmUso ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const parts = [chip.nome];
      if (chip.dose) parts.push(chip.dose);
      if (chip.frequencia) parts.push(chip.frequencia);
      if (chip.observacao) parts.push(chip.observacao);
      items.push({ key: `perfil-med-${chip.id ?? chip.nome}`, titulo: 'Medicamento em uso', valor: parts.join(' · '), secao: 'medicamentos', origem: 'perfil', nome: chip.nome });
    });
    (s.antecedentes ?? []).forEach((chip) => {
      if (!chip.nome) return;
      const val = chip.observacao ? `${chip.nome} · ${chip.observacao}` : chip.nome;
      items.push({ key: `perfil-ant-${chip.id ?? chip.nome}`, titulo: 'Antecedente', valor: val, secao: 'antecedentes', origem: 'perfil', nome: chip.nome });
    });
    return items;
  }, [perfilClinico.state]);

  const alertasAnamneseSemDuplicata = useMemo(() => {
    const nomesPerfil = new Set(
      alertasPerfil.map((p) => String(p.nome || p.valor || '').split(' · ')[0].trim().toLowerCase()).filter(Boolean)
    );
    return alertasAnamnese.filter((a) => !nomesPerfil.has(String(a.titulo || '').trim().toLowerCase()));
  }, [alertasAnamnese, alertasPerfil]);

  return {
    alertasAnamnese: alertasAnamneseSemDuplicata,
    alertasAlergia,
    alertasPerfil,
    isLoading: isLoadingAnamnese || perfilClinico.isLoading,
    totalCount: alertasPerfil.length + alertasAnamneseSemDuplicata.length,
  };
}
