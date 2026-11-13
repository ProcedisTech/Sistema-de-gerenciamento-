import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
  act,
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
vi.mock("../../hooks/usePapel", async (importOriginal) => ({
  ...(await importOriginal()), // papelDe real: o menu da janela Atribuir perfil o usa
  usePapel: () => mocks.access,
}));
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
  localStorage.removeItem("procedi_pinned_profiles_undefined"); // fixados gravados por um teste não vazam
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("busca por e-mail, filtra quem atende por campo real e o card 'Precisam de você' filtra sem toast", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  const cardAgenda = screen.getByRole("button", { name: /ATENDEM NA AGENDA/ });
  fireEvent.click(cardAgenda);
  expect(cardAgenda).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "Ver Bruno Silva" }),
  ).toBeInTheDocument();
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
  // "Convites pendentes" saiu; o card "Precisam de você" (ativos sem perfil) filtra, sem aviso
  const cardPrecisam = screen.getByRole("button", { name: /PRECISAM DE VOCÊ/ });
  expect(cardPrecisam).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(cardPrecisam);
  expect(cardPrecisam).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Status: Sem perfil/)).toBeInTheDocument();
  expect(screen.getByText("Nenhuma pessoa encontrada")).toBeInTheDocument();
  expect(mocks.toast.info).not.toHaveBeenCalled();
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

it("abre a folha 'Filtrar pessoas', filtra por status e agenda, e limpa filtros com badge reativo", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const filterBtn = screen.getByRole("button", { name: "Filtros" });
  expect(filterBtn).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Filtrar pessoas" })).not.toBeInTheDocument();

  // Abre a folha (portal no body, fora do container da tela)
  fireEvent.click(filterBtn);
  const folha = screen.getByRole("dialog", { name: "Filtrar pessoas" });
  expect(folha).toBeInTheDocument();
  expect(container.contains(folha)).toBe(false);
  expect(screen.getByRole("button", { name: "Ver 2 pessoas" })).toBeInTheDocument();

  // Marca Ativos
  fireEvent.click(within(folha).getByLabelText("Ativos"));
  expect(filterBtn.querySelector(".filter-btn-count")).toHaveTextContent("1");

  // Filtra por Não atendem na agenda: só Ana Dono
  fireEvent.click(within(folha).getByLabelText("Não atendem"));
  expect(filterBtn.querySelector(".filter-btn-count")).toHaveTextContent("2");
  expect(screen.getByRole("button", { name: "Ver 1 pessoa" })).toBeInTheDocument();

  // Fecha a folha com o botão Fechar filtros
  fireEvent.click(screen.getByRole("button", { name: "Fechar filtros" }));
  expect(screen.queryByRole("dialog", { name: "Filtrar pessoas" })).not.toBeInTheDocument();

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
  expect(sortBtn).toHaveTextContent("Hierarquia");

  fireEvent.click(sortBtn);
  const menu = screen.getByRole("menu", { name: "Menu de ordenação" });
  expect(
    within(menu).getAllByRole("menuitem").map((i) => i.textContent.trim()),
  ).toEqual([
    expect.stringContaining("Hierarquia"),
    expect.stringContaining("Nome (A–Z)"),
    expect.stringContaining("Nome (Z–A)"),
    expect.stringContaining("Perfil de acesso"),
    expect.stringContaining("Mais atendimentos"),
  ]);

  // Seleciona Nome (Z–A)
  fireEvent.click(screen.getByRole("menuitem", { name: /Nome \(Z–A\)/ }));
  expect(screen.queryByRole("menu", { name: "Menu de ordenação" })).not.toBeInTheDocument();
  expect(sortBtn).toHaveTextContent("Nome (Z–A)");

  // Abre novamente e seleciona Perfil de acesso
  fireEvent.click(sortBtn);
  fireEvent.click(screen.getByRole("menuitem", { name: /Perfil de acesso/ }));
  expect(sortBtn).toHaveTextContent("Perfil de acesso");

  // Nome (A–Z) e Mais atendimentos também ficam selecionáveis
  fireEvent.click(sortBtn);
  fireEvent.click(screen.getByRole("menuitem", { name: /Nome \(A–Z\)/ }));
  expect(sortBtn).toHaveTextContent("Nome (A–Z)");
  fireEvent.click(sortBtn);
  fireEvent.click(screen.getByRole("menuitem", { name: /Mais atendimentos/ }));
  expect(sortBtn).toHaveTextContent("Mais atendimentos");
});

