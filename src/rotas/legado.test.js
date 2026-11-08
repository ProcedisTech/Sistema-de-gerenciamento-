import { afterEach, describe, expect, it, vi } from "vitest";
import { consumirChavesAntigas, CHAVES_ANTIGAS } from "./legado";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("consumirChavesAntigas", () => {
  it('activeView=agenda em "/" devolve /agenda e apaga a chave', () => {
    sessionStorage.setItem("activeView", "agenda");
    expect(consumirChavesAntigas("/")).toBe("/agenda");
    expect(sessionStorage.getItem("activeView")).toBeNull();
    expect(consumirChavesAntigas("/")).toBeNull();
  });

  it.each([
    ["jornada", "/pacientes"],
    ["consulta", "/pacientes"],
    ["anamnese", "/configuracoes"],
    ["termos", "/configuracoes"],
    ["gestao-equipe", "/equipe"],
    ["pacientes", "/pacientes"],
    ["notificacoes", "/notificacoes"],
    ["configuracoes", "/configuracoes"],
  ])("%s -> %s", (valor, esperado) => {
    sessionStorage.setItem("activeView", valor);
    expect(consumirChavesAntigas("/")).toBe(esperado);
  });

  it("valor desconhecido devolve null e apaga", () => {
    sessionStorage.setItem("activeView", "xyz");
    expect(consumirChavesAntigas("/")).toBeNull();
    expect(sessionStorage.getItem("activeView")).toBeNull();
  });

  it('pathname diferente de "/" devolve null e apaga', () => {
    sessionStorage.setItem("activeView", "agenda");
    expect(consumirChavesAntigas("/agenda")).toBeNull();
    expect(sessionStorage.getItem("activeView")).toBeNull();
  });

  it("exporta a lista de chaves da onda", () => {
    expect(CHAVES_ANTIGAS).toEqual([
      "activeView",
      "patientView",
      "patientDetailTab",
      "selectedPatientCpf",
      "activePatientCpf",
      "procedi_config_section",
      "procedi_config_tab",
    ]);
  });

  it.each([
    "patientView",
    "patientDetailTab",
    "selectedPatientCpf",
    "activePatientCpf",
    "procedi_config_section",
    "procedi_config_tab",
  ])("apaga a chave antiga %s", (chave) => {
    sessionStorage.setItem(chave, "x");
    consumirChavesAntigas("/agenda");
    expect(sessionStorage.getItem(chave)).toBeNull();
  });

  it("storage que lança não lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(consumirChavesAntigas("/")).toBeNull();
  });
});
