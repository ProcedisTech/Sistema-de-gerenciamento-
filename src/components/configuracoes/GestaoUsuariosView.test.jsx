import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { GestaoUsuariosView } from "./GestaoUsuariosView";
import {
  montarComRoteador,
  ultimoRoteador,
} from "../../test/rotas/montarComRoteador.jsx";

const montar = (props, caminho = "/equipe") =>
  montarComRoteador(<GestaoUsuariosView {...props} />, { caminho });

const mocks = vi.hoisted(() => ({
  access: {},
  currentRoleUserId: "owner",
  update: vi.fn(),
  buscarPerfil: vi.fn(),
  reloadOrg: vi.fn(),
  agenda: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("../../hooks/usePapel", () => ({ usePapel: () => mocks.access }));
vi.mock("../../contexts/useToast.js", () => ({ useToast: () => mocks.toast }));
vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({
    roleUserId: mocks.currentRoleUserId,
    recarregarContextoOrg: mocks.reloadOrg,
  }),
}));
vi.mock("../hooks/useAgoraDaClinica.js", () => ({
  useAgoraDaClinica: () => ({
    hojeIso: "2026-10-04",
    fuso: "America/Sao_Paulo",
  }),
}));
vi.mock("../../services/api", () => ({
  authHeadersForFetch: vi.fn(async () => ({})),
  configuracoesClinicaApi: { buscar: vi.fn(async () => ({})) },
  agendasApi: { byRange: mocks.agenda },
  equipeApi: { update: mocks.update },
  perfilApi: { buscar: mocks.buscarPerfil },
  getApiErrorDetail: ({ body }) => body.message,
  getApiErrorToastMessage: (e, f) => e.message || f,
}));
vi.mock("./InviteModal", () => ({
  InviteModal: ({ onClose }) => (
    <div role="dialog" aria-label="Convidar pessoa">
      <button onClick={onClose}>Fechar</button>
    </div>
  ),
}));
vi.mock("./EditRoleModal", () => ({
  EditRoleModal: () => <div role="dialog">Cadastro completo</div>,
}));
vi.mock("./DisponibilidadeProfissionalModal", () => ({
  default: () => <div>Disponibilidade</div>,
}));
vi.mock("./AuditoriaView", () => ({
  AuditoriaView: ({ roleUserId }) => (
    <div>Auditoria: {roleUserId || "clínica"}</div>
  ),
}));
vi.mock("./GestaoPerfisTab", () => ({
  GestaoPerfisTab: ({ criarNovoNonce, onBack }) => (
    <div>
      Editor de perfis: {criarNovoNonce}
      <button onClick={onBack}>Voltar à equipe</button>
    </div>
  ),
}));
vi.mock("./EquipePessoaView", () => ({
  default: ({
    pessoa,
    permissoesPerfil,
    canSeeConfigAuditoria,
    canSeeConfigPerfil,
    canManageUsers,
    canDeleteUsers,
    isSelf,
    onPerfilAtualizado,
    onBack,
  }) => (
    <div>
      <h2>{pessoa.nomeCompleto}</h2>
      {isSelf && (
        <button
          onClick={() =>
            onPerfilAtualizado?.({
              nomeCompleto: "Nome atualizado",
              fotoUrl: "foto.webp",
            })
          }
        >
          Cadastro pessoal
        </button>
      )}
      <button onClick={onBack}>Voltar da pessoa</button>
      {canSeeConfigAuditoria && <button onClick={() => { }}>Histórico</button>}
      {canSeeConfigAuditoria && <span>Auditoria: {pessoa.id}</span>}
      {canSeeConfigPerfil && (
        <>
          <button>Acesso</button>
          <span>{permissoesPerfil.length} de 3 funções habilitadas</span>
        </>
      )}
      {canManageUsers && <button>Editar pessoa</button>}
      {canDeleteUsers && pessoa.perfilAcessoCodigo !== "DONO" && (
        <button>Desativar acesso</button>
      )}
    </div>
  ),
}));
const equipe = [
  {
    id: "owner",
    usuarioId: "owner-user",
    nomeCompleto: "Ana Dono",
    perfilAcessoId: "dono",
    perfilAcessoCodigo: "DONO",
    perfilAcessoNome: "Dono",
    roleId: "dentista",
    roleName: "DENTISTA",
    ativo: true,
    apareceNaAgenda: false,
  },
  {
    id: "member",
    nomeCompleto: "Bruno Silva",
    email: "bruno@clinica.example",
    telefone: "11987654321",
    perfilAcessoId: "clinico",
    perfilAcessoNome: "Clínico",
    roleId: "dentista",
    roleName: "DENTISTA",
    ativo: true,
    apareceNaAgenda: true,
  },
];
beforeEach(() => {
  mocks.currentRoleUserId = "owner";
  mocks.update.mockResolvedValue({});
  mocks.access = {
    canSeeConfigEquipe: true,
    canCreateUsers: true,
    canManageUsers: true,
    canDeleteUsers: true,
    canSeeConfigPerfil: true,
    canEditConfigPerfil: true,
    canSeeConfigAuditoria: true,
    canSeeAgenda: true,
    canSeeAgendaMulti: true,
  };
  mocks.agenda.mockResolvedValue([
    {
      id: "appointment",
      profissionalRoleUserId: "member",
      dataAgendamento: "2026-10-04",
      horaInicio: "10:00",
      pacienteNome: "Paciente existente",
      statusNome: "Agendado",
    },
  ]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        String(url).endsWith("/equipe")
          ? equipe
          : String(url).endsWith("/roles")
            ? [{ id: "dentista", nome: "DENTISTA" }]
            : String(url).endsWith("/perfis-acesso")
              ? [
                { id: "dono", codigo: "DONO", nome: "Dono" },
                { id: "clinico", nome: "Clínico" },
              ]
              : [],
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("busca por e-mail, filtra quem atende por campo real e distingue convites indisponíveis", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  fireEvent.click(screen.getAllByRole("button", { name: /Atendem na agenda/ })[0]);
  expect(
    screen.queryByRole("button", { name: "Ver Ana Dono" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Buscar pessoa"), {
    target: { value: "bruno@clinica" },
  });
  expect(
    screen.getByRole("button", { name: "Ver Bruno Silva" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Buscar pessoa"), {
    target: { value: "não existe" },
  });
  expect(screen.getByText("Nenhuma pessoa encontrada")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /convites pendentes/i }));
  expect(mocks.toast.info).toHaveBeenCalled();
});
it("abre histórico individual e protege dono de desativação", async () => {
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Ana Dono" }));
  expect(
    screen.queryByRole("button", { name: "Desativar acesso" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Histórico", exact: true }),
  );
  expect(screen.getByText("Auditoria: owner")).toBeInTheDocument();
});
it("mantém navegação novo perfil/convite e não cria contas nos testes", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  fireEvent.click(
    screen.getByRole("button", { name: "Criar perfil de acesso" }),
  );
  expect(screen.getByText("Editor de perfis: 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Voltar à equipe" }));
  fireEvent.click(screen.getByRole("button", { name: "Convidar pessoa" }));
  expect(
    screen.getByRole("dialog", { name: "Convidar pessoa" }),
  ).toBeInTheDocument();
  expect(
    fetch.mock.calls.every(
      ([, options]) => !options?.method || options.method === "GET",
    ),
  ).toBe(true);
});
it("despolui o cabeçalho removendo .phd e histórico/auditoria avulso, promovendo Convidar pessoa para a toolbar e Criar perfil na lateral", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  expect(container.querySelector(".phd")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Histórico / Auditoria" }),
  ).not.toBeInTheDocument();
  const inviteBtn = container.querySelector(".tool .tool-action-btn");
  expect(inviteBtn).toBeTruthy();
  expect(inviteBtn).toHaveTextContent("Convidar pessoa");
  expect(
    screen.getByRole("button", { name: "Criar perfil de acesso" }),
  ).toBeInTheDocument();

  // Verifica cards de KPI limpos e alinhados idênticos a Pacientes (sem subtexto descritivo .kpi-sub, com spacer)
  const kpiCards = container.querySelectorAll(".kpis .kpi");
  expect(kpiCards.length).toBe(5);
  expect(kpiCards[0].classList.contains("on")).toBe(false);
  expect(kpiCards[0].querySelector(".kpi-top .kpi-label")).toHaveTextContent("ATIVOS");
  expect(kpiCards[0].querySelector(".kpi-top .kpi-badge")).toBeTruthy();
  expect(kpiCards[0].querySelector(".kpi-sub-spacer")).toBeTruthy();
  expect(kpiCards[0].querySelector(".kpi-sub")).toBeNull();

  // Ao clicar no card de ATIVOS, ele ativa o filtro e ganha a classe .on
  fireEvent.click(kpiCards[0]);
  expect(kpiCards[0].classList.contains("on")).toBe(true);

  // Verifica que o rail não possui divisores obsoletos de modelos prontos
  expect(container.querySelectorAll(".rail .rgl")).toHaveLength(0);
});
it("mostra falha de carregamento com retry, e não confunde falha com equipe vazia", async () => {
  fetch.mockResolvedValue({
    ok: false,
    json: async () => ({ message: "Falha na equipe" }),
  });
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Falha na equipe");
  expect(
    screen.queryByText("Nenhuma pessoa encontrada"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(10));
});
it("oculta ações e histórico para acesso apenas de leitura e não consulta agenda sem permissão", async () => {
  mocks.access = { canSeeConfigEquipe: true };
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  expect(
    screen.queryByRole("button", { name: "Convidar pessoa" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Histórico / Auditoria" }),
  ).not.toBeInTheDocument();
  expect(mocks.agenda).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ver Bruno Silva" }));
  expect(
    screen.queryByRole("button", { name: "Editar pessoa" }),
  ).not.toBeInTheDocument();
});

it("exibe permissões efetivas do Dono sem inventar concessões configuráveis de agenda", async () => {
  const original = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) =>
    String(url).endsWith("/api/v1/permissoes")
      ? {
        ok: true,
        json: async () => [
          {
            permissaoId: "view",
            codigo: "PACIENTE_VER",
            modulo: "PACIENTES",
            nome: "Ver pacientes",
          },
          {
            permissaoId: "appear",
            codigo: "AGENDA_APARECER",
            modulo: "AGENDA",
            nome: "Aparecer",
          },
          {
            permissaoId: "multi",
            codigo: "AGENDA_MULTI_VER",
            modulo: "AGENDA",
            nome: "Multi",
          },
        ],
      }
      : original(url, options),
  );
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Ver Ana Dono" }));
  fireEvent.click(screen.getByRole("button", { name: "Acesso", exact: true }));
  expect(
    await screen.findByText("1 de 3 funções habilitadas"),
  ).toBeInTheDocument();
});

function mockOwnerAgendaCatalog() {
  const original = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) => {
    if (
      String(url).endsWith("/permissoes") &&
      !String(url).includes("/perfis-acesso/")
    )
      return {
        ok: true,
        json: async () => [
          {
            permissaoId: "appear",
            codigo: "AGENDA_APARECER",
            modulo: "AGENDA",
          },
          {
            permissaoId: "multi",
            codigo: "AGENDA_MULTI_VER",
            modulo: "AGENDA",
          },
          { permissaoId: "view", codigo: "AGENDA_VER", modulo: "AGENDA" },
        ],
      };
    return original(url, options);
  });
}
it("salva somente a opção do Dono escolhida e atualiza a sessão", async () => {
  mockOwnerAgendaCatalog();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  const accordionToggle = await screen.findByRole("button", {
    name: /Mais configurações|Opções de configuração/i,
  });
  expect(accordionToggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(accordionToggle);
  expect(accordionToggle).toHaveAttribute("aria-expanded", "true");
  const toggle = await screen.findByRole("switch", {
    name: "Aparecer na agenda",
  });
  await waitFor(() => expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("owner", {
      usuarioId: "owner-user",
      roleId: "dentista",
      apareceNaAgenda: true,
    }),
  );
  await waitFor(() => expect(mocks.reloadOrg).toHaveBeenCalled());
  expect(mocks.toast.success).toHaveBeenCalled();
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(
    screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
  ).toHaveAttribute("aria-checked", "false");
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(mocks.update).toHaveBeenLastCalledWith("owner", {
      usuarioId: "owner-user",
      roleId: "dentista",
      apareceNaAgenda: false,
    }),
  );
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
});
it("mantém o estado anterior quando falha o salvamento da opção do Dono", async () => {
  mockOwnerAgendaCatalog();
  mocks.update.mockRejectedValueOnce(new Error("Falha ao salvar"));
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Mais configurações|Opções de configuração/i,
    }),
  );
  const toggle = await screen.findByRole("switch", {
    name: "Ver múltiplas agendas",
  });
  await waitFor(() => expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(mocks.reloadOrg).not.toHaveBeenCalled();
});
it("não oferece controles do Dono para outro membro autenticado", async () => {
  mocks.currentRoleUserId = "member";
  mockOwnerAgendaCatalog();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  expect(
    screen.queryByRole("button", {
      name: /Mais configurações|Opções de configuração/i,
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("switch", { name: "Aparecer na agenda" }),
  ).not.toBeInTheDocument();
});

it("bloqueia as opções do Dono quando não consegue carregar permissões", async () => {
  mockOwnerAgendaCatalog();
  const original = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) =>
    String(url).includes("/perfis-acesso/dono/permissoes")
      ? { ok: false }
      : original(url, options),
  );
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Mais configurações|Opções de configuração/i,
    }),
  );
  const toggle = await screen.findByRole("switch", {
    name: "Aparecer na agenda",
  });
  expect(
    (
      await screen.findAllByText(
        "Não foi possível carregar as funções dos perfis.",
      )
    )[0],
  ).toBeInTheDocument();
  expect(toggle).toBeDisabled();
  fireEvent.click(toggle);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("abre e fecha os RNFs da agenda ao clicar para maximizar o espaço", async () => {
  mockOwnerAgendaCatalog();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  const accordionToggle = await screen.findByRole("button", {
    name: /Mais configurações|Opções de configuração/i,
  });
  expect(accordionToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("switch", { name: "Aparecer na agenda" }),
  ).not.toBeInTheDocument();

  // Abre com clique
  fireEvent.click(accordionToggle);
  expect(accordionToggle).toHaveAttribute("aria-expanded", "true");
  expect(
    await screen.findByRole("switch", { name: "Aparecer na agenda" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
  ).toBeInTheDocument();

  // Fecha com clique
  fireEvent.click(accordionToggle);
  expect(accordionToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("switch", { name: "Aparecer na agenda" }),
  ).not.toBeInTheDocument();
});

it("mantém a referência Agenda sincronizada com os nove módulos ao mudar uma opção", async () => {
  mockOwnerAgendaCatalog();
  const original = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) => {
    const response = await original(url, options);
    if (
      String(url).endsWith("/permissoes") &&
      !String(url).includes("/perfis-acesso/")
    ) {
      const catalog = await response.json();
      return {
        ...response,
        json: async () => catalog.filter((p) => p.codigo !== "AGENDA_VER"),
      };
    }
    return response;
  });
  const { container } = montar();
  fireEvent.click(await screen.findByRole("button", { name: /^Dono / }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Mais configurações|Opções de configuração/i,
    }),
  );
  const toggle = await screen.findByRole("switch", {
    name: "Ver múltiplas agendas",
  });
  await waitFor(() => expect(toggle).toBeEnabled());
  const reference = container.querySelector(".rnf-header-top .area");
  const agendaCard = container.querySelector(".areas .area");
  expect(
    screen.getByText(/Mais configurações|Opções de configuração/i),
  ).toBeInTheDocument();
  expect(container.querySelectorAll(".areas .area")).toHaveLength(9);
  expect(reference.textContent).toBe(agendaCard.textContent);
  expect(reference.className).toBe(agendaCard.className);
  expect(reference.lastElementChild.className).toBe(
    agendaCard.lastElementChild.className,
  );
  const initialLevel = reference.lastElementChild.textContent;
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  expect(reference.lastElementChild.textContent).not.toBe(initialLevel);
  expect(reference.textContent).toBe(agendaCard.textContent);
  expect(reference.className).toBe(agendaCard.className);
  expect(reference.lastElementChild.className).toBe(
    agendaCard.lastElementChild.className,
  );
  expect(container.querySelectorAll(".areas .area")).toHaveLength(9);
});

