import { describe, it, expect, vi } from 'vitest'
import { aoMostrarPagina } from '../../pwa/recarregarAoVoltar.js'

const rodar = (persisted, travado, publica) => {
  const recarregar = vi.fn()
  aoMostrarPagina({ persisted }, { estaTravado: () => travado, recarregar, publica })
  return recarregar
}

describe('aoMostrarPagina', () => {
  it('persisted travado não recarrega', () => expect(rodar(true, true)).not.toHaveBeenCalled())
  it('persisted livre recarrega', () => expect(rodar(true, false)).toHaveBeenCalledTimes(1))
  it('não persisted livre não recarrega', () => expect(rodar(false, false)).not.toHaveBeenCalled())
  it('não persisted travado não recarrega', () => expect(rodar(false, true)).not.toHaveBeenCalled())
  // 12a
  it('persisted em rota pública (livre) não recarrega', () => expect(rodar(true, false, true)).not.toHaveBeenCalled())
  it('persisted sem publica e sem trava recarrega (publica=false)', () => expect(rodar(true, false, false)).toHaveBeenCalledTimes(1))
})