it("permite filtrar equipe usando os indicadores (cards) do topo", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const grupo = screen.getByLabelText("Filtros rápidos de status");
  expect(grupo).toBeInTheDocument();
  // os botões rápidos (.quick-chip) saíram: o filtro vive nos indicadores
  expect(container.querySelector(".quick-chip")).toBeNull();

  // Clica no card "Ativos"
  const cardAtivos = within(grupo).getByRole("button", { name: /^ATIVOS/ });
  expect(cardAtivos).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(cardAtivos);

  expect(cardAtivos).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();

  // Clica de novo no mesmo card para desligar
  fireEvent.click(cardAtivos);
  expect(cardAtivos).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByText(/Status: Ativos/)).not.toBeInTheDocument();
});

it("aplica filtros de forma acumulativa entre múltiplos indicadores e pílulas ativas", async () => {
  montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });

  const grupo = screen.getByLabelText("Filtros rápidos de status");
  const cardAtivos = within(grupo).getByRole("button", { name: /^ATIVOS/ });
  const cardAgenda = within(grupo).getByRole("button", { name: /ATENDEM NA AGENDA/ });

  // 1. Clica em "Ativos"
  fireEvent.click(cardAtivos);
  expect(cardAtivos).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();

  // 2. Clica em "Atendem na agenda" sem desativar "Ativos" (acumulativo)
  fireEvent.click(cardAgenda);
  expect(cardAtivos).toHaveAttribute("aria-pressed", "true");
  expect(cardAgenda).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Status: Ativos/)).toBeInTheDocument();
  expect(screen.getByText(/Agenda: Atendem/)).toBeInTheDocument();

  // 3. Remove a pílula de "Status: Ativos" via botão ✕
  const removeStatusBtn = screen.getByRole("button", { name: "Remover filtro de status" });
  fireEvent.click(removeStatusBtn);
  expect(screen.queryByText(/Status: Ativos/)).not.toBeInTheDocument();
  expect(cardAtivos).toHaveAttribute("aria-pressed", "false");
  // "Agenda: Atendem" continua ativo!
  expect(cardAgenda).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Agenda: Atendem/)).toBeInTheDocument();

  // 4. Limpar todos limpa o que restava
  const clearBtn = screen.getByRole("button", { name: "Limpar todos" });
  fireEvent.click(clearBtn);
  expect(screen.queryByText(/Agenda: Atendem/)).not.toBeInTheDocument();
  expect(cardAgenda).toHaveAttribute("aria-pressed", "false");
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

it("abre a janela 'Todos os perfis de acesso', permite busca, fixar/desafixar perfil no rail e abrir ficha", async () => {
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
    name: "Todos os perfis de acesso",
  });
  expect(modal).toBeInTheDocument();

  // Testa busca no modal
  const searchInput = screen.getByLabelText("Buscar perfil na lista completa");
  fireEvent.change(searchInput, { target: { value: "Clínico" } });
  expect(modal.querySelector(".modal-perfil-name")).toHaveTextContent("Clínico");

  // Testa fixar/desafixar
  const pinBtn = screen.getByRole("button", { name: /Fixar Clínico|Desafixar Clínico/i });
  expect(pinBtn).toBeInTheDocument();
  const estavaFixado = /^Desafixar/.test(pinBtn.getAttribute("aria-label"));
  fireEvent.click(pinBtn);
  expect(
    screen.getByRole("button", { name: estavaFixado ? "Fixar Clínico" : "Desafixar Clínico" }),
  ).toBeInTheDocument();

  // Clica em "Ver ficha de Clínico" para abrir a ficha do perfil
  const fichaBtn = screen.getByRole("button", { name: "Ver ficha de Clínico" });
  fireEvent.click(fichaBtn);

  // Modal fecha e ficha abre na tela principal
  expect(screen.queryByRole("dialog", { name: "Todos os perfis de acesso" })).not.toBeInTheDocument();
  expect(container.querySelector(".pban")).toHaveTextContent("Clínico");
});

