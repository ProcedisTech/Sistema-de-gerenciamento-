import React from 'react';
import { Calendar, X, Loader2 } from 'lucide-react';
import { AppDateInput } from '../shared/AppDateInput.jsx';
import { isCpfIncomplete } from '../utils/formatters';
import { useToast } from '../../contexts/useToast.js';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid } from '../../utils/phoneUtils';

export function AgendaModal({
  isOpen,
  onClose,
  agendaModalError,
  agendaModePatient,
  setAgendaModePatient,
  agendaNewPatientNome,
  setAgendaNewPatientNome,
  agendaNewPatientCpf,
  setAgendaNewPatientCpf,
  agendaNewPatientTelefoneCountry,
  setAgendaNewPatientTelefoneCountry,
  agendaNewPatientTelefoneNumero,
  setAgendaNewPatientTelefoneNumero,
  agendaNewPatientTelefoneTouched,
  setAgendaNewPatientTelefoneTouched,
  maskCPF,
  agendaPatientSearch,
  setAgendaPatientSearch,
  patients,
  agendaSelectedPatientCpf,
  setAgendaSelectedPatientCpf,
  agendaDate,
  setAgendaDate,
  agendaTime,
  setAgendaTime,
  agendaHoraFim,
  setAgendaHoraFim,
  agendaProcedure,
  setAgendaProcedure,
  agendaCatalogoId,
  setAgendaCatalogoId,
  catalogosList = [],
  onConfirm,
  agendaSaving,
  onAgendaTimeChange,
}) {
  const toast = useToast();

  if (!isOpen) return null;

  const catalogOptions = Array.isArray(catalogosList) ? catalogosList : [];

  // BUG #3: bloqueia "Criar horário" quando o intervalo é invertido. Strings 'HH:MM' são
  // lexicograficamente comparáveis, então <= equivale a fim <= início temporalmente.
  const horarioInvalido = Boolean(agendaTime && agendaHoraFim && agendaHoraFim <= agendaTime);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-[860px] bg-white rounded-2xl border border-app-border shadow-xl overflow-y-auto max-h-[92vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-app-border">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
            <div>
              <h4 className="text-[16px] font-bold text-[#0f172a]">Novo horário na agenda</h4>
              <p className="text-[12px] font-medium text-[#64748b] leading-snug">
                Abre um intervalo (início e fim) para o profissional atender. Pacientes e procedimentos de cada atendimento são
                marcados depois, no botão &quot;Marcar atendimento&quot; do dia.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-[#f8fbfb] border border-transparent text-[#94a3b8] hover:text-[#00a88e] transition-all flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4">
          {agendaModalError && (
            <div className="mb-4 bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold">
              {agendaModalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[13px] font-bold text-[#00a88e]">Procedimento de referência (opcional)</label>
              <select
                value={agendaCatalogoId}
                onChange={(e) => setAgendaCatalogoId(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Nenhum</option>
                {catalogOptions.map((c) => (
                  <option key={c.id} value={c.catalogoProcedimentoId || c.id}>
                    {c.nomeProcedimento || c.id}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#64748b] font-medium leading-relaxed">
                Isso <span className="font-bold text-[#475569]">não é categoria</span>: vem do{' '}
                <span className="font-bold text-[#475569]">catálogo de procedimentos</span> da clínica. Só ajuda a preencher a
                observação deste horário na lista. Cada paciente continua com o procedimento escolhido em &quot;Marcar
                atendimento&quot;. O profissional é o usuário logado (vínculo de perfil).
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[11px] text-[#64748b] font-medium mb-2 leading-relaxed">
              Opcional: incluir paciente só atualiza a lista para você usar em &quot;Marcar atendimento&quot;. Criar o horário não
              reserva vaga para ninguém.
            </p>
            <div className="flex bg-[#f8fbfb] p-1.5 rounded-2xl mb-3 border border-app-border">
              <button
                type="button"
                onClick={() => setAgendaModePatient('novo')}
                className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${
                  agendaModePatient === 'novo'
                    ? 'bg-[#00a88e] text-white shadow-md'
                    : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'
                }`}
              >
                Novo paciente
              </button>
              <button
                type="button"
                onClick={() => setAgendaModePatient('existente')}
                className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${
                  agendaModePatient === 'existente'
                    ? 'bg-[#00a88e] text-white shadow-md'
                    : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'
                }`}
              >
                Paciente da clinica
              </button>
            </div>

            {agendaModePatient === 'novo' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[13px] font-bold text-[#00a88e]">Nome</label>
                  <input
                    value={agendaNewPatientNome}
                    onChange={(e) => setAgendaNewPatientNome(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
                    placeholder="Nome do paciente"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[13px] font-bold text-[#00a88e]">CPF</label>
                  <input
                    value={agendaNewPatientCpf}
                    onChange={(e) => setAgendaNewPatientCpf(maskCPF(e.target.value))}
                    onBlur={() => {
                      if (isCpfIncomplete(agendaNewPatientCpf)) {
                        toast.error('O CPF deve conter 11 dígitos.');
                      }
                    }}
                    className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[13px] font-bold text-[#00a88e]">Telefone</label>
                  <div className={`flex items-stretch gap-1 rounded-xl border bg-[#f8fbfb] transition-all focus-within:ring-4 focus-within:ring-[#00a88e]/10 ${agendaNewPatientTelefoneTouched && !isPhoneValid(agendaNewPatientTelefoneCountry, agendaNewPatientTelefoneNumero) ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/20 focus-within:border-[#00a88e]'}`}>
                    <select
                      value={agendaNewPatientTelefoneCountry}
                      title={getCountryByCode(agendaNewPatientTelefoneCountry).name}
                      onChange={(e) => {
                        setAgendaNewPatientTelefoneCountry(e.target.value);
                        setAgendaNewPatientTelefoneNumero('');
                        setAgendaNewPatientTelefoneTouched(false);
                      }}
                      className="max-w-[7.25rem] min-w-0 shrink-0 truncate rounded-l-[9px] border-0 bg-transparent py-3 pl-2 pr-1 text-[12px] font-medium text-[#475569] outline-none"
                      aria-label="País"
                    >
                      {[
                        COUNTRY_PHONE_CODES.find((c) => c.code === 'BR'),
                        ...COUNTRY_PHONE_CODES.filter((c) => c.code !== 'BR'),
                      ].filter(Boolean).map((c) => (
                        <option key={c.code} value={c.code} title={c.name}>{countrySelectDisplayLabel(c)}</option>
                      ))}
                    </select>
                    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                      <span className="flex items-center text-[12px] font-semibold text-[#00a88e] shrink-0 tabular-nums">
                        {getDdi(agendaNewPatientTelefoneCountry)}
                      </span>
                      <input
                        type="tel"
                        value={agendaNewPatientTelefoneNumero}
                        autoComplete="tel-national"
                        onChange={(e) => setAgendaNewPatientTelefoneNumero(formatPhoneAsYouType(agendaNewPatientTelefoneCountry, e.target.value))}
                        onBlur={() => setAgendaNewPatientTelefoneTouched(true)}
                        placeholder={agendaNewPatientTelefoneCountry === 'BR' ? '(00) 00000-0000' : 'Número'}
                        className="min-w-0 flex-1 rounded-r-[9px] bg-transparent py-3 pr-3 text-[14px] font-medium outline-none"
                      />
                    </div>
                  </div>
                  {agendaNewPatientTelefoneTouched && !isPhoneValid(agendaNewPatientTelefoneCountry, agendaNewPatientTelefoneNumero) && (
                    <p className="text-[11px] font-bold text-red-600 mt-0.5">Número inválido para este país</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={agendaPatientSearch}
                  onChange={(e) => setAgendaPatientSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
                  placeholder="Buscar por nome, CPF ou telefone..."
                />

                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {patients
                    .filter((p) => {
                      const q = agendaPatientSearch.trim().toLowerCase();
                      if (!q) return true;
                      return [p.nome, p.cpf, p.telefone]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q));
                    })
                    .map((p) => {
                      const selected = (agendaSelectedPatientCpf || '') === (p.cpf || '').trim();
                      return (
                        <button
                          type="button"
                          key={p.id || p.cpf}
                          onClick={() => setAgendaSelectedPatientCpf((p.cpf || '').trim())}
                          className={`w-full text-left p-4 rounded-xl border mb-2 ${
                            selected
                              ? 'border-[#00a88e] bg-[#e6f7f5]'
                              : 'border-[#00a88e]/15 bg-white hover:bg-[#f0fdfa]'
                          }`}
                        >
                          <div className="text-[14px] font-bold text-[#0f766e]">{p.nome}</div>
                          <div className="text-[12px] font-medium text-[#64748b]">
                            {p.cpf} • {p.telefone}
                            {!p.id && <span className="text-amber-600"> · sem ID servidor</span>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Data</label>
              <AppDateInput
                value={agendaDate}
                onChange={(e) => setAgendaDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Início</label>
              <input
                type="time"
                value={agendaTime}
                onChange={(e) => (onAgendaTimeChange ? onAgendaTimeChange(e.target.value) : setAgendaTime(e.target.value))}
                className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Fim</label>
              <input
                type="time"
                value={agendaHoraFim}
                onChange={(e) => setAgendaHoraFim(e.target.value)}
                className={`w-full px-4 py-3 bg-[#f8fbfb] border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] ${
                  horarioInvalido ? 'border-red-500' : 'border-slate-200'
                }`}
              />
              {horarioInvalido ? (
                <p className="text-xs text-red-500">
                  Horário final deve ser depois do horário inicial
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Observação do horário</label>
              <input
                value={agendaProcedure}
                onChange={(e) => setAgendaProcedure(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
                placeholder="Ex.: manhã consultas, revisão…"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t-[3px] border-[#00a88e]/15 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={agendaSaving}
            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[14px] transition-all border border-slate-200 bg-white text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={agendaSaving || horarioInvalido}
            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[14px] transition-all bg-[#00a88e] hover:bg-[#00967f] text-white border border-transparent shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {agendaSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar horário
          </button>
        </div>
      </div>
    </div>
  );
}
