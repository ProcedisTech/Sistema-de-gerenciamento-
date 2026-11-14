import { describe, it, expect } from 'vitest'
import { ehRotaPublica } from '../../pwa/ehRotaPublica.js'

describe('ehRotaPublica', () => {
  it.each(['/c/abc', '/anamnese', '/anamnese/x', '/assinar/t'])('%s é pública', (p) =>
    expect(ehRotaPublica(p)).toBe(true))
  it.each(['/', '/pacientes', '/consulta', '/configuracoes', '/c'])('%s não é pública', (p) =>
    expect(ehRotaPublica(p)).toBe(false))
})
