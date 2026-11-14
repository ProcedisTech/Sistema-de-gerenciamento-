// Copia useRotaAtual.js:7 (e AppRefactored.jsx:4874-4879); manter em sincronia.
const PREFIXOS = ['/c/', '/anamnese', '/assinar']
export function ehRotaPublica(pathname) { return PREFIXOS.some((p) => String(pathname).startsWith(p)) }
