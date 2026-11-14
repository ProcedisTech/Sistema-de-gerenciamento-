import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { aoMudarTrava, estaTravado } from './travaAtualizacao'

export function useAtualizacaoApp(chave) {
  const regRef = useRef(null)
  const {
    needRefresh: [precisa],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      regRef.current = reg
    },
  })
  const travado = useSyncExternalStore(aoMudarTrava, estaTravado)

  // Não guarda a key dispensada: voltar pelo histórico restaura a mesma key.
  const [dispensada, setDispensada] = useState(false)
  const [chaveAnterior, setChaveAnterior] = useState(chave)
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave)
    setDispensada(false)
  }

  useEffect(() => {
    regRef.current?.update()?.catch(() => {})
  }, [chave])

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') regRef.current?.update()?.catch(() => {})
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

  return {
    visivel: precisa && !travado && !dispensada,
    atualizar: () => updateServiceWorker(true),
    depois: () => setDispensada(true),
  }
}
