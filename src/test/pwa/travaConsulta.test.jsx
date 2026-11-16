/** A consulta só trava a atualização enquanto está NA TELA (emConsultaNaTela); em segundo plano não trava. */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx'
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js'
import { estaTravado } from '../../pwa/travaAtualizacao.js'
import {
  ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, emConsulta, iniciarPeloPaciente, montarApp, resumoDto,
} from '../consulta/appConsulta.jsx'

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso())
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso())
// Tela de computador: a Sidebar só mostra os itens no desktop (mesmo mock de inatividadeForaDaTela.test.jsx).
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: (q) => q === '(min-width: 1024px)' }))

// Editor falso: só avisa "sujo" ao pai (não trava 'ficha' por conta própria, então o motivo vem do App: 'config').
vi.mock('../../components/anamnese/AnamneseDocumentoEditor.jsx', () => ({
  AnamneseDocumentoEditor: ({ onDirtyChange }) => <input aria-label="campo-ficha" onChange={() => onDirtyChange?.(true)} />,
}))

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`)

describe('trava de atualização pela consulta', () => {
  afterEach(() => {
    limparAmbienteSnapshot()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('abrir trava; sair da tela pelo menu lateral libera; voltar trava; encerrar libera', async () => {
    const estado = { dto: consultaDto(), criada: false }
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', ENCERRAR, () => ({ atendimentoId: ATENDIMENTO_ID, status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z', procedimentos: [], orientacoes: [] })],
        ['POST', /^\/api\/v1\/atendimentos$/, () => { estado.criada = true; return estado.dto }],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => (estado.criada && estado.dto.status === 'aberto' ? [resumoDto(estado.dto)] : [])],
      ],
    })
    expect(estaTravado()).toBe(false)
    await iniciarPeloPaciente()
    await waitFor(() => expect(emConsulta()).toBe(true))
    expect(estaTravado()).toBe(true)

    // Sai da TELA da consulta (menu lateral) com a consulta ainda aberta.
    fireEvent.click(within(document.querySelector('aside')).getByTitle('Agenda'))
    await assentarMuito(6)
    await waitFor(() => expect(emConsulta()).toBe(false)) // sinal positivo: a tela da consulta saiu
    await waitFor(() => expect(estaTravado()).toBe(false))

    // Volta pelo atalho e encerra.
    fireEvent.click(await screen.findByRole('button', { name: /^Voltar à consulta de/ }))
    await assentarMuito(6)
    await waitFor(() => expect(emConsulta()).toBe(true))
    expect(estaTravado()).toBe(true)
    clicarBotao(/Encerrar consulta/)
    await assentarMuito()
    clicarBotao(/^Finalizar Atendimento$/)
    await assentarMuito(6)
    await waitFor(() => expect(screen.queryByText('Jornada finalizada com sucesso.')).not.toBeNull())
    expect(emConsulta()).toBe(false)
    expect(estaTravado()).toBe(false)
  }, TIMEOUT)

  it('ficha suja em Configurações trava (motivo config do App) e desmontar libera', async () => {
    await montarApp({
      caminho: '/configuracoes/fichas/5',
      rotas: [['GET', /^\/api\/v1\/anamnese\/fichas$/, () => [{ id: 5, nome: 'Ficha Cinco', totalPerguntas: 1 }]]],
    })
    const campo = await screen.findByLabelText('campo-ficha')
    expect(estaTravado()).toBe(false)
    fireEvent.change(campo, { target: { value: 'x' } })
    await waitFor(() => expect(estaTravado()).toBe(true))
    cleanup()
    expect(estaTravado()).toBe(false)
  }, TIMEOUT)
})
