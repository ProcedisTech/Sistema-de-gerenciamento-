import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MeuPerfilConfigPanel } from "./MeuPerfilConfigPanel";
import { ConfigDetailView } from "./ConfigDetailView";
import { ConfiguracoesView } from "./ConfiguracoesView";
const mocks = vi.hoisted(() => ({
  org: {},
  access: {},
  buscar: vi.fn(),
  byRange: vi.fn(),
  catalog: vi.fn(),
}));
vi.mock("../../contexts/OrgContext", () => ({ useOrg: () => mocks.org }));
vi.mock("../../hooks/usePapel", () => ({ usePapel: () => mocks.access }));
vi.mock("../hooks/useAgoraDaClinica.js", () => ({
  useAgoraDaClinica: () => ({
    hojeIso: "2026-10-08",
    fuso: "America/Sao_Paulo",
  }),
}));
vi.mock("../../services/api", () => ({
  termosApi: { list: async () => [] },
  clinicaApi: { buscar: async () => ({}) },
  perfilApi: { buscar: mocks.buscar },
  permissoesApi: { list: mocks.catalog },
  disponibilidadeApi: { buscar: async () => [] },
  agendasApi: { byRange: mocks.byRange },
  getApiErrorToastMessage: (err, fallback) => err.message || fallback,
}));
vi.mock("./UsuarioCadastroModal", () => ({
  default: ({ onSaved }) => (
    <div role="dialog" aria-label="Cadastro do Usuário">
      <button
        onClick={() =>
          onSaved({
            id: "user-id",
            nomeCompleto: "Ana Atualizada",
            telefone: "11999999999",
            fotoUrl: "https://cdn.example/ana.webp",
          })
        }
      >
        Salvar cadastro
      </button>
    </div>
  ),
}));
vi.mock("./AuditoriaView", () => ({
  AuditoriaView: ({ roleUserId }) => <div>Histórico de {roleUserId}</div>,
}));
const perfil = {
  id: "user-id",
  nomeCompleto: "Ana Souza",
  email: "ana@example.test",
  telefone: "11987654321",
  cargoNome: "DENTISTA",
  dataNascimento: "1990-03-12",
};
const agenda = [
  {
    id: "appointment",
    profissionalRoleUserId: "self-role",
    pacienteId: "patient",
    pacienteNome: "Paciente atendido",
    dataAgendamento: "2026-10-08",
    horaInicio: "09:00",
    horaFim: "10:00",
    statusCodigo: "REALIZADO",
  },
  {
    id: "other",
    profissionalRoleUserId: "other-role",
    pacienteId: "other-patient",
    pacienteNome: "Paciente de terceiro",
    dataAgendamento: "2026-10-08",
    statusCodigo: "REALIZADO",
  },
];
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  mocks.org = {
    orgId: "org-a",
    roleUserId: "self-role",
    roleNome: "DENTISTA",
    papel: "DONO",
    apareceNaAgenda: true,
  };
  mocks.access = {
    canSeeAgenda: true,
    canSeeConfigPerfil: true,
    canSeeConfigAuditoria: true,
  };
  mocks.catalog.mockResolvedValue([
    { permissaoId: "ver", codigo: "PACIENTE_VER", modulo: "Pacientes" },
  ]);
  mocks.buscar.mockResolvedValue(perfil);
  mocks.byRange.mockResolvedValue(agenda);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("carrega o perfil com cancelamento e apresenta skeleton até a resposta", async () => {
  let finish;
  mocks.buscar.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<MeuPerfilConfigPanel />);
  expect(
    screen.getByRole("status", { name: "Carregando meu perfil" }),
  ).toBeInTheDocument();
  expect(mocks.buscar).toHaveBeenCalledWith({
    signal: expect.any(AbortSignal),
  });
  finish(perfil);
  expect(
    await screen.findByRole("heading", { name: "Ana Souza" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Carregando meu perfil" }),
  ).not.toBeInTheDocument();
});
it("renderiza perfil próprio, Cadastro, seis abas e oculta breadcrumb interno", async () => {
  let container;
  await act(async () => {
    ({ container } = render(<MeuPerfilConfigPanel />));
  });
  await screen.findByRole("heading", { name: "Ana Souza" });
  expect(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(6);
  expect(container.querySelector(".equipe-pessoa .crumb")).toBeNull();
  expect(
    container.querySelector(".prototype-equipe .equipe-pessoa"),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Cadastro do Usuário" }),
  ).toBeInTheDocument();
});
it("consulta somente agenda do próprio vínculo no mês e permite navegar para Agenda", async () => {
  const onNavigateAgenda = vi.fn();
  const onSelectPatient = vi.fn();
  render(
    <MeuPerfilConfigPanel
      onNavigateAgenda={onNavigateAgenda}
      onSelectPatient={onSelectPatient}
    />,
  );
  await screen.findByRole("heading", { name: "Ana Souza" });
  expect(mocks.byRange).toHaveBeenCalledWith(
    "2026-10-01",
    "2026-10-31",
    expect.objectContaining({
      profissionalRoleUserId: "self-role",
      excluirCancelado: true,
      signal: expect.any(AbortSignal),
    }),
  );
  expect(await screen.findByText("Paciente atendido")).toBeInTheDocument();
  expect(screen.queryByText("Paciente de terceiro")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Agendar com Ana" }));
  expect(onNavigateAgenda).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Abrir histórico de Paciente atendido",
    }),
  );
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({ id: "patient" }),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(screen.getByText("Histórico de self-role")).toBeInTheDocument();
});
it("não consulta agenda sem permissão e mantém cadastro pessoal disponível", async () => {
  mocks.access.canSeeAgenda = false;
  render(<MeuPerfilConfigPanel />);
  await screen.findByRole("heading", { name: "Ana Souza" });
  expect(mocks.byRange).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Agendar com Ana" }),
  ).not.toBeInTheDocument();
});
it("erro de perfil permite tentar novamente sem exibir dados falsos", async () => {
  mocks.buscar.mockRejectedValueOnce(
    new Error("Não foi possível carregar seu cadastro."),
  );
  render(<MeuPerfilConfigPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar seu cadastro.",
  );
  expect(
    screen.queryByRole("button", { name: "Abrir cadastro do usuário" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(
    await screen.findByRole("heading", { name: "Ana Souza" }),
  ).toBeInTheDocument();
  expect(mocks.buscar).toHaveBeenCalledTimes(2);
});
it("erro de agenda conserva perfil e evita métricas que aparentem sucesso", async () => {
  mocks.byRange.mockRejectedValueOnce(new Error("Agenda indisponível"));
  render(<MeuPerfilConfigPanel />);
  await screen.findByRole("heading", { name: "Ana Souza" });
  expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent(
    "Agenda indisponível",
  );
  expect(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});
it("salvar Cadastro atualiza hero/contato e propaga identidade sem trocar role-user ID", async () => {
  const onPerfilAtualizado = vi.fn();
  // Aguarda os efeitos de montagem antes de abrir o cadastro.
  await act(async () => {
    render(<MeuPerfilConfigPanel onPerfilAtualizado={onPerfilAtualizado} />);
  });
  await screen.findByRole("heading", { name: "Ana Souza" });
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
  expect(
    screen.getByRole("heading", { name: "Ana Atualizada" }),
  ).toBeInTheDocument();
  expect(screen.getByText("11999999999")).toBeInTheDocument();
  expect(onPerfilAtualizado).toHaveBeenCalledWith(
    expect.objectContaining({
      nomeCompleto: "Ana Atualizada",
      fotoUrl: "https://cdn.example/ana.webp",
    }),
  );
  expect(onPerfilAtualizado.mock.calls[0][0]).not.toHaveProperty("id");
  fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(screen.getByText("Histórico de self-role")).toBeInTheDocument();
});
it("amplia o carregamento ao selecionar três meses no histórico de atendimentos", async () => {
  render(<MeuPerfilConfigPanel />);
  await screen.findByRole("heading", { name: "Ana Souza" });
  fireEvent.click(screen.getByRole("tab", { name: "Atendimentos" }));
  fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
  await waitFor(() =>
    expect(mocks.byRange).toHaveBeenLastCalledWith(
      "2026-08-01",
      "2026-10-31",
      expect.any(Object),
    ),
  );
});
it("troca de clínica cancela respostas antigas e não exibe o perfil anterior", async () => {
  let finish;
  mocks.buscar.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<MeuPerfilConfigPanel />);
  const signal = mocks.buscar.mock.calls[0][0].signal;
  mocks.org = { ...mocks.org, orgId: "org-b", roleUserId: "role-b" };
  mocks.buscar.mockResolvedValue({
    ...perfil,
    nomeCompleto: "Pessoa na nova clínica",
  });
  view.rerender(<MeuPerfilConfigPanel />);
  expect(signal.aborted).toBe(true);
  await screen.findByRole("heading", { name: "Pessoa na nova clínica" });
  finish(perfil);
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Ana Souza" }),
    ).not.toBeInTheDocument(),
  );
});
it("ConfigDetailView mantém breadcrumb Configurações > Meu Perfil e propaga navegação", async () => {
  const onNavigateAgenda = vi.fn();
  const onBackToHub = vi.fn();
  const onSelectPatient = vi.fn();
  const { container } = render(
    <ConfigDetailView
      categoryKey="meu-perfil"
      configSection="perfil"
      canSeePerfil
      onNavigateAgenda={onNavigateAgenda}
      onBackToHub={onBackToHub}
      onSelectPatient={onSelectPatient}
      setConfigSection={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: "Ana Souza" });
  const breadcrumb = container.querySelector(".equipe-pessoa .crumb");
  expect(breadcrumb).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Navegação de configurações" })).not.toBeInTheDocument();
  expect(container.querySelector("aside")).toBeNull();
  expect(within(breadcrumb).getByText("Meu Perfil")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Gestão de Equipe", exact: true }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Agendar com Ana" }));
  expect(onNavigateAgenda).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Abrir histórico de Paciente atendido",
    }),
  );
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({ id: "patient" }),
  );
  fireEvent.click(
    within(breadcrumb).getByRole("button", { name: "Configurações" }),
  );
  expect(onBackToHub).toHaveBeenCalledOnce();
});