// ---- Onda 3: barra de perfis, fixados, janela "Todos os perfis de acesso" ----
const catalogo7 = [1, 2, 3, 4, 5, 6].map((n) => ({
  permissaoId: `p${n}`,
  codigo: `PERM_${n}`,
  modulo: "PACIENTES",
  nome: `Função ${n}`,
}));
const perfis7 = [
  { id: "sec3", nome: "Secretaria-3" },
  { id: "dono", codigo: "DONO", nome: "Dono" },
  { id: "clin", nome: "Profissional Clínico" },
  { id: "sec1", nome: "Secretaria-1" },
  { id: "adm", nome: "Administrador" },
  { id: "socio", nome: "Sócio / Investidor" },
  { id: "sec2", nome: "Secretaria-2" },
];
const funcoes7 = {
  dono: ["p1", "p2", "p3", "p4", "p5", "p6"],
  adm: ["p1", "p2", "p3", "p4", "p5"],
  socio: ["p1", "p2", "p3", "p4"],
  clin: ["p1", "p2", "p3"],
  sec1: ["p1", "p2"],
  sec2: ["p1", "p2"],
  sec3: ["p1"],
};
const ordem7 = [
  "Dono",
  "Administrador",
  "Sócio / Investidor",
  "Profissional Clínico",
  "Secretaria-1",
  "Secretaria-2",
  "Secretaria-3",
];
function mockSetePerfis() {
  const original = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) => {
    const u = String(url);
    const id = u.match(/perfis-acesso\/([^/]+)\/permissoes/);
    if (id) return { ok: true, json: async () => funcoes7[id[1]] || [] };
    if (u.endsWith("/perfis-acesso"))
      return { ok: true, json: async () => perfis7 };
    if (u.endsWith("/permissoes"))
      return { ok: true, json: async () => catalogo7 };
    return original(url, options);
  });
}
const nomesBarra = (container) =>
  [...container.querySelectorAll(".pcw button .nm")].map((n) => n.textContent);

it("barra de perfis: Dono, depois quem tem mais funções, empate pelo nome", async () => {
  mockSetePerfis();
  const { container } = montar();
  await waitFor(() =>
    expect(nomesBarra(container)).toEqual(["Toda a equipe", ...ordem7]),
  );
});

it("barra de perfis abaixo de 1280 px: etiqueta que não coube fica hidden, 'Todos os perfis' à vista e sem overflow-x", async () => {
  mockSetePerfis();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // três linhas simuladas: filhos 0-2 na linha 1, 3-5 na linha 2, 6-7 na linha 3 (não cabe)
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get() {
      const i = [...(this.parentElement?.children || [])].indexOf(this);
      return this.parentElement?.classList.contains("pcw")
        ? Math.floor(i / 3) * 40
        : 0;
    },
  });
  try {
    const { container } = montar();
    await waitFor(() =>
      expect(nomesBarra(container)).toContain("Secretaria-3"),
    );
    const chip = (nome) =>
      [...container.querySelectorAll(".pcw button")].find(
        (b) => b.querySelector(".nm")?.textContent === nome,
      );
    await waitFor(() => expect(chip("Secretaria-3")).toHaveAttribute("hidden"));
    expect(chip("Secretaria-2")).toHaveAttribute("hidden");
    expect(chip("Secretaria-1")).not.toHaveAttribute("hidden");
    const todos = screen.getByRole("button", { name: "Todos os perfis (7)" });
    expect(todos).toBeVisible();
    expect(todos.closest("[hidden]")).toBeNull();
    expect(container.querySelector(".pchips").style.overflowX).toBe("");
    expect(container.querySelector(".pcw").style.overflowX).toBe("");
  } finally {
    delete HTMLElement.prototype.offsetTop;
  }
});

