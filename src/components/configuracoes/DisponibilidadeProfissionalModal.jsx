import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Save, Loader2, Building2, AlertTriangle, AlertCircle } from "lucide-react";
import {
  disponibilidadeApi,
  getApiErrorToastMessage,
} from "../../services/api.js";
import { useToast } from "../../contexts/useToast.js";
import { usePapel } from "../../hooks/usePapel.js";
import { Switch } from "../shared/Switch.jsx";
import { HorarioSemanaEditor } from "./HorarioSemanaEditor.jsx";
import {
  encontrarSobrepostos,
  hhmm,
  dispToDiasConfig,
  diasConfigToDisp,
} from "./horarioSemanaUtils.js";

function nomeDia(dia) {
  const nomes = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  return nomes[dia] ?? `Dia ${dia}`;
}

function validarContraGradeClinica(disp, gradeClinica) {
  if (!gradeClinica || gradeClinica.length === 0) return null;
  for (const t of disp) {
    const turnosClinicaDia = gradeClinica.filter(
      (g) => Number(g.diaSemana) === Number(t.diaSemana) && g.ativo !== false,
    );
    if (turnosClinicaDia.length === 0) {
      return `A clínica não funciona no dia selecionado (${nomeDia(t.diaSemana)}). Apenas o Dono pode definir exceções.`;
    }
    const cabe = turnosClinicaDia.some((tc) => {
      const tcIni = hhmm(tc.horaInicio);
      const tcFim = hhmm(tc.horaFim);
      const tIni = hhmm(t.horaInicio);
      const tFim = hhmm(t.horaFim);
      return tIni >= tcIni && tFim <= tcFim;
    });
    if (!cabe) {
      return `O horário ${hhmm(t.horaInicio)} - ${hhmm(t.horaFim)} está fora do horário de funcionamento da clínica. Apenas o Dono pode definir exceções.`;
    }
  }
  return null;
}