it("carrega catálogo e apresenta todas as funções do Dono sem 0 de 0", async () => {
  render(<MeuPerfilConfigPanel />);
  expect(await screen.findByText("1 de 1 funções")).toBeInTheDocument();
  expect(mocks.catalog).toHaveBeenCalledWith({
    signal: expect.any(AbortSignal),
  });
});
it("falha no catálogo oferece retry e não apresenta contagem vazia", async () => {
  mocks.catalog.mockRejectedValueOnce(new Error("Falha no catálogo"));
  render(<MeuPerfilConfigPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Falha no catálogo",
  );
  expect(screen.queryByText("0 de 0 funções")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("1 de 1 funções")).toBeInTheDocument();
});
it("propaga seleção do paciente atendido para a aplicação", async () => {
  const onSelectPatient = vi.fn();
  render(<MeuPerfilConfigPanel onSelectPatient={onSelectPatient} />);
  await screen.findByRole("heading", { name: "Ana Souza" });
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Abrir histórico de Paciente atendido",
    }),
  );
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({ id: "patient" }),
  );
});

it("sincroniza o deep-link de perfil após a montagem e limpa a seção ao voltar", async () => {
  const setConfigSection = vi.fn();
  const view = render(<ConfiguracoesView canSeePerfil configSection={null} setConfigSection={setConfigSection} />);
  expect(screen.getAllByText("Selecione uma área para configurar").length).toBeGreaterThan(0);
  view.rerender(<ConfiguracoesView canSeePerfil configSection="perfil" setConfigSection={setConfigSection} />);
  await screen.findByRole("heading", { name: "Ana Souza" });
  fireEvent.click(screen.getByRole("button", { name: "Configurações", exact: true }));
  expect(setConfigSection).toHaveBeenCalledWith(null);
  expect(screen.getAllByText("Selecione uma área para configurar").length).toBeGreaterThan(0);
  view.rerender(<ConfiguracoesView canSeePerfil configSection={null} setConfigSection={setConfigSection} />);
  view.rerender(<ConfiguracoesView canSeePerfil configSection="perfil" setConfigSection={setConfigSection} />);
  expect(await screen.findByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
});