it("fixados guardados: ids que não existem mais saem do navegador ao carregar", async () => {
  
  const chave = "procedi_pinned_profiles_undefined";
  localStorage.setItem(chave, JSON.stringify(["clin", "apagado"]));
  mockSetePerfis();
  const { container } = montar();
  await waitFor(() =>
    expect(nomesBarra(container)).toEqual(["Toda a equipe", "Profissional Clínico"]),
  );
  expect(JSON.parse(localStorage.getItem(chave))).toEqual(["clin"]);
  localStorage.removeItem(chave);
});

it("janela 'Todos os perfis de acesso': busca, Fixar todos / Desafixar todos, Ver ficha e Criar perfil", async () => {
  
  const chave = "procedi_pinned_profiles_undefined";
  localStorage.removeItem(chave);
  mockSetePerfis();
  const { container } = montar();
  await waitFor(() => expect(nomesBarra(container)).toContain("Secretaria-3"));
  fireEvent.click(screen.getByRole("button", { name: "Todos os perfis (7)" }));
  const janela = screen.getByRole("dialog", { name: "Todos os perfis de acesso" });
  const nomes = () =>
    [...janela.querySelectorAll(".modal-perfil-name")].map((n) => n.textContent);
  expect(nomes()).toEqual(ordem7);
  expect(janela.textContent).toContain("5 de 6 funções");
  fireEvent.change(screen.getByLabelText("Buscar perfil na lista completa"), {
    target: { value: "secretaria" },
  });
  expect(nomes()).toEqual(["Secretaria-1", "Secretaria-2", "Secretaria-3"]);
  fireEvent.change(screen.getByLabelText("Buscar perfil na lista completa"), {
    target: { value: "" },
  });
  fireEvent.click(within(janela).getByRole("button", { name: "Desafixar todos" }));
  expect(JSON.parse(localStorage.getItem(chave))).toEqual(["dono"]);
  expect(nomesBarra(container)).toEqual(["Toda a equipe", "Dono"]);
  fireEvent.click(within(janela).getByRole("button", { name: "Fixar todos" }));
  expect(JSON.parse(localStorage.getItem(chave))).toHaveLength(7);
  fireEvent.click(within(janela).getByRole("button", { name: "Ver ficha de Administrador" }));
  expect(screen.queryByRole("dialog", { name: "Todos os perfis de acesso" })).toBeNull();
  expect(container.querySelector(".pban")).toHaveTextContent("Administrador");
  fireEvent.click(screen.getByRole("button", { name: "Todos os perfis (7)" }));
  fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));
  expect(screen.getByText("Editor de perfis: 1")).toBeInTheDocument();
  localStorage.removeItem(chave);
});

it("janela 'Todos os perfis de acesso' não oferece Criar perfil sem canEditConfigPerfil", async () => {
  mocks.access.canEditConfigPerfil = false;
  mockSetePerfis();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Todos os perfis (7)" }));
  const janela = screen.getByRole("dialog", { name: "Todos os perfis de acesso" });
  expect(within(janela).getByRole("button", { name: "Pronto" })).toBeInTheDocument();
  expect(within(janela).queryByRole("button", { name: "Criar perfil" })).toBeNull();
});

it("cartão do Dono escolhido na barra: ligar 'Aparecer na agenda' faz PUT com apareceNaAgenda:true", async () => {
  mockOwnerAgendaCatalog();
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  const chipDono = [...container.querySelectorAll(".pcw button")].find((b) =>
    b.textContent.includes("Dono"),
  );
  fireEvent.click(chipDono);
  fireEvent.click(await screen.findByRole("button", { name: /Mais configurações/ }));
  const toggle = await screen.findByRole("switch", { name: "Aparecer na agenda" });
  await waitFor(() => expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("owner", {
      usuarioId: "owner-user",
      roleId: "dentista",
      apareceNaAgenda: true,
    }),
  );
});

