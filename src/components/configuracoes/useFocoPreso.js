import { useEffect, useRef } from "react";

const FOCAVEIS =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Janela/folha aberta: foco entra no que tiver [data-foco-inicial], Tab fica preso
 * dentro de `painelRef`, Esc chama `onFechar` e, ao fechar, o foco volta a `retornoRef`.
 */
export function useFocoPreso(painelRef, ativo, onFechar, retornoRef) {
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });
  useEffect(() => {
    if (!ativo) return undefined;
    const retorno = retornoRef?.current ?? document.activeElement;
    painelRef.current?.querySelector("[data-foco-inicial]")?.focus();
    const aoTeclar = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fecharRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !painelRef.current) return;
      const itens = [...painelRef.current.querySelectorAll(FOCAVEIS)];
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const fora = !painelRef.current.contains(document.activeElement);
      if (e.shiftKey && (fora || document.activeElement === primeiro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (fora || document.activeElement === ultimo)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      retorno?.focus?.();
    };
  }, [ativo, painelRef, retornoRef]);
}
