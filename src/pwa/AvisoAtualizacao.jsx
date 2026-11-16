import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ehRotaPublica } from './ehRotaPublica'
import { useAtualizacaoApp } from './useAtualizacaoApp'

const BTN_CLARO =
  'rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#0f766e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f766e]'
const BTN_VAZADO =
  'rounded-lg border border-white bg-transparent px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f766e]'

function Faixa({ chave }) {
  const { faixa, atualizar, depois, ok } = useAtualizacaoApp(chave)
  if (!faixa) return null
  const texto = {
    normal: 'Atualização disponível',
    consulta: 'Nova versão do Procedi · Atualiza quando você sair da consulta',
    salvar: 'Nova versão do Procedi · Atualiza quando você salvar e sair desta tela',
    outraAba: 'Outra aba está em consulta · atualiza quando ela terminar',
  }[faixa]
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:top-[4.5rem] sm:left-auto sm:right-4 sm:max-w-md rounded-xl bg-[#0f766e] text-white shadow-lg"
      style={{ zIndex: 25, fontFamily: 'Inter, sans-serif' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-medium">{texto}</span>
        <div className="flex gap-2">
          {faixa === 'normal' && (
            <button type="button" onClick={atualizar} className={BTN_CLARO}>
              Atualizar agora
            </button>
          )}
          {(faixa === 'consulta' || faixa === 'salvar') && (
            <button type="button" onClick={ok} className={BTN_CLARO}>
              Ok
            </button>
          )}
          {(faixa === 'normal' || faixa === 'outraAba') && (
            <button type="button" onClick={depois} className={BTN_VAZADO}>
              Depois
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function AvisoAtualizacao({ router }) {
  const loc = useSyncExternalStore(router.subscribe, () => router.state.location)
  if (ehRotaPublica(loc.pathname)) return null
  return <Faixa chave={loc.key} />
}