// ---- Onda 3 (lista, folha e Atribuir perfil) ----
// Esperado escrito à mão. Catálogo no formato real; 4 funções contam (AGENDA_APARECER não).
const catalogoO3 = [
  { permissaoId: "f1", codigo: "PACIENTE_VER", nome: "Ver pacientes", moduloCodigo: "PACIENTES" },
  { permissaoId: "f2", codigo: "AGENDA_VER", nome: "Ver agenda", moduloCodigo: "AGENDA" },
  { permissaoId: "f3", codigo: "PRONTUARIO_VER", nome: "Ver prontuário", moduloCodigo: "PRONTUARIO" },
  { permissaoId: "f4", codigo: "USUARIO_VER", nome: "Ver usuários", moduloCodigo: "ACESSO" },
  { permissaoId: "f5", codigo: "AGENDA_APARECER", nome: "Aparecer na agenda", moduloCodigo: "AGENDA" },
];
const perfisO3 = [
  { id: "dono", codigo: "DONO", nome: "Dono" },
  { id: "ger", nome: "Gerente" }, // 3 funções, ninguém usa
  { id: "rec", nome: "Recepção" }, // 2 funções
  { id: "aux", nome: "Auxiliar" }, // 1 função
];
const permsO3 = { dono: ["f1", "f2", "f3", "f4"], ger: ["f1", "f2", "f3"], rec: ["f1", "f2"], aux: ["f1"] };
const equipeO3 = [
  { id: "owner", usuarioId: "u0", nomeCompleto: "Ana Dono", perfilAcessoId: "dono", perfilAcessoCodigo: "DONO", roleId: "r", roleName: "DENTISTA", ativo: true, apareceNaAgenda: false },
  { id: "bia", usuarioId: "u1", nomeCompleto: "Bia Recepção", perfilAcessoId: "rec", roleId: "r", roleName: "SECRETARIA", ativo: true, apareceNaAgenda: false },
  { id: "carla", usuarioId: "u2", nomeCompleto: "Carla Souza", roleId: "r", roleName: "SECRETARIA", ativo: true, apareceNaAgenda: false },
  { id: "davi", usuarioId: "u3", nomeCompleto: "Davi Lima", roleId: "r", roleName: "SECRETARIA", ativo: false, apareceNaAgenda: false },
  { id: "edu", usuarioId: "u4", nomeCompleto: "Eduardo Auxiliar", perfilAcessoId: "aux", roleId: "r", roleName: "AUXILIAR", ativo: true, apareceNaAgenda: false },
];
const respostaO3 = (url) => {
  const u = String(url);
  const ids = u.match(/\/perfis-acesso\/([^/]+)\/permissoes$/);
  if (ids) return permsO3[ids[1]] || [];
  if (u.endsWith("/api/v1/permissoes")) return catalogoO3;
  if (u.endsWith("/equipe")) return equipeO3;
  if (u.endsWith("/perfis-acesso")) return perfisO3;
  if (u.endsWith("/roles")) return [{ id: "r", nome: "DENTISTA" }];
  return [];
};
const montarO3 = async () => {
  fetch.mockImplementation(async (url) => ({ ok: true, json: async () => respostaO3(url) }));
  const r = montar();
  await screen.findByRole("button", { name: "Abrir ficha de Ana Dono" });
  // sinal positivo: as funções dos perfis chegaram (a ordem de hierarquia depende delas)
  await waitFor(() => expect(r.container.querySelector(".rail")).toHaveTextContent("3 de 4"));
  return r;
};
const nomesDasLinhas = () =>
  screen
    .getAllByRole("button", { name: /^Abrir ficha de / })
    .map((b) => b.getAttribute("aria-label").replace("Abrir ficha de ", ""));