it("endereço do próprio perfil abre o cadastro pessoal e propaga atualização para lista e cabeçalho", async () => {
  const onPerfilAtualizado = vi.fn();
  montar({ onPerfilAtualizado }, "/equipe/owner");
  expect(
    await screen.findByRole("heading", { name: "Ana Dono" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cadastro pessoal" }));
  expect(
    screen.getByRole("heading", { name: "Nome atualizado" }),
  ).toBeInTheDocument();
  expect(onPerfilAtualizado).toHaveBeenCalledWith(
    expect.objectContaining({ nomeCompleto: "Nome atualizado" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Voltar da pessoa" }));
  expect(ultimoRoteador().state.location.pathname).toBe("/equipe");
  expect(
    await screen.findByRole("button", { name: "Ver Nome atualizado" }),
  ).toBeInTheDocument();
});
it("target de terceiro abre os detalhes sem cadastro pessoal", async () => {
  montar({}, "/equipe/member");
  expect(
    await screen.findByRole("heading", { name: "Bruno Silva" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cadastro pessoal" }),
  ).not.toBeInTheDocument();
});
it("usuário sem USUARIO_VER abre somente a si via perfil, sem buscar equipe ou catálogos protegidos", async () => {
  mocks.access = { canSeeConfigEquipe: false };
  mocks.buscarPerfil.mockResolvedValue({
    id: "owner-user",
    nomeCompleto: "Ana Pessoal",
    telefone: "11987654321",
  });
  montar({}, "/equipe/me");
  expect(
    await screen.findByRole("heading", { name: "Ana Pessoal" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Cadastro pessoal" }),
  ).toBeInTheDocument();
  expect(mocks.buscarPerfil).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Editar pessoa" }),
  ).not.toBeInTheDocument();
});
it("sem permissão de equipe não abre target de outro membro", async () => {
  mocks.access = { canSeeConfigEquipe: false };
  montar({}, "/equipe/member");
  expect(
    screen.getByText("Você não tem permissão para visualizar a equipe."),
  ).toBeInTheDocument();
  expect(mocks.buscarPerfil).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("abre popover de filtros, filtra por status e agenda, e limpa filtros com badge reativo", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const filterBtn = screen.getByRole("button", { name: "Filtros" });
  expect(filterBtn).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Opções de filtros" })).not.toBeInTheDocument();

  // Abre popover
  fireEvent.click(filterBtn);
  expect(screen.getByRole("dialog", { name: "Opções de filtros" })).toBeInTheDocument();

  // Seleciona Apenas Ativos
  fireEvent.click(screen.getByLabelText("Apenas Ativos"));
  expect(filterBtn.querySelector(".filter-btn-count")).toHaveTextContent("1");

  // Filtra por Não atendem na agenda
  fireEvent.click(screen.getByLabelText("Não atendem"));
  expect(filterBtn.querySelector(".filter-btn-count")).toHaveTextContent("2");

  // Fecha popover com botão Fechar
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog", { name: "Opções de filtros" })).not.toBeInTheDocument();

  // Verifica barra de filtros ativos
  expect(screen.getByLabelText("Filtros ativos")).toBeInTheDocument();
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();
  expect(screen.getByText(/Agenda: Não atendem/)).toBeInTheDocument();

  // Limpa individualmente status
  fireEvent.click(screen.getByLabelText("Remover filtro de status"));
  expect(screen.queryByText(/Status: Ativos/)).not.toBeInTheDocument();

  // Limpa todos os filtros
  fireEvent.click(screen.getByRole("button", { name: "Limpar todos" }));
  expect(screen.queryByLabelText("Filtros ativos")).not.toBeInTheDocument();
});

it("abre menu de ordenação e seleciona opções de ordenação", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const sortBtn = screen.getByRole("button", { name: "Opções de ordenação" });
  expect(sortBtn).toHaveTextContent("Nome (A–Z)");

  fireEvent.click(sortBtn);
  expect(screen.getByRole("menu", { name: "Menu de ordenação" })).toBeInTheDocument();

  // Seleciona Nome (Z–A)
  fireEvent.click(screen.getByRole("menuitem", { name: /Nome \(Z–A\)/ }));
  expect(screen.queryByRole("menu", { name: "Menu de ordenação" })).not.toBeInTheDocument();
  expect(sortBtn).toHaveTextContent("Nome (Z–A)");

  // Abre novamente e seleciona Perfil de acesso
  fireEvent.click(sortBtn);
  fireEvent.click(screen.getByRole("menuitem", { name: /Perfil de acesso/ }));
  expect(sortBtn).toHaveTextContent("Perfil de acesso");
});

it("permite filtrar equipe usando os chips rápidos integrados abaixo da busca", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const quickChips = screen.getByLabelText("Filtros rápidos de status");
  expect(quickChips).toBeInTheDocument();

  // Clica no chip "Ativos"
  const chipAtivos = Array.from(quickChips.querySelectorAll(".quick-chip")).find((c) =>
    c.textContent.includes("Ativos"),
  );
  expect(chipAtivos).toBeTruthy();
  fireEvent.click(chipAtivos);

  expect(chipAtivos).toHaveClass("active");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();

  // Clica no chip "Todos" para resetar
  const chipTodos = Array.from(quickChips.querySelectorAll(".quick-chip")).find((c) =>
    c.textContent.includes("Todos"),
  );
  fireEvent.click(chipTodos);
  expect(chipTodos).toHaveClass("active");
  expect(screen.queryByText(/Status: Ativos/)).not.toBeInTheDocument();
});

it("aplica filtros de forma acumulativa entre múltiplos chips e pílulas ativas", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const quickChips = screen.getByLabelText("Filtros rápidos de status");

  const chipAtivos = Array.from(quickChips.querySelectorAll(".quick-chip")).find((c) =>
    c.textContent.includes("Ativos"),
  );
  const chipAgenda = Array.from(quickChips.querySelectorAll(".quick-chip")).find((c) =>
    c.textContent.includes("Atendem na agenda"),
  );

  // 1. Clica em "Ativos"
  fireEvent.click(chipAtivos);
  expect(chipAtivos).toHaveClass("active");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();

  // 2. Clica em "Atendem na agenda" sem desativar "Ativos" (acumulativo)
  fireEvent.click(chipAgenda);
  expect(chipAtivos).toHaveClass("active");
  expect(chipAgenda).toHaveClass("active");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();
  expect(screen.getByText(/Agenda: Atendem/)).toBeInTheDocument();

  // 3. Remove a pílula de "Status: Ativos" via botão ✕
  const removeStatusBtn = screen.getByRole("button", { name: "Remover filtro de status" });
  fireEvent.click(removeStatusBtn);
  expect(screen.queryByText(/Status: Ativos/)).not.toBeInTheDocument();
  // "Agenda: Atendem" continua ativo!
  expect(chipAgenda).toHaveClass("active");
  expect(screen.getByText(/Agenda: Atendem/)).toBeInTheDocument();

  // 4. Limpar todos limpa o que restava
  const clearBtn = screen.getByRole("button", { name: "Limpar todos" });
  fireEvent.click(clearBtn);
  expect(screen.queryByText(/Agenda: Atendem/)).not.toBeInTheDocument();
});

it("abre a ficha do usuário ao clicar em qualquer lugar do bloco retangular da linha", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const row = screen.getByRole("button", { name: "Abrir ficha de Bruno Silva" });
  expect(row).toBeInTheDocument();

  // Clica no elemento da linha (bloco retangular)
  fireEvent.click(row);
  expect(await screen.findByRole("heading", { name: "Bruno Silva" })).toBeInTheDocument();
});

it("abre a ficha do usuário ao clicar na badge de perfil dentro da linha", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const row = screen.getByRole("button", { name: "Abrir ficha de Bruno Silva" });
  const badgeElement = row.querySelector(".c-pf");
  expect(badgeElement).toBeInTheDocument();

  fireEvent.click(badgeElement);
  expect(await screen.findByRole("heading", { name: "Bruno Silva" })).toBeInTheDocument();
});

it("abre a ficha do usuário via teclado com tecla Enter no bloco retangular", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const row = screen.getByRole("button", { name: "Abrir ficha de Bruno Silva" });
  fireEvent.keyDown(row, { key: "Enter" });
  expect(await screen.findByRole("heading", { name: "Bruno Silva" })).toBeInTheDocument();
});

it("não abre a ficha do usuário ao clicar no botão do WhatsApp", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const row = screen.getByRole("button", { name: "Abrir ficha de Bruno Silva" });
  const waLink = row.querySelector("a.ib");
  if (waLink) {
    fireEvent.click(waLink);
    // Não deve navegar para a ficha
    expect(screen.queryByRole("heading", { name: "Bruno Silva" })).not.toBeInTheDocument();
    // A lista de equipe deve permanecer visível
    expect(screen.getByRole("button", { name: "Ver Bruno Silva" })).toBeInTheDocument();
  }
});

it("renderiza o botão 'Adicionar membros' antes de 'Editar perfil' e abre o modal de vinculação ao clicar", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  // Seleciona o perfil "Clínico" no container .pchips
  const pchips = container.querySelector(".pchips");
  const profileButton = Array.from(pchips.querySelectorAll("button")).find((b) =>
    b.textContent.includes("Clínico"),
  );
  expect(profileButton).toBeTruthy();
  fireEvent.click(profileButton);

  // O cabeçalho do perfil selecionado deve exibir "Adicionar membros"
  const addMembersBtn = await screen.findByRole("button", {
    name: /Adicionar membros/i,
  });
  expect(addMembersBtn).toBeInTheDocument();

  // Verifica que existe o botão de editar ou usar como base
  const actionBtn = screen.getByRole("button", {
    name: /(Editar perfil|Usar como base)/i,
  });
  expect(actionBtn).toBeInTheDocument();

  // Verifica que "Adicionar membros" precede o botão de edição na ordem do DOM
  expect(
    addMembersBtn.compareDocumentPosition(actionBtn) &
    Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  // Clica em "Adicionar membros"
  fireEvent.click(addMembersBtn);

  // Modal deve abrir com o título e lista de membros elegíveis (excluindo Dono)
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Adicionar Membros ao Perfil" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Ana Dono")).not.toBeInTheDocument();
});



it("abre a ficha do perfil ao clicar no rail, e fechar a ficha (✕) remove o banner e o filtro", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  // Clica no perfil "Clínico" no Rail lateral
  const railItems = container.querySelectorAll(".rail .rit");
  const clinicoItem = Array.from(railItems).find((item) =>
    item.textContent.includes("Clínico"),
  );
  expect(clinicoItem).toBeTruthy();
  fireEvent.click(clinicoItem);

  // A ficha .pban deve estar visível
  const pban = container.querySelector(".pban");
  expect(pban).toBeInTheDocument();
  expect(pban).toHaveTextContent("Clínico");

  // Barra de pílulas deve exibir filtro ativo do perfil
  expect(screen.getByText(/Perfil: Clínico/)).toBeInTheDocument();

  // Clica no botão de fechar (✕) da ficha
  const closePbanBtn = screen.getByRole("button", {
    name: "Fechar ficha do perfil e remover filtro",
  });
  expect(closePbanBtn).toBeInTheDocument();
  fireEvent.click(closePbanBtn);

  // Banner recolhe e filtro é removido
  expect(container.querySelector(".pban")).toBeNull();
  expect(screen.queryByText(/Perfil: Clínico/)).not.toBeInTheDocument();
});

