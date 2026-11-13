import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import fixtures from "../../test/fixtures/equipePrototype.json";
import EquipePessoaView from "./EquipePessoaView";

const api = vi.hoisted(() => ({
  buscar: vi.fn(),
  atualizar: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  inativos: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../../services/api", () => ({
  disponibilidadeApi: { buscar: api.buscar, atualizar: api.atualizar },
  equipeApi: { update: api.update, get: api.get },
  pacientesApi: { inativos: api.inativos, listInativos: api.inativos, list: api.list, get: api.get },
  authHeadersForFetch: vi.fn(async () => ({ Authorization: "Bearer token" })),
  getApiErrorToastMessage: (error, fallback) => error.message || fallback,
  getOrgId: () => "test-org",
  setOrgId: () => {},
}));
vi.mock("../../contexts/useToast.js", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
const previaMock = vi.hoisted(() => ({
  inativa: { ativa: false, pessoaId: null, nome: null, perfil: null, codigos: [], entrar: () => {}, sair: () => {} },
  valor: null,
}));
vi.mock("../../contexts/PreviaAcessoContext", async (orig) => ({
  ...(await orig()),
  usePreviaAcesso: () => previaMock.valor,
}));
vi.mock("./AuditoriaView", () => ({ AuditoriaView: () => <div>Histórico</div> }));
vi.mock("./UsuarioCadastroModal", () => ({ default: () => null }));

beforeEach(() => {
  previaMock.valor = previaMock.inativa;
  api.buscar.mockResolvedValue([]);
  api.atualizar.mockResolvedValue([]);
  api.update.mockResolvedValue({});
  api.get.mockResolvedValue({ usuarioId: "usuario-id", roleId: "dentista" });
  api.inativos.mockResolvedValue([]);
  api.list.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const pessoa = {
  id: "member",
  nomeCompleto: "Bruno Silva",
  roleId: "dentista",
  roleName: "DENTISTA",
  perfilAcessoId: "clinico",
  ativo: true,
  apareceNaAgenda: true,
};
const props = {
  tipoOrg: "clinica",
  pessoa,
  perfil: { id: "clinico", nome: "Clínico", codigo: "CLINICO", organizacaoSaudeDonaId: "org" },
  roles: [
    { id: "dentista", nome: "DENTISTA" },
    { id: "recepcao", nome: "RECEPCIONISTA" },
  ],
  perfisAcesso: [
    { id: "clinico", nome: "Clínico", codigo: "CLINICO" },
    { id: "recepcao", nome: "Recepção", codigo: "RECEPCAO" },
    { id: "dono", nome: "Dono", codigo: "DONO" },
  ],
  hojeIso: "2026-10-05",
  canManageUsers: true,
  canSeeAgenda: true,
  canSeeConfigAuditoria: true,
  onSalvarAcesso: vi.fn(async () => {}),
  onPeriodoChange: vi.fn(),
  agenda: [],
  permissoes: fixtures.catalog,
  permissoesPerfil: ["agenda:VER", "AGENDA_CRIAR"],
};
const abrirAcesso = () => fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

describe("aba Acesso (Onda 5)", () => {
  it.each([
    ["agendaMultiVer", "Ver múltiplas agendas", false],
    ["apareceNaAgenda", "Aparecer na agenda", true],
  ])("Dono liga e desliga %s e cada clique chama equipeApi.update", async (campo, rotulo, inicial) => {
    render(<EquipePessoaView {...props} isSelf perfil={{ codigo: "DONO", nome: "Dono" }} permissoesPerfil={[]} />);
    abrirAcesso();
    const trigger = screen.queryByRole("button", { name: "Expandir configurações da agenda" });
    if (trigger) fireEvent.click(trigger);
    const sw = () => screen.getByRole("switch", { name: rotulo });
    expect(sw()).toHaveAttribute("aria-checked", String(inicial));
    fireEvent.click(sw());
    await waitFor(() =>
      expect(api.update).toHaveBeenNthCalledWith(1, "member", {
        usuarioId: "usuario-id",
        roleId: "dentista",
        [campo]: !inicial,
      }),
    );
    await waitFor(() => expect(sw()).toHaveAttribute("aria-checked", String(!inicial)));
    fireEvent.click(sw());
    await waitFor(() =>
      expect(api.update).toHaveBeenNthCalledWith(2, "member", {
        usuarioId: "usuario-id",
        roleId: "dentista",
        [campo]: inicial,
      }),
    );
    await waitFor(() => expect(sw()).toHaveAttribute("aria-checked", String(inicial)));
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("não Dono vê de onde vêm as opções de agenda, sem interruptores", () => {
    const onEditarPerfil = vi.fn();
    const view = render(<EquipePessoaView {...props} canEditPerfis onEditarPerfil={onEditarPerfil} />);
    abrirAcesso();
    expect(document.querySelector(".acesso-agenda-perfil")).toHaveTextContent("vêm do perfil Clínico");
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Mudar no perfil" }));
    expect(onEditarPerfil).toHaveBeenCalledWith("clinico");
    view.unmount();
    render(<EquipePessoaView {...props} onEditarPerfil={onEditarPerfil} />);
    abrirAcesso();
    expect(document.querySelector(".acesso-agenda-perfil")).toHaveTextContent("vêm do perfil Clínico");
    expect(screen.queryByRole("button", { name: "Mudar no perfil" })).not.toBeInTheDocument();
  });

  it("funções uma a uma só com PERFIL_ACESSO_EDITAR", () => {
    const view = render(<EquipePessoaView {...props} />);
    abrirAcesso();
    expect(screen.getByRole("combobox", { name: "Perfil Base" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /^Agenda .*liberadas/ })[0]);
    expect(screen.getByRole("checkbox", { name: "Ver agenda" })).toBeDisabled();
    view.unmount();
    render(<EquipePessoaView {...props} canEditPerfis />);
    abrirAcesso();
    fireEvent.click(screen.getAllByRole("button", { name: /^Agenda .*liberadas/ })[0]);
    expect(screen.getByRole("checkbox", { name: "Ver agenda" })).toBeEnabled();
  });

  it("sem perfil: aviso e Atribuir perfil só grava depois de confirmar", async () => {
    const onSalvarAcesso = vi.fn(async () => {});
    render(
      <EquipePessoaView
        {...props}
        pessoa={{ ...pessoa, perfilAcessoId: null }}
        perfil={undefined}
        permissoesPerfil={[]}
        permissionsByProfile={{ clinico: ["agenda:VER"], recepcao: ["agenda:VER", "AGENDA_CRIAR"] }}
        onSalvarAcesso={onSalvarAcesso}
      />,
    );
    expect(screen.getByText(/está sem perfil de acesso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atribuir perfil" }));
    const janela = await screen.findByRole("dialog");
    expect(onSalvarAcesso).not.toHaveBeenCalled();
    fireEvent.click(within(janela).getByRole("radio", { name: /Recepção/ }));
    fireEvent.click(within(janela).getByRole("button", { name: "Atribuir perfil" }));
    await waitFor(() =>
      expect(onSalvarAcesso).toHaveBeenCalledWith(
        expect.objectContaining({ id: "member" }),
        expect.objectContaining({ perfilAcessoId: "recepcao" }),
      ),
    );
  });

  it("sem perfil e sem canManageUsers: aviso sem botão Atribuir perfil", () => {
    render(<EquipePessoaView {...props} canManageUsers={false} pessoa={{ ...pessoa, perfilAcessoId: null }} perfil={undefined} />);
    expect(screen.getByText(/está sem perfil de acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atribuir perfil" })).not.toBeInTheDocument();
  });

  it("trocar o perfil mostra a barra com 1 e pede confirmação ao trocar de aba", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ["agenda:VER"] })));
    const onDirtyChange = vi.fn();
    render(<EquipePessoaView {...props} onDirtyChange={onDirtyChange} />);
    abrirAcesso();
    fireEvent.change(screen.getByRole("combobox", { name: "Perfil Base" }), { target: { value: "recepcao" } });
    const barra = await screen.findByRole("region", { name: "Salvar acesso" });
    expect(within(barra).getByText("1")).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acesso", exact: true })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("region", { name: "Salvar acesso" })).not.toBeInTheDocument();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("Cargo na Clínica é o primeiro cartão e o menu respeita as funções", () => {
    const { rerender } = render(<EquipePessoaView {...props} />);
    abrirAcesso();
    expect(document.querySelector(".acesso-card h4")).toHaveTextContent("Cargo na Clínica");
    const menu = screen.getByRole("complementary", { name: /O menu de/ });
    expect(within(menu).getByText("Agenda")).toBeInTheDocument();
    expect(within(menu).queryByText("Gestão de Equipe")).not.toBeInTheDocument();
    rerender(
      <EquipePessoaView
        {...props}
        permissoes={[...fixtures.catalog, { permissaoId: "cfg", codigo: "ACESSO_CONFIGURACOES_VER", nome: "Ver configurações", modulo: "Acesso" }]}
        permissoesPerfil={["agenda:VER", "cfg"]}
      />,
    );
    expect(within(screen.getByRole("complementary", { name: /O menu de/ })).queryByText("Gestão de Equipe")).toBeInTheDocument();
  });
});

describe("aba Acesso: prévia, descartar e Ver como (onda 1)", () => {
  const checkAgenda = (nome) => {
    fireEvent.click(screen.getAllByRole("button", { name: /^Agenda .*liberadas/ })[0]);
    return screen.getByRole("checkbox", { name: nome });
  };

  it("rascunho + prévia da mesma pessoa: sem a barra Salvar acesso; ao sair da prévia a barra volta com o rascunho", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ["agenda:VER"] })));
    const { rerender } = render(<EquipePessoaView {...props} />);
    abrirAcesso();
    fireEvent.change(screen.getByRole("combobox", { name: "Perfil Base" }), { target: { value: "recepcao" } });
    expect(await screen.findByRole("region", { name: "Salvar acesso" })).toBeInTheDocument();

    previaMock.valor = { ...previaMock.inativa, ativa: true, pessoaId: "member", nome: "Bruno", perfil: "Clínico", codigos: ["AGENDA_VER"] };
    rerender(<EquipePessoaView {...props} />);
    expect(screen.queryByRole("combobox", { name: "Perfil Base" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Salvar acesso" })).not.toBeInTheDocument();

    previaMock.valor = previaMock.inativa;
    rerender(<EquipePessoaView {...props} />);
    expect(await screen.findByRole("region", { name: "Salvar acesso" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Perfil Base" })).toHaveValue("recepcao");
  });

  it("Descartar antes da resposta do perfil B: a resposta atrasada não volta a sujar nem muda as funções do perfil A", async () => {
    let responder;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => { responder = r; })));
    render(<EquipePessoaView {...props} />);
    abrirAcesso();
    fireEvent.change(screen.getByRole("combobox", { name: "Perfil Base" }), { target: { value: "recepcao" } });
    const barra = await screen.findByRole("region", { name: "Salvar acesso" });
    fireEvent.click(within(barra).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Salvar acesso" })).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Perfil Base" })).toHaveValue("clinico");
    await act(async () => { responder({ ok: true, json: async () => ["agenda:VER", "AGENDA_CRIAR", "AGENDA_EDITAR", "AGENDA_CANCELAR"] }); });
    expect(screen.getByRole("combobox", { name: "Perfil Base" })).toHaveValue("clinico");
    expect(checkAgenda("Criar agendamentos")).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Editar e reagendar" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cancelar agendamentos" })).not.toBeChecked();
    expect(screen.queryByRole("region", { name: "Salvar acesso" })).not.toBeInTheDocument();
  });

  it("Ver como com rascunho não salvo entra na prévia só com os códigos salvos", () => {
    const entrar = vi.fn();
    previaMock.valor = { ...previaMock.inativa, entrar };
    render(<EquipePessoaView {...props} viewerIsDono canEditPerfis />);
    abrirAcesso();
    const extra = checkAgenda("Editar e reagendar");
    expect(extra).not.toBeChecked();
    fireEvent.click(extra);
    expect(screen.getByRole("checkbox", { name: "Editar e reagendar" })).toBeChecked();
    expect(screen.getByRole("region", { name: "Salvar acesso" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver como Bruno" }));
    expect(entrar).toHaveBeenCalledTimes(1);
    const arg = entrar.mock.calls[0][0];
    expect(arg.pessoaId).toBe("member");
    expect([...arg.codigos].sort()).toEqual(["AGENDA_CRIAR", "AGENDA_VER"]);
    expect(arg.codigos).not.toContain("AGENDA_EDITAR");
  });
});