it("Precisam de você: conta só ativa sem perfil, clicar filtra e não há aviso de convite", async () => {
  const { container } = await montarO3();
  const card = within(container.querySelector(".kpis")).getByRole("button", { name: /PRECISAM DE VOCÊ/ });
  expect(card.querySelector(".kpi-value")).toHaveTextContent("1"); // Carla; Davi é inativo
  expect(screen.queryByRole("button", { name: /convites pendentes/i })).not.toBeInTheDocument();
  expect(container.querySelector(".kpis")).toHaveAttribute("aria-label", "Filtros rápidos de status");
  fireEvent.click(card);
  expect(card).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Abrir ficha de Carla Souza" })).toBeInTheDocument();
  expect(nomesDasLinhas()).toEqual(["Carla Souza"]);
  expect(mocks.toast.info).not.toHaveBeenCalled();
});

it("Folha de filtros: nasce no body, a lista muda com ela aberta e a primeira opção é perfil em uso", async () => {
  const { container } = await montarO3();
  expect(nomesDasLinhas()).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
  const folha = screen.getByRole("dialog", { name: "Filtrar pessoas" });
  expect(container.contains(folha)).toBe(false);
  expect(folha.parentElement.parentElement).toBe(document.body);
  fireEvent.click(within(folha).getByRole("checkbox", { name: "Ativos" }));
  expect(screen.getByRole("dialog", { name: "Filtrar pessoas" })).toBeInTheDocument(); // continua aberta
  expect(nomesDasLinhas()).toHaveLength(4); // Davi (desativado) saiu
  const secao = within(folha).getByRole("region", { name: "Perfil de acesso" });
  const nomes = within(secao).getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"));
  expect(nomes[0]).toBe("Dono"); // em uso (Ana)
  expect(nomes.indexOf("Gerente")).toBeGreaterThan(nomes.indexOf("Auxiliar")); // ninguém usa: depois dos em uso
  expect(within(folha).getByText("3 de 4 funções")).toBeInTheDocument();
  expect(within(folha).getByRole("button", { name: "Ver 4 pessoas" })).toBeInTheDocument();
});

