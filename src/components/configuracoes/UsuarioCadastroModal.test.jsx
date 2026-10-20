import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import UsuarioCadastroModal from "./UsuarioCadastroModal";
const mocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  atualizar: vi.fn(),
  uploadFoto: vi.fn(),
  buscarAssinatura: vi.fn(),
  salvarAssinatura: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../../services/api", () => ({
  perfilApi: mocks,
  getApiErrorToastMessage: (err, fallback) => err.message || fallback,
}));
vi.mock("../../contexts/useToast.js", () => ({ useToast: () => mocks.toast }));
vi.mock("../hooks/useFusoClinica.js", () => ({
  useFusoClinica: () => ({ fuso: "America/Sao_Paulo" }),
}));
vi.mock("../../hooks/useEstadosCivis.js", () => ({
  useEstadosCivis: () => ({
    estadosCivis: [{ id: "civil", nome: "Solteiro(a)" }],
    loading: false,
  }),
}));
vi.mock("../journey/Step4LGPD.jsx", () => ({
  SignatureFullscreenModal: ({ open, onClose, onConfirm, saving }) =>
    open ? (
      <div>
        <button aria-label="Fechar" onClick={onClose} disabled={saving}>
          Fechar assinatura
        </button>
        <button
          onClick={() => onConfirm("data:image/png;base64,assinatura")}
          disabled={saving}
        >
          Confirmar assinatura
        </button>
      </div>
    ) : null,
}));
const perfil = {
  id: "user-id",
  nomeCompleto: "Maria Souza",
  apelido: "Maria",
  cpf: "52998224725",
  dataNascimento: "1990-05-15",
  estadoCivilId: "civil",
  telefone: "11987654321",
  statusPresenca: "online",
  cep: "01310000",
  logradouro: "Rua informada",
  numero: "10",
  cidade: "São Paulo",
  uf: "SP",
  fotoUrl: "",
};
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  mocks.buscar.mockResolvedValue(perfil);
  mocks.atualizar.mockImplementation(async (body) => ({
    ...body,
    id: "user-id",
  }));
  mocks.buscarAssinatura.mockResolvedValue({ assinaturaPadrao: "" });
  mocks.uploadFoto.mockResolvedValue({
    fotoUrl: "https://cdn.example/foto.webp",
  });
  mocks.salvarAssinatura.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function edit() {
  await screen.findByLabelText(/Nome completo/);
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
}
it("inicia em leitura e habilita edição sem consultar CEP nem salvar", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<UsuarioCadastroModal onClose={vi.fn()} />);
  expect(
    screen.getByRole("dialog", { name: "Cadastro do Usuário" }),
  ).toBeInTheDocument();
  expect(await screen.findByLabelText(/Nome completo/)).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Salvar alterações" }),
  ).not.toBeInTheDocument();
  await edit();
  expect(screen.getByLabelText(/Nome completo/)).toBeEnabled();
  expect(screen.getByLabelText(/CPF/)).toBeDisabled();
  expect(screen.getByLabelText("CEP")).toHaveValue("01310000");
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("salva payload normalizado e propaga a resposta do servidor", async () => {
  const onSaved = vi.fn();
  render(<UsuarioCadastroModal onSaved={onSaved} />);
  await edit();
  fireEvent.change(screen.getByLabelText(/Nome completo/), {
    target: { value: " Maria Atualizada " },
  });
  fireEvent.change(screen.getByLabelText("Complemento"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(mocks.atualizar).toHaveBeenCalledWith(
    expect.objectContaining({
      nomeCompleto: "Maria Atualizada",
      cpf: "52998224725",
      dataNascimento: "1990-05-15",
      telefone: "11987654321",
      estadoCivilId: "civil",
      complemento: "",
    }),
  );
  expect(mocks.atualizar.mock.calls[0][0]).not.toHaveProperty("id");
  expect(onSaved).toHaveBeenCalledWith(
    expect.objectContaining({
      nomeCompleto: "Maria Atualizada",
      id: "user-id",
    }),
  );
});
it("trata 409 como CPF duplicado, conserva edição e permite corrigir", async () => {
  mocks.atualizar.mockRejectedValueOnce(
    Object.assign(new Error("Conflito"), { status: 409 }),
  );
  const onSaved = vi.fn();
  render(<UsuarioCadastroModal onSaved={onSaved} />);
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  expect(
    await screen.findByText("Já existe um usuário cadastrado com este CPF."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/CPF/)).toBeEnabled();
  expect(screen.getByLabelText(/CPF/)).toHaveAttribute("aria-invalid", "true");
  expect(onSaved).not.toHaveBeenCalled();
});
it("bloqueia CPF inválido e nascimento futuro antes do PUT", async () => {
  render(<UsuarioCadastroModal />);
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Alterar CPF" }));
  fireEvent.change(screen.getByLabelText(/CPF/), {
    target: { value: "11111111111" },
  });
  fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
    target: { value: "01012999" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  expect(screen.getByLabelText(/CPF/)).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText(/Data de nascimento/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("fecha por Escape, contém foco e restaura o foco ao desmontar", async () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const onClose = vi.fn();
  const view = render(<UsuarioCadastroModal onClose={onClose} />);
  await screen.findByLabelText(/Nome completo/);
  const first = screen.getByRole("button", { name: "Editar", exact: true });
  const last = screen.getByRole("button", {
    name: "Fechar cadastro do usuário",
  });
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
  expect(outside).toHaveFocus();
  outside.remove();
});
it("impede fechar e reenviar enquanto salva", async () => {
  let finish;
  mocks.atualizar.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onClose = vi.fn();
  render(<UsuarioCadastroModal onClose={onClose} />);
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Fechar cadastro do usuário" }),
    ).toBeDisabled(),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
  finish(perfil);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled(),
  );
});
it("erro de leitura permite tentar novamente e não autoriza salvamento", async () => {
  mocks.buscar.mockRejectedValueOnce(new Error("Falha ao carregar perfil"));
  render(<UsuarioCadastroModal />);
  expect(
    await screen.findByText("Falha ao carregar perfil"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  expect(
    screen.queryByRole("button", { name: "Salvar alterações" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByLabelText(/Nome completo/)).toHaveValue(
    "Maria Souza",
  );
});
it("envia foto, sincroniza identidade e permite remover ao salvar", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    }),
  );
  const onMediaAtualizada = vi.fn();
  const { container } = render(
    <UsuarioCadastroModal onMediaAtualizada={onMediaAtualizada} />,
  );
  await edit();
  const file = new File(["foto"], "foto.png", { type: "image/png" });
  // The modal renders into the portal, outside the render container.
  expect(container.querySelector("input[type=file]")).toBeNull();
  fireEvent.change(document.querySelector("input[type=file]"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(onMediaAtualizada).toHaveBeenCalledWith({
      fotoUrl: "https://cdn.example/foto.webp",
    }),
  );
  expect(mocks.uploadFoto).toHaveBeenCalledWith(file);
  fireEvent.click(screen.getByRole("button", { name: "Remover foto" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith(
      expect.objectContaining({ fotoUrl: "" }),
    ),
  );
});
it("confirma assinatura com a API pessoal", async () => {
  render(<UsuarioCadastroModal />);
  await edit();
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar assinatura padrão" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Assinatura padrão" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar assinatura" }));
  await waitFor(() =>
    expect(mocks.salvarAssinatura).toHaveBeenCalledWith(
      "data:image/png;base64,assinatura",
    ),
  );
});

it("falha de upload conserva a foto anterior e permite tentar novamente", async () => {
  mocks.buscar.mockResolvedValue({
    ...perfil,
    fotoUrl: "https://cdn.example/anterior.webp",
  });
  mocks.uploadFoto.mockRejectedValueOnce(new Error("Foto indisponível"));
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    }),
  );
  const onMediaAtualizada = vi.fn();
  render(<UsuarioCadastroModal onMediaAtualizada={onMediaAtualizada} />);
  await edit();
  fireEvent.change(document.querySelector("input[type=file]"), {
    target: { files: [new File(["foto"], "foto.png", { type: "image/png" })] },
  });
  expect(await screen.findByText("Foto indisponível")).toBeInTheDocument();
  expect(
    document.querySelector('img[src="https://cdn.example/anterior.webp"]'),
  ).toBeInTheDocument();
  expect(onMediaAtualizada).not.toHaveBeenCalled();
});
it("Escape fecha somente a assinatura e mantém o cadastro aberto", async () => {
  const onClose = vi.fn();
  render(<UsuarioCadastroModal onClose={onClose} />);
  await edit();
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar assinatura padrão" }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    screen.queryByRole("dialog", { name: "Assinatura padrão" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Editar Cadastro" }),
  ).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
