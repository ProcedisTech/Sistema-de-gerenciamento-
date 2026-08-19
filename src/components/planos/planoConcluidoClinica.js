export function loteConcluiuPlano(respostas) {
  const list = Array.isArray(respostas) ? respostas : [];
  return list.some((r) => r && r.planoConcluidoNesteFinalizar === true);
}

/** Fecha Encerrar/Sair antes do pop-up — um diálogo só na cena. */
export function aplicarCenaAntesDoPlanoConcluido({
  setEncerrarConsultaOpen,
  setFinishingMode,
} = {}) {
  setEncerrarConsultaOpen?.(false);
  setFinishingMode?.(null);
}