export default function DisponibilidadeProfissionalModal({
  roleUserId,
  nome,
  onClose,
  onSaved,
}) {
  const dialogRef = useRef(null);
  const { isDono } = usePapel();
  const [seguirHorarioClinica, setSeguirHorarioClinica] = useState(true);
  const [gradeClinica, setGradeClinica] = useState([]);
  const [diasConfig, setDiasConfig] = useState(() => dispToDiasConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const gradeClinicaConfig = useMemo(
    () => dispToDiasConfig(gradeClinica),
    [gradeClinica],
  );

  const dispAtual = useMemo(() => diasConfigToDisp(diasConfig), [diasConfig]);

  const erroGradeClinica = useMemo(() => {
    if (seguirHorarioClinica || !gradeClinica || gradeClinica.length === 0) return null;
    return validarContraGradeClinica(dispAtual, gradeClinica);
  }, [seguirHorarioClinica, dispAtual, gradeClinica]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await disponibilidadeApi.buscar(roleUserId);
      const isEnvelope = Boolean(d && typeof d === "object" && !Array.isArray(d));
      setSeguirHorarioClinica(
        isEnvelope ? (d.seguirHorarioClinica ?? true) : false,
      );
      setGradeClinica(
        isEnvelope && Array.isArray(d.gradeClinica) ? d.gradeClinica : [],
      );
      const turnos = isEnvelope ? d.turnos || [] : Array.isArray(d) ? d : [];
      setDiasConfig(dispToDiasConfig(turnos));
    } catch (e) {
      toastError(
        getApiErrorToastMessage(e, "Erro ao carregar disponibilidade"),
      );
    } finally {
      setLoading(false);
    }
  }, [roleUserId, toastError]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow || "unset";
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  const handleSalvar = async () => {
    if (saving || loading) return;

    if (seguirHorarioClinica) {
      setSaving(true);
      try {
        await disponibilidadeApi.atualizar(roleUserId, {
          seguirHorarioClinica: true,
          turnos: [],
        });
        success("Disponibilidade salva");
        onSaved?.();
        onClose?.();
      } catch (e) {
        toastError(getApiErrorToastMessage(e, "Erro ao salvar"));
      } finally {
        setSaving(false);
      }
      return;
    }

    const activeDays = diasConfig.filter((dia) => dia.ativo);
    if (
      activeDays.some(
        (dia) =>
          !dia.turnos.length ||
          dia.turnos.some(
            (t) =>
              !t.horaInicio ||
              !t.horaFim ||
              hhmm(t.horaFim) <= hhmm(t.horaInicio),
          ),
      )
    ) {
      toastError("Horário final deve ser depois do horário inicial");
      return;
    }
    if (activeDays.some((dia) => encontrarSobrepostos(dia.turnos).size > 0)) {
      toastError("Os turnos de um mesmo dia não podem se sobrepor");
      return;
    }
    if (activeDays.some((dia) => dia.turnos.length > 3)) {
      toastError("Configure até três turnos por dia");
      return;
    }

    const disp = diasConfigToDisp(diasConfig);

    if (!isDono && gradeClinica.length > 0) {
      const erroClinica = validarContraGradeClinica(disp, gradeClinica);
      if (erroClinica) {
        toastError(erroClinica);
        return;
      }
    }

    setSaving(true);
    try {
      await disponibilidadeApi.atualizar(roleUserId, {
        seguirHorarioClinica: false,
        turnos: disp,
      });
      success(
        erroGradeClinica
          ? "Disponibilidade salva (com exceções de atendimento)"
          : "Disponibilidade salva",
      );
      onSaved?.();
      onClose?.();
    } catch (e) {
      toastError(getApiErrorToastMessage(e, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
      data-testid="disponibilidade-backdrop"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Disponibilidade do profissional"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Disponibilidade do profissional
            </h2>
            {nome ? <p className="text-sm text-slate-500">{nome}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar disponibilidade"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" />
          </div>
        ) : null}

        {!loading ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Seguir o horário da clínica
                </h3>
                <p className="text-xs text-slate-500">
                  Herda automaticamente os dias e horários gerais de funcionamento da organização.
                </p>
              </div>
              <Switch
                checked={seguirHorarioClinica}
                onChange={setSeguirHorarioClinica}
                disabled={saving}
                ariaLabel="Seguir o horário da clínica"
              />
            </div>

            {seguirHorarioClinica ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-[#00a88e]/20 bg-[#f0fdf9] p-4 text-[13px] text-[#0f172a]">
                  <Building2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#00a88e]"
                    aria-hidden
                  />
                  <div>
                    <p className="font-semibold text-[#00a88e]">
                      Segue o horário de funcionamento da clínica
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Este profissional tem sua agenda guiada pela grade geral da clínica. Se desejar definir dias ou turnos exclusivos, desligue o switch acima.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Grade da clínica (somente leitura)
                  </p>
                  <HorarioSemanaEditor
                    diasConfig={gradeClinicaConfig}
                    onChange={() => {}}
                    disabled={true}
                    ordemDias={[1, 2, 3, 4, 5, 6, 0]}
                    maxTurnos={3}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Configure os intervalos fixos de atendimento da semana para este profissional.
                </p>
                <fieldset disabled={saving} className="min-w-0 border-0 p-0 m-0">
                  <HorarioSemanaEditor
                    diasConfig={diasConfig}
                    onChange={setDiasConfig}
                    ordemDias={[1, 2, 3, 4, 5, 6, 0]}
                    maxTurnos={3}
                    gradeClinica={gradeClinica}
                  />
                </fieldset>
              </div>
            )}

            {erroGradeClinica && isDono ? (
              <div
                data-testid="aviso-excecao-clinica"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">
                    Aviso: Horário extraordinário (clínica fechada ou fora do expediente)
                  </p>
                  <p className="mt-0.5 text-amber-700">
                    {erroGradeClinica.replace(" Apenas o Dono pode definir exceções.", "")}
                    {" "}Como você é Dono da organização, estes horários serão registrados e salvos como <strong>exceções de atendimento</strong>.
                  </p>
                </div>
              </div>
            ) : null}

            {erroGradeClinica && !isDono ? (
              <div
                data-testid="bloqueio-clinica-fechada"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">
                    Bloqueio de horário
                  </p>
                  <p className="mt-0.5 text-red-700">
                    {erroGradeClinica}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-bold text-white hover:bg-[#008f78] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
