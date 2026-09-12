import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Search, Calendar, Check, ChevronRight, Syringe } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';
import {
  formatProcedimentoRaizData,
  filtrarProcedimentosRaiz,
  nomeProcedimentoRaiz,
} from './retornoOrigemUtils.js';
import { formatDataPt } from '../../utils/planejamentoDraftUtils.js';
import { SearchDropdownShell } from './SearchDropdownShell.jsx';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

function OrigemOptionButton({ r, isSelected, onSelect, active }) {
  const isPlano = r.tipoOrigem === 'plano';
  const nome = nomeProcedimentoRaiz(r);
  const dataFmt = isPlano && !r.jaRealizado
    ? (r.data ? formatDataPt(r.data) : 'Data a definir')
    : formatProcedimentoRaizData(r.data);
  const cor = gerarCorAvatar(nome);

  const subtext = isPlano
    ? `${r.planoTitulo ? `${r.planoTitulo} · ` : ''}${
        r.jaRealizado
          ? `Realizado em ${dataFmt}`
          : r.jaAgendado
            ? `Agendado para ${dataFmt}${r.horaInicio ? ` às ${String(r.horaInicio).slice(0, 5)}` : ''}`
            : `Planejado para ${dataFmt}`
      }`
    : `Realizado em ${dataFmt}`;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${nome}, ${subtext}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect?.(r)}
      className={
        isSelected
          ? `flex w-full items-center gap-3.5 rounded-xl border-2 border-[#00a88e] bg-[#e6f7f5] px-3.5 py-3 text-left transition-all ${FOCUS_RING}`
          : `flex w-full items-center gap-3.5 rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-left hover:border-teal-300 hover:bg-teal-50/30 transition-all ${FOCUS_RING} ${
              active ? 'ring-2 ring-[#14B8A6] ring-offset-1' : ''
            }`
      }
    >
      <div
        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold ${
          isPlano
            ? 'bg-teal-50 text-[#00a88e] border border-teal-200/80'
            : `${cor.bg} ${cor.fg}`
        }`}
      >
        {isPlano ? (
          <Syringe className="h-4 w-4 sm:h-5 sm:w-5" />
        ) : (
          iniciaisDoNome(nome)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`truncate text-[13px] sm:text-[14px] font-semibold ${
              isSelected ? 'text-[#0f766e]' : 'text-ink-900'
            }`}
          >
            {nome}
          </p>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isPlano
                ? 'bg-teal-100 text-teal-800 border border-teal-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {isPlano ? 'No Plano' : 'Concluído'}
          </span>
          {r.retornosCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {r.retornosCount === 1 ? '1 retorno já realizado' : `${r.retornosCount} retornos realizados`}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] sm:text-[13px] text-ink-500">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{subtext}</span>
        </p>
      </div>
      {isSelected ? (
        <Check className="h-5 w-5 shrink-0 text-[#00a88e]" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
      )}
    </button>
  );
}

/**
 * Seletor unificado de procedimento raiz para retorno:
 * Suporta tanto itens do plano de tratamento (visitas futuras)
 * quanto procedimentos já finalizados no prontuário (histórico).
 *
 * @param {boolean} [flutuante=false] — se true, lista via SearchDropdownShell (só AgendaFormModal).
 */
export function RetornoOrigemSelect({
  value,
  onChange,
  onSelectOrigem,
  options = [],
  optionsPlano = [],
  optionsHistorico = [],
  loading = false,
  error = '',
  fieldError = '',
  id = 'retorno-origem-select',
  flutuante = false,
  planoSectionTitle = '📌 Agendados no Plano (Visitas Futuras)',
  planoSectionBadge = 'Sem precisar ter concluído',
  historicoSectionTitle = '✅ Já Realizados no Histórico (Prontuário)',
  historicoSectionBadge = 'Atendimentos concluídos',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listId = `${id}-list`;

  // Determina lista de plano e lista de histórico
  const { listaPlano, listaHistorico } = useMemo(() => {
    if (optionsPlano.length > 0 || optionsHistorico.length > 0) {
      return {
        listaPlano: optionsPlano,
        listaHistorico: optionsHistorico,
      };
    }
    // Caso seja passado apenas o array options legado:
    const plano = [];
    const historico = [];
    (options || []).forEach((it) => {
      if (it.tipoOrigem === 'plano') {
        plano.push(it);
      } else {
        historico.push(it);
      }
    });
    return { listaPlano: plano, listaHistorico: historico };
  }, [options, optionsPlano, optionsHistorico]);

  const filteredPlano = useMemo(
    () => filtrarProcedimentosRaiz(listaPlano, query),
    [listaPlano, query],
  );

  const filteredHistorico = useMemo(
    () => filtrarProcedimentosRaiz(listaHistorico, query),
    [listaHistorico, query],
  );

  const todosFiltrados = useMemo(
    () => [...filteredPlano, ...filteredHistorico],
    [filteredPlano, filteredHistorico],
  );

  const emptyMessage =
    listaPlano.length === 0 && listaHistorico.length === 0
      ? 'Este paciente ainda não possui procedimentos no histórico ou no plano para vincular o retorno.'
      : 'Nenhum procedimento encontrado na busca.';

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(0);
  }, []);

  const selectItem = useCallback(
    (item) => {
      onSelectOrigem?.(item);
      onChange?.(item.id, item.tipoOrigem, item);
      setQuery('');
      close();
      inputRef.current?.focus();
    },
    [onSelectOrigem, onChange, close],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && flutuante && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
      inputRef.current?.focus();
      return;
    }
    if (!flutuante) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, todosFiltrados.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && todosFiltrados.length > 0) {
      const idx = Math.min(highlight, todosFiltrados.length - 1);
      const item = todosFiltrados[idx];
      if (item) {
        e.preventDefault();
        selectItem(item);
      }
    }
  };

  const listContent =
    todosFiltrados.length === 0 ? (
      <p className="py-8 text-center text-[13px] text-[#6b7280]">{emptyMessage}</p>
    ) : (
      <div className={flutuante ? 'space-y-3 p-2' : 'space-y-3'}>
        {/* SEÇÃO A: AGENDADOS NO PLANO (VISITAS FUTURAS) */}
        {filteredPlano.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 py-1 rounded-md bg-teal-50/80 text-teal-800 text-[10px] font-extrabold uppercase tracking-wider border border-teal-100">
              <span>{planoSectionTitle}</span>
              <span className="text-[9px] font-medium text-teal-600">{planoSectionBadge}</span>
            </div>
            <div className="space-y-1.5">
              {filteredPlano.map((r, idx) => (
                <OrigemOptionButton
                  key={`plano-${r.id}`}
                  r={r}
                  isSelected={String(value) === String(r.id)}
                  onSelect={selectItem}
                  active={flutuante && open && idx === highlight}
                />
              ))}
            </div>
          </div>
        )}

        {/* SEÇÃO B: JÁ REALIZADOS NO HISTÓRICO (PRONTUÁRIO) */}
        {filteredHistorico.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider border border-slate-200/80">
              <span>{historicoSectionTitle}</span>
              <span className="text-[9px] font-medium text-slate-500">{historicoSectionBadge}</span>
            </div>
            <div className="space-y-1.5">
              {filteredHistorico.map((r, idx) => {
                const globalIdx = filteredPlano.length + idx;
                return (
                  <OrigemOptionButton
                    key={`hist-${r.id}`}
                    r={r}
                    isSelected={String(value) === String(r.id)}
                    onSelect={selectItem}
                    active={flutuante && open && globalIdx === highlight}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    );

  const inputEl = (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        role={flutuante ? 'combobox' : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (flutuante) setOpen(true);
        }}
        onFocus={() => {
          if (flutuante) setOpen(true);
        }}
        onClick={() => {
          if (flutuante) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Buscar por nome ou data…"
        aria-controls={listId}
        aria-expanded={flutuante ? open : undefined}
        aria-autocomplete={flutuante ? 'list' : undefined}
        className={`w-full rounded-xl border border-ink-200 bg-white py-2 pl-10 pr-3 text-sm text-ink-800 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#e6f7f5] ${FOCUS_RING}`}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-ink-500"
      >
        Retorno de qual procedimento? <span className="text-red-500">*</span>
      </label>
      {loading ? (
        <p className="text-[12px] text-[#6b7280]">Carregando procedimentos…</p>
      ) : error ? (
        <p className="text-[11px] font-bold text-red-600">{error}</p>
      ) : flutuante ? (
        <>
          <SearchDropdownShell
            open={open}
            onRequestClose={close}
            dropdown={
              <div
                id={listId}
                role="listbox"
                aria-label="Procedimentos de origem do retorno"
              >
                {listContent}
              </div>
            }
          >
            {inputEl}
          </SearchDropdownShell>
        </>
      ) : (
        <>
          {inputEl}
          <div
            id={listId}
            role="listbox"
            aria-label="Procedimentos de origem do retorno"
            className="mt-2.5 max-h-[300px] sm:max-h-[380px] md:max-h-[440px] space-y-2 overflow-y-auto overscroll-contain pr-1"
          >
            {listContent}
          </div>
        </>
      )}
      {fieldError ? (
        <p className="text-[11px] font-bold text-red-600">{fieldError}</p>
      ) : null}
    </div>
  );
}
