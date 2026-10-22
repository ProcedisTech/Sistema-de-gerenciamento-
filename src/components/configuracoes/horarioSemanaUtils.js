/**
 * Compara dois horários HH:MM lexicograficamente.
 * Válido porque <input type="time"> sempre produz zero-padded HH:MM.
 */
export function hhmm(str) {
  return String(str || "").slice(0, 5);
}

export function timeToMinutes(str) {
  const [hours = 0, minutes = 0] = String(str || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(minutes, 1439));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Sugere turnos no mesmo dia, preservando a entrada e um intervalo de descanso. */
export function adicionarTurnoInteligente(turnos = []) {
  if (!turnos?.length) return [{ horaInicio: "08:00", horaFim: "18:00" }];

  if (turnos.length === 1) {
    const turno = turnos[0];
    const inicio = timeToMinutes(turno.horaInicio);
    const fim = timeToMinutes(turno.horaFim);
    if (fim - inicio >= 300) {
      const fimManha = Math.min(Math.max(inicio + 240, 720), fim - 120);
      return [
        { ...turno, horaFim: minutesToTime(fimManha) },
        { horaInicio: minutesToTime(fimManha + 60), horaFim: turno.horaFim },
      ];
    }
  }

  const ultimoFim = Math.max(...turnos.map((t) => timeToMinutes(t.horaFim)));
  const pausa = turnos.length === 1 || ultimoFim < 1080 ? 60 : 30;
  const novoInicio = ultimoFim + pausa;
  const duracao = turnos.length === 1 ? 300 : 180;
  const novoFim = Math.min(novoInicio + duracao, 1380);
  if (novoFim > novoInicio) {
    return [...turnos, { horaInicio: minutesToTime(novoInicio), horaFim: minutesToTime(novoFim) }];
  }

  // Sem espaço ao fim do dia: divide o maior período, se comportar a pausa.
  let maiorIdx = 0;
  turnos.forEach((t, i) => {
    const duracaoAtual = timeToMinutes(t.horaFim) - timeToMinutes(t.horaInicio);
    const maior = turnos[maiorIdx];
    if (duracaoAtual > timeToMinutes(maior.horaFim) - timeToMinutes(maior.horaInicio)) maiorIdx = i;
  });
  const maior = turnos[maiorIdx];
  const inicio = timeToMinutes(maior.horaInicio);
  const fim = timeToMinutes(maior.horaFim);
  if (fim - inicio < 62) return [...turnos];
  const meio = Math.floor((inicio + fim) / 2);
  const result = [...turnos];
  result.splice(maiorIdx, 1,
    { ...maior, horaFim: minutesToTime(meio - 30) },
    { horaInicio: minutesToTime(meio + 30), horaFim: maior.horaFim },
  );
  return result;
}

/**
 * Retorna um Set com os índices dos turnos sobrepostos dentro de um array de turnos.
 * Turnos são comparados em pares após ordenação por horaInicio.
 */
export function encontrarSobrepostos(turnos) {
  if (!turnos || turnos.length < 2) return new Set();
  const indexed = turnos.map((t, i) => ({ ...t, _orig: i }));
  indexed.sort((a, b) => hhmm(a.horaInicio).localeCompare(hhmm(b.horaInicio)));
  const conflitantes = new Set();
  for (let i = 0; i < indexed.length - 1; i++) {
    if (hhmm(indexed[i].horaFim) > hhmm(indexed[i + 1].horaInicio)) {
      conflitantes.add(indexed[i]._orig);
      conflitantes.add(indexed[i + 1]._orig);
    }
  }
  return conflitantes;
}

export function dispToDiasConfig(disp = []) {
  const lista = Array.isArray(disp)
    ? disp
    : Array.isArray(disp?.turnos)
      ? disp.turnos
      : [];
  return Array.from({ length: 7 }, (_, dia) => {
    const turnos = lista
      .filter((row) => Number(row.diaSemana) === dia && row.ativo !== false)
      .map((row) => ({
        horaInicio: hhmm(row.horaInicio || "08:00"),
        horaFim: hhmm(row.horaFim || "18:00"),
      }));
    return {
      ativo: turnos.length > 0,
      turnos: turnos.length
        ? turnos
        : [{ horaInicio: "08:00", horaFim: "18:00" }],
    };
  });
}
export function diasConfigToDisp(diasConfig = []) {
  return diasConfig.flatMap((dia, diaSemana) =>
    dia.ativo
      ? dia.turnos
          .filter((turno) => turno.horaInicio && turno.horaFim)
          .map((turno) => ({
            id: null,
            diaSemana,
            horaInicio: hhmm(turno.horaInicio),
            horaFim: hhmm(turno.horaFim),
            ativo: true,
          }))
      : [],
  );
}

/**
 * Funde intervalos contíguos ou sobrepostos (ex.: 08:00-12:00 + 12:00-18:00 -> 08:00-18:00).
 */
export function fundirJanelasMinutos(turnos = []) {
  const validos = (turnos || [])
    .map((t) => ({
      ini: timeToMinutes(hhmm(t?.horaInicio)),
      fim: timeToMinutes(hhmm(t?.horaFim)),
    }))
    .filter((j) => Number.isFinite(j.ini) && Number.isFinite(j.fim) && j.fim > j.ini)
    .sort((a, b) => a.ini - b.ini || a.fim - b.fim);

  const fundidas = [];
  for (const j of validos) {
    if (fundidas.length === 0) {
      fundidas.push({ ...j });
    } else {
      const ultima = fundidas[fundidas.length - 1];
      if (j.ini <= ultima.fim) {
        ultima.fim = Math.max(ultima.fim, j.fim);
      } else {
        fundidas.push({ ...j });
      }
    }
  }
  return fundidas;
}