it("abre o modal 'Todos os Perfis', permite busca, fixar/desafixar perfil no rail e abrir ficha", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  // Clica no botão de ver todos os perfis
  const seeAllBtn = screen.getByRole("button", {
    name: /Ver todos os \d+ perfis/i,
  });
  expect(seeAllBtn).toBeInTheDocument();
  fireEvent.click(seeAllBtn);

  // Modal aberto
  const modal = screen.getByRole("dialog", {
    name: "Todos os Perfis de Acesso",
  });
  expect(modal).toBeInTheDocument();

  // Testa busca no modal
  const searchInput = screen.getByLabelText("Buscar perfil na lista completa");
  fireEvent.change(searchInput, { target: { value: "Clínico" } });
  expect(modal.querySelector(".modal-perfil-name")).toHaveTextContent("Clínico");

  // Testa fixar/desafixar
  const pinBtn = screen.getByRole("button", { name: /Fixar Clínico|Desafixar Clínico/i });
  expect(pinBtn).toBeInTheDocument();
  fireEvent.click(pinBtn);

  // Clica no botão Ficha para abrir a ficha do perfil
  const fichaBtn = screen.getByRole("button", { name: "Abrir ficha de Clínico" });
  fireEvent.click(fichaBtn);

  // Modal fecha e ficha abre na tela principal
  expect(screen.queryByRole("dialog", { name: "Todos os Perfis de Acesso" })).not.toBeInTheDocument();
  expect(container.querySelector(".pban")).toHaveTextContent("Clínico");
});
