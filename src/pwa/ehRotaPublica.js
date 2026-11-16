import { caminhos } from '../rotas/caminhos.js'
export const PREFIXOS = ['/c/', '/anamnese', '/assinar']
export function ehRotaPublica(pathname) { return PREFIXOS.some((p) => String(pathname).startsWith(p)) }
export function ehRotaConsulta(pathname) { const c = caminhos.consulta(); return pathname === c || pathname.startsWith(c + '/') }
