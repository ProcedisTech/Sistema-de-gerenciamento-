import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import DisponibilidadeProfissionalModal from "./DisponibilidadeProfissionalModal";
import { dispToDiasConfig, diasConfigToDisp } from "./horarioSemanaUtils.js";

const mocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  atualizar: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  isDono: vi.fn(() => true),
}));

vi.mock("../../services/api.js", () => ({
  disponibilidadeApi: { buscar: mocks.buscar, atualizar: mocks.atualizar },
  getApiErrorToastMessage: (e, fallback) => e.message || fallback,
}));

vi.mock("../../hooks/usePapel.js", () => ({
  usePapel: () => ({ isDono: mocks.isDono() }),
}));

vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

beforeEach(() => {
  mocks.buscar.mockResolvedValue({
    seguirHorarioClinica: false,
    turnos: [],
    gradeClinica: [],
  });
  mocks.atualizar.mockResolvedValue([]);
  mocks.isDono.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("salva e chama onSaved antes de fechar automaticamente", async () => {
  const calls = [],
    onSaved = vi.fn(() => calls.push("saved")),
    onClose = vi.fn(() => calls.push("close"));
  render(
    <DisponibilidadeProfissionalModal
      roleUserId="own"
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  await waitFor(() => expect(calls).toEqual(["saved", "close"]));
  expect(mocks.atualizar).toHaveBeenCalledWith("own", {
    seguirHorarioClinica: false,
    turnos: [],
  });
});

it("salva herança da clínica quando switch seguirHorarioClinica está ligado", async () => {
  mocks.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: true,
    turnos: [],
    gradeClinica: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: true },
    ],
  });
  const onSaved = vi.fn(),
    onClose = vi.fn();
  render(
    <DisponibilidadeProfissionalModal
      roleUserId="prof-1"
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  expect(
    await screen.findByText("Segue o horário de funcionamento da clínica"),
  ).toBeInTheDocument();
  expect(screen.getByText("Grade da clínica (somente leitura)")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith("prof-1", {
      seguirHorarioClinica: true,
      turnos: [],
    }),
  );
  expect(onSaved).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it("bloqueia profissional que extrapola grade da clínica quando não for Dono", async () => {
  mocks.isDono.mockReturnValue(false);
  mocks.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: false,
    turnos: [{ diaSemana: 1, horaInicio: "07:00", horaFim: "12:00" }],
    gradeClinica: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: true },
    ],
  });
  render(<DisponibilidadeProfissionalModal roleUserId="prof-2" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  expect(mocks.error).toHaveBeenCalledWith(
    expect.stringContaining("está fora do horário de funcionamento da clínica"),
  );
  expect(mocks.atualizar).not.toHaveBeenCalled();
});

it("permite Dono salvar turno fora da grade da clínica como exceção", async () => {
  mocks.isDono.mockReturnValue(true);
  mocks.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: false,
    turnos: [{ diaSemana: 1, horaInicio: "07:00", horaFim: "12:00" }],
    gradeClinica: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: true },
    ],
  });
  render(<DisponibilidadeProfissionalModal roleUserId="prof-dono" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith("prof-dono", {
      seguirHorarioClinica: false,
      turnos: [
        {
          id: null,
          diaSemana: 1,
          horaInicio: "07:00",
          horaFim: "12:00",
          ativo: true,
        },
      ],
    }),
  );
});

