import { describe, it, expect, vi } from 'vitest'
import { aoMostrarPagina } from '../../pwa/recarregarAoVoltar.js'

const rodar = (persisted, travado) => {
  const recarregar = vi.fn()
  aoMostrarPagina({ persisted }, { estaTravado: () => travado, recarregar })
  return recarregar
}

describe('aoMostrarPagina', () => {
  it('persisted travado não recarrega', () => expect(rodar(true, true)).not.toHaveBeenCalled())
  it('persisted livre recarrega', () => expect(rodar(true, false)).toHaveBeenCalledTimes(1))
  it('não persisted livre não recarrega', () => expect(rodar(false, false)).not.toHaveBeenCalled())
  it('não persisted travado não recarrega', () => expect(rodar(false, true)).not.toHaveBeenCalled())
})
