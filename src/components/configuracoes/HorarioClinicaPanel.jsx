import { useEffect, useState } from 'react';
import { Building2, Clock, Save, User } from 'lucide-react';
import { configuracoesClinicaApi, getApiErrorToastMessage } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';

const DIAS = [
  { key: 'seg', label: 'Segunda-feira' },
  { key: 'ter', label: 'Terça-feira' },
  { key: 'qua', label: 'Quarta-feira' },
  { key: 'qui', label: 'Quinta-feira' },
  { key: 'sex', label: 'Sexta-feira' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

function defaultHorarios() {
  return DIAS.reduce((acc, dia) => {
    acc[dia.key] = { ativo: false, inicio: '08:00', fim: '18:00' };
    return acc;
  }, {});
}

export function HorarioClinicaPanel() {
  const [tipoOrg, setTipoOrg] = useState('clinica');
  const [horarios, setHorarios] = useState(defaultHorarios);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let alive = true;
    configuracoesClinicaApi
      .buscar()
      .then((dto) => {
        if (!alive) return;
        setTipoOrg(dto?.tipoOrg || 'clinica');
        const next = defaultHorarios();
        for (const dia of DIAS) {
          const inicio = dto?.[`${dia.key}Inicio`];
          const fim = dto?.[`${dia.key}Fim`];
          next[dia.key] = {
            ativo: Boolean(inicio && fim),
            inicio: inicio ? String(inicio).slice(0, 5) : '08:00',
            fim: fim ? String(fim).slice(0, 5) : '18:00',
          };
        }
        setHorarios(next);
      })
      .catch((e) => toastError(getApiErrorToastMessage(e, 'Erro ao carregar configuracoes')))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [toastError]);

  const handleToggleDia = (key) => {
    setHorarios((prev) => ({
      ...prev,
      [key]: { ...prev[key], ativo: !prev[key].ativo },
    }));
  };

  const handleHorario = (key, campo, valor) => {
    setHorarios((prev) => ({
      ...prev,
      [key]: { ...prev[key], [campo]: valor },
    }));
  };

  // BUG #3: comparação de strings 'HH:MM' funciona porque é lexicograficamente equivalente.
  const diaInvalido = (h) => Boolean(h?.ativo && h.inicio && h.fim && h.fim <= h.inicio);

  const handleSalvar = async () => {
    const diasInvalidos = DIAS.filter((d) => diaInvalido(horarios[d.key]));
    if (diasInvalidos.length > 0) {
      toastError('Horário final deve ser depois do horário inicial');
      return;
    }
    setSaving(true);
    try {
      const payload = { tipoOrg };
      for (const dia of DIAS) {
        const h = horarios[dia.key] || { ativo: false, inicio: '08:00', fim: '18:00' };
        payload[`${dia.key}Inicio`] = h.ativo ? `${h.inicio}:00` : null;
        payload[`${dia.key}Fim`] = h.ativo ? `${h.fim}:00` : null;
      }
      await configuracoesClinicaApi.atualizar(payload);
      success('Configuracoes salvas');
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const algumDiaInvalido = DIAS.some((d) => diaInvalido(horarios[d.key]));

  if (loading) {
    return <div className="text-sm text-[#64748b]">Carregando configuracoes...</div>;
  }

  return (
    <div className="space-y-6">
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
          Horário de atendimento
        </h3>
        <div className="space-y-2">
          {DIAS.map((dia) => {
            const h = horarios[dia.key];
            const invalido = diaInvalido(h);
            return (
              <div
                key={dia.key}
                className="flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-white p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <input
                    type="checkbox"
                    checked={h?.ativo || false}
                    onChange={() => handleToggleDia(dia.key)}
                    className="h-4 w-4"
                  />
                  <span className="text-[13px] font-medium text-[#0f172a] sm:w-32">{dia.label}</span>
                  <input
                    type="time"
                    value={h?.inicio || '08:00'}
                    onChange={(e) => handleHorario(dia.key, 'inicio', e.target.value)}
                    disabled={!h?.ativo}
                    className={`rounded-md border px-2 py-1 text-[13px] disabled:bg-[#f8fafc] disabled:opacity-50 ${
                      invalido ? 'border-red-500' : 'border-[#e2e8f0]'
                    }`}
                  />
                  <span className="text-[13px] text-[#64748b]">ate</span>
                  <input
                    type="time"
                    value={h?.fim || '18:00'}
                    onChange={(e) => handleHorario(dia.key, 'fim', e.target.value)}
                    disabled={!h?.ativo}
                    className={`rounded-md border px-2 py-1 text-[13px] disabled:bg-[#f8fafc] disabled:opacity-50 ${
                      invalido ? 'border-red-500' : 'border-[#e2e8f0]'
                    }`}
                  />
                </div>
                {invalido ? (
                  <p className="text-xs text-red-500 sm:ml-[152px]">
                    Horário final deve ser depois do horário inicial
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
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
