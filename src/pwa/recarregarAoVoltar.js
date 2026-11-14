export function aoMostrarPagina(event, { estaTravado, recarregar }) {
  if (event.persisted && !estaTravado()) recarregar()
}
