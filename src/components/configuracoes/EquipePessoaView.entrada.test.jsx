import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
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
const ENTRADA = "animate-agenda-rise agenda-delay-100";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
const hero = (c) => c.querySelector(".hero");
describe("EquipePessoaView entrada animada", () => {
  it("hero anima ao montar, desliga em 1800 ms e raiz/painel nunca animam", () => {
    const { container } = render(<EquipePessoaView {...props} />);
    expect(hero(container).className).toContain(ENTRADA);
    expect(container.querySelector(".prototype-equipe").className).not.toContain("animate-agenda-rise");
    expect(container.querySelector("#pessoa-painel").className).not.toContain("animate-agenda-rise");
    act(() => { vi.advanceTimersByTime(1800); });
    expect(hero(container).className).not.toContain("animate-agenda-rise");
  });
  it("trocar de aba anima de novo", () => {
    const { container } = render(<EquipePessoaView {...props} />);
    act(() => { vi.advanceTimersByTime(1800); });
    expect(hero(container).className).not.toContain("animate-agenda-rise");
    fireEvent.click(screen.getByRole("tab", { name: "Atendimentos" }));
    expect(hero(container).className).toContain(ENTRADA);
    expect(container.querySelector(".prototype-equipe").className).not.toContain("animate-agenda-rise");
    expect(container.querySelector("#pessoa-painel").className).not.toContain("animate-agenda-rise");
  });
  it("digitar na busca não reanima", () => {
    const { container } = render(<EquipePessoaView {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Pacientes" }));
    act(() => { vi.advanceTimersByTime(1800); });
    expect(hero(container).className).not.toContain("animate-agenda-rise");
    const busca = container.querySelector("#pessoa-painel input");
    expect(busca).not.toBeNull();
    fireEvent.change(busca, { target: { value: "Mar" } });
    expect(busca).toHaveValue("Mar");
    expect(hero(container).className).not.toContain("animate-agenda-rise");
  });
});
