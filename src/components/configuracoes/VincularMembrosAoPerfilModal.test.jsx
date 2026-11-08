import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VincularMembrosAoPerfilModal } from "./VincularMembrosAoPerfilModal";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../services/api", () => ({
  equipeApi: {
    update: (...args) => mocks.update(...args),
  },
  getApiErrorToastMessage: vi.fn((e, fallback) => e?.message || fallback),
}));

vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => mocks.toast,
}));

describe("VincularMembrosAoPerfilModal", () => {
  const mockSelectedProfile = {
    id: "perfil-recepcao-1",
    nome: "Recepção / Secretária",
    codigo: "RECEPCAO",
  };

  const mockPerfisAcesso = [
    { id: "perfil-dono", nome: "Dono", codigo: "DONO" },
    { id: "perfil-recepcao-1", nome: "Recepção / Secretária", codigo: "RECEPCAO" },
    { id: "perfil-clinico-1", nome: "Profissional Clínico", codigo: "CLINICO" },
    { id: "perfil-apoio-1", nome: "Apoio / Auxiliar", codigo: "APOIO" },
  ];

  const mockUsuarios = [
    {
      id: "user-dono",
      nomeCompleto: "Doutor Proprietário",
      email: "dono@procedi.com",
      perfilAcessoId: "perfil-dono",
      perfilAcessoCodigo: "DONO",
      ativo: true,
    },
    {
      id: "user-1",
      nomeCompleto: "Ana Secretária",
      email: "ana@procedi.com",
      perfilAcessoId: "perfil-recepcao-1",
      perfilAcessoCodigo: "RECEPCAO",
      ativo: true,
    },
    {
      id: "user-2",
      nomeCompleto: "Carlos Clínico",
      email: "carlos@procedi.com",
      perfilAcessoId: "perfil-clinico-1",
      perfilAcessoCodigo: "CLINICO",
      ativo: true,
    },
    {
      id: "user-3",
      nomeCompleto: "Bruna Apoio",
      email: "bruna@procedi.com",
      perfilAcessoId: "perfil-apoio-1",
      perfilAcessoCodigo: "APOIO",
      ativo: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ id: "ok" });
  });

  it("não renderiza quando isOpen for false", () => {
    render(
      <VincularMembrosAoPerfilModal
        isOpen={false}
        onClose={vi.fn()}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("NÃO inclui o Dono na lista de membros elegíveis (imutável)", () => {
    render(
      <VincularMembrosAoPerfilModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Dono não deve aparecer
    expect(screen.queryByText("Doutor Proprietário")).toBeNull();
    // Demais colaboradores devem aparecer
    expect(screen.getByText("Ana Secretária")).toBeInTheDocument();
    expect(screen.getByText("Carlos Clínico")).toBeInTheDocument();
    expect(screen.getByText("Bruna Apoio")).toBeInTheDocument();
  });

  it("exibe badge 'Já vinculado' e checkbox desabilitado para membro que já possui este perfil", () => {
    render(
      <VincularMembrosAoPerfilModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
      />,
    );

    expect(screen.getByText("Já vinculado")).toBeInTheDocument();
    const checkboxAna = screen.getByLabelText("Selecionar Ana Secretária");
    expect(checkboxAna).toBeDisabled();
    expect(checkboxAna).toBeChecked();

    const checkboxCarlos = screen.getByLabelText("Selecionar Carlos Clínico");
    expect(checkboxCarlos).not.toBeDisabled();
    expect(checkboxCarlos).not.toBeChecked();
  });

  it("permite filtrar colaboradores por nome via campo de busca", () => {
    render(
      <VincularMembrosAoPerfilModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
      />,
    );

    const inputBusca = screen.getByPlaceholderText(
      "Buscar por nome, e-mail ou perfil...",
    );
    fireEvent.change(inputBusca, { target: { value: "Carlos" } });

    expect(screen.getByText("Carlos Clínico")).toBeInTheDocument();
    expect(screen.queryByText("Bruna Apoio")).toBeNull();
    expect(screen.queryByText("Ana Secretária")).toBeNull();
  });

  it("seleciona colaboradores elegíveis e salva vínculos com sucesso", async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <VincularMembrosAoPerfilModal
        isOpen={true}
        onClose={handleClose}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
        onSuccess={handleSuccess}
      />,
    );

    const btnConfirmar = screen.getByRole("button", {
      name: /Adicionar ao perfil/i,
    });
    expect(btnConfirmar).toBeDisabled();

    // Seleciona Carlos Clínico
    const checkboxCarlos = screen.getByLabelText("Selecionar Carlos Clínico");
    fireEvent.click(checkboxCarlos);

    expect(checkboxCarlos).toBeChecked();
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Adicionar 1 colaborador/i }),
    ).toBeEnabled();

    // Clica em confirmar
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar 1 colaborador/i }),
    );

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledTimes(1);
      expect(mocks.update).toHaveBeenCalledWith("user-2", {
        id: "user-2",
        nomeCompleto: "Carlos Clínico",
        email: "carlos@procedi.com",
        perfilAcessoId: "perfil-recepcao-1",
        perfilAcessoCodigo: "CLINICO",
        ativo: true,
        apareceNaAgenda: undefined,
        agendaMultiVer: undefined,
      });
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "1 colaborador vinculado a Recepção / Secretária com sucesso.",
      );
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it("permite marcar todos os colaboradores disponíveis de uma só vez", () => {
    render(
      <VincularMembrosAoPerfilModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProfile={mockSelectedProfile}
        usuarios={mockUsuarios}
        perfisAcesso={mockPerfisAcesso}
      />,
    );

    const btnMarcarTodos = screen.getByRole("button", {
      name: "Marcar todos",
    });
    fireEvent.click(btnMarcarTodos);

    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar Carlos Clínico")).toBeChecked();
    expect(screen.getByLabelText("Selecionar Bruna Apoio")).toBeChecked();

    // Desmarcar todos
    const btnDesmarcar = screen.getByRole("button", {
      name: "Desmarcar todos",
    });
    fireEvent.click(btnDesmarcar);

    expect(
      screen.getByText("Nenhum novo membro selecionado"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar Carlos Clínico")).not.toBeChecked();
    expect(screen.getByLabelText("Selecionar Bruna Apoio")).not.toBeChecked();
  });
});

