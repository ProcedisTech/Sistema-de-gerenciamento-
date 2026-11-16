import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router'
import AvisoAtualizacao from '../../pwa/AvisoAtualizacao.jsx'
import SeloAtualizacao from '../../pwa/SeloAtualizacao.jsx'
import { CONSULTA_ENTRE_ABAS, liberar, segurarEntreAbas, travar } from '../../pwa/travaAtualizacao.js'

// Falso de virtual:pwa-register/react. onRegisteredSW só roda quando o teste manda (registrar),
// como na lib real (assíncrono). controlling() imita o 'controlling' da lib: onNeedReload ou reload.
const sw = vi.hoisted(() => {
  const ouvintes = new Set()
  const s = {
    precisa: false,
    reg: null,
    opcoes: null,
    definir(v) { s.precisa = v; ouvintes.forEach((cb) => cb()) },
    assinar(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb) },
    registrar() { s.opcoes.onRegisteredSW('/sw.js', s.reg) },
    controlling() { if (s.opcoes.onNeedReload) s.opcoes.onNeedReload(); else location.reload() },
  }
  return s
})

vi.mock('virtual:pwa-register/react', async () => {
  const R = await import('react')
  return {
    useRegisterSW: (opcoes) => {
      sw.opcoes = opcoes
      const precisa = R.useSyncExternalStore(sw.assinar, () => sw.precisa)
      return { needRefresh: [precisa, () => {}], updateServiceWorker: vi.fn() }
    },
  }
})

const toastFalso = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastFalso }))

const MOTIVOS = ['consulta', 'config', 'ficha', 'horario', 'm1', 'm2']
const MARCA = 'procedi_atualizado'
let roteador
let recarga

const mkWaiting = () => ({ state: 'installed', postMessage: vi.fn(), addEventListener: vi.fn() })
const visibilidade = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
const assentar = () => act(async () => { await new Promise((r) => setTimeout(r, 15)) })

function montar(caminho = '/a') {
  roteador = createMemoryRouter(
    [{ path: '*', element: <div data-testid="pagina">pagina</div> }],
    { initialEntries: [caminho] },
  )
  render(<><RouterProvider router={roteador} /><AvisoAtualizacao router={roteador} /><SeloAtualizacao /></>)
}
const faixa = () => screen.queryByRole('status')
const ir = (para) => act(async () => { await roteador.navigate(para) })
const definir = (v) => act(() => { sw.definir(v) })
const registrar = () => act(() => { sw.registrar() })
const pediuAtivar = (w) => w.postMessage.mock.calls.some(([m]) => m?.type === 'SKIP_WAITING')
const texto = (re) => screen.findByText(re)

// Aba com versão nova em espera, sem aplicar sozinha: registra SEM waiting e só depois põe a versão.
async function comVersao(caminho) {
  montar(caminho)
  await screen.findByTestId('pagina')
  await registrar()
  const w = mkWaiting()
  sw.reg.waiting = w
  await definir(true)
  await texto('Atualização disponível')
  return w
}

beforeEach(() => {
  sw.precisa = false
  sw.opcoes = null
  sw.reg = { update: vi.fn(() => Promise.resolve()), waiting: null }
  toastFalso.success.mockClear()
  recarga = vi.fn()
  vi.stubGlobal('location', { reload: recarga, pathname: '/a' })
  sessionStorage.clear()
  visibilidade('visible')
})
afterEach(() => {
  cleanup()
  MOTIVOS.forEach(liberar)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete navigator.locks
  delete navigator.serviceWorker
  sessionStorage.clear()
  visibilidade('visible')
})

describe('5 · Depois, selo e troca de tela', () => {
  it('5a "Depois" mostra o selo; navegar sem trava aplica', async () => {
    const w = await comVersao()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await screen.findByRole('button', { name: 'Atualização pendente' })
    expect(faixa()).toBeNull()
    expect(pediuAtivar(w)).toBe(false)
    await ir('/b')
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('5a tocar no selo aplica', async () => {
    const w = await comVersao()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Atualização pendente' }))
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('5b sem "Depois", navegar não aplica', async () => {
    const w = await comVersao()
    sw.reg.update.mockClear()
    await ir('/b')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1)) // efeito da troca de tela rodou
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    expect(screen.getByText('Atualização disponível')).toBeInTheDocument()
  })

  it('5c "Depois" com trava ficha não aplica; liberar e navegar aplica', async () => {
    const w = await comVersao()
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await screen.findByRole('button', { name: 'Atualização pendente' })
    act(() => travar('ficha'))
    await texto(/salvar e sair desta tela/)
    sw.reg.update.mockClear()
    await ir('/b')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1))
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    act(() => liberar('ficha'))
    await ir('/c')
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })
})

