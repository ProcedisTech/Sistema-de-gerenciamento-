import { useCallback, useMemo, useState } from 'react';
import { PacienteSearchInput } from '../PacienteSearchInput.jsx';
import { ProcedimentoAutocomplete } from '../../shared/ProcedimentoAutocomplete.jsx';
import { ProcedimentoChipList } from '../ProcedimentoChipList.jsx';
import { isClinicalRoleCodigo } from '../../../hooks/useUsuarioLogado.js';
import AvatarInicialColorido from './AvatarInicialColorido.jsx';

function patchModo(onChange, patch) {
  onChange((prev) => ({ ...prev, ...patch }));
}

export default function ModoAgendamentoSeletores({
  modo,
  onChange,
  ehProfissionalClinico = false,
  usuarioLogado,
  equipeList = [],
  equipeLoading = false,
  procedimentoOptions = [],
}) {
  const [profBusca, setProfBusca] = useState('');

  const lockedPatient = Boolean(modo?.reagendamentoOrigem?.pacienteId);
  const pacienteId = modo?.pacienteSelecionado?.id || '';
  const pacienteNome = modo?.pacienteSelecionado?.nome || '';

  const catalogoOptions = useMemo(
    () =>
      (Array.isArray(procedimentoOptions) ? procedimentoOptions : []).map((p) => ({
        id: String(p.id || ''),
        nomeProcedimento: p.nome || p.nomeProcedimento || '',
        tipoCodigo: String(p.tipoCodigo || '').toLowerCase(),
        duracaoMin: Number(p.duracaoMin) || 60,
      })),
    [procedimentoOptions],
  );

  const equipeClinica = useMemo(() => {
    const list = Array.isArray(equipeList) ? equipeList : [];
    const withRole = list.filter((m) => m.roleNome || m.papel);
    if (withRole.length === 0) return [];
    return withRole.filter((m) => isClinicalRoleCodigo(m.roleNome || m.papel));
  }, [equipeList]);

  const profissionaisFiltrados = useMemo(() => {
    const q = profBusca.trim().toLowerCase();
    if (!q) return equipeClinica;
    return equipeClinica.filter((m) => String(m.nome || '').toLowerCase().includes(q));
  }, [equipeClinica, profBusca]);

  const soloProf = useMemo(() => {
    if (!ehProfissionalClinico) return null;
    const rid = usuarioLogado?.roleUserId;
    const fromEquipe = equipeList.find((m) => String(m.roleUserId) === String(rid));
    return {
      roleUserId: rid,
      nome: fromEquipe?.nome || usuarioLogado?.roleNome || 'Profissional',
      fotoUrl: fromEquipe?.fotoUrl,
      especialidade: fromEquipe?.especialidade,
    };
  }, [ehProfissionalClinico, equipeList, usuarioLogado]);

  const handlePacienteChange = useCallback(
    (id, patient) => {
      patchModo(onChange, {
        pacienteSelecionado: id
          ? {
              id: String(id),
              nome: patient?.nome || patient?.nomeCompleto || '',
              fotoUrl: patient?.fotoUrl || patient?.urlFoto,
            }
          : null,
      });
    },
    [onChange],
  );

  const handleAddProcedimento = useCallback(
    (nome, catalogoId) => {
      const proc = catalogoOptions.find((c) => c.id === catalogoId);
      const item = {
        catalogoId: catalogoId || nome,
        nomeProcedimento: nome,
        tipoCodigo: proc?.tipoCodigo || 'atendimento',
        duracaoMin: proc?.duracaoMin || 60,
      };
      patchModo(onChange, {
        procedimentosSelecionados: [
          ...(modo?.procedimentosSelecionados || []).filter((p) => p.catalogoId !== item.catalogoId),
          item,
        ],
      });
    },
    [catalogoOptions, modo, onChange],
  );

  const handleRemoveProcedimento = useCallback(
    (catalogoId) => {
      patchModo(onChange, {
        procedimentosSelecionados: (modo?.procedimentosSelecionados || []).filter(
          (p) => p.catalogoId !== catalogoId,
        ),
      });
    },
    [modo, onChange],
  );

  const handleReorderProcedimentos = useCallback(
    (newIds) => {
      const map = Object.fromEntries(
        (modo?.procedimentosSelecionados || []).map((p) => [p.catalogoId, p]),
      );
      patchModo(onChange, {
        procedimentosSelecionados: newIds.map((id) => map[id]).filter(Boolean),
      });
    },
    [modo, onChange],
  );

  const handleEditDuracao = useCallback(
    (catalogoId, novaDuracaoMin) => {
      patchModo(onChange, {
        procedimentosSelecionados: (modo?.procedimentosSelecionados || []).map((p) =>
          p.catalogoId === catalogoId
            ? { ...p, duracaoMin: Number(novaDuracaoMin) || p.duracaoMin }
            : p,
        ),
      });
    },
    [modo, onChange],
  );

  const handleProfSelect = useCallback(
    (member) => {
      patchModo(onChange, {
        profissionalFiltro: member
          ? {
              roleUserId: member.roleUserId,
              nome: member.nome,
              fotoUrl: member.fotoUrl,
              especialidade: member.especialidade,
            }
          : null,
        horaSelecionada: null,
        slotProfissional: null,
      });
    },
    [onChange],
  );

  const procedimentosSelecionados = modo?.procedimentosSelecionados || [];

  return (
    <div className="space-y-2">
      {modo?.reagendamentoOrigem ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-xs font-semibold text-amber-900">
            Reagendando — {modo.reagendamentoOrigem.pacienteNome || pacienteNome || 'Paciente'}
          </span>
        </div>
      ) : null}

      <section
        className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-ink-200 bg-white p-2.5 shadow-agenda-sm lg:grid-cols-3 lg:gap-4 lg:p-3"
        aria-label="Seleção para novo agendamento"
      >
        {/* Paciente */}
        <div className="min-w-0 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">
            Paciente *
          </label>
          <PacienteSearchInput
            value={pacienteId}
            onChange={handlePacienteChange}
            locked={lockedPatient}
            displayNome={pacienteNome}
          />
          {pacienteNome ? (
            <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/50 px-2 py-1.5">
              <AvatarInicialColorido
                nome={pacienteNome}
                fotoUrl={modo?.pacienteSelecionado?.fotoUrl}
                size="sm"
              />
              <span className="truncate text-xs font-semibold text-ink-800">{pacienteNome}</span>
            </div>
          ) : null}
        </div>

        {/* Procedimento(s) */}
        <div className="min-w-0 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">
            Procedimento(s) *
          </label>
          <ProcedimentoAutocomplete
            key={`proc-ac-${procedimentosSelecionados.length}`}
            value=""
            onInputChange={() => {}}
            onCommit={handleAddProcedimento}
            placeholder={
              procedimentosSelecionados.length > 0
                ? 'Adicionar procedimento'
                : 'Buscar procedimento...'
            }
            catalogoOptions={catalogoOptions}
            showCatalogCommitBadge={false}
          />
        </div>

        {/* Profissionais */}
        <div className="min-w-0 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">
            Profissional
          </label>

          {ehProfissionalClinico && soloProf ? (
            <div className="flex items-center gap-3 rounded-xl border border-vivid-teal-200 bg-vivid-teal-50/40 p-3">
              <AvatarInicialColorido nome={soloProf.nome} fotoUrl={soloProf.fotoUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{soloProf.nome}</p>
                <p className="text-xs text-ink-500">Seu horário</p>
              </div>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={profBusca}
                onChange={(e) => setProfBusca(e.target.value)}
                placeholder="Buscar profissional…"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-vivid-teal-500 focus:outline-none focus:ring-2 focus:ring-vivid-teal-200"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-ink-400">Especialidade:</span>
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[11px] font-medium text-white opacity-90"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleProfSelect(null)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                    !modo?.profissionalFiltro
                      ? 'border-vivid-teal-500 bg-vivid-teal-50 text-vivid-teal-800'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  Todos profissionais
                </button>
              </div>
              <div className="custom-scrollbar max-h-[140px] space-y-1.5 overflow-y-auto">
                {equipeLoading ? (
                  <p className="py-2 text-center text-xs text-ink-500">Carregando equipe…</p>
                ) : null}
                {!equipeLoading && equipeList.length > 0 && profissionaisFiltrados.length === 0 ? (
                  <p className="py-2 text-center text-xs text-ink-500">
                    Nenhum profissional clínico cadastrado nesta clínica.
                  </p>
                ) : !equipeLoading && equipeList.length === 0 ? (
                  <p className="py-2 text-center text-xs text-ink-500">
                    Nenhum profissional encontrado.
                  </p>
                ) : null}
                {profissionaisFiltrados.map((member) => {
                  const selected =
                    String(modo?.profissionalFiltro?.roleUserId) === String(member.roleUserId);
                  return (
                    <button
                      key={member.roleUserId}
                      type="button"
                      onClick={() => handleProfSelect(member)}
                      className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${
                        selected
                          ? 'border-vivid-teal-500 bg-vivid-teal-50 ring-1 ring-vivid-teal-200'
                          : 'border-ink-100 hover:border-ink-200 hover:bg-ink-50/50'
                      }`}
                    >
                      <AvatarInicialColorido nome={member.nome} fotoUrl={member.fotoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-900">{member.nome}</p>
                        {member.especialidade ? (
                          <p className="truncate text-[10px] text-ink-500">{member.especialidade}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {procedimentosSelecionados.length > 0 && (
        <div className="rounded-2xl border border-ink-200 bg-white px-3 py-2 lg:px-4 lg:py-3">
          <ProcedimentoChipList
            items={procedimentosSelecionados.map((p) => ({
              id: p.catalogoId,
              label: p.nomeProcedimento,
              duracaoMin: p.duracaoMin,
            }))}
            onRemove={handleRemoveProcedimento}
            onReorder={handleReorderProcedimentos}
            onEditDuracao={handleEditDuracao}
          />
        </div>
      )}
    </div>
  );
}