it("fecha por backdrop e Escape, preservando clique dentro do diálogo", async () => {
  const onClose = vi.fn();
  render(
    <DisponibilidadeProfissionalModal roleUserId="own" onClose={onClose} />,
  );
  await screen.findByRole("button", { name: "Salvar", exact: true });
  fireEvent.click(screen.getByRole("dialog"));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("disponibilidade-backdrop"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("bloqueia qualquer fechamento durante gravação e mantém modal se a API falhar", async () => {
  let reject;
  mocks.atualizar.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const onClose = vi.fn(),
    onSaved = vi.fn();
  render(
    <DisponibilidadeProfissionalModal
      roleUserId="own"
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  expect(
    screen.getByRole("button", { name: "Fechar disponibilidade" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Fechar", exact: true }),
  ).toBeDisabled();
  fireEvent.click(screen.getByTestId("disponibilidade-backdrop"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  reject(new Error("Falha ao salvar"));
  await waitFor(() =>
    expect(mocks.error).toHaveBeenCalledWith("Falha ao salvar"),
  );
  expect(onSaved).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it("horário inválido impede persistir ou fechar", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "18:00", horaFim: "08:00" },
  ]);
  const onClose = vi.fn();
  render(
    <DisponibilidadeProfissionalModal roleUserId="own" onClose={onClose} />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  expect(mocks.atualizar).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(
    "Horário final deve ser depois do horário inicial",
  );
});

it("adapta disponibilidade para sete dias e devolve somente turnos ativos", () => {
  const config = dispToDiasConfig([
    { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00" },
    { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
    { diaSemana: 0, horaInicio: "09:00", horaFim: "10:00", ativo: false },
  ]);
  expect(config).toHaveLength(7);
  expect(config[0].ativo).toBe(false);
  expect(config[1].turnos).toEqual([
    { horaInicio: "08:00", horaFim: "12:00" },
    { horaInicio: "14:00", horaFim: "18:00" },
  ]);
  expect(diasConfigToDisp(config)).toEqual([
    {
      id: null,
      diaSemana: 1,
      horaInicio: "08:00",
      horaFim: "12:00",
      ativo: true,
    },
    {
      id: null,
      diaSemana: 1,
      horaInicio: "14:00",
      horaFim: "18:00",
      ativo: true,
    },
  ]);
});

it("carrega dias em ordem Seg–Dom sem selects e mantém múltiplos turnos", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "08:00:00", horaFim: "12:00:00" },
    { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
  ]);
  render(<DisponibilidadeProfissionalModal roleUserId="own" />);
  await screen.findByRole("switch", { name: "Segunda-feira ativo" });
  expect(
    screen
      .getAllByRole("switch")
      .map((element) => element.getAttribute("aria-label")),
  ).toEqual([
    "Seguir o horário da clínica",
    "Segunda-feira ativo",
    "Terça-feira inativo",
    "Quarta-feira inativo",
    "Quinta-feira inativo",
    "Sexta-feira inativo",
    "Sábado inativo",
    "Domingo inativo",
  ]);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Segunda-feira, início do turno 2")).toHaveValue(
    "14:00",
  );
});

it("desativa um dia, ativa domingo e salva payload plano sem ID antigo", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { id: "old", diaSemana: 1, horaInicio: "08:00", horaFim: "18:00" },
  ]);
  render(<DisponibilidadeProfissionalModal roleUserId="own" />);
  fireEvent.click(
    await screen.findByRole("switch", { name: "Segunda-feira ativo" }),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Domingo inativo" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith("own", {
      seguirHorarioClinica: false,
      turnos: [
        {
          id: null,
          diaSemana: 0,
          horaInicio: "08:00",
          horaFim: "18:00",
          ativo: true,
        },
      ],
    }),
  );
});

it("adiciona almoço e terceiro turno sem sobreposição e salva os horários sugeridos", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00" },
  ]);
  render(<DisponibilidadeProfissionalModal roleUserId="own" />);
  fireEvent.click(await screen.findByRole("button", { name: /Adicionar turno/ }));
  expect(screen.getByLabelText("Segunda-feira, fim do turno 1")).toHaveValue("12:00");
  expect(screen.getByLabelText("Segunda-feira, início do turno 2")).toHaveValue("13:00");
  fireEvent.click(screen.getByRole("button", { name: /Adicionar turno/ }));
  expect(screen.getByLabelText("Segunda-feira, início do turno 3")).toHaveValue("18:30");
  expect(screen.getByLabelText("Segunda-feira, fim do turno 3")).toHaveValue("21:30");
  expect(screen.queryByText(/Turnos sobrepostos/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith("own", {
      seguirHorarioClinica: false,
      turnos: [
        { id: null, diaSemana: 1, horaInicio: "08:00", horaFim: "12:00", ativo: true },
        { id: null, diaSemana: 1, horaInicio: "13:00", horaFim: "18:00", ativo: true },
        { id: null, diaSemana: 1, horaInicio: "18:30", horaFim: "21:30", ativo: true },
      ],
    }),
  );
});

