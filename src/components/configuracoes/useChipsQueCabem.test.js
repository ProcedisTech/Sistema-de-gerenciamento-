import { it, expect } from "vitest";
import { chipsVisiveis } from "./useChipsQueCabem";

it("oculta a etiqueta que começa abaixo do limite", () => {
  const r = chipsVisiveis([0, 0, 40], 36, -1);
  expect([...r.ocultos]).toEqual([2]);
  expect(r.escolhidoNaFrente).toBe(false);
});
it("a escolhida que não coube vai para a frente e não fica oculta", () => {
  const r = chipsVisiveis([0, 0, 40], 36, 2);
  expect(r.escolhidoNaFrente).toBe(true);
  expect(r.ocultos.has(2)).toBe(false);
});
it("a escolhida que coube fica onde está", () => {
  const r = chipsVisiveis([0, 0, 40], 36, 1);
  expect(r.escolhidoNaFrente).toBe(false);
  expect([...r.ocultos]).toEqual([2]);
});
it("sem limite nada é oculto", () => {
  expect(chipsVisiveis([0, 40, 80], Infinity, -1).ocultos.size).toBe(0);
});
