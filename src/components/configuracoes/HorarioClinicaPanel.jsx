import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Info, Save, User } from 'lucide-react';
import {
  configuracoesClinicaApi,
  getApiErrorToastMessage,
  organizacoesHorariosApi,
} from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import { encontrarSobrepostos } from './horarioSemanaUtils.js';
import { HorarioSemanaEditor } from './HorarioSemanaEditor.jsx';

// ── Helpers de agrupamento/desagrupamento ─────────────────────────────────────

/** Lista plana do servidor → diasConfig[0..6] */
function agrupar(lista) {
  const dias = Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }));
  for (const h of lista) {
    const d = Number(h.diaSemana);
    dias[d].ativo = true;
    dias[d].turnos.push({
      id: h.id,
      horaInicio: String(h.horaInicio || '').slice(0, 5),
      horaFim: String(h.horaFim || '').slice(0, 5),
    });
  }
  return dias;
}

/** diasConfig[0..6] → lista plana para o PUT (dias desligados não entram) */
function desagrupar(diasConfig) {
  return diasConfig.flatMap((dia, diaSemana) =>
    dia.ativo
      ? dia.turnos.map((t) => ({
          diaSemana,
          horaInicio: String(t.horaInicio || '').slice(0, 5),
          horaFim: String(t.horaFim || '').slice(0, 5),
        }))
      : []
  );
}

/**
 * Snapshot determinístico para dirty detection.
 * Ordenação estável: diaSemana asc, horaInicio asc.
 * Premissa: strings HH:MM com zero-padding são lexicograficamente ordenáveis.
 */
function sortedSnapshot(diasConfig) {
  const payload = desagrupar(diasConfig).sort((a, b) =>
    a.diaSemana !== b.diaSemana
      ? a.diaSemana - b.diaSemana
      : a.horaInicio.localeCompare(b.horaInicio)
  );
  return JSON.stringify(payload);
}

// ── Validação ─────────────────────────────────────────────────────────────────

function validarDiasConfig(diasConfig) {
  for (let d = 0; d < diasConfig.length; d++) {
    const dia = diasConfig[d];
    if (!dia.ativo) continue;
    for (const t of dia.turnos) {
      const ini = String(t.horaInicio || '').slice(0, 5);
      const fim = String(t.horaFim || '').slice(0, 5);
      if (ini && fim && fim <= ini) return 'invalid-time';
    }
    if (encontrarSobrepostos(dia.turnos).size > 0) return 'overlap';
  }
  return null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function HorarioClinicaPanel({ onDisponibilidadeInvalidate, onDirtyChange }) {
  const { orgId } = useOrg();
  const [tipoOrg, setTipoOrg] = useState('clinica');
  const [diasConfig, setDiasConfig] = useState(() =>
    Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const serverSnapshot = useRef(null);

  // ── Carregamento inicial ───────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dto = await configuracoesClinicaApi.buscar();
        if (!alive) return;
        setTipoOrg(dto?.tipoOrg || 'clinica');
        if (orgId) {
          const horariosRes = await organizacoesHorariosApi.buscar(orgId);
          if (!alive) return;
          const config = agrupar(Array.isArray(horariosRes) ? horariosRes : []);
          setDiasConfig(config);
          serverSnapshot.current = sortedSnapshot(config);
        } else {
          const empty = Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }));
          serverSnapshot.current = sortedSnapshot(empty);
        }
      } catch (e) {
        if (alive) toastError(getApiErrorToastMessage(e, 'Erro ao carregar configurações'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [toastError, orgId]);

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (serverSnapshot.current === null) return false;
    return serverSnapshot.current !== sortedSnapshot(diasConfig);
  }, [diasConfig]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── beforeunload: cobre fechar aba / refresh ──────────────────────────────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSalvar = async () => {
    const erro = validarDiasConfig(diasConfig);
    if (erro === 'invalid-time') {
      toastError('Horário final deve ser depois do horário inicial');
      return;
    }
    if (erro === 'overlap') {
      toastError('Existem turnos sobrepostos no mesmo dia — corrija antes de salvar');
      return;
    }
    setSaving(true);
    try {
      await configuracoesClinicaApi.atualizar({ tipoOrg });
      if (orgId) {
        await organizacoesHorariosApi.atualizar(orgId, desagrupar(diasConfig));
      }
      serverSnapshot.current = sortedSnapshot(diasConfig);
      // Re-cria referência do array para forçar re-render e recalcular isDirty → false
      setDiasConfig((prev) => prev.map((d) => ({ ...d })));
      success('Configurações salvas');
      onDisponibilidadeInvalidate?.({ scope: 'all' });
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const temErro = validarDiasConfig(diasConfig) !== null;

  if (loading) {
    return <div className="text-sm text-[#64748b]">Carregando configurações...</div>;
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
              <p className="text-[12px] text-[#64748b]">Vários profissionais</p>
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
        <h3 className="mb-1 text-[15px] font-bold text-[#0f172a]">Horários de funcionamento</h3>
        <p className="mb-3 text-[12px] text-[#94a3b8]">
          Ligue o botão ao lado de cada dia para definir o horário. Dias desligados aparecem como Fechado.
        </p>
        <HorarioSemanaEditor diasConfig={diasConfig} onChange={setDiasConfig} />
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] pt-4">
        {isDirty && !saving && (
          <span className="text-[12px] font-medium text-amber-600">Alterações não salvas</span>
        )}
        <button
          type="button"
          onClick={handleSalvar}
          disabled={saving || temErro || !isDirty}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${
            isDirty && !temErro
              ? 'bg-[#00a88e] hover:bg-[#008f78]'
              : 'cursor-not-allowed bg-[#94a3b8]'
          }`}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
