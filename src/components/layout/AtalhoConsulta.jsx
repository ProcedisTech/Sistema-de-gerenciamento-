import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { useAgoraDaClinica } from '../hooks/useAgoraDaClinica.js';
import { AtalhoConsultaBusca } from './AtalhoConsultaBusca.jsx';

const BOTAO =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40';

/** Tempo desde o início, em minutos ou horas e minutos. */
function tempoDeConsulta(iniciadoEm, agoraMs) {
  const inicio = Date.parse(iniciadoEm || '');
  if (!Number.isFinite(inicio)) return '';
  const min = Math.max(0, Math.floor((agoraMs - inicio) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

function Rotulo({ consulta, agoraMs }) {
  return (
    <>
      <Stethoscope className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.25} aria-hidden />
      <span className="hidden max-w-[9rem] truncate xl:inline">{consulta.pacienteNome || 'Paciente'}</span>
      <span className="tabular-nums text-ink-500">{tempoDeConsulta(consulta.iniciadoEm, agoraMs)}</span>
    </>
  );
}

/**
 * Atalho da consulta no cabeçalho (V1): só as consultas abertas contam (a abandonada some da barra). Sem consulta →
 * busca de paciente; uma → nome + tempo; duas ou mais → lista simples.
 * @param {{
 *   minhas: Array<{ id: string, pacienteNome?: string, status: string, iniciadoEm?: string }>,
 *   onEntrar: (consulta: object) => (void | boolean | Promise<boolean | void>),
 *   onEscolherPaciente: (paciente: object) => void,
 * }} props
 */
export function AtalhoConsulta({ minhas, onEntrar, onEscolherPaciente }) {
  const { agoraMs } = useAgoraDaClinica(30000);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [listaAberta, setListaAberta] = useState(false);
  const caixaRef = useRef(null);
  /** Consulta que está abrindo (id); trava o clique duplo e desabilita o atalho até a promessa fechar. */
  const [abrindoId, setAbrindoId] = useState(null);
  const abrindoRef = useRef(false);
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  const entrar = useCallback(
    async (c, chave) => {
      if (abrindoRef.current) return;
      abrindoRef.current = true;
      setAbrindoId(chave);
      try {
        await onEntrar(c);
      } catch {
        /* o aviso de falha é do App; aqui só limpa o estado */
      } finally {
        abrindoRef.current = false;
        if (montadoRef.current) {
          setAbrindoId(null);
          setListaAberta(false);
        }
      }
    },
    [onEntrar],
  );
  const abrindo = abrindoId !== null;
  const lista = (Array.isArray(minhas) ? minhas : []).filter((c) => c?.status === 'aberto');

  useEffect(() => {
    if (!listaAberta) return undefined;
    const fora = (e) => {
      if (!caixaRef.current?.contains(e.target)) setListaAberta(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [listaAberta]);

  if (lista.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setBuscaAberta(true)}
          aria-label="Iniciar consulta"
          title="Iniciar consulta"
          className={BOTAO}
        >
          <Stethoscope className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="hidden xl:inline">Consulta</span>
        </button>
        <AtalhoConsultaBusca
          open={buscaAberta}
          onClose={() => setBuscaAberta(false)}
          onEscolher={(paciente) => {
            setBuscaAberta(false);
            onEscolherPaciente(paciente);
          }}
        />
      </>
    );
  }

  if (lista.length === 1) {
    const c = lista[0];
    return (
      <button
        type="button"
        onClick={() => entrar(c, c.id ?? 0)}
        disabled={abrindo}
        aria-busy={abrindo ? 'true' : undefined}
        aria-label={`Voltar à consulta de ${c.pacienteNome || 'paciente'}`}
        title={`Consulta de ${c.pacienteNome || 'paciente'}`}
        className={`${BOTAO} disabled:cursor-wait disabled:opacity-60`}
      >
        {abrindo ? <span>Abrindo…</span> : <Rotulo consulta={c} agoraMs={agoraMs} />}
      </button>
    );
  }

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={() => setListaAberta((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={listaAberta}
        aria-label={`${lista.length} consultas em andamento`}
        aria-busy={abrindo ? 'true' : undefined}
        className={BOTAO}
      >
        <Stethoscope className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.25} aria-hidden />
        <span className="tabular-nums">{lista.length}</span>
        <span className="hidden xl:inline">consultas</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      </button>
      {listaAberta ? (
        <ul
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white py-1 shadow-lg"
        >
          {lista.map((c, i) => (
            <li key={c.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={abrindo}
                aria-busy={abrindoId === (c.id ?? i) ? 'true' : undefined}
                onClick={() => entrar(c, c.id ?? i)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="truncate font-medium">{c.pacienteNome || 'Paciente'}</span>
                <span className="shrink-0 tabular-nums text-ink-500">
                  {abrindoId === (c.id ?? i) ? 'Abrindo…' : tempoDeConsulta(c.iniciadoEm, agoraMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
