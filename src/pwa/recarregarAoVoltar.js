export function aoMostrarPagina(event, { estaTravado, recarregar, publica }) {
  if (event.persisted && !publica && !estaTravado()) recarregar()
}
