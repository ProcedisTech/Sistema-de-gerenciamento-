import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../contexts/useToast'
import { ehRotaConsulta } from './ehRotaPublica'
import {
  CONSULTA_ENTRE_ABAS, aoMudarMotivos, esperarOutraAba, estaTravado,
  seguradoEmOutraAba, travadoAlemDe, travadoPor,
} from './travaAtualizacao'
import { definirSelo } from './seloAtualizacao'

const INTERVALO = 600000
const LIMITE = 3000
const MARCA = 'procedi_atualizado'

const lerMarca = () => { try { return sessionStorage.getItem(MARCA) === '1' } catch { return false } }
const gravarMarca = () => { try { sessionStorage.setItem(MARCA, '1') } catch { /* sem sessionStorage */ } }
const apagarMarca = () => { try { sessionStorage.removeItem(MARCA) } catch { /* idem */ } }

export function useAtualizacaoApp(chave) {
  const toast = useToast()
  const regRef = useRef(null)
  const recarregando = useRef(false)
  const esperandoRef = useRef(false)
  const acoes = useRef({})
  const estado = useRef({})
  const [trocou, setTrocou] = useState(false)
  const [escolheuDepois, setEscolheuDepois] = useState(false)
  const [okTocado, setOkTocado] = useState(false)
  const [aguardaSaida, setAguardaSaida] = useState(false)
  const [esperando, setEsperando] = useState(false)

  const {
    needRefresh: [precisa],
  } = useRegisterSW({
    immediate: true,
    onNeedReload() {},
    onRegisteredSW(_url, reg) { acoes.current.registrou(reg) },
  })
  const pendente = precisa || trocou
  const emConsulta = useSyncExternalStore(aoMudarMotivos, () => travadoPor('consulta'))
  const emSalvar = useSyncExternalStore(aoMudarMotivos, () => travadoAlemDe('consulta'))

  // Faixa de salvar/consulta com versão pendente: a próxima troca de tela aplica, mesmo depois do Ok.
  if (pendente && (emSalvar || emConsulta) && !aguardaSaida) setAguardaSaida(true)

  const procurar = () => { regRef.current?.update()?.catch(() => {}) }

  const aplicar = () => {
    if (recarregando.current) return
    recarregando.current = true
    gravarMarca()
    // Se a recarga for cancelada e a página seguir viva, libera de novo faixa, selo e "Atualizar agora".
    setTimeout(() => { recarregando.current = false; apagarMarca() }, LIMITE + 2000)
    const w = regRef.current?.waiting
    if (!w) { location.reload(); return }
    let feito = false
    const recarregar = () => { if (!feito) { feito = true; location.reload() } }
    w.addEventListener('statechange', () => {
      if (w.state === 'activated' || w.state === 'redundant') recarregar()
    })
    setTimeout(recarregar, LIMITE)
    w.postMessage({ type: 'SKIP_WAITING' })
  }

  // automatico: caminho sem toque do usuário; dentro da consulta nada se aplica sozinho (F5 no meio dela).
  const tentarSozinho = async (automatico) => {
    const travado = () => estaTravado() || (automatico && ehRotaConsulta(location.pathname))
    if (travado() || esperandoRef.current) return
    if (await seguradoEmOutraAba(CONSULTA_ENTRE_ABAS)) {
      esperandoRef.current = true
      setEsperando(true)
      await esperarOutraAba(CONSULTA_ENTRE_ABAS)
      esperandoRef.current = false
      setEsperando(false)
      if (travado()) return
    }
    aplicar()
  }

  const atualizar = () => {
    setEscolheuDepois(false)
    if (estaTravado()) {
      setOkTocado(false)
      setAguardaSaida(true)
      return
    }
    tentarSozinho()
  }

  const novasAcoes = {
    atualizar,
    tentarSozinho,
    procurar,
    registrou(reg) {
      regRef.current = reg
      const marca = lerMarca()
      if (marca) apagarMarca()
      if (!reg.waiting) {
        if (marca) toast.success('Procedi atualizado')
      } else if (!marca) {
        if (ehRotaConsulta(location.pathname)) setAguardaSaida(true)
        else tentarSozinho(true)
      }
      procurar()
    },
  }

  useEffect(() => {
    acoes.current = novasAcoes
    estado.current = { pendente, escolheuDepois, aguardaSaida }
  })

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return undefined
    const prev = sw.controller
    const aoTrocar = () => { if (prev && !recarregando.current) setTrocou(true) }
    sw.addEventListener('controllerchange', aoTrocar)
    return () => sw.removeEventListener('controllerchange', aoTrocar)
  }, [])

  useEffect(() => {
    acoes.current.procurar()
    const e = estado.current
    if (e.pendente && (e.escolheuDepois || e.aguardaSaida)) acoes.current.tentarSozinho(true)
  }, [chave])

  // Saiu da consulta: zera o Ok durante o render (padrão do React) e tenta aplicar no efeito.
  const [eraConsulta, setEraConsulta] = useState(emConsulta)
  if (eraConsulta !== emConsulta) {
    setEraConsulta(emConsulta)
    if (!emConsulta) setOkTocado(false)
  }
  const estavaEmConsulta = useRef(emConsulta)
  useEffect(() => {
    if (estavaEmConsulta.current && !emConsulta && estado.current.pendente) acoes.current.tentarSozinho(true)
    estavaEmConsulta.current = emConsulta
  }, [emConsulta])

  useEffect(() => {
    const visivel = () => document.visibilityState === 'visible'
    const id = setInterval(() => { if (visivel()) acoes.current.procurar() }, INTERVALO)
    const aoVoltar = () => { if (visivel()) acoes.current.procurar() }
    const aoMostrar = () => acoes.current.procurar()
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('pageshow', aoMostrar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('pageshow', aoMostrar)
    }
  }, [])

  const selo = pendente && escolheuDepois
  useEffect(() => {
    definirSelo(selo ? () => acoes.current.atualizar() : null)
    return () => definirSelo(null)
  }, [selo])

  let faixa = 'normal'
  if (!pendente) faixa = null
  else if (emConsulta && !okTocado) faixa = 'consulta'
  else if (emSalvar && !okTocado) faixa = 'salvar'
  else if (esperando && !escolheuDepois) faixa = 'outraAba'
  else if (escolheuDepois || okTocado) faixa = null

  return {
    faixa,
    atualizar,
    depois: () => setEscolheuDepois(true),
    ok: () => setOkTocado(true),
  }
}
