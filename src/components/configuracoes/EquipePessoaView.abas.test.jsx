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
  criarPerfilComPermissoes: vi.fn(),
  atualizarPermissoesDoPerfil: vi.fn(),
}));
vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("./AuditoriaView", () => ({ AuditoriaView: () => <div /> }));
vi.mock("./UsuarioCadastroModal", () => ({ default: () => <div /> }));

beforeEach(() => {
  api.buscar.mockResolvedValue([]);
  api.atualizar.mockResolvedValue([]);
  api.update.mockResolvedValue({});
  api.get.mockResolvedValue({ usuarioId: "usuario-id", roleId: "dentista" });
  api.inativos.mockResolvedValue([]);
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
  roleName: "DENTISTA",
  perfilAcessoId: "clinico",
  ativo: true,
  apareceNaAgenda: true,
};
const props = {
  tipoOrg: "clinica",
  pessoa,
  perfil: { id: "clinico", nome: "Clínico", codigo: "CLINICO", organizacaoSaudeDonaId: "org" },
  roles: [{ id: "dentista", nome: "DENTISTA" }],
  perfisAcesso: [{ id: "clinico", nome: "Clínico", codigo: "CLINICO" }],
  hojeIso: "2026-10-05",
  canManageUsers: true,
  canSeeAgenda: true,
  onSalvarAcesso: vi.fn(async () => {}),
  onDesativar: vi.fn(),
  onPeriodoChange: vi.fn(),
  agenda: [],
};
const ag = (id, pacienteId, pacienteNome, dataAgendamento, statusCodigo, extra = {}) => ({
  id,
  profissionalRoleUserId: "member",
  pacienteId,
  pacienteNome,
  dataAgendamento,
  statusCodigo,
  ...extra,
});

describe("EquipePessoaView · abas", () => {
  it("aba Pacientes segue o período", () => {
    const onPeriodoChange = vi.fn();
    render(
      <EquipePessoaView
        {...props}
        onPeriodoChange={onPeriodoChange}
        agenda={[
          ag("a", "pacA", "Ana Antiga", "2026-08-20", "realizado"),
          ag("b", "pacB", "Bia Recente", "2026-10-03", "realizado"),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
    expect(screen.getByText("Pacientes atendidos · Este mês")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir histórico de Bia Recente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir histórico de Ana Antiga" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(onPeriodoChange).toHaveBeenCalledWith("3m");
    expect(screen.getByText("Pacientes atendidos · Últimos 3 meses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir histórico de Bia Recente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir histórico de Ana Antiga" })).toBeInTheDocument();
  });

  it("abrir paciente lista só os realizados dele com o profissional", () => {
    const onSelectPatient = vi.fn();
    render(
      <EquipePessoaView
        {...props}
        onSelectPatient={onSelectPatient}
        agenda={[
          ag("1", "pac1", "Maria", "2026-10-02", "realizado", { horaInicio: "09:00:00", horaFim: "10:00:00", catalogoProcedimentoNome: "Avaliação" }),
          ag("2", "pac1", "Maria", "2026-10-03", "faltou", { horaInicio: "09:00:00", horaFim: "10:00:00", catalogoProcedimentoNome: "Retorno" }),
          ag("3", "pac1", "Maria", "2026-10-04", "realizado", { horaInicio: "14:00:00", horaFim: "14:30:00", catalogoProcedimentoNome: "Limpeza" }),
          ag("4", "pac2", "Joana", "2026-10-04", "realizado", { horaInicio: "10:00:00", horaFim: "11:00:00", catalogoProcedimentoNome: "Toxina" }),
          ag("5", "pac1", "Maria", "2026-10-04", "realizado", { profissionalRoleUserId: "other", horaInicio: "16:00:00", horaFim: "17:00:00", catalogoProcedimentoNome: "Anamnese" }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir histórico de Maria" }));
    expect(onSelectPatient).not.toHaveBeenCalled();
    const linhas = screen.getAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    // mais recente primeiro
    expect(linhas[0]).toHaveTextContent("04/10");
    expect(linhas[0]).toHaveTextContent("Limpeza");
    expect(linhas[0]).toHaveTextContent("30 min");
    expect(linhas[1]).toHaveTextContent("02/10");
    expect(linhas[1]).toHaveTextContent("Avaliação");
    expect(linhas[1]).toHaveTextContent("60 min");
    expect(screen.queryByText(/03\/10/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anamnese/)).not.toBeInTheDocument();
    expect(screen.queryByText("Joana")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ficha completa do paciente" }));
    expect(onSelectPatient).toHaveBeenCalledTimes(1);
    expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ id: "pac1" }));
    fireEvent.click(screen.getByRole("button", { name: /Pacientes de Bruno/ }));
    expect(screen.getByRole("button", { name: "Abrir histórico de Joana" })).toBeInTheDocument();
  });

  it("horário dia a dia: sete linhas, pausa entre turnos e folga", async () => {
    api.buscar.mockResolvedValue([
      { diaSemana: 1, horaInicio: "13:00", horaFim: "18:00" },
      { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00" },
      { diaSemana: 0, horaInicio: "09:00", horaFim: "12:00" },
    ]);
    render(<EquipePessoaView {...props} />);
    await screen.findByText("13:00 - 18:00");
    expect(document.querySelectorAll(".week-group-row")).toHaveLength(7);
    expect(screen.getAllByText("pausa")).toHaveLength(1);
    expect(screen.getAllByText("Folga")).toHaveLength(5);
    const segunda = screen.getByText("Segunda").closest(".week-group-row");
    expect(segunda).toHaveTextContent("08:00 - 12:00");
    expect(segunda).toHaveTextContent("pausa");
    expect(segunda).toHaveTextContent("13:00 - 18:00");
    expect(screen.getByText("09:00 - 12:00").closest(".week-group-row")).toHaveTextContent("Domingo");
  });

  describe("quem não atende", () => {
    const catalogo = [
      { permissaoId: "c1", codigo: "PACIENTE_VER", nome: "Ver pacientes", modulo: "Pacientes" },
      { permissaoId: "c2", codigo: "ACESSO_CONFIGURACOES_VER", nome: "Ver a equipe", modulo: "Acesso" },
    ];
    const naoAtende = { ...pessoa, apareceNaAgenda: false };
    const menu = () => screen.getByRole("heading", { name: "O menu de Bruno" }).closest(".box");

    it("sem a função da equipe o menu não tem Gestão de Equipe", () => {
      render(<EquipePessoaView {...props} pessoa={naoAtende} permissoes={catalogo} permissoesPerfil={["c1"]} />);
      expect(screen.getByText("Bruno não atende pacientes")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /O que Bruno pode fazer/ })).toBeInTheDocument();
      expect(screen.getByText("Não tem acesso a")).toBeInTheDocument();
      expect(within(menu()).getByText("Pacientes")).toBeInTheDocument();
      expect(within(menu()).queryByText("Gestão de Equipe")).not.toBeInTheDocument();
    });

    it("com a função da equipe o menu tem Gestão de Equipe", () => {
      render(<EquipePessoaView {...props} pessoa={naoAtende} permissoes={catalogo} permissoesPerfil={["c1", "c2"]} />);
      expect(within(menu()).getByText("Pacientes")).toBeInTheDocument();
      expect(within(menu()).getByText("Gestão de Equipe")).toBeInTheDocument();
    });
  });

  it("Atendimentos: busca por paciente, chips por procedimento e totais", () => {
    render(
      <EquipePessoaView
        {...props}
        agenda={[
          ag("1", "pac1", "Maria", "2026-10-01", "realizado", { horaInicio: "09:00:00", horaFim: "10:00:00", catalogoProcedimentoNome: "Avaliação" }),
          ag("2", "pac1", "Maria", "2026-10-02", "realizado", { horaInicio: "14:00:00", horaFim: "14:30:00", catalogoProcedimentoNome: "Limpeza" }),
          ag("3", "pac2", "João", "2026-10-03", "realizado", { horaInicio: "08:00:00", horaFim: "08:45:00", catalogoProcedimentoNome: "Avaliação" }),
          ag("4", "pac3", "Carla", "2026-10-04", "faltou", { horaInicio: "10:00:00", horaFim: "11:00:00", catalogoProcedimentoNome: "Limpeza" }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Atendimentos", exact: true }));
    const totais = () => screen.getByRole("group", { name: "Totais" });
    // 3 realizados (60+30+45 = 135 min), 2 pacientes, 1 falta
    expect(totais()).toHaveTextContent("3 realizados");
    expect(totais()).toHaveTextContent("2 pacientes");
    expect(totais()).toHaveTextContent("2 h 15 min em atendimento");
    expect(totais()).toHaveTextContent("1 falta");
    expect(screen.getByRole("button", { name: /^Todos 4$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Avaliação 2$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Limpeza 2$/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar paciente"), { target: { value: "mar" } });
    expect(screen.queryByText("João")).not.toBeInTheDocument();
    expect(screen.queryByText("Carla")).not.toBeInTheDocument();
    expect(totais()).toHaveTextContent("2 realizados");
    expect(totais()).toHaveTextContent("1 paciente");
    expect(totais()).toHaveTextContent("1 h 30 min em atendimento");
    expect(totais()).not.toHaveTextContent("falta");

    fireEvent.change(screen.getByLabelText("Buscar paciente"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^Avaliação 2$/ }));
    expect(totais()).toHaveTextContent("2 realizados");
    expect(totais()).toHaveTextContent("2 pacientes");
    expect(totais()).toHaveTextContent("1 h 45 min em atendimento");
    expect(screen.queryByText("Carla")).not.toBeInTheDocument();
  });

  it("Agenda mostra a semana de segunda a domingo e troca de dia sem chamada nova", async () => {
    // 2026-10-05 é segunda-feira
    render(
      <EquipePessoaView
        {...props}
        agenda={[
          ag("1", "pac1", "Maria", "2026-10-05", "agendado", { horaInicio: "09:00:00", horaFim: "10:00:00" }),
          ag("2", "pac2", "João", "2026-10-07", "agendado", { horaInicio: "11:00:00", horaFim: "12:00:00" }),
          ag("3", "pac3", "Carla", "2026-10-11", "agendado", { horaInicio: "08:00:00", horaFim: "09:00:00" }),
        ]}
      />,
    );
    await waitFor(() => expect(api.buscar).toHaveBeenCalled());
    const chamadas = api.buscar.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: "Agenda", exact: true }));
    const dias = within(screen.getByRole("group", { name: "Dias da semana" })).getAllByRole("button");
    expect(dias).toHaveLength(7);
    expect(dias[0]).toHaveTextContent("Seg");
    expect(dias[6]).toHaveTextContent("Dom");
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.queryByText("João")).not.toBeInTheDocument();
    fireEvent.click(dias[2]);
    expect(screen.getByText("João")).toBeInTheDocument();
    fireEvent.click(dias[6]);
    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(api.buscar.mock.calls.length).toBe(chamadas);
  });

  it("Visão geral resume o dia: N de M atendidos e o próximo", () => {
    render(
      <EquipePessoaView
        {...props}
        agenda={[
          ag("1", "pac1", "Maria", "2026-10-05", "realizado", { horaInicio: "08:00:00", horaFim: "09:00:00" }),
          ag("2", "pac2", "João", "2026-10-05", "agendado", { horaInicio: "10:30:00", horaFim: "11:00:00", catalogoProcedimentoNome: "Limpeza" }),
          ag("3", "pac3", "Carla", "2026-10-05", "cancelado", { horaInicio: "12:00:00", horaFim: "13:00:00" }),
        ]}
      />,
    );
    expect(screen.getByText("1 de 2 atendidos")).toBeInTheDocument();
    expect(screen.getByText(/Próximo:/)).toHaveTextContent("10:30 · João");
  });

  it("Agenda: dia fora do período carregado mostra — e 'Fora do período carregado', sem livre nem Nada marcado", () => {
    api.buscar.mockResolvedValue([{ diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" }]);
    render(<EquipePessoaView {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Agenda", exact: true }));
    // sinal positivo: hoje (05/10, dentro de 01/10..31/10) é carregado
    expect(screen.getByText("Nada marcado para este dia.")).toBeInTheDocument();
    expect(screen.queryByText("Fora do período carregado")).not.toBeInTheDocument();
    // semana anterior (28/09 a 04/10): 28/09 a 30/09 antes do período
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    const dias = within(screen.getByRole("group", { name: "Dias da semana" })).getAllByRole("button");
    expect(dias[0]).toHaveTextContent("28");
    expect(dias[0]).toHaveTextContent("—");
    expect(dias[0]).not.toHaveTextContent(/livre|folga/);
    expect(dias[3]).toHaveTextContent("1"); // 01/10 já carregado
    expect(dias[3]).not.toHaveTextContent("—");
    fireEvent.click(dias[0]);
    expect(screen.getByText("Fora do período carregado")).toBeInTheDocument();
    expect(screen.queryByText("Nada marcado para este dia.")).not.toBeInTheDocument();
    expect(screen.queryByText("Folga", { selector: ".day small, .day small *" })).not.toBeInTheDocument();
    // depois do fim do mês: semana de 02/11 (5 semanas à frente de 28/09)
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    const depois = within(screen.getByRole("group", { name: "Dias da semana" })).getAllByRole("button");
    expect(depois[0]).toHaveTextContent("—");
    expect(screen.getByText("Fora do período carregado")).toBeInTheDocument();
    expect(screen.queryByText(/livre/)).not.toBeInTheDocument();
  });

  it("Agenda: dia fora do período carregado de quem não atende nele: o texto de .day não termina em '·'", async () => {
    // atende so as segundas (diaSemana 1); 29/09 (terça) e antes de 01/10 e nao tem turno
    api.buscar.mockResolvedValue([{ diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" }]);
    render(<EquipePessoaView {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Agenda", exact: true }));
    // sinal positivo 1: a disponibilidade carregou (hoje, segunda 05/10, tem turno no .day)
    await waitFor(() => expect(document.querySelector(".day small")).toHaveTextContent("08:00-12:00"));
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    const dias = within(screen.getByRole("group", { name: "Dias da semana" })).getAllByRole("button");
    // sinal positivo 2: segunda 28/09, tambem fora do periodo mas COM turno, mostra o horario no .day
    fireEvent.click(dias[0]);
    expect(document.querySelector(".day")).toHaveTextContent("08:00-12:00");
    fireEvent.click(dias[1]);
    const dia = document.querySelector(".day");
    expect(dia).toHaveTextContent(/^Ter/); // o dia aparece
    expect(dia).toHaveTextContent("29");
    expect(dia.querySelector("small")).toBeNull();
    expect(dia.textContent.trim().endsWith("·")).toBe(false);
    expect(screen.getByText("Fora do período carregado")).toBeInTheDocument();
  });

  it("card do topo 'Pacientes atendidos' não muda ao trocar o período da aba Pacientes", () => {
    render(
      <EquipePessoaView
        {...props}
        agenda={[
          ag("a", "pacA", "Ana Antiga", "2026-08-20", "realizado"),
          ag("b", "pacB", "Bia Recente", "2026-10-03", "realizado"),
        ]}
      />,
    );
    const topo = () => screen.getByText("Pacientes atendidos", { exact: true }).parentElement;
    expect(topo()).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("tab", { name: "Pacientes", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(screen.getByRole("button", { name: "Abrir histórico de Ana Antiga" })).toBeInTheDocument();
    expect(topo()).toHaveTextContent("1");
    expect(topo()).not.toHaveTextContent("2");
  });
});
