import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Info, RefreshCw, Save } from 'lucide-react';
import {
  getApiErrorToastMessage,
  organizacoesHorariosApi,
} from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import { usePapel } from '../../hooks/usePapel.js';
import { encontrarSobrepostos } from './horarioSemanaUtils.js';
import { HorarioSemanaEditor } from './HorarioSemanaEditor.jsx';
import { ConfigFormSectionsSkeleton } from '../shared/ConfigPanelSkeletons';

// ── Helpers de agrupamento/desagrupamento ─────────────────────────────────────

/** Lista plana do servidor → diasConfig[0..6] */
function agrupar(lista) {
  const dias = Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }));
  for (const h of lista) {
    if (h.ativo === false) continue;
    const d = Number(h.diaSemana);
    if (d < 0 || d > 6) continue;
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
  const { isDono } = usePapel();
  const [diasConfig, setDiasConfig] = useState(() =>
    Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }))
  );
  const [savedSnapshotState, setSavedSnapshotState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // ── Carregamento inicial ───────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      if (orgId) {
        const horariosRes = await organizacoesHorariosApi.buscar(orgId);
        if (!aliveRef.current) return;
        const config = agrupar(Array.isArray(horariosRes) ? horariosRes : []);
        setDiasConfig(config);
        setSavedSnapshotState(sortedSnapshot(config));
      } else {
        const empty = Array.from({ length: 7 }, () => ({ ativo: false, turnos: [] }));
        setDiasConfig(empty);
        setSavedSnapshotState(sortedSnapshot(empty));
      }
    } catch (e) {
      if (aliveRef.current) {
        setLoadError(true);
        toastError(getApiErrorToastMessage(e, 'Erro ao carregar configurações'));
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [orgId, toastError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (savedSnapshotState === null) return false;
    return savedSnapshotState !== sortedSnapshot(diasConfig);
  }, [diasConfig, savedSnapshotState]);

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
    if (!isDono) {
      toastError('Apenas o Dono da clínica pode salvar alterações gerais de horário');
      return;
    }
    if (loadError) return;
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
      if (orgId) {
        await organizacoesHorariosApi.atualizar(orgId, desagrupar(diasConfig));
      }
      setSavedSnapshotState(sortedSnapshot(diasConfig));
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

  return (
    <div className="space-y-6">
      {!isDono && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-semibold">Exclusivo do Dono</p>
            <p>
              Apenas o Dono da clínica pode alterar os horários gerais de funcionamento.
            </p>
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-1 text-[15px] font-bold text-[#0f172a]">Horários de funcionamento</h3>
        <p className="mb-3 text-[12px] text-[#94a3b8]">
          Ligue o botão ao lado de cada dia para definir o horário. Dias desligados aparecem como Fechado.
        </p>
        {loading ? (
          <ConfigFormSectionsSkeleton sections={7} />
        ) : loadError ? (
          <div
            role="alert"
            data-testid="horario-clinica-load-error"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/70 p-6 text-center"
          >
            <AlertCircle className="h-6 w-6 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              Não foi possível carregar os horários de funcionamento da clínica.
            </p>
            <button
              type="button"
              onClick={carregar}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        ) : (
          <HorarioSemanaEditor diasConfig={diasConfig} onChange={setDiasConfig} disabled={!isDono} />
        )}
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-[#e2e8f0] pt-4">
        {isDirty && !saving && !loading && (
          <span className="text-[12px] font-medium text-amber-600">Alterações não salvas</span>
        )}
        <button
          type="button"
          onClick={handleSalvar}
          disabled={saving || temErro || !isDirty || loading || loadError || !isDono}
          title={!isDono ? 'Apenas o Dono da clínica pode salvar' : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${
            isDirty && !temErro && isDono && !loadError
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

export default HorarioClinicaPanel;