it("Folha de filtros: Esc fecha e devolve o foco ao botão Filtros; Tab fica preso dentro", async () => {
  await montarO3();
  const botao = screen.getByRole("button", { name: "Filtros" });
  fireEvent.click(botao);
  const folha = screen.getByRole("dialog", { name: "Filtrar pessoas" });
  const ultimo = within(folha).getByRole("button", { name: /^Ver \d+ pessoas$/ });
  ultimo.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(folha.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(ultimo); // voltou ao primeiro
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Filtrar pessoas" })).not.toBeInTheDocument();
  expect(document.activeElement).toBe(botao);
});

it("Ordem: padrão Hierarquia, cabeçalho com aria-sort e Nome (A–Z) reordena", async () => {
  const { container } = await montarO3();
  expect(screen.getByRole("button", { name: "Opções de ordenação" })).toHaveTextContent("Hierarquia");
  const cab = [...container.querySelectorAll(".lhd [role=columnheader]")].filter((h) => h.querySelector(".lhd-sort"));
  expect(cab.map((b) => b.textContent.replace(/[↑↓]/g, ""))).toEqual(["Pessoa e cargo", "Perfil de acesso", "Atendimentos"]);
  expect(cab.map((b) => b.getAttribute("aria-sort"))).toEqual(["none", "descending", "none"]);
  expect(container.querySelectorAll(".lhd-sort[aria-sort]")).toHaveLength(0); // aria-sort só no columnheader
  // Dono, Recepção, Auxiliar; sem perfil por último, pelo nome
  expect(nomesDasLinhas()).toEqual(["Ana Dono", "Bia Recepção", "Eduardo Auxiliar", "Carla Souza", "Davi Lima"]);
  fireEvent.click(screen.getByRole("button", { name: "Opções de ordenação" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Nome \(A–Z\)/ }));
  expect(nomesDasLinhas()).toEqual(["Ana Dono", "Bia Recepção", "Carla Souza", "Davi Lima", "Eduardo Auxiliar"]);
  expect(cab[0]).toHaveAttribute("aria-sort", "ascending");
  expect(cab[1]).toHaveAttribute("aria-sort", "none");
  fireEvent.click(cab[0].querySelector(".lhd-sort"));
  expect(nomesDasLinhas()).toEqual(["Eduardo Auxiliar", "Davi Lima", "Carla Souza", "Bia Recepção", "Ana Dono"]);
});

it("Atribuir perfil: só a pessoa ativa sem perfil tem o botão; a janela mostra o que muda e grava pelo salvar existente", async () => {
  await montarO3();
  const linha = (nome) => screen.getByRole("button", { name: `Abrir ficha de ${nome}` });
  expect(linha("Carla Souza")).toHaveClass("row-aviso");
  const botaoCarla = within(linha("Carla Souza").querySelector(".c-pf")).getByRole("button", { name: "Atribuir perfil" });
  expect(within(linha("Bia Recepção")).queryByRole("button", { name: "Atribuir perfil" })).not.toBeInTheDocument();
  expect(within(linha("Davi Lima")).queryByRole("button", { name: "Atribuir perfil" })).not.toBeInTheDocument(); // desativado
  fireEvent.click(botaoCarla);
  const janela = screen.getByRole("dialog", { name: /Atribuir perfil a Carla/ });
  expect(screen.queryByRole("heading", { name: "Carla Souza" })).not.toBeInTheDocument(); // não abriu a ficha
  fireEvent.click(within(janela).getByRole("radio", { name: /Gerente/ }));
  expect(within(janela).getByText("Passa a poder (3)")).toBeInTheDocument(); // f1, f2, f3
  expect(within(janela).getByText("O menu de Carla")).toBeInTheDocument();
  fireEvent.click(within(janela).getByRole("button", { name: "Atribuir perfil" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("carla", expect.objectContaining({ perfilAcessoId: "ger" })),
  );
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /Atribuir perfil a Carla/ })).not.toBeInTheDocument());
  expect(mocks.toast.success).toHaveBeenCalledWith("Acesso atualizado.");
  // Lacuna b: o corpo não leva os interruptores do Dono (undefined some no JSON).
  const corpo = JSON.parse(JSON.stringify(mocks.update.mock.calls[0][1]));
  expect(corpo.perfilAcessoId).toBe("ger");
  expect(corpo).not.toHaveProperty("apareceNaAgenda");
  expect(corpo).not.toHaveProperty("agendaMultiVer");
});

it("Atribuir perfil: sem permissão de gerenciar, a linha marcada não tem o botão", async () => {
  mocks.access = { ...mocks.access, canManageUsers: false };
  await montarO3();
  const carla = screen.getByRole("button", { name: "Abrir ficha de Carla Souza" });
  expect(carla).toHaveClass("row-aviso");
  expect(within(carla).queryByRole("button", { name: "Atribuir perfil" })).not.toBeInTheDocument();
});

it("Entrada animada só nos blocos de conteúdo, nunca no contêiner da área", async () => {
  const { container } = await montarO3();
  expect(container.querySelector(".prototype-equipe")).not.toHaveClass("animate-agenda-rise");
  expect(container.querySelector(".kpis .kpi").className).toMatch(/animate-agenda-rise/);
  expect(screen.getByRole("button", { name: "Abrir ficha de Ana Dono" }).className).toMatch(/animate-agenda-rise/);
});

it("Entrada animada: coluna .rail e barra .pchips entram com delay-150, o item .rit não, e ambas desligam em 1800 ms", async () => {
  vi.useFakeTimers(); // relógio falso desde a montagem; sem waitFor (ele não avança o relógio falso)
  try {
    fetch.mockImplementation(async (url) => ({ ok: true, json: async () => respostaO3(url) }));
    const { container } = montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); }); // só deixa as respostas chegarem, bem abaixo de 1800
    const alvos = () => [container.querySelector(".rail"), container.querySelector(".pchips")];
    for (const el of alvos()) {
      expect(el).not.toBeNull(); // sinal positivo
      expect(el).toHaveClass("animate-agenda-rise", "agenda-delay-150");
    }
    const rit = container.querySelector(".rail .rit");
    expect(rit).not.toBeNull();
    expect(rit.className).not.toMatch(/animate-agenda-rise/);
    act(() => { vi.advanceTimersByTime(1800); });
    for (const el of alvos()) expect(el).not.toHaveClass("animate-agenda-rise");
  } finally {
    vi.useRealTimers();
  }
});