it("copia turnos para todos os dias após confirmação", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "09:00", horaFim: "17:00" },
  ]);
  render(<DisponibilidadeProfissionalModal roleUserId="own" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Copiar para todos" }),
  );
  const confirm = screen.getByRole("dialog", {
    name: "Copiar horário para todos os dias",
  });
  fireEvent.click(
    within(confirm).getByRole("button", { name: "Confirmar cópia" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() =>
    expect(mocks.atualizar).toHaveBeenCalledWith("own", {
      seguirHorarioClinica: false,
      turnos: Array.from({ length: 7 }, (_, diaSemana) => ({
        id: null,
        diaSemana,
        horaInicio: "09:00",
        horaFim: "17:00",
        ativo: true,
      })),
    }),
  );
});

it("sobreposição bloqueia gravação, mas turnos contíguos são aceitos", async () => {
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
    { diaSemana: 1, horaInicio: "11:00", horaFim: "18:00" },
  ]);
  render(<DisponibilidadeProfissionalModal roleUserId="own" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Salvar", exact: true }),
  );
  expect(mocks.error).toHaveBeenCalledWith(
    "Os turnos de um mesmo dia não podem se sobrepor",
  );
  expect(mocks.atualizar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Segunda-feira, início do turno 2"), {
    target: { value: "12:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() => expect(mocks.atualizar).toHaveBeenCalledOnce());
});

it("mantém limite de três turnos e cancelar cópia com Escape não fecha o modal pai", async () => {
  const onClose = vi.fn();
  mocks.buscar.mockResolvedValueOnce([
    { diaSemana: 1, horaInicio: "08:00", horaFim: "10:00" },
    { diaSemana: 1, horaInicio: "12:00", horaFim: "14:00" },
    { diaSemana: 1, horaInicio: "16:00", horaFim: "18:00" },
  ]);
  render(
    <DisponibilidadeProfissionalModal roleUserId="own" onClose={onClose} />,
  );
  expect(
    await screen.findByRole("button", { name: "Limite de horários atingido" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Copiar para todos" }));
  const confirm = screen.getByRole("dialog", {
    name: "Copiar horário para todos os dias",
  });
  fireEvent.keyDown(confirm, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("dialog", { name: "Copiar horário para todos os dias" }),
  ).not.toBeInTheDocument();
});

it("exibe aviso visual e banner de exceção quando o Dono configura horário em dia que a clínica está fechada", async () => {
  mocks.isDono.mockReturnValue(true);
  mocks.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: false,
    gradeClinica: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: true },
    ],
    turnos: [
      { diaSemana: 6, horaInicio: "09:00", horaFim: "13:00", ativo: true }, // Sábado (clínica fechada)
    ],
  });

  render(<DisponibilidadeProfissionalModal roleUserId="colab-1" />);

  // Banner âmbar no rodapé do modal
  const banner = await screen.findByTestId("aviso-excecao-clinica");
  expect(banner).toBeInTheDocument();
  expect(banner).toHaveTextContent("exceções de atendimento");

  // Alerta inline no sábado
  const alertaSabado = screen.getByTestId("alerta-dia-fechado-6");
  expect(alertaSabado).toHaveTextContent("Horário de exceção (clínica fechada)");

  // Dono pode salvar normalmente
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() => expect(mocks.atualizar).toHaveBeenCalledOnce());
  expect(mocks.success).toHaveBeenCalledWith(
    "Disponibilidade salva (com exceções de atendimento)",
  );
});

it("exibe banner de bloqueio para não-dono quando extrapola a grade da clínica", async () => {
  mocks.isDono.mockReturnValue(false);
  mocks.buscar.mockResolvedValueOnce({
    seguirHorarioClinica: false,
    gradeClinica: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00", ativo: true },
    ],
    turnos: [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "20:00", ativo: true }, // Ultrapassa 18h
    ],
  });

  render(<DisponibilidadeProfissionalModal roleUserId="colab-2" />);

  // Banner vermelho de bloqueio
  const banner = await screen.findByTestId("bloqueio-clinica-fechada");
  expect(banner).toBeInTheDocument();
  expect(banner).toHaveTextContent("Bloqueio de horário");

  // Alerta inline no turno
  const alertaTurno = screen.getByTestId("alerta-turno-fora-1-0");
  expect(alertaTurno).toHaveTextContent("Fora do expediente da clínica");

  // Tentativa de salvar dispara toast de erro e não atualiza
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  expect(mocks.error).toHaveBeenCalledWith(
    expect.stringContaining("está fora do horário de funcionamento da clínica"),
  );
  expect(mocks.atualizar).not.toHaveBeenCalled();
});

