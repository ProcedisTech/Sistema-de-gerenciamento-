import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import { PacienteSearchDropdownItem } from './PacienteSearchDropdownItem.jsx';

const SEARCH_DEBOUNCE_MS = 320;
const MIN_QUERY_LEN = 2;
const LIST_SIZE = 10;

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20';

function mapPatients(rows) {
  const mapped = Array.isArray(rows) ? rows.map(mapBackendPatient).filter(Boolean) : [];
  return mapped.slice(0, LIST_SIZE);
}

/** Ordenação secundária: sem última visita vão ao fim; desempate por createdAt. */
function sortPatientsForDropdown(list) {
  return [...list].sort((a, b) => {
    const va = a?.ultimaVinda ? new Date(a.ultimaVinda).getTime() : 0;
    const vb = b?.ultimaVinda ? new Date(b.ultimaVinda).getTime() : 0;
    if (va !== vb) return vb - va;
    const ca = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cb - ca;
  });
}

export function PacienteSearchInput({
  value,
  onChange,
  locked = false,
  displayNome = '',
  hideSelectedHint = false,
}) {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const closeList = useCallback(() => {
    setOpen(false);
  }, []);

  const loadDefaultList = useCallback(async (cancelledRef) => {
    setLoading(true);
    try {
      const pageData = await pacientesApi.list({ page: 0, size: LIST_SIZE, sort: 'visita_desc' });
      if (cancelledRef.current) return;
      const rows = pageData?.content ?? [];
      setPatients(sortPatientsForDropdown(mapPatients(rows)));
    } catch {
      if (!cancelledRef.current) setPatients([]);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locked) return undefined;

    const q = query.trim();
    const cancelledRef = { current: false };

    if (!open) {
      return undefined;
    }

    if (q.length < MIN_QUERY_LEN) {
      loadDefaultList(cancelledRef);
      return () => {
        cancelledRef.current = true;
      };
    }

    setLoading(true);
    const t = window.setTimeout(() => {
      pacientesApi
        .search(q)
        .then((pageData) => {
          if (cancelledRef.current) return;
          const rows = pageData?.content ?? [];
          setPatients(sortPatientsForDropdown(mapPatients(rows)));
        })
        .catch(() => {
          if (!cancelledRef.current) setPatients([]);
        })
        .finally(() => {
          if (!cancelledRef.current) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(t);
    };
  }, [locked, query, open, loadDefaultList]);

  useEffect(() => {
    if (locked) return undefined;
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) closeList();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [locked, closeList]);

  const handleSelect = (p) => {
    const id = String(p.id || '').trim();
    onChange(id, p);
    setQuery('');
    setPatients([]);
    closeList();
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeList();
      e.preventDefault();
    }
  };

  if (locked) {
    return (
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300"
          aria-hidden
        />
        <div className={`${INPUT_CLASS} bg-gray-50`}>{displayNome || '—'}</div>
      </div>
    );
  }

  const showDropdown = open;
  const qTrim = query.trim();

  return (
    <div ref={containerRef} className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="paciente-search-listbox"
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar por nome, CPF ou telefone..."
        className={INPUT_CLASS}
        autoComplete="off"
      />

      {showDropdown ? (
        <ul
          id="paciente-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">Buscando…</li>
          ) : patients.length > 0 ? (
            patients.map((p) => {
              const id = String(p.id || '').trim();
              return (
                <li key={id || p.cpf || p.nome} role="presentation">
                  <PacienteSearchDropdownItem
                    patient={p}
                    selected={String(value || '') === id}
                    onSelect={handleSelect}
                  />
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">
              {qTrim.length >= MIN_QUERY_LEN ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </li>
          )}
        </ul>
      ) : null}

      {!showDropdown && !hideSelectedHint && value && displayNome ? (
        <p className="mt-2 text-[12px] font-semibold text-teal-700">Selecionado: {displayNome}</p>
      ) : null}
    </div>
  );
}
