import React from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import fixtures from "../../test/fixtures/equipePrototype.json";
import EquipePessoaView from "./EquipePessoaView";
import PreviaAcessoView from "./PreviaAcessoView";
import { PreviaAcessoProvider } from "../../contexts/PreviaAcessoContext";

const api = vi.hoisted(() => ({ buscar: vi.fn(), get: vi.fn(), list: vi.fn() }));
vi.mock("../../services/api", () => ({
  disponibilidadeApi: { buscar: api.buscar, atualizar: vi.fn() },
  equipeApi: { update: vi.fn(), get: api.get },
  pacientesApi: { inativos: api.list, listInativos: api.list, list: api.list, get: api.get },
  authHeadersForFetch: vi.fn(async () => ({})),
  getApiErrorToastMessage: (e, f) => e.message || f,
  getOrgId: () => "test-org",
  setOrgId: () => {},
}));
vi.mock("../../contexts/useToast.js", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("./AuditoriaView", () => ({ AuditoriaView: () => <div>Histórico</div> }));
vi.mock("./UsuarioCadastroModal", () => ({ default: () => null }));

beforeEach(() => {
  api.buscar.mockResolvedValue([]);
  api.get.mockResolvedValue({});
  api.list.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pessoa = {
  id: "member",
  nomeCompleto: "Bruno Silva",
  roleId: "dentista",
  roleName: "SECRETARIA",
  perfilAcessoId: "recepcao",
  ativo: true,
  apareceNaAgenda: true,
};
const props = {
  tipoOrg: "clinica",
  pessoa,
  perfil: { id: "recepcao", nome: "Recepção", codigo: "RECEPCAO" },
  roles: [{ id: "dentista", nome: "SECRETARIA" }],
  perfisAcesso: [{ id: "recepcao", nome: "Recepção", codigo: "RECEPCAO" }],
  hojeIso: "2026-10-05",
  canManageUsers: true,
  canSeeAgenda: true,
  onPeriodoChange: vi.fn(),
  agenda: [],
  permissoes: fixtures.catalog,
  permissoesPerfil: ["agenda:VER", "AGENDA_CRIAR"],
  viewerIsDono: true,
};
const montar = (extra = {}) =>
  render(
    <MemoryRouter>
      <PreviaAcessoProvider>
        <EquipePessoaView {...props} {...extra} />
      </PreviaAcessoProvider>
    </MemoryRouter>,
  );
// sinal positivo: o botão do hero "Cadastro" já está na tela antes de afirmar ausência
const heroPronto = () => screen.getByRole("button", { name: "Abrir cadastro do usuário" });

describe("PreviaAcessoView", () => {
  it("mostra menu sem Gestão de Equipe, botões do topo e N de M", () => {
    render(
      <PreviaAcessoView
        nome="Bruno"
        perfil="Recepção"
        codigos={["AGENDA_VER", "AGENDA_CRIAR"]}
        catalogo={fixtures.catalog}
      />,
    );
    expect(screen.getByRole("heading", { name: "O Procedi de Bruno" })).toBeInTheDocument();
    expect(screen.getByText("No menu")).toBeInTheDocument();
    expect(screen.getByText("Agenda", { selector: "li" })).toBeInTheDocument();
    expect(screen.queryByText("Gestão de Equipe")).not.toBeInTheDocument();
    expect(screen.getByText("Botões do topo")).toBeInTheDocument();
    expect(screen.getByText("Não aparece para Bruno")).toBeInTheDocument();
    expect(screen.getByTestId("previa-area-agenda")).toHaveTextContent("2 de 8");
  });
});

describe("Ver como na EquipePessoaView", () => {
  it("Dono vê o botão numa pessoa com perfil, clica e abre a prévia", () => {
    montar();
    heroPronto();
    fireEvent.click(screen.getByRole("button", { name: "Ver como Bruno" }));
    expect(screen.getByRole("heading", { name: "O Procedi de Bruno" })).toBeInTheDocument();
    expect(screen.getByText("No menu")).toBeInTheDocument();
    expect(screen.queryByText("Gestão de Equipe", { selector: "li" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair da prévia" }));
    expect(screen.queryByRole("heading", { name: "O Procedi de Bruno" })).not.toBeInTheDocument();
  });

  it.each([
    ["viewer não-Dono", { viewerIsDono: false }],
    ["a própria pessoa", { isSelf: true }],
    ["pessoa sem perfil", { pessoa: { ...pessoa, perfilAcessoId: null }, perfil: undefined }],
    ["pessoa Dono", { perfil: { id: "dono", nome: "Dono", codigo: "DONO" } }],
  ])("não aparece para %s", (_n, extra) => {
    montar(extra);
    heroPronto();
    expect(screen.queryByRole("button", { name: /^Ver (o sistema )?como/ })).not.toBeInTheDocument();
  });

  it("com loadingPermissoes o botão fica desabilitado", () => {
    montar({ loadingPermissoes: true });
    expect(screen.getByRole("button", { name: "Ver como Bruno" })).toBeDisabled();
  });
});
