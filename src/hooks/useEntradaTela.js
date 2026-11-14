import { useEffect, useState } from 'react';
import { agendaEnterClass } from '../components/agenda/agendaEnterClasses.js';

/** Entrada animada da tela: liga ao montar e quando `chave` muda; desliga após 1800 ms (mesmo tempo de Pacientes). */
export function useEntradaTela(chave) {
  const [ativa, setAtiva] = useState({ chave, ligada: true });
  // Chave nova religa durante o render (sem efeito extra); mesma chave não mexe.
  if (ativa.chave !== chave) setAtiva({ chave, ligada: true });
  const ligada = ativa.chave === chave ? ativa.ligada : true;

  useEffect(() => {
    const id = window.setTimeout(() => setAtiva({ chave, ligada: false }), 1800);
    return () => window.clearTimeout(id);
  }, [chave]);

  return (delayClass) => agendaEnterClass(ligada, delayClass);
}
