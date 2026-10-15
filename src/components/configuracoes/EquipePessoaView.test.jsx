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
}));
vi.mock("../../services/api", () => ({
  disponibilidadeApi: { buscar: api.buscar, atualizar: api.atualizar },
  equipeApi: { update: api.update, get: api.get },
  getApiErrorToastMessage: (error, fallback) => error.message || fallback,
  getOrgId: () => "test-org",
  setOrgId: () => {},
}));
vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
beforeEach(() => {
  api.buscar.mockResolvedValue([]);
  api.atualizar.mockResolvedValue([]);
  api.update.mockResolvedValue({});
  api.get.mockResolvedValue({ usuarioId: "usuario-id", roleId: "dentista" });
});
vi.mock("./AuditoriaView", () => ({
  AuditoriaView: ({ roleUserId }) => <div>Histórico de {roleUserId}</div>,
}));
vi.mock("./UsuarioCadastroModal", () => ({
  default: ({ onSaved, onClose }) => (
    <div role="dialog" aria-label="Cadastro do Usuário">
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
    const profile = screen.getByLabelText("Perfil");
    expect(profile.querySelector('option[value="dono"]')).toBeNull();
    fireEvent.change(screen.getByLabelText("Cargo na clínica"), {
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
    fireEvent.click(screen.getByRole("button", { name: "Desativar Bruno" }));
    expect(props.onDesativar).toHaveBeenCalledWith(pessoa);
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

it("cadastro é exclusivo do próprio membro mesmo para administradores", () => {
  const view = render(<EquipePessoaView {...props} isSelf={false} />);
  expect(
    screen.queryByRole("button", { name: "Abrir cadastro do usuário" }),
  ).not.toBeInTheDocument();
  view.rerender(<EquipePessoaView {...props} isSelf />);
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
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
it("troca de pessoa ou perda de isSelf encerra o acesso ao modal", () => {
  const view = render(<EquipePessoaView {...props} isSelf />);
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir cadastro do usuário" }),
  );
  view.rerender(
    <EquipePessoaView
      {...props}
      pessoa={{ ...pessoa, id: "other", nomeCompleto: "Outro Membro" }}
      isSelf={false}
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
    .mockResolvedValueOnce([])
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
  expect(document.querySelector(".acc")).not.toContainElement(options);
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
