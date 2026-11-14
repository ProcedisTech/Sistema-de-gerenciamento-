// Ficha: o AnamneseDocumentoEditor não tinha teste de componente; o caso do horário fica em
// src/components/configuracoes/HorarioClinicaPanel.test.jsx.
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AnamneseDocumentoEditor } from '../../components/anamnese/AnamneseDocumentoEditor.jsx'
import { estaTravado, liberar, travar } from '../../pwa/travaAtualizacao.js'

vi.mock('../../services/api', () => ({
  anamneseApi: { listStarters: async () => [], getStarterDocumento: async () => ({}), getFicha: vi.fn(), createFicha: vi.fn(), salvarDocumento: vi.fn() },
  clinicaApi: { buscar: async () => null, atualizar: vi.fn() },
  dimensoesApi: { especialidades: async () => [] },
  getApiErrorToastMessage: (e, f) => e?.message || f,
}))
vi.mock('../../contexts/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

beforeAll(() => { globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }; window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) })
afterEach(() => { cleanup(); liberar('ficha') })

async function montarESujar() {
  const sujo = vi.fn()
  const r = render(<AnamneseDocumentoEditor fichaId={null} onBack={vi.fn()} onSaved={vi.fn()} onFichaNomeChange={vi.fn()} onDirtyChange={sujo} />)
  await screen.findByText('Escrever do zero') // carga terminou (INIT_BLANK não zera o sujo depois)
  const nome = await screen.findByPlaceholderText('Dê um nome para a ficha...')
  fireEvent.change(nome, { target: { value: 'Ficha X' } })
  await waitFor(() => expect(sujo).toHaveBeenLastCalledWith(true)) // o pai viu o sujo: o efeito da trava já rodou
  return r
}

describe('trava de atualização pela ficha', () => {
  it('ficar suja trava e desmontar libera', async () => {
    expect(estaTravado()).toBe(false)
    const { unmount } = await montarESujar()
    await waitFor(() => expect(estaTravado()).toBe(true))
    unmount()
    expect(estaTravado()).toBe(false)
  })

  it('o motivo é exatamente "ficha": outro motivo de fora não é solto e o "ficha" de fora é', async () => {
    travar('horario')
    let r = await montarESujar()
    r.unmount()
    expect(estaTravado()).toBe(true)
    liberar('horario')
    travar('ficha')
    r = await montarESujar()
    r.unmount()
    expect(estaTravado()).toBe(false)
  })
})
