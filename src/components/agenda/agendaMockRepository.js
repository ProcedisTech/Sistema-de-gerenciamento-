const STATUS = {
  confirmado: 'confirmado',
  pendente: 'pendente',
  cancelado: 'cancelado',
};

/** Fallback de rótulos para o select de procedimento até existir API dedicada na Agenda. */
const PROCEDIMENTOS = [
  'Botox + Preenchimento',
  'Harmonização Facial',
  'Bioestimulador',
  'Limpeza de Pele',
  'Retorno Avaliativo',
];

let mockRows = [];

/** Normaliza data (YYYY-MM-DD ou ISO com hora) para comparação e filtros. */
export function toDateKey(value) {
  const s = String(value || '');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function sortByDateTime(rows) {
  return [...rows].sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
}

function normalizePayload(payload) {
  return {
    ...payload,
    duracaoMin: Number(payload.duracaoMin) || 45,
    status: payload.status || STATUS.pendente,
  };
}

export const agendaMockRepository = {
  listByMonth(ym) {
    return Promise.resolve(
      sortByDateTime(mockRows.filter((row) => toDateKey(row.data).startsWith(ym)))
    );
  },

  listByDate(date) {
    const key = toDateKey(date);
    return Promise.resolve(sortByDateTime(mockRows.filter((row) => toDateKey(row.data) === key)));
  },

  listInDateRange(startKey, endKey) {
    const a = toDateKey(startKey);
    const b = toDateKey(endKey);
    if (!a || !b) return Promise.resolve([]);
    return Promise.resolve(
      sortByDateTime(
        mockRows.filter((row) => {
          const k = toDateKey(row.data);
          return k >= a && k <= b;
        })
      )
    );
  },

  create(payload) {
    const next = {
      id: `mock-agendamento-${Date.now()}`,
      ...normalizePayload(payload),
    };
    mockRows = sortByDateTime([...mockRows, next]);
    return Promise.resolve(next);
  },

  update(id, payload) {
    let updated = null;
    mockRows = mockRows.map((row) => {
      if (row.id !== id) return row;
      updated = { ...row, ...normalizePayload(payload), id };
      return updated;
    });
    return Promise.resolve(updated);
  },

  remove(id) {
    mockRows = mockRows.filter((row) => row.id !== id);
    return Promise.resolve({ ok: true });
  },
};

export const agendaMockOptions = {
  procedimentos: PROCEDIMENTOS,
  status: Object.values(STATUS),
};