it("perfil escolhido que não está fixado aparece na barra", async () => {
  const chave = "procedi_pinned_profiles_undefined";
  localStorage.setItem(chave, JSON.stringify(["clin"]));
  mockSetePerfis();
  const { container } = montar();
  await waitFor(() =>
    expect(nomesBarra(container)).toEqual(["Toda a equipe", "Profissional Clínico"]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Todos os perfis (7)" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver ficha de Administrador" }));
  expect(nomesBarra(container)).toEqual([
    "Toda a equipe",
    "Profissional Clínico",
    "Administrador",
  ]);
  localStorage.removeItem(chave);
});

it("Esc fecha a janela 'Todos os perfis de acesso' e o foco volta ao botão que abriu", async () => {
  mockSetePerfis();
  montar();
  const abrir = await screen.findByRole("button", { name: "Todos os perfis (7)" });
  abrir.focus();
  fireEvent.click(abrir);
  expect(screen.getByLabelText("Buscar perfil na lista completa")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Todos os perfis de acesso" })).toBeNull(),
  );
  expect(abrir).toHaveFocus();
});

it("janela 'Todos os perfis de acesso': Tab e Shift+Tab não saem da janela", async () => {
  mockSetePerfis();
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Todos os perfis (7)" }));
  const janela = screen.getByRole("dialog", { name: "Todos os perfis de acesso" });
  const itens = [...janela.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  expect(itens.length).toBeGreaterThan(2);
  itens[itens.length - 1].focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(itens[0]);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(itens[itens.length - 1]);
  expect(janela.contains(document.activeElement)).toBe(true);
});

it("css: a regra de 44 px da barra vem depois da regra base de 40 px", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/components/configuracoes/gestaoEquipe.css", "utf8").replace(/\r/g, "");
  const base = css.indexOf(".prototype-equipe .pchips button {\n  display");
  const toque = css.indexOf(
    "(pointer: coarse) {\n  .prototype-equipe .pchips button {\n    min-height: 44px;",
  );
  expect(base).toBeGreaterThan(0);
  expect(toque).toBeGreaterThan(base);
});

it("Ordem: 'Perfil de acesso (A–Z)' do menu marca a coluna Perfil de acesso como ascending e Hierarquia como descending", async () => {
  const { container } = await montarO3();
  const colunas = () => [...container.querySelectorAll(".lhd [role=columnheader]")].filter((h) => h.querySelector(".lhd-sort"));
  expect(colunas()[1]).toHaveAttribute("aria-sort", "descending"); // Hierarquia
  fireEvent.click(screen.getByRole("button", { name: "Opções de ordenação" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Perfil de acesso \(A–Z\)/ }));
  expect(colunas().map((h) => h.getAttribute("aria-sort"))).toEqual(["none", "ascending", "none"]);
  expect(colunas()[1].querySelector(".lhd-seta")).toHaveTextContent("↑");
  // A–Z pelo nome do perfil: sem perfil (vazio) primeiro, pelo nome; depois Auxiliar
  expect(nomesDasLinhas().slice(0, 3)).toEqual(["Carla Souza", "Davi Lima", "Eduardo Auxiliar"]);
});

it("Item 3 (onda 1): os rotulos .kpi-label dos cartoes existem (5) e nenhum tem classe truncate", async () => {
  const { container } = montar();
  await screen.findByRole("button", { name: "Ver Bruno Silva" });
  const rotulos = container.querySelectorAll(".kpis .kpi .kpi-label");
  expect(rotulos).toHaveLength(5); // sinal positivo
  rotulos.forEach((r) => {
    expect(r.classList.contains("truncate")).toBe(false);
    expect(r.className).toBe("kpi-label");
  });
});
