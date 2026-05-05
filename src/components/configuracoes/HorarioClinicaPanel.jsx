import { useEffect, useState } from 'react';
import { Building2, Clock, Info, Save, User } from 'lucide-react';
import {
  configuracoesClinicaApi,
  getApiErrorToastMessage,
  organizacoesHorariosApi,
} from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import { HorarioIntervalosEditor } from './HorarioIntervalosEditor.jsx';

export function HorarioClinicaPanel() {
  const { orgId } = useOrg();
  const [tipoOrg, setTipoOrg] = useState('clinica');
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dto = await configuracoesClinicaApi.buscar();
        if (!alive) return;
        setTipoOrg(dto?.tipoOrg || 'clinica');
        if (orgId) {
          const horariosRes = await organizacoesHorariosApi.buscar(orgId);
          if (alive) setHorarios(Array.isArray(horariosRes) ? horariosRes : []);
        } else if (alive) {
          setHorarios([]);
        }
      } catch (e) {
        if (alive) toastError(getApiErrorToastMessage(e, 'Erro ao carregar configuracoes'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [toastError, orgId]);

  const diaInvalido = (h) =>
    Boolean(h?.horaInicio && h?.horaFim && String(h.horaFim) <= String(h.horaInicio));

  const handleSalvar = async () => {
    const hasInvalid = horarios.some((h) => diaInvalido(h));
    if (hasInvalid) {
      toastError('Horário final deve ser depois do horário inicial');
      return;
    }
    setSaving(true);
    try {
      await configuracoesClinicaApi.atualizar({ tipoOrg });
      if (orgId) {
        await organizacoesHorariosApi.atualizar(
          orgId,
          horarios.map((h) => ({
            id: h.id ?? undefined,
            diaSemana: Number(h.diaSemana),
            horaInicio: String(h.horaInicio || '').slice(0, 5),
            horaFim: String(h.horaFim || '').slice(0, 5),
            ativo: h.ativo !== false,
          }))
        );
      }
      success('Configuracoes salvas');
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const algumDiaInvalido = horarios.some((h) => diaInvalido(h));

  if (loading) {
    return <div className="text-sm text-[#64748b]">Carregando configuracoes...</div>;
  }

  return (
    <div className="space-y-6">
      {tipoOrg === 'autonomo' ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[13px] text-blue-800"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          <p>
            Como você é Autônomo, este horário também é o seu horário de atendimento.
          </p>
        </div>
      ) : null}

      <section>
        <h3 className="mb-3 text-[15px] font-bold text-[#0f172a]">Tipo de organização</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
              tipoOrg === 'clinica'
                ? 'border-[#00a88e] bg-[#f0fdf9]'
                : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
            }`}
          >
            <input
              type="radio"
              name="tipoOrg"
              value="clinica"
              checked={tipoOrg === 'clinica'}
              onChange={(e) => setTipoOrg(e.target.value)}
              className="h-4 w-4"
            />
            <Building2 className="h-5 w-5 text-[#00a88e]" />
            <div>
              <p className="text-[14px] font-bold text-[#0f172a]">Clínica</p>
              <p className="text-[12px] text-[#64748b]">Varios profissionais</p>
            </div>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
              tipoOrg === 'autonomo'
                ? 'border-[#00a88e] bg-[#f0fdf9]'
                : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
            }`}
          >
            <input
              type="radio"
              name="tipoOrg"
              value="autonomo"
              checked={tipoOrg === 'autonomo'}
              onChange={(e) => setTipoOrg(e.target.value)}
              className="h-4 w-4"
            />
            <User className="h-5 w-5 text-[#00a88e]" />
            <div>
              <p className="text-[14px] font-bold text-[#0f172a]">Autônomo</p>
              <p className="text-[12px] text-[#64748b]">Profissional sozinho</p>
            </div>
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[#0f172a]">
          <Clock className="h-4 w-4" />
          Horários de funcionamento
        </h3>
        <HorarioIntervalosEditor
          value={horarios}
          onChange={setHorarios}
          addButtonLabel="Adicionar turno"
          emptyStateLabel="Nenhum turno cadastrado."
        />
      </section>

      <div className="flex justify-end border-t border-[#e2e8f0] pt-4">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={saving || algumDiaInvalido}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#008f78] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
