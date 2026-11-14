import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router'
import AvisoAtualizacao from '../../pwa/AvisoAtualizacao.jsx'
import { liberar, travar } from '../../pwa/travaAtualizacao.js'

// Falso controlável de virtual:pwa-register/react (needRefresh vem de uma store para re-renderizar).
const sw = vi.hoisted(() => {
  const ouvintes = new Set()
  const s = {
    precisa: false,
    reg: null,
    updateServiceWorker: null,
    useRegisterSW: null,
    definir(v) { s.precisa = v; ouvintes.forEach((cb) => cb()) },
    assinar(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb) },
  }
  return s
})

vi.mock('virtual:pwa-register/react', async () => {
  const React = await import('react')
  sw.updateServiceWorker = vi.fn()
  sw.useRegisterSW = vi.fn((opcoes) => {
    const precisa = React.useSyncExternalStore(sw.assinar, () => sw.precisa)
    React.useEffect(() => { opcoes?.onRegisteredSW?.('/sw.js', sw.reg) }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return { needRefresh: [precisa, () => {}], updateServiceWorker: sw.updateServiceWorker }
  })
  return { useRegisterSW: (...a) => sw.useRegisterSW(...a) }
})

const MOTIVOS = ['consulta', 'config', 'ficha', 'horario', 'm1', 'm2']
let roteador

function montar(caminho = '/a') {
  roteador = createMemoryRouter(
    [{ path: '*', element: <div data-testid="pagina">pagina</div> }],
    { initialEntries: [caminho] },
  )
  render(<><RouterProvider router={roteador} /><AvisoAtualizacao router={roteador} /></>)
}
const faixa = () => screen.queryByRole('status')
const ir = (para) => act(async () => { await roteador.navigate(para) })
const definir = (v) => act(() => { sw.definir(v) })
const espereFaixa = () => screen.findByRole('status')

beforeEach(() => {
  sw.precisa = false
  sw.reg = { update: vi.fn(() => Promise.resolve()) }
  sw.updateServiceWorker.mockClear()
  sw.useRegisterSW.mockClear()
})
afterEach(() => {
  cleanup()
  MOTIVOS.forEach(liberar)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('AvisoAtualizacao', () => {
  it('sem versão nova não há faixa; com versão, é filha direta do body com Atualizar e Depois', async () => {
    montar()
    await screen.findByTestId('pagina')
    expect(faixa()).toBeNull()
    await definir(true)
    const f = await espereFaixa()
    expect(f.parentElement).toBe(document.body)
    expect(f).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Depois' })).toBeInTheDocument()
  })

  it('"Depois" esconde e navegar traz de volta', async () => {
    montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await waitFor(() => expect(faixa()).toBeNull())
    await ir('/b')
    await espereFaixa()
  })

  it('voltar à mesma entrada do histórico também traz de volta (A, Depois, B, volta, A)', async () => {
    montar('/a')
    await definir(true)
    await espereFaixa()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await waitFor(() => expect(faixa()).toBeNull())
    await ir('/b')
    await espereFaixa()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await waitFor(() => expect(faixa()).toBeNull())
    await ir(-1)
    expect(roteador.state.location.pathname).toBe('/a')
    await espereFaixa()
  })

  it('travar esconde e liberar volta se ainda houver versão; sem versão não volta', async () => {
    montar()
    await definir(true)
    await espereFaixa()
    act(() => travar('m1'))
    await waitFor(() => expect(faixa()).toBeNull())
    act(() => liberar('m1'))
    await espereFaixa()
    act(() => travar('m1'))
    await waitFor(() => expect(faixa()).toBeNull())
    await definir(false)
    act(() => liberar('m1'))
    await definir(true)
    await espereFaixa() // sinal positivo; antes dele a faixa não pode ter voltado sem versão
  })

  it('dois motivos só voltam depois de liberar os dois', async () => {
    montar()
    await definir(true)
    await espereFaixa()
    act(() => { travar('m1'); travar('m2') })
    await waitFor(() => expect(faixa()).toBeNull())
    act(() => liberar('m1'))
    await ir('/b') // render posterior à liberação de um só
    await screen.findByTestId('pagina')
    expect(faixa()).toBeNull()
    act(() => liberar('m2'))
    await espereFaixa()
  })

  it('"Depois" + liberar não volta antes de navegar', async () => {
    montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await waitFor(() => expect(faixa()).toBeNull())
    act(() => travar('m1'))
    act(() => liberar('m1'))
    await definir(false); await definir(true) // render extra como sinal de que o estado assentou
    expect(faixa()).toBeNull()
    await ir('/b')
    await espereFaixa()
  })

  it('rota pública: sem faixa e sem chamar useRegisterSW; fora dela a faixa aparece', async () => {
    sw.precisa = true
    montar('/assinar/x')
    await screen.findByTestId('pagina')
    expect(faixa()).toBeNull()
    expect(sw.useRegisterSW).not.toHaveBeenCalled()
    await ir('/a')
    await espereFaixa()
    expect(sw.useRegisterSW).toHaveBeenCalled()
  })

  it('"Atualizar" chama updateServiceWorker(true)', async () => {
    montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledTimes(1)
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('navegar chama reg.update()', async () => {
    montar()
    await screen.findByTestId('pagina')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalled()) // registro chegou (efeito de montagem)
    sw.reg.update.mockClear()
    await ir('/b')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1))
  })

  it('visibilitychange: visível chama reg.update(), oculta não', async () => {
    montar()
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalled())
    sw.reg.update.mockClear()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(sw.reg.update).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(sw.reg.update).toHaveBeenCalledTimes(1) // só a visível contou
  })
})
