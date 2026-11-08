import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
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
  pacientesApi: {
    inativos: api.inativos,
    listInativos: api.inativos,
    list: api.list,
    get: api.get,
  },
  authHeadersForFetch: vi.fn(async () => ({ Authorization: "Bearer token" })),
  getApiErrorToastMessage: (error, fallback) => error.message || fallback,
  getOrgId: () => "test-org",
  setOrgId: () => {},
}));
vi.mock("./gestaoUsuariosUtils", () => ({
  formatCargoLabel: (c) => c,
  criarPerfilComPermissoes: vi.fn(async ({ nome, descricao, permissoes }) => ({
    id: "perfil-custom-123",
    nome,
    descricao,
    permissoes,
  })),
  atualizarPermissoesDoPerfil: vi.fn(async () => true),
}));
vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
beforeEach(() => {
  api.buscar.mockResolvedValue([]);
  api.atualizar.mockResolvedValue([]);
  api.update.mockResolvedValue({});
  api.get.mockResolvedValue({ usuarioId: "usuario-id", roleId: "dentista" });
  api.inativos.mockResolvedValue([]);
  api.list.mockResolvedValue([]);
});
vi.mock("./AuditoriaView", () => ({
  AuditoriaView: ({ roleUserId }) => <div>Histórico de {roleUserId}</div>,
}));
vi.mock("./UsuarioCadastroModal", () => ({
  default: ({ onSaved, onClose, onAlterarAcesso, isSelf, pessoa }) => (
    <div
      role="dialog"
      aria-label={isSelf ? "Cadastro do Usuário" : "Cadastro do Colaborador"}
    >
      <span data-testid="membro-nome">{pessoa?.nomeCompleto}</span>
      {onAlterarAcesso && (
        <button onClick={onAlterarAcesso}>Alterar Acesso &amp; Permissões</button>
      )}
      <button
        onClick={() =>
          onSaved({
            id: "usuario-id",
            nomeCompleto: "Bruno Atualizado",
            telefone: "11999999999",
            fotoUrl: "https://cdn.example/foto.webp",
            dataNascimento: "1990-02-03",
          })
        }
      >
        Salvar cadastro
      </button>
      <button onClick={onClose}>Fechar cadastro</button>
    </div>
  ),
}));
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
  perfil: {
    id: "clinico",
    nome: "Clínico",
    codigo: "CLINICO",
    organizacaoSaudeDonaId: "org",
  },
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
  canDeleteUsers: true,
  canSeeAgenda: true,
  canSeeConfigPerfil: true,
  canSeeConfigAuditoria: true,
  onSalvarAcesso: vi.fn(async () => {}),
  onDesativar: vi.fn(),
  onPeriodoChange: vi.fn(),
  agenda: [
    {
      id: "done",
      profissionalRoleUserId: "member",
      pacienteId: "pac1",
      pacienteNome: "Maria",
      dataAgendamento: "2026-10-05",
      horaInicio: "09:00:00",
      horaFim: "10:00:00",
      statusCodigo: "realizado",
      catalogoProcedimentoNome: "Avaliação",
    },
    {
      id: "other",
      profissionalRoleUserId: "other",
      pacienteId: "pac2",
      pacienteNome: "Outro profissional",
      dataAgendamento: "2026-10-05",
      statusCodigo: "realizado",
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("EquipePessoaView", () => {
  it("replica as seis abas e usa somente a agenda real da pessoa e realizado do backend", () => {
    render(<EquipePessoaView {...props} />);
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.queryByText("Outro profissional")).not.toBeInTheDocument();
    expect(screen.getByText("Atendimentos neste mês")).toBeInTheDocument();
    expect(screen.getByText("Pacientes atendidos")).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("1 já atendidos")).toBeInTheDocument();
    expect(screen.getByText("Próximos 7 dias")).toBeInTheDocument();
    expect(screen.queryByText("Horas atendidas")).not.toBeInTheDocument();
    expect(screen.queryByText("Comparecimento")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Atendimentos" }));
    expect(screen.getByText("Atendido")).toBeInTheDocument();
    expect(screen.getByText("60 min")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(props.onPeriodoChange).toHaveBeenCalledWith("3m");
    fireEvent.click(screen.getByRole("tab", { name: "Pacientes" }));
    expect(screen.getByText("Maria")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByText("Histórico de member")).toBeInTheDocument();
  });
  it("respeita apareceNaAgenda=false sem inventar agenda ou números", () => {
    render(
      <EquipePessoaView
        {...props}
        pessoa={{ ...pessoa, apareceNaAgenda: false }}
      />,
    );
    expect(screen.getByText("Bruno não atende pacientes")).toBeInTheDocument();
    expect(
      screen.queryByText("Atendimentos neste mês"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(screen.getByText("Bruno não atende pacientes")).toBeInTheDocument();
  });
  it("salva cargo e perfil independentemente somente após confirmação explícita", async () => {
    render(<EquipePessoaView {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Acesso" }));
    const profile = screen.getByRole("combobox", { name: /Perfil/i });
    expect(profile.querySelector('option[value="dono"]')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Cargo/i), {
      target: { value: "recepcao" },
    });
    expect(profile).toHaveValue("clinico");
    expect(props.onSalvarAcesso).not.toHaveBeenCalled();
    fireEvent.change(profile, { target: { value: "recepcao" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar acesso" }));
    await waitFor(() =>
      expect(props.onSalvarAcesso).toHaveBeenCalledWith(pessoa, {
        roleId: "recepcao",
        perfilAcessoId: "recepcao",
      }),
    );
    expect(pessoa.perfilAcessoId).toBe("clinico");
    fireEvent.click(screen.getByRole("button", { name: "Inativar colaborador" }));
    fireEvent.change(screen.getByLabelText(/Sua senha/i), {
      target: { value: "senha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Desativar Bruno" }));
    await waitFor(() => {
      expect(props.onDesativar).toHaveBeenCalledWith(pessoa);
    });
  });
  it("protege o dono e respeita as permissões para desativação e histórico", () => {
    render(
      <EquipePessoaView
        {...props}
        perfil={{ id: "dono", codigo: "DONO", nome: "Dono" }}
        pessoa={{ ...pessoa, perfilAcessoId: "dono" }}
        canSeeConfigAuditoria={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Mudar acesso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inativar colaborador" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Acesso" }));
    expect(screen.getByText("fixo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar acesso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar Bruno" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(
      screen.getByText("Você não tem permissão para consultar o histórico."),
    ).toBeInTheDocument();
  });
  it("oculta números ao falhar o carregamento e não expõe consulta sem permissão", () => {
    const { rerender } = render(
      <EquipePessoaView {...props} agendaError="Agenda indisponível" />,
    );
    expect(screen.getAllByText("Agenda indisponível")).toHaveLength(3);
    expect(screen.queryByText("Maria")).not.toBeInTheDocument();
    rerender(<EquipePessoaView {...props} canSeeAgenda={false} />);
    expect(
      screen.queryByRole("button", { name: "Agendar com Bruno" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Maria")).not.toBeInTheDocument();
  });
});

it("não confunde erro de permissões com acesso vazio", () => {
  render(
    <EquipePessoaView
      {...props}
      permissoesError="Não foi possível carregar funções"
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.queryByRole("button", {
    name: "Expandir configurações da agenda",
  });
  if (trigger) fireEvent.click(trigger);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível carregar funções",
  );
  expect(screen.queryByText("Sem acesso")).not.toBeInTheDocument();
});

it("botão de cadastro aparece para quem tem permissão de equipe ou é o próprio membro", () => {
  const view = render(<EquipePessoaView {...props} isSelf={false} canManageUsers={false} />);
  expect(
    screen.queryByRole("button", { name: "Abrir cadastro do usuário" }),
  ).not.toBeInTheDocument();

  // Gestor visualizando colaborador abre modal como Cadastro do Colaborador
  view.rerender(<EquipePessoaView {...props} isSelf={false} canManageUsers />);
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Cadastro do Colaborador" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("membro-nome")).toHaveTextContent("Bruno Silva");

  // Membro visualizando o próprio perfil abre como Cadastro do Usuário
  view.rerender(<EquipePessoaView {...props} isSelf canManageUsers={false} />);
  expect(
    screen.getByRole("dialog", { name: "Cadastro do Usuário" }),
  ).toBeInTheDocument();
});
it("salvamento atualiza hero e contato sem trocar a identidade do membro", () => {
  const onPerfilAtualizado = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      isSelf
      onPerfilAtualizado={onPerfilAtualizado}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
  expect(
    screen.getByRole("heading", { name: "Bruno Atualizado" }),
  ).toBeInTheDocument();
  expect(screen.getByText("11999999999")).toBeInTheDocument();
  expect(screen.getByText("🎂 Aniversário 03/02")).toBeInTheDocument();
  expect(screen.getByText("Maria")).toBeInTheDocument();
  expect(onPerfilAtualizado).toHaveBeenCalledWith(
    expect.objectContaining({
      nomeCompleto: "Bruno Atualizado",
      fotoUrl: "https://cdn.example/foto.webp",
    }),
  );
  expect(onPerfilAtualizado.mock.calls[0][0]).not.toHaveProperty("id");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("troca de pessoa encerra o modal de cadastro aberto", () => {
  const view = render(<EquipePessoaView {...props} isSelf />);
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(
    <EquipePessoaView
      {...props}
      pessoa={{ ...pessoa, id: "other", nomeCompleto: "Outro Membro" }}
      isSelf={false}
      canManageUsers={false}
    />,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Abrir cadastro do usuário" }),
  ).not.toBeInTheDocument();
});

it("Dono sintetiza todas as funções operacionais e módulos mesmo sem IDs de perfil", async () => {
  render(
    <EquipePessoaView
      {...props}
      isSelf
      perfil={{ codigo: "DONO", nome: "Dono" }}
      permissoes={fixtures.catalog}
      permissoesPerfil={[]}
    />,
  );
  const total = fixtures.catalog.filter(
    (p) => !["AGENDA_APARECER", "AGENDA_MULTI_VER"].includes(p.codigo),
  ).length;
  expect(screen.getByText(`${total} de ${total} funções`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.queryByRole("button", {
    name: "Expandir configurações da agenda",
  });
  if (trigger) fireEvent.click(trigger);
  expect(document.querySelectorAll(".lvrow")).toHaveLength(9);
  expect(
    screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
  ).toHaveAttribute("aria-checked", "false");
  await waitFor(() => expect(api.buscar).toHaveBeenCalled());
});
it("horários reais incluem domingo, múltiplos turnos e ignoram intervalos inativos", async () => {
  api.buscar.mockResolvedValue([
    { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00", ativo: true },
    { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
    { diaSemana: 0, horaInicio: "09:00", horaFim: "11:00" },
    { diaSemana: 2, horaInicio: "01:00", horaFim: "02:00", ativo: false },
  ]);
  render(<EquipePessoaView {...props} />);
  const firstTurn = await screen.findByText("08:00 - 12:00");
  expect(firstTurn).toHaveClass("week-pill");
  expect(firstTurn.parentElement).toHaveClass("week-turns-row");
  expect(firstTurn.parentElement).toHaveTextContent("08:00 - 12:00 · 14:00 - 18:00");
  expect(firstTurn.parentElement.querySelectorAll(".week-pill")).toHaveLength(2);
  expect(screen.getByText("14:00 - 18:00")).toHaveClass("week-pill");
  expect(screen.getByText("09:00 - 11:00")).toBeInTheDocument();
  expect(screen.getByText("Terça a Sábado:")).toBeInTheDocument();
  expect(screen.getByText("2 turnos")).toBeInTheDocument();
});
it("salvar modal revalida horários sem reload e notifica disponibilidade", async () => {
  api.buscar
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce({ seguirHorarioClinica: true, turnos: [], gradeClinica: [] })
    .mockResolvedValue([
      { diaSemana: 3, horaInicio: "10:00", horaFim: "16:00" },
    ]);
  const onDisponibilidadeInvalidate = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      canManageDisponibilidade
      onDisponibilidadeInvalidate={onDisponibilidadeInvalidate}
    />,
  );
  await waitFor(() => expect(api.buscar).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "editar", exact: true }));
  await screen.findByRole("button", { name: "Salvar", exact: true });
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  expect(await screen.findByText("10:00 - 16:00")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onDisponibilidadeInvalidate).toHaveBeenCalledWith({
    scope: "role",
    roleUserId: "member",
  });
});
it("falha de horários exibe erro e retry em vez de sugerir folgas", async () => {
  api.buscar.mockRejectedValueOnce(new Error("Horários indisponíveis"));
  render(<EquipePessoaView {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Horários indisponíveis",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() =>
    expect(document.querySelector(".week-groups")).toBeInTheDocument(),
  );
});
it("pacientes atendidos usam botão nativo acessível e repassam ID e CPF", async () => {
  const onSelectPatient = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      agenda={[{ ...props.agenda[0], pacienteCpf: "12345678901" }]}
      onSelectPatient={onSelectPatient}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
  const button = screen.getByRole("button", {
    name: "Abrir histórico de Maria",
  });
  expect(button.tagName).toBe("BUTTON");
  fireEvent.click(button);
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.keyDown(button, { key: " " });
  expect(onSelectPatient).toHaveBeenCalledTimes(3);
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({ id: "pac1", cpf: "12345678901" }),
  );
  await waitFor(() => expect(api.buscar).toHaveBeenCalled());
});
it("aba pacientes oculta pacientes inativos por padrão e permite alternar com o pill Incluir inativados", async () => {
  const onSelectPatient = vi.fn();
  const agendaComInativo = [
    {
      id: "ag-ativo",
      profissionalRoleUserId: "member",
      pacienteId: "pac-ativo",
      pacienteNome: "Carlos Ativo",
      pacienteAtivo: true,
      dataAgendamento: "2026-10-05",
      horaInicio: "09:00:00",
      statusCodigo: "realizado",
    },
    {
      id: "ag-inativo",
      profissionalRoleUserId: "member",
      pacienteId: "pac-inativo",
      pacienteNome: "André Inativo",
      pacienteAtivo: false,
      dataAgendamento: "2026-10-04",
      horaInicio: "10:00:00",
      statusCodigo: "realizado",
    },
  ];
  render(
    <EquipePessoaView
      {...props}
      agenda={agendaComInativo}
      onSelectPatient={onSelectPatient}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));

  // Por padrão, mostra apenas o ativo
  expect(screen.getByText("Carlos Ativo")).toBeInTheDocument();
  expect(screen.queryByText("André Inativo")).not.toBeInTheDocument();

  // Abre o popover de filtros
  const btnFiltros = screen.getByRole("button", { name: /Filtros de pacientes/i });
  expect(btnFiltros).toBeInTheDocument();
  fireEvent.click(btnFiltros);

  // No popover de status, clica em "Todos"
  const btnTodos = screen.getAllByRole("button", { name: "Todos" })[0];
  fireEvent.click(btnTodos);

  // Agora ambos devem estar visíveis e o inativo deve ter o badge INATIVO
  expect(screen.getByText("Carlos Ativo")).toBeInTheDocument();
  expect(screen.getByText("André Inativo")).toBeInTheDocument();
  expect(screen.getByText("INATIVO")).toBeInTheDocument();

  // Testa busca em tempo real por nome: digita "André" e encontra o inativo diretamente
  const inputBusca = screen.getByLabelText("Buscar paciente por nome");
  fireEvent.change(inputBusca, { target: { value: "André" } });
  expect(screen.getByText("André Inativo")).toBeInTheDocument();
  expect(screen.queryByText("Carlos Ativo")).not.toBeInTheDocument();

  // Ao clicar no inativo, onSelectPatient é chamado com dados do paciente inativo
  const btnInativo = screen.getByRole("button", { name: "Abrir histórico de André Inativo" });
  fireEvent.click(btnInativo);
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({ id: "pac-inativo", name: "André Inativo", ativo: false })
  );
});
it("quando todos os pacientes atendidos forem inativos, exibe estado vazio informativo e botão para ver inativados", async () => {
  const agendaApenasInativo = [
    {
      id: "ag-inativo-1",
      profissionalRoleUserId: "member",
      pacienteId: "pac-andre",
      pacienteNome: "André Almeida Ribeiro",
      pacienteAtivo: false,
      dataAgendamento: "2026-10-29",
      horaInicio: "10:00:00",
      statusCodigo: "realizado",
    },
  ];
  render(
    <EquipePessoaView
      {...props}
      agenda={agendaApenasInativo}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));

  // Deve exibir o cabeçalho com 0 ativos · 1 inativo
  expect(screen.getByText("0 ativos · 1 inativo")).toBeInTheDocument();

  // No modo padrão (Apenas ativos), exibe o empty state informativo com botão
  expect(screen.getByText(/Nenhum paciente ativo no período carregado \(1 paciente inativado oculto\)/i)).toBeInTheDocument();
  const btnVerInativado = screen.getByRole("button", { name: /Ver inativado \(\+1\)/i });
  expect(btnVerInativado).toBeInTheDocument();

  // Ao clicar no botão, alterna para ver inativados
  fireEvent.click(btnVerInativado);

  // Agora o card do André aparece com o badge INATIVO e a legenda
  expect(screen.getByText("André Almeida Ribeiro")).toBeInTheDocument();
  expect(screen.getByText("INATIVO")).toBeInTheDocument();
  expect(screen.getByText(/Cadastro inativado/i)).toBeInTheDocument();
});
it("identifica paciente inativo via pacientesApi.inativos mesmo quando agenda não traz pacienteAtivo", async () => {
  api.inativos.mockResolvedValueOnce([
    { id: "pac-inativo-api", nome: "Paciente Inativo da API" },
  ]);
  const agendaSemFlag = [
    {
      id: "ag-sem-flag",
      profissionalRoleUserId: "member",
      pacienteId: "pac-inativo-api",
      pacienteNome: "Paciente Inativo da API",
      pacienteAtivo: undefined, // Simula backend sem restart que não devolveu pacienteAtivo
      dataAgendamento: "2026-10-29",
      horaInicio: "11:00:00",
      statusCodigo: "realizado",
    },
  ];
  render(
    <EquipePessoaView
      {...props}
      agenda={agendaSemFlag}
    />,
  );

  // Aguarda resolução da chamada a pacientesApi.inativos
  await waitFor(() => expect(api.inativos).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));

  // Como o ID está no set de inativos, ele foi identificado como inativo mesmo com pacienteAtivo=undefined
  expect(screen.getByText(/Nenhum paciente ativo no período carregado \(1 paciente inativado oculto\)/i)).toBeInTheDocument();
  const btnVer = screen.getByRole("button", { name: /Ver inativado \(\+1\)/i });
  fireEvent.click(btnVer);

  expect(screen.getByText("Paciente Inativo da API")).toBeInTheDocument();
  expect(screen.getByText("INATIVO")).toBeInTheDocument();
});
it("Dono persiste opções com vínculo existente, estado confirmado e callbacks", async () => {
  const onPerfilAtualizado = vi.fn(),
    onEquipeInvalidate = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      isSelf
      perfil={{ codigo: "DONO" }}
      onPerfilAtualizado={onPerfilAtualizado}
      onEquipeInvalidate={onEquipeInvalidate}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.queryByRole("button", {
    name: "Expandir configurações da agenda",
  });
  if (trigger) fireEvent.click(trigger);
  fireEvent.click(
    screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
  );
  await waitFor(() =>
    expect(api.update).toHaveBeenCalledWith("member", {
      usuarioId: "usuario-id",
      roleId: "dentista",
      agendaMultiVer: true,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
    ).toHaveAttribute("aria-checked", "true"),
  );
  expect(onPerfilAtualizado).toHaveBeenCalledWith({ agendaMultiVer: true });
  expect(onEquipeInvalidate).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: "Aparecer na agenda" }));
  await waitFor(() =>
    expect(onPerfilAtualizado).toHaveBeenCalledWith({ apareceNaAgenda: false }),
  );
});
it("erro de persistência mantém opções anteriores e terceiros não alteram o Dono", async () => {
  api.update.mockRejectedValueOnce(new Error("Falha ao salvar opção"));
  const view = render(
    <EquipePessoaView {...props} isSelf perfil={{ codigo: "DONO" }} />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.queryByRole("button", {
    name: "Expandir configurações da agenda",
  });
  if (trigger) fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("switch", { name: "Aparecer na agenda" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Falha ao salvar opção",
  );
  expect(
    screen.getByRole("switch", { name: "Aparecer na agenda" }),
  ).toHaveAttribute("aria-checked", "true");
  view.rerender(
    <EquipePessoaView {...props} isSelf={false} perfil={{ codigo: "DONO" }} />,
  );
  expect(
    screen.getByRole("switch", { name: "Aparecer na agenda" }),
  ).toBeDisabled();
});

it("troca de clínica descarta horários antigos e cancela a consulta", async () => {
  let finish;
  api.buscar.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<EquipePessoaView {...props} orgId="org-a" />);
  const oldSignal = api.buscar.mock.calls[0][1].signal;
  api.buscar.mockResolvedValue([
    { diaSemana: 2, horaInicio: "11:00", horaFim: "13:00" },
  ]);
  view.rerender(<EquipePessoaView {...props} orgId="org-b" />);
  expect(oldSignal.aborted).toBe(true);
  await screen.findByText("11:00 - 13:00");
  finish([{ diaSemana: 1, horaInicio: "01:00", horaFim: "02:00" }]);
  await waitFor(() =>
    expect(screen.queryByText("01:00 - 02:00")).not.toBeInTheDocument(),
  );
});
it("gravação pendente bloqueia switches e não atualiza outra clínica ao concluir", async () => {
  let finish;
  api.update.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onPerfilAtualizado = vi.fn();
  const view = render(
    <EquipePessoaView
      {...props}
      orgId="org-a"
      isSelf
      perfil={{ codigo: "DONO" }}
      onPerfilAtualizado={onPerfilAtualizado}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.queryByRole("button", {
    name: "Expandir configurações da agenda",
  });
  if (trigger) fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("switch", { name: "Aparecer na agenda" }));
  await waitFor(() => expect(api.update).toHaveBeenCalled());
  expect(
    screen.getByRole("switch", { name: "Ver múltiplas agendas" }),
  ).toBeDisabled();
  view.rerender(
    <EquipePessoaView
      {...props}
      orgId="org-b"
      isSelf
      perfil={{ codigo: "DONO" }}
      onPerfilAtualizado={onPerfilAtualizado}
    />,
  );
  finish({});
  await waitFor(() => expect(onPerfilAtualizado).not.toHaveBeenCalled());
});

it("RNFs iniciam recolhidos, expandem abaixo de Agenda e não ficam no menu", async () => {
  render(
    <EquipePessoaView
      {...props}
      isSelf
      perfil={{ codigo: "DONO" }}
      permissoes={fixtures.catalog}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  const trigger = screen.getByRole("button", {
    name: "Expandir configurações da agenda",
  });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  expect(screen.queryByText("Opções da agenda")).not.toBeInTheDocument();
  expect(trigger.closest(".lvrow")).toHaveTextContent("Agenda");
  expect(trigger.previousElementSibling).toHaveClass("lvrow-name");
  expect(trigger.nextElementSibling).toHaveClass("l");
  document.querySelectorAll(".lvrow").forEach((row) => {
    expect(row.lastElementChild).toHaveClass("l");
  });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const options = document.getElementById(
    trigger.getAttribute("aria-controls"),
  );
  expect(options).toHaveClass("owner-agenda-inline-accordion");
  expect(options.parentElement.querySelector(".lvrow")).toContainElement(
    trigger,
  );
  const accMenu = document.querySelector(".acesso-side-column, .acesso-tree-container, .acc");
  if (accMenu) {
    expect(accMenu).not.toContainElement(options);
  }
  expect(
    screen.getByRole("switch", { name: "Aparecer na agenda" }),
  ).toBeInTheDocument();
  const row = trigger.closest(".lvrow");
  expect(row).toHaveAttribute("role", "button");
  expect(row).toHaveAttribute("tabindex", "0");
  expect(row).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(row);
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  fireEvent.keyDown(row, { key: "Enter" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(row, { key: " " });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(trigger);
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  await waitFor(() => expect(api.buscar).toHaveBeenCalled());
});
it("perfis comuns não exibem chevron nem RNFs", async () => {
  render(<EquipePessoaView {...props} isSelf />);
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));
  expect(
    screen.queryByRole("button", { name: "Expandir configurações da agenda" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  await waitFor(() => expect(api.buscar).toHaveBeenCalled());
});


it("consolida a rotina de Terça a Sexta e mantém a exceção de Segunda", async () => {
  api.buscar.mockResolvedValue([
    { diaSemana: 1, horaInicio: "13:00", horaFim: "19:00" },
    { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00" },
    ...[2, 3, 4, 5].map((diaSemana) => ({
      diaSemana, horaInicio: "08:00", horaFim: "18:00",
    })),
  ]);
  render(<EquipePessoaView {...props} />);
  const routine = (await screen.findByText("Terça a Sexta")).closest(".week-group-row");
  expect(within(routine).getByText("08:00 - 18:00")).toBeInTheDocument();
  expect(screen.getAllByText("08:00 - 18:00")).toHaveLength(1);
  expect(document.querySelectorAll(".week-group-row")).toHaveLength(2);
  const monday = screen.getByText("Segunda").closest(".week-group-row");
  expect(monday).toHaveClass("highlighted");
  expect(monday).toHaveTextContent("2 turnos");
  expect(monday).toHaveTextContent("08:00 - 12:00 · 13:00 - 19:00");
  expect(screen.getByText("Sábado e Domingo:")).toBeInTheDocument();
});

it("não une dias separados por folga ou por uma rotina diferente", async () => {
  api.buscar.mockResolvedValue([
    ...[1, 3, 5].map((diaSemana) => ({ diaSemana, horaInicio: "08:00", horaFim: "18:00" })),
    { diaSemana: 4, horaInicio: "08:00", horaFim: "17:00" },
  ]);
  render(<EquipePessoaView {...props} />);
  await screen.findByText("Quinta");
  expect(document.querySelectorAll(".week-group-row")).toHaveLength(4);
  expect(screen.getAllByText("08:00 - 18:00")).toHaveLength(3);
  expect(screen.getByText("Terça, Sábado e Domingo:")).toBeInTheDocument();
});

it("compara todos os turnos ordenados ao consolidar dias consecutivos", async () => {
  api.buscar.mockResolvedValue([
    { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
    { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00" },
    { diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" },
    { diaSemana: 2, horaInicio: "14:00:00", horaFim: "18:00:00" },
    { diaSemana: 3, horaInicio: "08:00", horaFim: "12:00" },
    { diaSemana: 3, horaInicio: "14:00", horaFim: "19:00" },
  ]);
  render(<EquipePessoaView {...props} />);
  const group = (await screen.findByText("Segunda e Terça")).closest(".week-group-row");
  expect(group).toHaveTextContent("2 turnos");
  expect(group).toHaveTextContent("08:00 - 12:00 · 14:00 - 18:00");
  expect(document.querySelectorAll(".week-group-row")).toHaveLength(2);
  expect(screen.getByText("14:00 - 19:00")).toBeInTheDocument();
});

it("omite folgas quando há atendimento em todos os dias, inclusive Domingo", async () => {
  api.buscar.mockResolvedValue(Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana, horaInicio: "08:00", horaFim: "18:00",
  })));
  render(<EquipePessoaView {...props} />);
  await screen.findByText("Segunda a Domingo");
  expect(document.querySelectorAll(".week-group-row")).toHaveLength(1);
  expect(document.querySelector(".week-off-row")).toBeNull();
});

it("exibe todos os dias de folga quando não há horários ativos", async () => {
  api.buscar.mockResolvedValue([
    { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: false },
  ]);
  render(<EquipePessoaView {...props} />);
  await screen.findByText("Todos os dias:");
  expect(screen.getByText("Folga")).toBeInTheDocument();
  expect(document.querySelectorAll(".week-group-row")).toHaveLength(0);
});

it("exibe botão editar quando canManageDisponibilidade=true sem depender de tipoOrg e abre modal", async () => {
  const { tipoOrg: _omit, ...propsSemTipo } = props;
  render(<EquipePessoaView {...propsSemTipo} canManageDisponibilidade />);
  const btnEditar = await screen.findByRole("button", { name: /^editar$/i });
  expect(btnEditar).toBeInTheDocument();
  expect(screen.queryByText(/Modo Autônomo/)).not.toBeInTheDocument();
  fireEvent.click(btnEditar);
  expect(await screen.findByRole("dialog", { name: "Disponibilidade do profissional" })).toBeInTheDocument();
});

it("oculta botão editar quando canManageDisponibilidade=false", async () => {
  render(<EquipePessoaView {...props} canManageDisponibilidade={false} />);
  expect(await screen.findByText("Horário de atendimento")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
});

it("renderiza gradeClinica quando o envelope indica seguirHorarioClinica=true", async () => {
  api.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: true,
    turnos: [],
    gradeClinica: [{ diaSemana: 1, horaInicio: "08:00", horaFim: "17:00", ativo: true }],
  });
  render(<EquipePessoaView {...props} />);
  expect(await screen.findByText("08:00 - 17:00")).toBeInTheDocument();
});

it("aba atendimentos renderiza botão clicável para o paciente e chama onSelectPatient", async () => {
  const onSelectPatient = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      agenda={[
        {
          id: "done-1",
          profissionalRoleUserId: "member",
          pacienteId: "pac-atend-1",
          pacienteNome: "Carlos Alberto",
          pacienteCpf: "98765432100",
          pacienteFotoUrl: "https://foto.example/carlos.jpg",
          dataAgendamento: "2026-10-05",
          horaInicio: "10:00:00",
          horaFim: "10:30:00",
          statusCodigo: "REALIZADO",
          duracaoMinutos: 30,
        },
      ]}
      onSelectPatient={onSelectPatient}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Atendimentos", exact: true }));
  const patientButton = screen.getByRole("button", {
    name: "Abrir histórico de Carlos Alberto",
  });
  expect(patientButton).toBeInTheDocument();
  fireEvent.click(patientButton);
  expect(onSelectPatient).toHaveBeenCalledTimes(1);
  expect(onSelectPatient).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "pac-atend-1",
      name: "Carlos Alberto",
      photo: "https://foto.example/carlos.jpg",
      cpf: "98765432100",
    }),
  );
});

it("aba acesso renderiza layout limpo em coluna única com Cargo e Perfil e sem cards laterais redundantes", () => {
  render(<EquipePessoaView {...props} />);
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Cards principais presentes
  expect(screen.getByText("Cargo na Clínica")).toBeInTheDocument();
  expect(screen.getByText("Perfil e Níveis de Acesso")).toBeInTheDocument();

  // Coluna lateral com prévias redundantes não deve existir
  expect(document.querySelector(".acesso-side-column")).not.toBeInTheDocument();
  expect(document.querySelector(".acesso-tree-container")).not.toBeInTheDocument();
});

it("modal de inativação exige senha e pode ser cancelado ou confirmado com motivo opcional", async () => {
  render(<EquipePessoaView {...props} />);

  // Clica no botão de inativação no Hero
  const inativarHero = screen.getByRole("button", {
    name: "Inativar colaborador",
  });
  fireEvent.click(inativarHero);

  // Modal é aberto
  expect(screen.getByText("Inativar colaborador?")).toBeInTheDocument();
  expect(
    screen.getByText(/permanecem salvos e preservados/i),
  ).toBeInTheDocument();

  // Tenta confirmar sem senha e valida mensagem de erro
  fireEvent.click(screen.getByRole("button", { name: "Desativar Bruno" }));
  expect(
    screen.getByText("Informe sua senha para confirmar a inativação."),
  ).toBeInTheDocument();
  expect(props.onDesativar).not.toHaveBeenCalled();

  // Clica em Cancelar
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByText("Inativar colaborador?")).not.toBeInTheDocument();
  expect(props.onDesativar).not.toHaveBeenCalled();

  // Abre novamente, digita senha e motivo
  fireEvent.click(inativarHero);
  const senhaInput = screen.getByLabelText(/Sua senha/i);
  fireEvent.change(senhaInput, { target: { value: "senha123" } });
  const motivoInput = screen.getByPlaceholderText(/desligamento, licença médica/i);
  fireEvent.change(motivoInput, { target: { value: "Fim do contrato temporário" } });

  // Confirma a inativação
  fireEvent.click(screen.getByRole("button", { name: "Desativar Bruno" }));
  await waitFor(() => {
    expect(props.onDesativar).toHaveBeenCalledWith(
      expect.objectContaining({ id: "member" }),
      "Fim do contrato temporário",
    );
  });
});

it("Hero não exibe botão avulso Mudar acesso e centraliza acesso pelo Card 3 do Cadastro e aba Acesso", async () => {
  const scrollIntoViewMock = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  render(<EquipePessoaView {...props} />);

  // Botão avulso Mudar acesso não existe no Hero
  expect(screen.queryByRole("button", { name: "Mudar acesso" })).not.toBeInTheDocument();

  // Abre o modal de Cadastro pelo Hero
  fireEvent.click(screen.getByRole("button", { name: "Abrir cadastro do usuário" }));
  expect(screen.getByRole("dialog", { name: "Cadastro do Colaborador" })).toBeInTheDocument();

  // Clica no botão Alterar Acesso & Permissões dentro do modal de Cadastro
  fireEvent.click(screen.getByRole("button", { name: "Alterar Acesso & Permissões" }));

  // Modal de Cadastro é fechado e aba Acesso é selecionada
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Acesso" })).toHaveAttribute("aria-selected", "true");

  // Rola suavemente até a barra de abas
  await waitFor(() => {
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});

it("aba Acesso separa Card 1 de Cargo e Card 2 de Perfil com Matriz Canônica de módulos", async () => {
  render(<EquipePessoaView {...props} permissoes={fixtures.catalog} permissoesPerfil={["p1", "p2"]} />);
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Card 1: Cargo na Clínica
  expect(screen.getByText("Cargo na Clínica")).toBeInTheDocument();
  const selectCargo = screen.getByLabelText(/Função \/ Cargo/i);
  expect(selectCargo).toBeInTheDocument();

  // Altera o cargo e verifica o botão "Salvar cargo"
  fireEvent.change(selectCargo, { target: { value: "recepcao" } });
  const btnSalvarCargo = screen.getByRole("button", { name: "Salvar cargo" });
  expect(btnSalvarCargo).toBeInTheDocument();
  fireEvent.click(btnSalvarCargo);
  await waitFor(() => {
    expect(props.onSalvarAcesso).toHaveBeenCalledWith(
      expect.objectContaining({ id: "member" }),
      { roleId: "recepcao", perfilAcessoId: "clinico" }
    );
  });

  // Card 2: Perfil e Níveis de Acesso com Matriz Canônica
  expect(screen.getByText("Perfil e Níveis de Acesso")).toBeInTheDocument();
  const matrixGrid = screen.getByRole("group", { name: "Módulos do perfil" });
  expect(matrixGrid).toBeInTheDocument();

  // Expande o módulo Agenda na matriz
  const chipAgenda = within(matrixGrid).getByRole("button", { name: /^Agenda/i });
  fireEvent.click(chipAgenda);
  expect(screen.getByRole("region", { name: /Funções de Agenda/i })).toBeInTheDocument();
  // Controle de nível canônico fica exclusivamente no cabeçalho do módulo
  expect(within(matrixGrid).getByRole("group", { name: /Nível em Agenda/i })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: /Funções de Agenda/i })).queryByText("Ações rápidas:")).not.toBeInTheDocument();
});

it("aba Acesso renderiza card rico do perfil (Modelo 1) com botão Alterar perfil e dropdown flutuante", async () => {
  render(<EquipePessoaView {...props} permissoes={fixtures.catalog} permissoesPerfil={["p1", "p2"]} />);
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Card rico do perfil selecionado com botão Alterar perfil
  const btnAlterar = screen.getByRole("button", { name: /Alterar perfil/i });
  expect(btnAlterar).toBeInTheDocument();
  expect(btnAlterar).toHaveAttribute("aria-expanded", "false");

  // Abre dropdown flutuante
  fireEvent.click(btnAlterar);
  expect(btnAlterar).toHaveAttribute("aria-expanded", "true");
  const listbox = screen.getByRole("listbox", { name: "Perfis Disponíveis" });
  expect(listbox).toBeInTheDocument();

  // Seleciona perfil 'Recepção' no dropdown customizado
  const opcaoRecepcao = within(listbox).getByText(/Recepção/i);
  fireEvent.click(opcaoRecepcao);

  // Dropdown fecha
  expect(btnAlterar).toHaveAttribute("aria-expanded", "false");
});

it("nome amigável completo preserva honorífico para médicos", () => {
  render(
    <EquipePessoaView
      {...props}
      pessoa={{ ...pessoa, nomeCompleto: "Dra. Amanda Silva" }}
    />
  );
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
  expect(screen.getByText(/Pacientes que Dra\. Amanda atendeu/i)).toBeInTheDocument();
});

it("ao customizar permissões na matriz e clicar em Salvar Acesso, abre modal de decisão via portal", async () => {
  const onPerfilCriado = vi.fn();
  render(
    <EquipePessoaView
      {...props}
      permissoes={fixtures.catalog}
      permissoesPerfil={["p1", "p2"]}
      onPerfilCriado={onPerfilCriado}
    />
  );
  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Expande um módulo e altera permissões para criar customização
  const matrixGroup = screen.getByRole("group", { name: "Módulos do perfil" });
  const chipAgenda = within(matrixGroup).getByRole("button", { name: /^Agenda/i });
  fireEvent.click(chipAgenda);

  // Clica em uma das ações rápidas de nível (ex: Tudo do primeiro módulo)
  const btnTudo = screen.getAllByRole("button", { name: "Tudo" })[0];
  fireEvent.click(btnTudo);

  // Banner de customização deve aparecer com botão Restaurar
  expect(screen.getByText(/Você está personalizando as permissões deste colaborador/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();

  // Clica em Salvar acesso
  const btnSalvarAcesso = screen.getByRole("button", { name: "Salvar acesso" });
  fireEvent.click(btnSalvarAcesso);

  // Modal de Decisão abre via portal
  const modalDecisao = screen.getByRole("dialog", { name: /Salvar Permissões Personalizadas/i });
  expect(modalDecisao).toBeInTheDocument();

  // Seleciona a opção de criar novo perfil
  const opcaoNovo = screen.getByText(/Criar um novo perfil e já vincular a Bruno/i);
  fireEvent.click(opcaoNovo);
  const inputNome = screen.getByLabelText(/Nome do novo perfil/i);
  fireEvent.change(inputNome, { target: { value: "Perfil Bruno Custom" } });

  // Confirma e salva
  const btnConfirmar = screen.getByRole("button", { name: "Confirmar e salvar" });
  fireEvent.click(btnConfirmar);

  await waitFor(() => {
    expect(props.onSalvarAcesso).toHaveBeenCalled();
  });
});

it("filtra pacientes por sexo, faixa etária e ordena por mais atendimentos", async () => {
  api.list.mockResolvedValueOnce([
    { id: "pac-1", nomeCompleto: "Bernardo Silva", dataNascimento: "2015-05-10", sexo: "m", ativo: true },
    { id: "pac-2", nomeCompleto: "Clara Santos", dataNascimento: "1990-03-15", sexo: "f", ativo: true },
    { id: "pac-3", nomeCompleto: "Dorival Oliveira", dataNascimento: "1950-01-20", sexo: "m", ativo: true },
  ]);

  const agendaComVarios = [
    { id: "ag-1", profissionalRoleUserId: "member", pacienteId: "pac-1", pacienteNome: "Bernardo Silva", dataAgendamento: "2026-10-10", statusCodigo: "realizado" },
    { id: "ag-2a", profissionalRoleUserId: "member", pacienteId: "pac-2", pacienteNome: "Clara Santos", dataAgendamento: "2026-10-01", statusCodigo: "realizado" },
    { id: "ag-2b", profissionalRoleUserId: "member", pacienteId: "pac-2", pacienteNome: "Clara Santos", dataAgendamento: "2026-10-20", statusCodigo: "realizado" },
    { id: "ag-2c", profissionalRoleUserId: "member", pacienteId: "pac-2", pacienteNome: "Clara Santos", dataAgendamento: "2026-10-25", statusCodigo: "realizado" },
    { id: "ag-3", profissionalRoleUserId: "member", pacienteId: "pac-3", pacienteNome: "Dorival Oliveira", dataAgendamento: "2026-10-15", statusCodigo: "realizado" },
  ];

  render(
    <EquipePessoaView
      {...props}
      agenda={agendaComVarios}
      hojeIso="2026-10-29"
    />,
  );

  await waitFor(() => expect(api.list).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));

  // Todos os 3 aparecem inicialmente
  expect(screen.getByText("Bernardo Silva")).toBeInTheDocument();
  expect(screen.getByText("Clara Santos")).toBeInTheDocument();
  expect(screen.getByText("Dorival Oliveira")).toBeInTheDocument();

  // Abre popover de filtros e seleciona Sexo: Mulher
  fireEvent.click(screen.getByRole("button", { name: /Filtros de pacientes/i }));
  fireEvent.click(screen.getByRole("button", { name: "Mulher" }));

  // Somente Clara deve estar visível
  expect(screen.getByText("Clara Santos")).toBeInTheDocument();
  expect(screen.queryByText("Bernardo Silva")).not.toBeInTheDocument();
  expect(screen.queryByText("Dorival Oliveira")).not.toBeInTheDocument();

  // Seleciona Sexo: Homem
  fireEvent.click(screen.getByRole("button", { name: "Homem" }));
  expect(screen.getByText("Bernardo Silva")).toBeInTheDocument();
  expect(screen.getByText("Dorival Oliveira")).toBeInTheDocument();
  expect(screen.queryByText("Clara Santos")).not.toBeInTheDocument();

  // Agora seleciona Faixa Etária: Menores (< 18 anos)
  const radioMenor = screen.getByLabelText(/Menores \(< 18 anos\)/i);
  fireEvent.click(radioMenor);
  expect(screen.getByText("Bernardo Silva")).toBeInTheDocument();
  expect(screen.queryByText("Dorival Oliveira")).not.toBeInTheDocument();

  // Limpa filtros
  fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
  expect(screen.getByText("Bernardo Silva")).toBeInTheDocument();
  expect(screen.getByText("Clara Santos")).toBeInTheDocument();
  expect(screen.getByText("Dorival Oliveira")).toBeInTheDocument();

  // Testa ordenação por mais atendimentos: Clara Santos (3 atendimentos) deve ser o primeiro
  const selectSort = screen.getByLabelText("Ordenar pacientes");
  fireEvent.change(selectSort, { target: { value: "mais_atendimentos" } });
  const cards = screen.getAllByRole("button", { name: /^Abrir histórico de/i });
  expect(cards[0]).toHaveTextContent("Clara Santos");
});

it("exibe idade e sexo no subtítulo do card de paciente", async () => {
  api.list.mockResolvedValueOnce([
    { id: "pac-pedro", nomeCompleto: "Pedro Alcantara", dataNascimento: "1991-04-12", sexo: "m", ativo: true },
  ]);

  const agenda = [
    { id: "ag-p", profissionalRoleUserId: "member", pacienteId: "pac-pedro", pacienteNome: "Pedro Alcantara", dataAgendamento: "2026-10-18", statusCodigo: "realizado" },
  ];

  render(
    <EquipePessoaView
      {...props}
      agenda={agenda}
      hojeIso="2026-10-29"
    />,
  );

  await waitFor(() => expect(api.list).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));

  expect(screen.getByText("Pedro Alcantara")).toBeInTheDocument();
  expect(screen.getByText(/35 anos · Masculino · 1 atendimento/i)).toBeInTheDocument();
});

it("ao customizar permissão, exibe badge no módulo, realce na permissão e popover ao passar mouse sobre as diferenças", async () => {
  render(
    <EquipePessoaView
      {...props}
      permissoes={fixtures.catalog}
      permissoesPerfil={["p1", "p2"]}
      canManageUsers={true}
      hojeIso="2026-10-29"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Clica em 'Tudo' no primeiro módulo para gerar modificação
  const btnTudo = screen.getAllByRole("button", { name: "Tudo" })[0];
  fireEvent.click(btnTudo);

  // 1. Nível 1: Banner com indicador de diferenças aplicadas
  expect(screen.getByText(/Diferenças aplicadas:/i)).toBeInTheDocument();
  const pillWrapper = screen.getByRole("button", { name: /Ver detalhes das diferenças aplicadas/i });
  expect(pillWrapper).toBeInTheDocument();

  // Hover no pill de diferenças abre o DiffPopover
  fireEvent.mouseEnter(pillWrapper);
  expect(await screen.findByRole("tooltip", { name: /Permissões modificadas/i })).toBeInTheDocument();
  expect(screen.getByText(/Permissões Modificadas/i)).toBeInTheDocument();

  // 2. Nível 2: Badge no cabeçalho do módulo afetado
  const modHasDiff = document.querySelector(".mod.mod-has-diff");
  expect(modHasDiff).toBeInTheDocument();
  expect(document.querySelector(".mod-diff-chip")).toBeInTheDocument();

  // 3. Nível 3: Ao expandir o módulo, o item ganha realce e tag (+ Adicionada)
  const expandBtn = document.querySelector(".expand-functions");
  expect(expandBtn).toBeInTheDocument();
  fireEvent.click(expandBtn);

  const permModified = document.querySelector(".perm-item.perm-item-added");
  expect(permModified).toBeInTheDocument();
  expect(screen.getAllByText(/\+ Adicionada/i).length).toBeGreaterThan(0);
});

it("exibe modal de confirmação ao desmarcar permissão raiz com dependentes ativas e seleciona pré-requisito ao marcar subfunção", async () => {
  render(
    <EquipePessoaView
      {...props}
      permissoes={fixtures.catalog}
      permissoesPerfil={["agenda:VER", "AGENDA_CRIAR"]}
      canManageUsers={true}
      hojeIso="2026-10-29"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Expande o módulo Agenda
  const matrixGroup = screen.getByRole("group", { name: "Módulos do perfil" });
  const chipAgenda = within(matrixGroup).getByRole("button", { name: /^Agenda/i });
  fireEvent.click(chipAgenda);

  const chkVer = screen.getByRole("checkbox", { name: "Ver agenda" });
  const chkCriar = screen.getByRole("checkbox", { name: "Criar agendamentos" });

  expect(chkVer).toBeChecked();
  expect(chkCriar).toBeChecked();

  // Tenta desmarcar a raiz 'Ver agenda'
  fireEvent.click(chkVer);

  // Modal de confirmação deve aparecer
  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: /Desativar visualização em Agenda\?/i })).toBeInTheDocument();
  expect(within(dialog).getByText(/Criar agendamentos/i)).toBeInTheDocument();
  expect(chkVer).toBeChecked();
  expect(chkCriar).toBeChecked();

  // Clica em 'Manter visualização'
  fireEvent.click(within(dialog).getByRole("button", { name: "Manter visualização" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(chkVer).toBeChecked();
  expect(chkCriar).toBeChecked();

  // Tenta desmarcar novamente e confirma desativação em cascata
  fireEvent.click(chkVer);
  const dialogConfirm = screen.getByRole("dialog");
  expect(dialogConfirm).toBeInTheDocument();
  fireEvent.click(within(dialogConfirm).getByRole("button", { name: "Desativar funções dependentes" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(chkVer).not.toBeChecked();
  expect(chkCriar).not.toBeChecked();

  // Ao marcar a subfunção 'Criar agendamentos', o pré-requisito 'Ver agenda' deve ser auto-marcado
  fireEvent.click(chkCriar);
  expect(chkCriar).toBeChecked();
  expect(chkVer).toBeChecked();
});

it("modal de decisão exibe lista e total de colaboradores que utilizam o perfil", async () => {
  const pessoasClinica = [
    { id: "m1", nomeCompleto: "Carlos Silva", perfilAcessoId: "clinico", ativo: true },
    { id: "m2", nomeCompleto: "Camila Santos", perfilAcessoId: "clinico", ativo: true },
  ];

  render(
    <EquipePessoaView
      {...props}
      pessoas={pessoasClinica}
      permissoes={fixtures.catalog}
      permissoesPerfil={["agenda:VER"]}
      canManageUsers={true}
      hojeIso="2026-10-29"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Clica em 'Tudo' no primeiro módulo para criar diferença
  const btnTudo = screen.getAllByRole("button", { name: "Tudo" })[0];
  fireEvent.click(btnTudo);

  // Clica no botão 'Salvar acesso'
  const btnSalvar = screen.getByRole("button", { name: "Salvar acesso" });
  fireEvent.click(btnSalvar);

  // Modal de decisão deve estar aberto e listar os colaboradores vinculados
  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByText(/Utilizado por 2 colaboradores/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/Carlos, Camila/i)).toBeInTheDocument();
});

it("sugere nome único e avisa em tempo real sobre nome repetido ao criar novo perfil a partir de membro", async () => {
  const perfisClinica = [
    { id: "p1", nome: "Profissional Clínico" },
    { id: "p2", nome: "Profissional Clínico (Personalizado)" },
  ];

  render(
    <EquipePessoaView
      {...props}
      perfil={perfisClinica[0]}
      perfisAcesso={perfisClinica}
      permissoes={fixtures.catalog}
      permissoesPerfil={["agenda:VER"]}
      canManageUsers={true}
      hojeIso="2026-10-29"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Acesso", exact: true }));

  // Clica em 'Tudo' no primeiro módulo para criar diferença
  const btnTudo = screen.getAllByRole("button", { name: "Tudo" })[0];
  fireEvent.click(btnTudo);

  // Clica no botão 'Salvar acesso'
  const btnSalvar = screen.getByRole("button", { name: "Salvar acesso" });
  fireEvent.click(btnSalvar);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();

  // Seleciona Opção B: Criar um novo perfil
  const optNovo = within(dialog).getByText(/Criar um novo perfil/i);
  fireEvent.click(optNovo);

  const inputNome = within(dialog).getByLabelText(/Nome do novo perfil/i);
  // Como 'Profissional Clínico (Personalizado)' já existe, deve sugerir '(Personalizado 2)'
  expect(inputNome.value).toBe("Profissional Clínico (Personalizado 2)");

  // Se digitar o nome existente de outro perfil
  fireEvent.change(inputNome, { target: { value: "Profissional Clínico" } });
  expect(within(dialog).getByText(/Já existe um perfil com este nome nesta clínica/i)).toBeInTheDocument();
  const btnConfirmar = within(dialog).getByRole("button", { name: "Confirmar e salvar" });
  expect(btnConfirmar).toBeDisabled();

  // Se alterar para um nome novo
  fireEvent.change(inputNome, { target: { value: "Clínico Noturno" } });
  expect(within(dialog).queryByText(/Já existe um perfil com este nome nesta clínica/i)).not.toBeInTheDocument();
  expect(btnConfirmar).toBeEnabled();
});