describe('6 · registro com versão em espera', () => {
  it('6a registro com waiting e sem trava aplica', async () => {
    montar()
    await screen.findByTestId('pagina')
    const w = mkWaiting()
    sw.reg.waiting = w
    await registrar()
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('6b com a marca só mostra a faixa e apaga a marca', async () => {
    sessionStorage.setItem(MARCA, '1')
    montar()
    await screen.findByTestId('pagina')
    const w = mkWaiting()
    sw.reg.waiting = w
    await definir(true)
    await registrar()
    await texto('Atualização disponível')
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    expect(sessionStorage.getItem(MARCA)).toBeNull()
    expect(toastFalso.success).not.toHaveBeenCalled()
  })

  it('6c com trava não aplica', async () => {
    montar()
    await screen.findByTestId('pagina')
    const w = mkWaiting()
    sw.reg.waiting = w
    act(() => travar('ficha'))
    await definir(true)
    await registrar()
    await texto(/salvar e sair desta tela/)
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
  })

  it('6d abrindo em /consulta não aplica; ao sair da consulta aplica', async () => {
    vi.stubGlobal('location', { reload: recarga, pathname: '/consulta' })
    montar('/consulta')
    await screen.findByTestId('pagina')
    const w = mkWaiting()
    sw.reg.waiting = w
    await definir(true)
    await registrar()
    await texto('Atualização disponível')
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    vi.stubGlobal('location', { reload: recarga, pathname: '/b' }) // o location real já mudaria com a navegação
    await ir('/b')
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })
})

describe('6e · F5 no meio da consulta', () => {
  it('6e na rota /consulta sem trava ligada a troca de tela não aplica; fora da rota aplica', async () => {
    vi.stubGlobal('location', { reload: recarga, pathname: '/consulta' })
    montar('/consulta')
    await screen.findByTestId('pagina')
    await registrar()
    const w = mkWaiting()
    sw.reg.waiting = w
    await definir(true)
    await texto('Atualização disponível')
    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))
    await screen.findByRole('button', { name: 'Atualização pendente' })
    sw.reg.update.mockClear()
    await ir('/consulta/x')
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1)) // efeito da troca de tela rodou
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    vi.stubGlobal('location', { reload: recarga, pathname: '/b' })
    await ir('/b')
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })
})

describe('7 · procurar versão nova', () => {
  it('7a o registro chama update', async () => {
    montar()
    await screen.findByTestId('pagina')
    expect(sw.reg.update).not.toHaveBeenCalled()
    await registrar()
    await waitFor(() => expect(sw.reg.update).toHaveBeenCalledTimes(1))
  })

  it('7b a cada 10 min com a página visível chama update; oculta não chama', async () => {
    const espiao = vi.spyOn(window, 'setInterval')
    montar()
    await screen.findByTestId('pagina')
    await registrar()
    const chamada = espiao.mock.calls.find(([, ms]) => ms === 600000)
    expect(chamada).toBeTruthy()
    sw.reg.update.mockClear()
    act(() => chamada[0]())
    expect(sw.reg.update).toHaveBeenCalledTimes(1) // sinal positivo: visível chamou
    visibilidade('hidden')
    act(() => chamada[0]())
    expect(sw.reg.update).toHaveBeenCalledTimes(1)
  })

  it('7c o pageshow chama update', async () => {
    montar()
    await screen.findByTestId('pagina')
    await registrar()
    sw.reg.update.mockClear()
    act(() => { window.dispatchEvent(new Event('pageshow')) })
    expect(sw.reg.update).toHaveBeenCalledTimes(1)
  })
})

