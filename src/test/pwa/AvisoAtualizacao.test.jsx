import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router'
import AvisoAtualizacao from '../../pwa/AvisoAtualizacao.jsx'
import SeloAtualizacao from '../../pwa/SeloAtualizacao.jsx'
import { ToastProvider } from '../../contexts/ToastContext.jsx'
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
    // Como a lib real: o registro chega depois da montagem (o hook guarda as ações num efeito posterior).
    React.useEffect(() => { queueMicrotask(() => opcoes?.onRegisteredSW?.('/sw.js', sw.reg)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return { needRefresh: [precisa, () => {}], updateServiceWorker: sw.updateServiceWorker }
  })
  return { useRegisterSW: (...a) => sw.useRegisterSW(...a) }
})

const MOTIVOS = ['consulta', 'config', 'ficha', 'horario', 'm1', 'm2']
const MARCA = 'procedi_atualizado'
const TEXTO_FAIXA = /Atualização disponível|Nova versão do Procedi|Outra aba está em consulta/
let roteador
let reload

function novoWaiting() {
  const ouvintes = []
  return {
    state: 'installed',
    postMessage: vi.fn(),
    addEventListener: vi.fn((_t, cb) => ouvintes.push(cb)),
    emitir(estado) { this.state = estado; ouvintes.forEach((cb) => cb()) },
  }
}

