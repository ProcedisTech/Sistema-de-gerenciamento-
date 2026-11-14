import { describe, it, expect, afterEach, vi } from 'vitest'
import { travar, liberar, estaTravado, aoMudarTrava } from '../../pwa/travaAtualizacao.js'

// Estado de módulo: libera tudo que o teste travou.
const usados = ['a', 'b']
afterEach(() => usados.forEach((m) => liberar(m)))

describe('travaAtualizacao', () => {
  it('começa livre', () => expect(estaTravado()).toBe(false))

  it('travar deixa travado', () => {
    travar('a')
    expect(estaTravado()).toBe(true)
  })

  it('dois motivos: liberar um mantém travado, o último destrava', () => {
    travar('a'); travar('b')
    liberar('a')
    expect(estaTravado()).toBe(true)
    liberar('b')
    expect(estaTravado()).toBe(false)
  })

  it('mesmo motivo duas vezes + uma liberação fica livre', () => {
    travar('a'); travar('a')
    liberar('a')
    expect(estaTravado()).toBe(false)
  })

  it('liberar motivo inexistente não notifica', () => {
    const cb = vi.fn()
    const cancela = aoMudarTrava(cb)
    liberar('a')
    expect(cb).not.toHaveBeenCalled()
    cancela()
  })

  it('aoMudarTrava notifica só nas transições', () => {
    const cb = vi.fn()
    const cancela = aoMudarTrava(cb)
    travar('a')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith(true)
    travar('b')
    expect(cb).toHaveBeenCalledTimes(1)
    liberar('a')
    expect(cb).toHaveBeenCalledTimes(1)
    liberar('b')
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(false)
    cancela()
  })

  it('a função devolvida cancela a inscrição', () => {
    const cb = vi.fn()
    aoMudarTrava(cb)()
    travar('a')
    expect(cb).not.toHaveBeenCalled()
  })
})
