import { useLayoutEffect } from "react";

// Função pura. `tops` = offsetTop de cada etiqueta; as que começam em limiteY ou abaixo estão
// numa linha que não cabe. A escolhida nunca fica oculta: se não coube, vai para a frente.
export function chipsVisiveis(tops, limiteY, idxEscolhido = -1) {
  const ocultos = new Set();
  tops.forEach((top, i) => {
    if (top >= limiteY && i !== idxEscolhido) ocultos.add(i);
  });
  const escolhidoNaFrente =
    idxEscolhido >= 0 && tops[idxEscolhido] >= limiteY;
  return { ocultos, escolhidoNaFrente };
}

const linhasPorLargura = (w) => (w >= 1280 ? 0 : w < 768 ? 1 : 2);

// Mede na tela (nunca por número de caracteres). Etiquetas = filhos do contêiner; as que têm
// `data-fixo` contam para as linhas mas nunca saem; a escolhida tem aria-pressed="true".
export function useChipsQueCabem(ref, chave) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => {
      const filhos = Array.from(el.children);
      filhos.forEach((c) => {
        c.hidden = false;
        c.style.order = "";
      });
      const linhas = linhasPorLargura(window.innerWidth);
      if (!linhas || !filhos.length) return; // >= 1280 px: barra não é usada
      const pode = filhos.filter((c) => !c.hasAttribute("data-fixo"));
      const limite = () => {
        const linhasTops = [...new Set(filhos.map((c) => c.offsetTop))].sort(
          (a, b) => a - b,
        );
        return linhasTops.length > linhas ? linhasTops[linhas] : Infinity;
      };
      const escolhido = pode.findIndex(
        (c) => c.getAttribute("aria-pressed") === "true",
      );
      const tops = () => pode.map((c) => c.offsetTop);
      let r = chipsVisiveis(tops(), limite(), escolhido);
      if (r.escolhidoNaFrente) {
        pode[escolhido].style.order = "-1";
        filhos.find((c) => c.hasAttribute("data-fixo"))?.style.setProperty(
          "order",
          "-2",
        );
        r = chipsVisiveis(tops(), limite(), escolhido);
      }
      r.ocultos.forEach((i) => {
        pode[i].hidden = true;
      });
    };
    medir();
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    ro?.observe(el);
    document.fonts?.ready?.then(medir);
    return () => ro?.disconnect();
  }, [ref, chave]);
}