async function montar(caminho = '/a') {
  roteador = createMemoryRouter(
    [{ path: '*', element: <div data-testid="pagina">pagina</div> }],
    { initialEntries: [caminho] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={roteador} />
      <AvisoAtualizacao router={roteador} />
      <SeloAtualizacao />
    </ToastProvider>,
  )
  await act(async () => {}) // deixa o registro falso chegar
}
// O toast também tem role=status: a faixa é o status com um dos textos dela.
const faixa = () => screen.queryAllByRole('status').find((e) => TEXTO_FAIXA.test(e.textContent)) ?? null
const ir = (para) => act(async () => { await roteador.navigate(para) })
const definir = (v) => act(() => { sw.definir(v) })
const espereFaixa = (texto) => waitFor(() => {
  const f = faixa()
  expect(f).not.toBeNull()
  if (texto) expect(f).toHaveTextContent(texto)
  return f
})
const espereSemFaixa = () => waitFor(() => expect(faixa()).toBeNull())
const selo = () => screen.queryByRole('button', { name: 'Atualização pendente' })
const botao = (nome) => screen.getByRole('button', { name: nome })
const assentar = () => act(async () => { await new Promise((r) => setTimeout(r, 25)) })

beforeEach(() => {
  sw.precisa = false
  sw.reg = { update: vi.fn(() => Promise.resolve()), waiting: null }
  sw.updateServiceWorker.mockClear()
  sw.useRegisterSW.mockClear()
  reload = vi.fn()
  vi.stubGlobal('location', { pathname: '/a', reload })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
  sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  MOTIVOS.forEach(liberar)
  vi.unstubAllGlobals()
  delete navigator.serviceWorker
  sessionStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('AvisoAtualizacao', () => {
  it('sem versão nova não há faixa; com versão, é filha direta do body com Atualizar agora e Depois', async () => {
    await montar()
    await screen.findByTestId('pagina')
    expect(faixa()).toBeNull()
    await definir(true)
    const f = await espereFaixa('Atualização disponível')
    expect(f.parentElement).toBe(document.body)
    expect(f).toHaveAttribute('aria-live', 'polite')
    expect(botao('Atualizar agora')).toBeInTheDocument()
    expect(botao('Depois')).toBeInTheDocument()
  })

  it('"Depois" esconde a faixa e mostra o selo; navegar sem trava aplica a versão', async () => {
    await montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    expect(selo()).toBeInTheDocument() // sinal positivo: o estado assentou
    expect(reload).not.toHaveBeenCalled()
    await ir('/b')
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(MARCA)).toBe('1')
  })

  it('voltar à mesma entrada do histórico não traz a faixa de volta e o selo continua', async () => {
    await montar('/a')
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    await ir('/b')
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    await ir(-1)
    expect(roteador.state.location.pathname).toBe('/a')
    await assentar()
    expect(faixa()).toBeNull()
    expect(selo()).toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1) // a guarda "recarregando" impede segunda recarga
  })

  it('travar troca a faixa: ficha pede salvar e sair (só Ok); consulta pede sair da consulta; sair da consulta aplica', async () => {
    await montar()
    await definir(true)
    await espereFaixa('Atualização disponível')
    act(() => travar('m1'))
    const salvar = await espereFaixa('salvar e sair desta tela')
    expect(salvar).toHaveTextContent('Nova versão do Procedi')
    expect(botao('Ok')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    act(() => liberar('m1'))
    await espereFaixa('Atualização disponível') // liberar volta à faixa normal
    // sem versão a faixa não volta
    act(() => travar('m1'))
    await espereFaixa('salvar e sair desta tela')
    await definir(false)
    await espereSemFaixa()
    act(() => liberar('m1'))
    await definir(true)
    await espereFaixa('Atualização disponível') // sinal positivo
    expect(reload).not.toHaveBeenCalled()
    act(() => travar('consulta'))
    await espereFaixa('sair da consulta')
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    fireEvent.click(botao('Ok'))
    await espereSemFaixa()
    await assentar()
    expect(reload).not.toHaveBeenCalled() // dentro da consulta nada aplica
    act(() => liberar('consulta'))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('dois motivos: nada é aplicado ao navegar enquanto sobrar um; só depois de liberar os dois', async () => {
    await montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    act(() => { travar('m1'); travar('m2') })
    await espereFaixa('salvar e sair desta tela')
    act(() => liberar('m1'))
    await ir('/b') // render posterior à liberação de um só
    await espereFaixa('salvar e sair desta tela')
    await assentar()
    expect(reload).not.toHaveBeenCalled()
    act(() => liberar('m2'))
    await espereSemFaixa()
    expect(reload).not.toHaveBeenCalled() // liberar sozinho não aplica
    await ir('/c')
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('"Depois" + liberar não aplica antes de navegar; ao navegar aplica', async () => {
    await montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    act(() => travar('m1'))
    await espereFaixa('salvar e sair desta tela')
    act(() => liberar('m1'))
    await espereSemFaixa()
    await definir(false); await definir(true) // render extra como sinal de que o estado assentou
    expect(selo()).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    await ir('/b')
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('rota pública: sem faixa e sem chamar useRegisterSW; fora dela a faixa aparece', async () => {
    sw.precisa = true
    await montar('/assinar/x')
    await screen.findByTestId('pagina')
    expect(faixa()).toBeNull()
    expect(sw.useRegisterSW).not.toHaveBeenCalled()
    await ir('/a')
    await espereFaixa()
    expect(sw.useRegisterSW).toHaveBeenCalled()
  })

  it('3a: "Atualizar agora" com versão em espera envia SKIP_WAITING e só recarrega em "activated"', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Atualizar agora'))
    await waitFor(() => expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    expect(sessionStorage.getItem(MARCA)).toBe('1')
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
    await assentar()
    expect(reload).not.toHaveBeenCalled() // ainda não ativou
    act(() => w.emitir('activated'))
    expect(reload).toHaveBeenCalledTimes(1)
    act(() => w.emitir('activated'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('3b: "Atualizar agora" sem versão em espera recarrega na hora', async () => {
    await montar()
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Atualizar agora'))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(MARCA)).toBe('1')
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('3c: sem sinal de ativação recarrega no tempo-limite de 3000 ms', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    vi.useFakeTimers()
    fireEvent.click(botao('Atualizar agora'))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }) // sinal positivo: o temporizador foi armado
    await act(async () => { await vi.advanceTimersByTimeAsync(2999) })
    expect(reload).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('3d: se a recarga for cancelada e a página seguir viva, "Atualizar agora" volta a funcionar', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    vi.useFakeTimers()
    fireEvent.click(botao('Atualizar agora'))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(reload).toHaveBeenCalledTimes(1) // recarga "cancelada": reload falso não sai da página
    expect(w.postMessage).toHaveBeenCalledTimes(1)
    fireEvent.click(botao('Atualizar agora'))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(w.postMessage).toHaveBeenCalledTimes(1) // antes do limite a guarda ainda vale
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    fireEvent.click(botao('Atualizar agora'))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(w.postMessage).toHaveBeenCalledTimes(2)
  })

  it('10a: com trava de ficha a faixa pede salvar e sair (só Ok) e o selo não recarrega nem envia SKIP_WAITING', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    act(() => travar('ficha'))
    await espereFaixa('salvar e sair desta tela')
    expect(botao('Ok')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    fireEvent.click(botao('Ok'))
    await espereSemFaixa()
    expect(selo()).toBeInTheDocument()
    fireEvent.click(selo())
    await espereFaixa('salvar e sair desta tela') // tocar no selo traz a faixa de volta
    await assentar()
    expect(reload).not.toHaveBeenCalled()
    expect(w.postMessage).not.toHaveBeenCalled()
  })

  it('10b: depois de liberar a ficha, trocar de tela aplica a versão', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    fireEvent.click(botao('Depois'))
    await espereSemFaixa()
    act(() => travar('ficha'))
    await espereFaixa('salvar e sair desta tela')
    fireEvent.click(selo())
    await espereFaixa('salvar e sair desta tela')
    act(() => liberar('ficha'))
    await espereFaixa('Atualização disponível') // o selo foi gasto: a faixa normal volta
    await assentar()
    expect(w.postMessage).not.toHaveBeenCalled() // liberar sozinho não aplica
    await ir('/b')
    await waitFor(() => expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    act(() => w.emitir('activated'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('10c: ficha salva depois do Ok: liberar e trocar de tela aplica a versão', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    act(() => travar('ficha'))
    await espereFaixa('salvar e sair desta tela')
    fireEvent.click(botao('Ok'))
    await espereSemFaixa()
    act(() => liberar('ficha'))
    await assentar()
    expect(w.postMessage).not.toHaveBeenCalled() // liberar sozinho não aplica
    await ir('/b')
    await waitFor(() => expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
  })

  it('10d: o mesmo sem tocar em Ok', async () => {
    await montar()
    const w = novoWaiting()
    sw.reg.waiting = w
    await definir(true)
    await espereFaixa()
    act(() => travar('ficha'))
    await espereFaixa('salvar e sair desta tela')
    act(() => liberar('ficha'))
    await espereFaixa('Atualização disponível')
    await assentar()
    expect(w.postMessage).not.toHaveBeenCalled()
    await ir('/b')
    await waitFor(() => expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
  })

  it('11a: marca de atualização sem versão em espera mostra o toast uma vez e apaga a marca', async () => {
    sessionStorage.setItem(MARCA, '1')
    await montar()
    expect(await screen.findByText('Procedi atualizado')).toBeInTheDocument()
    expect(sessionStorage.getItem(MARCA)).toBeNull()
    cleanup()
    sw.reg.update.mockClear()
    await montar()
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1)) // sinal positivo: o registro da 2ª montagem terminou (procurar é o último passo)
    expect(screen.queryByText('Procedi atualizado')).toBeNull()
  })

  it('11b: marca com versão ainda em espera não mostra toast, não aplica e mostra a faixa', async () => {
    sessionStorage.setItem(MARCA, '1')
    const w = novoWaiting()
    sw.reg.waiting = w
    sw.precisa = true
    await montar()
    await espereFaixa('Atualização disponível')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalled())
    expect(screen.queryByText('Procedi atualizado')).toBeNull()
    expect(sessionStorage.getItem(MARCA)).toBeNull()
    expect(w.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('navegar chama reg.update()', async () => {
    await montar()
    await screen.findByTestId('pagina')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalled()) // registro chegou
    sw.reg.update.mockClear() // o registro e o efeito de montagem já chamaram update
    await ir('/b')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1))
  })

  it('visibilitychange: visível chama reg.update(), oculta não', async () => {
    await montar()
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
