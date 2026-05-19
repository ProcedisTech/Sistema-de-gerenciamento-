import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';

const SEARCH_DEBOUNCE_MS = 320;
const MIN_QUERY_LEN = 2;

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20';

function formatTelefone(p) {
  return p?.telefone || p?.phone || p?.telefonePrincipal || '';
}

export function PacienteSearchInput({
  value,
  onChange,
  locked = false,
  displayNome = '',
  hideSelectedHint = false,
}) {
  const [query, setQuery] = useState('');
  const [remotePatients, setRemotePatients] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (locked) return undefined;
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      setRemotePatients([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      pacientesApi
        .search(q)
        .then((pageData) => {
          if (cancelled) return;
          const rows = pageData?.content ?? [];
          const mapped = Array.isArray(rows) ? rows.map(mapBackendPatient).filter(Boolean) : [];
          setRemotePatients(mapped);
        })
        .catch(() => {
          if (!cancelled) setRemotePatients([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [locked, query]);

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

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
          className={INPUT_CLASS}
          autoComplete="off"
        />
      </div>
      {searching ? <p className="text-[11px] font-medium text-gray-500">Buscando…</p> : null}
      {query.trim().length >= MIN_QUERY_LEN ? (
        <div className="max-h-[160px] overflow-y-auto rounded-lg border border-gray-200">
          {remotePatients.length > 0 ? (
            remotePatients.map((p) => {
              const id = String(p.id || '').trim();
              const sel = String(value || '') === id;
              const tel = formatTelefone(p);
              return (
                <button
                  key={id || p.cpf || p.nome}
                  type="button"
                  onClick={() => {
                    onChange(id, p);
                    setQuery('');
                    setRemotePatients([]);
                  }}
                  className={`w-full border-b border-gray-100 px-3 py-2.5 text-left text-[13px] last:border-0 ${
                    sel ? 'bg-teal-50 font-bold text-teal-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-semibold text-gray-900">{p.nome}</span>
                  {tel ? <span className="ml-2 font-medium text-gray-500">· {tel}</span> : null}
                </button>
              );
            })
          ) : !searching ? (
            <p className="px-3 py-2.5 text-[12px] font-medium text-gray-500">Nenhum paciente encontrado</p>
          ) : null}
        </div>
      ) : query.trim().length > 0 ? (
        <p className="text-[11px] font-medium text-gray-500">Digite ao menos 2 caracteres</p>
      ) : !hideSelectedHint && value && displayNome ? (
        <p className="text-[12px] font-semibold text-teal-700">Selecionado: {displayNome}</p>
      ) : null}
        </div>
  );
}