describe('8 · consulta na tela', () => {
  it('8a consulta mostra o texto da consulta com Ok; Ok esconde; liberar aplica', async () => {
    const w = await comVersao()
    act(() => travar('ficha'))
    await texto(/salvar e sair desta tela/)
    expect(screen.queryByText(/sair da consulta/)).toBeNull()
    act(() => liberar('ficha'))
    await texto('Atualização disponível')
    expect(pediuAtivar(w)).toBe(false)

    act(() => travar('consulta'))
    await texto(/Atualiza quando você sair da consulta/)
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }))
    await waitFor(() => expect(faixa()).toBeNull())
    expect(pediuAtivar(w)).toBe(false)
    act(() => liberar('consulta'))
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('8b consulta e ficha: liberar só a consulta não aplica', async () => {
    const w = await comVersao()
    act(() => { travar('consulta'); travar('ficha') })
    await texto(/sair da consulta/)
    act(() => liberar('consulta'))
    await texto(/salvar e sair desta tela/)
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    expect(recarga).not.toHaveBeenCalled()
  })

  it('8c controllerchange durante a consulta não recarrega', async () => {
    const fake = new EventTarget()
    fake.controller = {}
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: fake })
    montar()
    await screen.findByTestId('pagina')
    await registrar()
    act(() => travar('consulta'))
    act(() => { sw.controlling(); fake.dispatchEvent(new Event('controllerchange')) })
    await texto(/sair da consulta/) // pendente por controllerchange
    await assentar()
    expect(recarga).not.toHaveBeenCalled()
  })
})

// Falso mínimo de navigator.locks: o teste segura ou solta como se fosse outra aba.
function falsoLocks() {
  const held = []
  const esperas = []
  const acordar = () => {
    for (let i = esperas.length - 1; i >= 0; i--) {
      const e = esperas[i]
      if (!held.some((h) => h.name === e.name)) { esperas.splice(i, 1); e.go() }
    }
  }
  const api = {
    held,
    request(name, opts, cb) {
      if (opts.mode === 'shared') {
        const h = { name, mode: 'shared' }
        held.push(h)
        return Promise.resolve(cb()).finally(() => { held.splice(held.indexOf(h), 1); acordar() })
      }
      return new Promise((res) => {
        const go = () => res(cb())
        if (held.some((h) => h.name === name)) esperas.push({ name, go }); else go()
      })
    },
    query: () => Promise.resolve({ held: held.map((h) => ({ ...h })), pending: [] }),
    // simula a outra aba
    outraAbaSegura(name) { const h = { name, mode: 'shared' }; held.push(h); return () => { held.splice(held.indexOf(h), 1); acordar() } },
  }
  Object.defineProperty(navigator, 'locks', { configurable: true, value: api })
  return api
}

describe('d · outra aba em consulta', () => {
  it('d1 lock segurado: faixa outraAba sem postMessage; quando a espera resolve, aplica', async () => {
    const locks = falsoLocks()
    const w = await comVersao()
    const soltar = locks.outraAbaSegura(CONSULTA_ENTRE_ABAS)
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await texto(/Outra aba está em consulta/)
    await assentar()
    expect(pediuAtivar(w)).toBe(false)
    act(() => soltar())
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('d1 automático (registro com waiting) também espera a outra aba', async () => {
    const locks = falsoLocks()
    const soltar = locks.outraAbaSegura(CONSULTA_ENTRE_ABAS)
    montar()
    await screen.findByTestId('pagina')
    const w = mkWaiting()
    sw.reg.waiting = w
    await definir(true)
    await registrar()
    await texto(/Outra aba está em consulta/)
    expect(pediuAtivar(w)).toBe(false)
    act(() => soltar())
    await waitFor(() => expect(pediuAtivar(w)).toBe(true))
  })

  it('d2 aba escondida solta o lock; visível pede de novo; a devolvida solta tudo', async () => {
    const locks = falsoLocks()
    const soltarTudo = segurarEntreAbas(CONSULTA_ENTRE_ABAS)
    expect(locks.held).toHaveLength(1)
    visibilidade('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(locks.held).toHaveLength(0))
    visibilidade('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(locks.held).toHaveLength(1)
    soltarTudo()
    await waitFor(() => expect(locks.held).toHaveLength(0))
    visibilidade('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await assentar()
    expect(locks.held).toHaveLength(0) // ouvinte removido
  })
})
