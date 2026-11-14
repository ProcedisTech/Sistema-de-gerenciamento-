import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import { AtribuirPerfilModal } from "./AtribuirPerfilModal";

afterEach(cleanup);

// Formato real do catálogo: {permissaoId, codigo, nome, moduloCodigo}.
const catalogo = [
  { permissaoId: "a", codigo: "PACIENTE_VER", nome: "Ver pacientes", moduloCodigo: "PACIENTES" },
  { permissaoId: "b", codigo: "AGENDA_VER", nome: "Ver agenda", moduloCodigo: "AGENDA" },
  { permissaoId: "c", codigo: "PRONTUARIO_VER", nome: "Ver prontuário", moduloCodigo: "PRONTUARIO" },
  { permissaoId: "d", codigo: "USUARIO_VER", nome: "Ver usuários", moduloCodigo: "ACESSO" },
  { permissaoId: "e", codigo: "AGENDA_APARECER", nome: "Aparecer na agenda", moduloCodigo: "AGENDA" },
];
const perfis = [
  { id: "dono", codigo: "DONO", nome: "Dono" },
  { id: "aux", nome: "Auxiliar" },
  { id: "ger", nome: "Gerente" },
  { id: "rec", nome: "Recepção" },
];
// Gerente 3, Recepção 2 (a,b), Auxiliar 1 (a); a função "e" não conta.
const permissionsByProfile = {
  dono: ["a", "b", "c", "d"],
  ger: ["a", "b", "c", "e"],
  rec: ["a", "b"],
  aux: ["a"],
};
const montar = (extra = {}) => {
  const props = {
    aberto: true,
    pessoa: { id: "p1", nomeCompleto: "Carla Souza" },
    perfis,
    permissionsByProfile,
    catalogo,
    onConfirmar: vi.fn(),
    onFechar: vi.fn(),
    ...extra,
  };
  render(<AtribuirPerfilModal {...props} />);
  return props;
};

it("sem perfil: lista em ordem de hierarquia (sem Dono) e confirma só depois de escolher", () => {
  const props = montar();
  const dialog = screen.getByRole("dialog", { name: /Atribuir perfil a Carla/ });
  expect(dialog.parentElement.parentElement).toBe(document.body);
  const nomes = within(dialog).getAllByRole("radio").map((r) => r.textContent);
  expect(nomes[0]).toMatch(/^Gerente3 de 4 funções/);
  expect(nomes[1]).toMatch(/^Recepção2 de 4 funções/);
  expect(nomes[2]).toMatch(/^Auxiliar1 de 4 funções/);
  expect(nomes).toHaveLength(3);
  const ok = screen.getByRole("button", { name: "Atribuir perfil" });
  expect(ok).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: /Recepção/ }));
  expect(screen.getByText("Passa a poder (2)")).toBeInTheDocument();
  expect(screen.queryByText(/Deixa de poder/)).not.toBeInTheDocument();
  expect(screen.getByText("O menu de Carla")).toBeInTheDocument();
  fireEvent.click(ok);
  expect(props.onConfirmar).toHaveBeenCalledWith("rec");
});

it("com perfil: mostra o que passa a poder e o que deixa de poder; o mesmo perfil não confirma", () => {
  const props = montar({ pessoa: { id: "p1", nomeCompleto: "Carla Souza", perfilAcessoId: "rec" } });
  expect(screen.getByRole("dialog", { name: /Trocar o perfil de Carla/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /Recepção/ }));
  expect(screen.getByText("É o perfil que a pessoa já tem.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Trocar perfil" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: /Gerente/ }));
  expect(screen.getByText("Passa a poder (1)")).toBeInTheDocument();
  expect(screen.getByText("Ver prontuário")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /Auxiliar/ }));
  expect(screen.getByText("Deixa de poder (1)")).toBeInTheDocument();
  expect(screen.getByText("Ver agenda")).toBeInTheDocument();
  expect(screen.queryByText(/Passa a poder/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Trocar perfil" }));
  expect(props.onConfirmar).toHaveBeenCalledWith("aux");
});

it("Esc e Cancelar fecham; fechado não desenha nada", () => {
  const props = montar();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.onFechar).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(props.onFechar).toHaveBeenCalledTimes(2);
  cleanup();
  montar({ aberto: false });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("gravando: com onConfirmar pendente, dois cliques chamam uma vez e os botões ficam desligados até resolver", async () => {
  let resolver;
  const onConfirmar = vi.fn(() => new Promise((r) => { resolver = r; }));
  montar({ onConfirmar });
  fireEvent.click(screen.getByRole("radio", { name: /Recepção/ }));
  const ok = screen.getByRole("button", { name: "Atribuir perfil" });
  expect(ok).not.toBeDisabled();
  fireEvent.click(ok);
  fireEvent.click(ok);
  expect(onConfirmar).toHaveBeenCalledTimes(1);
  expect(onConfirmar).toHaveBeenCalledWith("rec");
  expect(ok).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  await act(async () => { resolver(); });
  expect(ok).not.toBeDisabled();
});

it("gravando: Esc e clique no fundo NAO fecham (onFechar nunca chamado); sem gravacao os dois fecham", async () => {
  // sinal positivo: sem gravacao, Esc e mousedown no fundo chamam onFechar
  const livre = montar();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(livre.onFechar).toHaveBeenCalledTimes(1);
  fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
  expect(livre.onFechar).toHaveBeenCalledTimes(2);
  cleanup();

  let resolver;
  const onConfirmar = vi.fn(() => new Promise((r) => { resolver = r; }));
  const props = montar({ onConfirmar });
  fireEvent.click(screen.getByRole("radio", { name: /Recep\u00e7\u00e3o/ }));
  fireEvent.click(screen.getByRole("button", { name: "Atribuir perfil" }));
  expect(onConfirmar).toHaveBeenCalledTimes(1);
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.mouseDown(dialog.parentElement);
  expect(props.onFechar).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await act(async () => { resolver(); });
});
