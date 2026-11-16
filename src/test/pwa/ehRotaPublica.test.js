import { describe, it, expect } from 'vitest'
import { ehRotaPublica, ehRotaConsulta, PREFIXOS } from '../../pwa/ehRotaPublica.js'

describe('ehRotaPublica', () => {
  it.each(['/c/abc', '/anamnese', '/anamnese/x', '/assinar/t'])('%s é pública', (p) =>
    expect(ehRotaPublica(p)).toBe(true))
  it.each(['/', '/pacientes', '/consulta', '/configuracoes', '/c'])('%s não é pública', (p) =>
    expect(ehRotaPublica(p)).toBe(false))
})

// 12b: a denylist do SW é montada de PREFIXOS como em vite.config.js (navigateFallbackDenylist).
describe('denylist do service worker (PREFIXOS)', () => {
  const denylist = PREFIXOS.map((p) => new RegExp('^' + p))
  const bloqueada = (rota) => denylist.some((r) => r.test(rota))
  it('tem os 3 prefixos do paciente', () => expect(PREFIXOS).toEqual(['/c/', '/anamnese', '/assinar']))
  it.each(['/c/x', '/anamnese', '/assinar/1'])('%s é bloqueada', (r) => expect(bloqueada(r)).toBe(true))
  it.each(['/agenda', '/', '/consulta', '/c'])('%s não é bloqueada', (r) => expect(bloqueada(r)).toBe(false))
})

describe('ehRotaConsulta', () => {
  it.each(['/consulta', '/consulta/12'])('%s é consulta', (p) => expect(ehRotaConsulta(p)).toBe(true))
  it.each(['/agenda', '/consultas', '/', '/anamnese'])('%s não é consulta', (p) => expect(ehRotaConsulta(p)).toBe(false))
})
