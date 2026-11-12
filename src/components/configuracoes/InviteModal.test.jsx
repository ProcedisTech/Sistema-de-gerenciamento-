import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
  act,
} from "@testing-library/react";
import { InviteModal } from "./InviteModal";
import PrototypeIcon from "./PrototypeIcon";
import * as Lucide from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { setOrgId } from "../../services/api";

// Regressão prevenida: consulta por módulo e edição de perfis respeitam a seleção e a autorização do convite.

const toastMocks = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => toastMocks,
}));
vi.mock("../hooks/useAgoraDaClinica.js", () => ({
  useAgoraDaClinica: () => ({ hojeIso: "2026-10-04" }),
}));
vi.mock("../../hooks/useEstadosCivis.js", () => ({
  useEstadosCivis: () => ({
    estadosCivis: [{ id: "civil", nome: "Solteiro(a)" }],
    loading: false,
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(async () => ({
        data: {
          user: { id: "usr_mock_123" },
          session: { access_token: "mock_token" },
        },
        error: null,
      })),
    },
  })),
}));

// Catálogo canônico da V172, sem categorias ilustrativas do showcase.
const catalog = [
  [
    "c0000000-0000-0000-0000-000000000101",
    "AGENDA_VER",
    "Visualizar Agenda",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000102",
    "AGENDA_CRIAR",
    "Criar Agendamento",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000103",
    "AGENDA_EDITAR",
    "Editar/Reagendar",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000104",
    "AGENDA_EXCLUIR",
    "Cancelamento de Agendamento do Paciente",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000001",
    "AGENDA_BLOQUEIO_GERENCIAR",
    "Gerenciar Bloqueios de Horário",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000002",
    "CONFIRMACAO_GERENCIAR",
    "Gerenciar Confirmações",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000017",
    "AGENDA_MULTI_VER",
    "Visualizar Grade de Todos os Profissionais",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000018",
    "AGENDA_PROPRIA_VER",
    "Visualizar Agenda Própria",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000019",
    "AGENDA_FORA_DISP_ENCAIXAR",
    "Encaixar Fora da Disponibilidade",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000020",
    "AGENDA_APARECER",
    "Aparecer na Agenda como Profissional",
    "Agenda",
  ],
  [
    "c0000000-0000-0000-0000-000000000105",
    "PACIENTE_VER",
    "Ver Dados Cadastrais",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000106",
    "PACIENTE_CRIAR",
    "Cadastrar Paciente",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000107",
    "PACIENTE_EDITAR",
    "Editar Dados Cadastrais",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000108",
    "PACIENTE_EXCLUIR",
    "Inativar/Excluir Paciente",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000015",
    "PACIENTE_ORCAMENTO_VER",
    "Visualizar Orçamentos e Planos",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000016",
    "PACIENTE_ORCAMENTO_EDITAR",
    "Editar Valores e Preços em Orçamentos",
    "Pacientes",
  ],
  [
    "c0000000-0000-0000-0000-000000000111",
    "ANAMNESE_PREENCHIMENTO_CRIAR",
    "Realizar Atendimento",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000010",
    "HUB_AVALIACAO_VER",
    "Acessar Avaliação e Fotos Iniciais",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000011",
    "HUB_ANAMNESE_VER",
    "Acessar Anamnese no Atendimento",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000012",
    "HUB_TERMOS_VER",
    "Acessar Termos de Consentimento",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000013",
    "HUB_PROCEDIMENTO_EXECUTAR",
    "Executar e Registrar Procedimento Clínico",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000014",
    "HUB_ORIENTACAO_VER",
    "Acessar Orientações Pós-Procedimento",
    "Atendimento",
  ],
  [
    "c0000000-0000-0000-0000-000000000114",
    "PRONTUARIO_VER",
    "Ver Prontuário Clínico",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000115",
    "PRONTUARIO_CRIAR",
    "Lançar Procedimento",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000116",
    "PACIENTE_NOTA_VER",
    "Ver Notas Clínicas",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000117",
    "PACIENTE_NOTA_CRIAR",
    "Criar Notas Clínicas",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000118",
    "PACIENTE_NOTA_EDITAR",
    "Editar Notas Clínicas",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000006",
    "EVOLUCAO_GERENCIAR",
    "Gerenciar Evoluções e Relatos",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000007",
    "ORIENTACAO_GERENCIAR",
    "Gerenciar Orientações Pós",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000109",
    "PACIENTE_GALERIA_VER",
    "Ver Fotos em Anexo do Paciente",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000110",
    "ANAMNESE_PREENCHIMENTO_VER",
    "Ver Anamnese do Paciente",
    "Prontuário",
  ],
  [
    "c0000000-0000-0000-0000-000000000119",
    "PACIENTE_DOCUMENTO_VER",
    "Ver Documentos Assinados",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000121",
    "DOC_MODELO_VER",
    "Ver Modelos de Documentos",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000122",
    "DOC_MODELO_EDITAR",
    "Configurar Modelos de Documentos",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000112",
    "ANAMNESE_MODELO_VER",
    "Ver Modelos de Anamnese",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000113",
    "ANAMNESE_MODELO_EDITAR",
    "Configurar Modelos de Anamnese",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000136",
    "PDF_EXPORTAR",
    "Exportar Fichas e Prontuários em PDF",
    "Documentos",
  ],
  [
    "c0000000-0000-0000-0000-000000000123",
    "CATALOGO_VER",
    "Ver Catálogo de Procedimentos",
    "Catálogo",
  ],
  [
    "c0000000-0000-0000-0000-000000000124",
    "CATALOGO_EDITAR",
    "Configurar Procedimentos",
    "Catálogo",
  ],
  [
    "c0000000-0000-0000-0000-000000000125",
    "PRECOS_EDITAR",
    "Editar Preços e Valores",
    "Catálogo",
  ],
  [
    "c0000000-0000-0000-0000-000000000129",
    "USUARIO_VER",
    "Ver Lista de Colaboradores",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000130",
    "USUARIO_CRIAR",
    "Convidar Colaborador",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000131",
    "USUARIO_EDITAR",
    "Editar Cargos e Níveis",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000132",
    "USUARIO_EXCLUIR",
    "Desativar Colaborador",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000133",
    "PERFIL_ACESSO_VER",
    "Ver Perfis de Acesso",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000134",
    "PERFIL_ACESSO_EDITAR",
    "Configurar Perfis de Acesso",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000008",
    "ESPECIALIDADE_GERENCIAR",
    "Configurar Especialidades",
    "Equipe",
  ],
  [
    "c0000000-0000-0000-0000-000000000126",
    "CLINICA_EDITAR",
    "Configurar Dados da Clínica",
    "Clínica",
  ],
  [
    "c0000000-0000-0000-0000-000000000127",
    "HORARIO_EDITAR",
    "Configurar Horários da Clínica",
    "Clínica",
  ],
  [
    "c0000000-0000-0000-0000-000000000128",
    "FERIADO_EDITAR",
    "Gerenciar Feriados",
    "Clínica",
  ],
  [
    "c0000000-0000-0000-0000-000000000135",
    "AUDITORIA_VER",
    "Acessar Auditoria Geral",
    "Sistema",
  ],
  [
    "c0000000-0000-0000-0000-000000000137",
    "NOTIFICACAO_VER",
    "Ver Notificações",
    "Sistema",
  ],
  [
    "c0000000-0000-0000-0000-000000000009",
    "MSG_TEMPLATE_GERENCIAR",
    "Configurar Templates de Mensagem",
    "Sistema",
  ],
].map(([permissaoId, codigo, nome, modulo]) => ({
  permissaoId,
  codigo,
  nome,
  modulo,
}));
const permissionIds = (...codes) =>
  catalog.filter((p) => codes.includes(p.codigo)).map((p) => p.permissaoId);
const selectedIds = permissionIds(
  "AGENDA_VER",
  "AGENDA_APARECER",
  "PACIENTE_VER",
  "PACIENTE_CRIAR",
  "PACIENTE_EDITAR",
  "PACIENTE_EXCLUIR",
  "PACIENTE_ORCAMENTO_VER",
  "PACIENTE_ORCAMENTO_EDITAR",
);

const defaultProps = {
  roles: [
    { id: "dentista", nome: "DENTISTA" },
    { id: "recepcao", nome: "RECEPCIONISTA" },
  ],
  perfisAcesso: [
    { id: "dono", codigo: "DONO", nome: "Dono" },
    { id: "clinico", codigo: "PROFISSIONAL_CLINICO", nome: "Clínico" },
    { id: "custom", nome: "Perfil da clínica", organizacaoSaudeDonaId: "org" },
  ],
  permissoes: catalog,
  canEditConfigPerfil: true,
  especialidadesList: [{ id: "odonto", nome: "Odontologia" }],
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  fetchHeaders: vi.fn(async () => ({})),
  onEditarPerfilNaAba: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  setOrgId("d0000000-0000-0000-0000-0000000000aa");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => selectedIds })),
  );
});
afterEach(() => {
  cleanup();
  setOrgId(null);
  vi.unstubAllGlobals();
});

describe("InviteModal", () => {
  it("mantém o cadastro completo e cargo independente do perfil, sem oferecer Dono", async () => {
    render(<InviteModal {...defaultProps} />);
    expect(
      screen.getByRole("dialog", { name: "Convidar pessoa" }),
    ).toHaveFocus();
    expect(screen.getByLabelText("CPF")).toBeRequired();
    expect(screen.getByLabelText(/Senha inicial/)).toHaveAttribute(
      "minlength",
      "8",
    );
    expect(screen.getByLabelText(/Estado Civil/)).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
    expect(screen.getByLabelText("Odontologia")).toBeInTheDocument();
    const profile = screen.getByLabelText("Perfil de acesso");
    expect(profile.querySelector('option[value="dono"]')).toBeNull();
    fireEvent.change(profile, { target: { value: "clinico" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
      target: { value: "recepcao" },
    });
    expect(profile).toHaveValue("clinico");
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it("limita Tab ao diálogo, permite Escape e devolve foco ao gatilho", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<InviteModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Fechar convite" }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Criar acesso" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Fechar convite" }),
    ).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("não renderiza botões de mutação de perfil no rodapé do card", async () => {
    render(<InviteModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "clinico" },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", {
        name: /Editar este perfil|Criar (perfil|novo) com base/,
      }),
    ).not.toBeInTheDocument();
  });
  it("mostra erro de permissões sem apresentar acesso vazio", async () => {
    fetch.mockResolvedValue({ ok: false });
    render(<InviteModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "clinico" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as permissões",
    );
    expect(screen.getByRole("button", { name: "Criar acesso" })).toBeDisabled();
  });

  it("exibe o <select> canônico agrupado por perfis da clínica e modelos prontos do sistema", () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    expect(perfilSelect).toBeInTheDocument();
    expect(perfilSelect).toHaveClass("select-control");

    expect(
      perfilSelect.querySelector('optgroup[label="Perfis da sua clínica"]'),
    ).toBeInTheDocument();
    expect(
      perfilSelect.querySelector('optgroup[label="Modelos prontos do sistema"]'),
    ).toBeInTheDocument();
    expect(within(perfilSelect).getByRole("option", { name: "Clínico" })).toBeInTheDocument();
    expect(within(perfilSelect).getByRole("option", { name: "Perfil da clínica" })).toBeInTheDocument();
    expect(within(perfilSelect).queryByRole("option", { name: /^Dono$/i })).not.toBeInTheDocument();
  });

  it("seleciona perfil pelo <select> canônico e atualiza o card de governança e funções", async () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);

    fireEvent.change(perfilSelect, { target: { value: "clinico" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Modelo pronto · protegido")).toBeInTheDocument();
    expect(screen.getByText(/funções liberadas/)).toBeInTheDocument();

    fireEvent.change(perfilSelect, { target: { value: "custom" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Perfil da sua Clínica")).toBeInTheDocument();
  });

  it("renderiza o seletor visual idêntico ao protótipo com botão vazio, dropdown e botão alterar perfil", async () => {
    render(<InviteModal {...defaultProps} />);

    // 1. Botão Vazio de Destaque
    expect(
      screen.getByText("Escolha um perfil para conferir o acesso desta pessoa"),
    ).toBeInTheDocument();
    const btnSelecionar = screen.getByText("Selecionar perfil");
    expect(btnSelecionar).toBeInTheDocument();

    const dropdown = screen.getByRole("listbox", { name: "Perfis Disponíveis" });
    expect(dropdown).not.toHaveClass("open");

    // 2. Abrir Dropdown
    fireEvent.click(btnSelecionar);
    expect(dropdown).toHaveClass("open");

    // 3. Selecionar Perfil no Dropdown
    const optClinico = within(dropdown).getByRole("option", { name: /Clínico/ });
    fireEvent.click(optClinico);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(dropdown).not.toHaveClass("open");
    expect(
      screen.queryByText("Escolha um perfil para conferir o acesso desta pessoa"),
    ).not.toBeInTheDocument();

    // 4. Card do Perfil Selecionado com Botão Alterar Perfil
    const btnAlterar = screen.getByText("Alterar perfil");
    expect(btnAlterar).toBeInTheDocument();

    // 5. Reabrir Dropdown pelo Alterar Perfil
    fireEvent.click(btnAlterar);
    expect(dropdown).toHaveClass("open");
  });

  it("fecha o modal de convite ao pressionar Escape quando não há sub-modal aberto", () => {
    render(<InviteModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});

it("sugere o perfil configurado no cargo e atualiza sua prévia", async () => {
  render(
    <InviteModal
      {...defaultProps}
      roles={[
        { id: "medico", nome: "MEDICO", perfilAcessoPadraoId: "clinico" },
        {
          id: "recepcao",
          nome: "RECEPCIONISTA",
          perfilAcessoPadraoId: "secretaria",
        },
      ]}
      perfisAcesso={[
        ...defaultProps.perfisAcesso,
        { id: "secretaria", codigo: "SECRETARIA", nome: "Recepção" },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
    target: { value: "medico" },
  });
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("clinico");
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/clinico/permissoes"),
      expect.anything(),
    ),
  );
  fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
    target: { value: "recepcao" },
  });
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("secretaria");
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/secretaria/permissoes"),
      expect.anything(),
    ),
  );
});

it("preserva o perfil escolhido manualmente ao trocar cargo com sugestão", () => {
  render(
    <InviteModal
      {...defaultProps}
      roles={[
        { id: "medico", nome: "MEDICO", perfilAcessoPadraoId: "clinico" },
      ]}
      perfisAcesso={[
        ...defaultProps.perfisAcesso,
        { id: "custom", nome: "Personalizado", organizacaoSaudeDonaId: 1 },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
    target: { value: "medico" },
  });
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("custom");
});

it("remove sugestão automática quando novo cargo não tem padrão disponível e nunca sugere Dono", () => {
  render(
    <InviteModal
      {...defaultProps}
      roles={[
        { id: "medico", nome: "MEDICO", perfilAcessoPadraoId: "clinico" },
        { id: "outro", nome: "OUTRO", perfilAcessoPadraoId: "dono" },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
    target: { value: "medico" },
  });
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("clinico");
  fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
    target: { value: "outro" },
  });
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("");
});

const moduleButton = (name) =>
  screen.getByRole("button", { name: new RegExp(`^${name} `) });
const chooseProfile = async (id = "clinico") => {
  fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
    target: { value: id },
  });
  await screen.findByRole("button", { name: /^Agenda / });
};

describe("matriz canônica de funções do convite", () => {
  // Regressão prevenida: a prévia aprovada mantém resumo e personalização antes da consulta de módulos.
  it("apresenta a cobertura real e a personalização antes dos módulos e dados complementares", async () => {
    render(<InviteModal {...defaultProps} />);
    await chooseProfile();
    const summary = screen.getByRole("region", {
      name: "Resumo do perfil de acesso",
    });
    expect(summary).toHaveTextContent("8 / 53");
    expect(summary).toHaveTextContent("funções liberadas");
    expect(
      within(summary).queryByRole("button", {
        name: "Criar perfil com base neste modelo",
      }),
    ).not.toBeInTheDocument();
    const heading = screen.getByRole("heading", {
      name: "O que este perfil pode fazer",
    });
    expect(heading.parentElement).not.toHaveTextContent("8 de 53");
    expect(heading.parentElement).toHaveTextContent(
      "Toque em um módulo para detalhar",
    );
    const matrix = screen.getByRole("group", { name: "Módulos do perfil" });
    expect(
      summary.compareDocumentPosition(matrix) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByLabelText("CPF").compareDocumentPosition(matrix) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("mostra os nove módulos com cobertura e consulta somente o módulo expandido", async () => {
    render(<InviteModal {...defaultProps} />);
    await chooseProfile();
    const matrix = screen.getByRole("group", { name: "Módulos do perfil" });
    expect(within(matrix).getAllByRole("button")).toHaveLength(9);
    expect(
      within(matrix)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "Agenda1/9 liberadasParcial",
      "Pacientes6/12 liberadasParcial",
      "Atendimento0/6 liberadasSem acesso",
      "Prontuário0/5 liberadasSem acesso",
      "Documentos0/4 liberadasSem acesso",
      "Catálogo0/3 liberadasSem acesso",
      "Equipe0/7 liberadasSem acesso",
      "Clínica0/3 liberadasSem acesso",
      "Sistema0/3 liberadasSem acesso",
    ]);
    expect(screen.getByText("Atende na agenda")).toBeInTheDocument();
    const agenda = moduleButton("Agenda");
    expect(agenda).toHaveAttribute("type", "button");
    expect(agenda).toHaveAttribute("aria-controls", "module-detail");
    expect(agenda).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(agenda);
    expect(agenda).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "Funções de Agenda" });
    expect(panel).toHaveAttribute("id", "module-detail");
    expect(within(panel).getAllByRole("checkbox")).toHaveLength(9);
    expect(
      within(panel).getByRole("checkbox", { name: "Visualizar Agenda" }),
    ).toBeChecked();
    expect(
      within(panel).getByRole("checkbox", { name: "Criar Agendamento" }),
    ).not.toBeChecked();
    expect(
      within(panel).queryByText("Aparecer na Agenda como Profissional"),
    ).not.toBeInTheDocument();
    fireEvent.click(moduleButton("Documentos"));
    expect(
      screen.queryByRole("region", { name: "Funções de Agenda" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Funções de Documentos" }),
    ).toHaveTextContent("Ver Modelos de Anamnese");
    expect(agenda).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(moduleButton("Documentos"));
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it.each(["custom", "clinico"])(
    "exibe informativo de proteção do perfil sem botões redundantes (%s)",
    async (profile) => {
      render(<InviteModal {...defaultProps} />);
      await chooseProfile(profile);
      expect(
        screen.queryByRole("button", {
          name: /Editar este perfil|Criar (perfil|novo) com base/,
        }),
      ).not.toBeInTheDocument();
      if (profile === "custom") {
        expect(
          screen.getByText(/Perfil da sua clínica\. Personalize as permissões diretamente nos seletores acima\./),
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/alterações afetam os colaboradores/),
        ).not.toBeInTheDocument();
      } else {
        expect(
          screen.getByText(/Modelo protegido pelo sistema\. Personalize as permissões diretamente nos seletores acima\./),
        ).toBeInTheDocument();
      }
    },
  );

  it("recolhe ao trocar ou limpar perfil e ao fechar o convite", async () => {
    render(<InviteModal {...defaultProps} />);
    await chooseProfile();
    fireEvent.click(moduleButton("Agenda"));
    await chooseProfile("custom");
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    expect(moduleButton("Agenda")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(moduleButton("Agenda"));
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "" },
    });
    expect(
      screen.queryByRole("group", { name: "Módulos do perfil" }),
    ).not.toBeInTheDocument();
    await chooseProfile("clinico");
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    fireEvent.click(moduleButton("Agenda"));
    fireEvent.click(screen.getByRole("button", { name: "Fechar convite" }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
  });

  it("recolhe na sugestão automática ao trocar de cargo", async () => {
    render(
      <InviteModal
        {...defaultProps}
        roles={[
          { id: "medico", nome: "MEDICO", perfilAcessoPadraoId: "clinico" },
          {
            id: "recepcao",
            nome: "RECEPCIONISTA",
            perfilAcessoPadraoId: "custom",
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
      target: { value: "medico" },
    });
    await screen.findByRole("button", { name: /^Agenda / });
    fireEvent.click(moduleButton("Agenda"));
    fireEvent.change(screen.getByLabelText("Cargo na Clínica"), {
      target: { value: "recepcao" },
    });
    await screen.findByRole("button", { name: /^Agenda / });
    expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("custom");
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
  });

  it("esconde dados anteriores em loading/erro e permite tentar novamente sem reabrir painel", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => { });
    render(<InviteModal {...defaultProps} />);
    await chooseProfile();
    fireEvent.click(moduleButton("Agenda"));
    let finishRequest;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        }),
    );
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "custom" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Carregando funções");
    expect(
      screen.queryByRole("group", { name: "Módulos do perfil" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(finishRequest).toBeTypeOf("function"));
    await act(async () => finishRequest({ ok: false }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar",
    );
    expect(
      screen.queryByRole("group", { name: "Módulos do perfil" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar acesso" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("button", { name: /^Agenda / });
    expect(
      screen.queryByRole("region", { name: /^Funções de / }),
    ).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("ignora resposta tardia de outro perfil sem sobrescrever a matriz atual", async () => {
    let finishOldRequest;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldRequest = resolve;
        }),
    );
    render(<InviteModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "clinico" },
    });
    await waitFor(() => expect(finishOldRequest).toBeTypeOf("function"));
    fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await chooseProfile("custom");
    fireEvent.click(moduleButton("Agenda"));
    await act(async () =>
      finishOldRequest({ ok: true, json: async () => selectedIds }),
    );
    expect(moduleButton("Agenda")).toHaveTextContent("0/9 liberadasSem acesso");
    expect(screen.getByText("Não atende na agenda")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Funções de Agenda" }),
    ).not.toHaveTextContent("Liberada");
  });
});

describe("contrato compartilhado dos ícones Lucide", () => {
  it.each([
    ["cal", "CalendarDays"],
    ["calok", "CalendarCheck"],
    ["caloff", "CalendarOff"],
    ["users", "Users"],
    ["ucog", "UserCog"],
    ["gear", "Settings"],
    ["steth", "Stethoscope"],
    ["file", "FileText"],
    ["fold", "FileText"],
    ["book", "Sparkles"],
    ["sparkles", "Sparkles"],
    ["bld", "Building2"],
    ["lock", "Lock"],
    ["copy", "Copy"],
    ["pen", "PenLine"],
    ["shield", "Shield"],
    ["shield-check", "ShieldCheck"],
    ["info", "Info"],
    ["check", "Check"],
    ["x", "X"],
    ["search", "Search"],
    ["cr", "ChevronRight"],
    ["cd", "ChevronDown"],
    ["cl", "ChevronLeft"],
  ])("%s preserva os traçados oficiais de %s", (name, officialName) => {
    const paths = (markup) =>
      markup.slice(markup.indexOf(">") + 1, markup.lastIndexOf("</svg>"));
    expect(paths(renderToStaticMarkup(<PrototypeIcon name={name} />))).toBe(
      paths(renderToStaticMarkup(React.createElement(Lucide[officialName]))),
    );
  });

  it("preserva tamanhos, classe, props e fallback para nome desconhecido", () => {
    const { rerender } = render(
      <PrototypeIcon
        name="check"
        size="s"
        className="custom"
        aria-label="Estado"
      />,
    );
    expect(screen.getByLabelText("Estado")).toHaveAttribute("width", "16");
    expect(screen.getByLabelText("Estado")).toHaveClass(
      "prototype-icon",
      "custom",
    );
    rerender(<PrototypeIcon name="check" size="l" aria-label="Estado" />);
    expect(screen.getByLabelText("Estado")).toHaveAttribute("height", "22");
    rerender(<PrototypeIcon name="check" size={30} aria-label="Estado" />);
    expect(screen.getByLabelText("Estado")).toHaveAttribute("width", "30");
    rerender(<PrototypeIcon name="missing" aria-label="Estado" />);
    expect(screen.getByLabelText("Estado")).toHaveAttribute("width", "18");
    expect(screen.getByLabelText("Estado")).toHaveAttribute(
      "viewBox",
      "0 0 24 24",
    );
    expect(screen.getByLabelText("Estado").innerHTML).toBe(
      renderToStaticMarkup(<PrototypeIcon name="shield" />).replace(
        /^<svg[^>]*>|<\/svg>$/g,
        "",
      ),
    );
  });
});

describe("Validação de Integridade Estrita de Campos Obrigatórios", () => {
  const fillValidBasicsExcept = async (override = {}) => {
    // Cargo e Perfil
    const roleSelect = screen.getByLabelText(/Cargo na Clínica/);
    fireEvent.change(roleSelect, { target: { value: "dentista" } });

    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Criar acesso/i }),
      ).not.toBeDisabled(),
    );

    // Nome
    const nomeInput = screen.getByLabelText(/Nome Completo/);
    fireEvent.change(nomeInput, {
      target: { value: override.nome !== undefined ? override.nome : "Dra. Ana Silva" },
    });

    // Email
    const emailInput = screen.getByLabelText(/E-mail/);
    fireEvent.change(emailInput, {
      target: { value: override.email !== undefined ? override.email : "ana.silva@clinica.com" },
    });

    // CPF (529.982.247-25 é matematicamente válido)
    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, {
      target: { value: override.cpf !== undefined ? override.cpf : "529.982.247-25" },
    });

    // Senha
    const senhaInput = screen.getByLabelText(/Senha inicial/);
    fireEvent.change(senhaInput, {
      target: { value: override.senha !== undefined ? override.senha : "senhaSegura123" },
    });

    // Data de Nascimento
    const dataNascInput = screen.getByLabelText(/Data de Nascimento/);
    fireEvent.change(dataNascInput, {
      target: { value: override.dataNascimento !== undefined ? override.dataNascimento : "1990-05-15" },
    });

    // Estado Civil
    const estadoCivilSelect = screen.getByLabelText(/Estado Civil/);
    fireEvent.change(estadoCivilSelect, {
      target: { value: override.estadoCivilId !== undefined ? override.estadoCivilId : "civil" },
    });

    // Telefone
    const telInput = screen.getByLabelText(/Telefone Celular/);
    fireEvent.change(telInput, {
      target: { value: override.telefone !== undefined ? override.telefone : "(11) 98765-4321" },
    });
  };

  it("bloqueia submit quando o número de celular for incompleto ou incorreto", async () => {
    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept({ telefone: "(11) 9" });

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Informe um número de telefone celular completo e válido.",
    );
    const telInput = screen.getByLabelText(/Telefone Celular/);
    expect(telInput).toHaveClass("has-error");
    expect(
      screen.getByText("Informe um número de telefone celular completo e válido."),
    ).toBeInTheDocument();
  });

  it("exibe erro inline com borda vermelha ao sair do campo (onBlur) com telefone inválido", async () => {
    render(<InviteModal {...defaultProps} />);
    const telInput = screen.getByLabelText(/Telefone Celular/);

    fireEvent.change(telInput, { target: { value: "1198" } });
    fireEvent.blur(telInput);

    expect(telInput).toHaveClass("has-error");
    expect(
      screen.getByText("Informe um número de telefone celular completo e válido."),
    ).toBeInTheDocument();
  });

  it("bloqueia submit quando o CPF for matematicamente inválido (dígitos verificadores falsos)", async () => {
    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept({ cpf: "111.111.111-11" });

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "CPF inválido. Verifique os números digitados.",
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    expect(cpfInput).toHaveClass("has-error");
    expect(
      screen.getByText("CPF inválido. Verifique os números digitados."),
    ).toBeInTheDocument();
  });

  it("bloqueia submit e destaca campo quando o CPF já pertencer a um colaborador da equipe", async () => {
    render(
      <InviteModal
        {...defaultProps}
        equipeMembros={[
          { id: "mem-1", nomeCompleto: "João Silva", cpf: "529.982.247-25" },
        ]}
      />,
    );
    await fillValidBasicsExcept({ cpf: "529.982.247-25" });

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Já existe um usuário cadastrado com este CPF.",
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    expect(cpfInput).toHaveClass("has-error");
    expect(
      screen.getByText("Já existe um usuário cadastrado com este CPF."),
    ).toBeInTheDocument();
  });

  it("não incrementa contador de progresso quando o CPF for duplicado na equipe", async () => {
    render(
      <InviteModal
        {...defaultProps}
        equipeMembros={[
          { id: "mem-1", nomeCompleto: "João Silva", cpf: "529.982.247-25" },
        ]}
      />,
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, { target: { value: "529.982.247-25" } });
    expect(screen.getByText(/0 de 9 campos obrigatórios/)).toBeInTheDocument();
  });

  it("trata retorno 409 do backend destacando o campo CPF sem fechar o modal", async () => {
    fetch.mockImplementation((url) => {
      if (String(url).includes("/api/auth/completar-perfil")) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({
              message: "Já existe um usuário cadastrado com este CPF.",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept({});

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Já existe um usuário cadastrado com este CPF.",
    );
    const cpfInput = screen.getByLabelText(/CPF/);
    expect(cpfInput).toHaveClass("has-error");
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando a data de nascimento for futura", async () => {
    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept({ dataNascimento: "2099-01-01" });

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "A data de nascimento não pode ser no futuro.",
    );
    const dataInput = screen.getByLabelText(/Data de Nascimento/);
    expect(dataInput).toHaveClass("has-error");
    expect(
      screen.getByText("A data de nascimento não pode ser no futuro."),
    ).toBeInTheDocument();
  });

  it("bloqueia submit quando o e-mail não possuir domínio válido", async () => {
    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept({ email: "usuario@dominioincompleto" });

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Informe um e-mail profissional válido.",
    );
    const emailInput = screen.getByLabelText(/E-mail/);
    expect(emailInput).toHaveClass("has-error");
    expect(
      screen.getByText("Informe um e-mail profissional válido."),
    ).toBeInTheDocument();
  });

  it("sincroniza a contagem da barra de progresso (X de 9) exigindo validação estrita", async () => {
    render(<InviteModal {...defaultProps} />);

    // Inicia com 0 de 9
    expect(
      screen.getByText("0 de 9 campos obrigatórios preenchidos"),
    ).toBeInTheDocument();

    const telInput = screen.getByLabelText(/Telefone Celular/);

    // Telefone incompleto -> não incrementa
    fireEvent.change(telInput, { target: { value: "9" } });
    expect(
      screen.getByText("0 de 9 campos obrigatórios preenchidos"),
    ).toBeInTheDocument();

    // Telefone completo válido -> incrementa para 1 de 9
    fireEvent.change(telInput, { target: { value: "(11) 98765-4321" } });
    expect(
      screen.getByText("1 de 9 campos obrigatórios preenchidos"),
    ).toBeInTheDocument();

    // CPF com checksum falso -> não incrementa
    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, { target: { value: "111.111.111-11" } });
    expect(
      screen.getByText("1 de 9 campos obrigatórios preenchidos"),
    ).toBeInTheDocument();

    // CPF válido -> incrementa para 2 de 9
    fireEvent.change(cpfInput, { target: { value: "529.982.247-25" } });
    expect(
      screen.getByText("2 de 9 campos obrigatórios preenchidos"),
    ).toBeInTheDocument();
  });
});

describe("Edição Interativa de Permissões e Criação de Novo Perfil", () => {
  const fillValidBasicsExcept = async (override = {}) => {
    const roleSelect = screen.getByLabelText(/Cargo na Clínica/);
    fireEvent.change(roleSelect, { target: { value: "dentista" } });

    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Criar acesso/i }),
      ).not.toBeDisabled(),
    );

    const nomeInput = screen.getByLabelText(/Nome Completo/);
    fireEvent.change(nomeInput, {
      target: { value: override.nome !== undefined ? override.nome : "Dra. Ana Silva" },
    });

    const emailInput = screen.getByLabelText(/E-mail/);
    fireEvent.change(emailInput, {
      target: { value: override.email !== undefined ? override.email : "ana.silva@clinica.com" },
    });

    const cpfInput = screen.getByLabelText(/CPF/);
    fireEvent.change(cpfInput, {
      target: { value: override.cpf !== undefined ? override.cpf : "529.982.247-25" },
    });

    const senhaInput = screen.getByLabelText(/Senha inicial/);
    fireEvent.change(senhaInput, {
      target: { value: override.senha !== undefined ? override.senha : "senhaSegura123" },
    });

    const dataNascInput = screen.getByLabelText(/Data de Nascimento/);
    fireEvent.change(dataNascInput, {
      target: { value: override.dataNascimento !== undefined ? override.dataNascimento : "1990-05-15" },
    });

    const estadoCivilSelect = screen.getByLabelText(/Estado Civil/);
    fireEvent.change(estadoCivilSelect, {
      target: { value: override.estadoCivilId !== undefined ? override.estadoCivilId : "civil" },
    });

    const telInput = screen.getByLabelText(/Telefone Celular/);
    fireEvent.change(telInput, {
      target: { value: override.telefone !== undefined ? override.telefone : "(11) 98765-4321" },
    });
  };

  it("renderiza o card de governança com badges e contagem de funções ao selecionar perfil", async () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Resumo do perfil de acesso" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/funções liberadas/)).toBeInTheDocument();
    expect(screen.getByText("Modelo pronto · protegido")).toBeInTheDocument();
  });

  it("marca o perfil como customizado e exibe o banner custom-profile-alert ao alterar permissão", async () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Módulos do perfil" })).toBeInTheDocument(),
    );

    // Expande o módulo Agenda
    const agendaBtn = screen.getByRole("button", { name: /Agenda .* liberadas/ });
    fireEvent.click(agendaBtn);

    const permDetail = screen.getByLabelText("Funções de Agenda");
    expect(permDetail).toBeInTheDocument();

    // Encontra o checkbox de uma permissão liberada
    const checkbox = within(permDetail).getAllByRole("checkbox")[0];
    expect(checkbox).toBeChecked();

    // Desmarca a permissão
    fireEvent.click(checkbox);

    // O banner de personalização deve aparecer
    expect(
      screen.getByText("Você está personalizando as permissões deste colaborador"),
    ).toBeInTheDocument();
    expect(screen.getByText(/-1 desmarcadas/)).toBeInTheDocument();
  });

  it("reverte as permissões para o modelo base ao clicar em Restaurar", async () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Módulos do perfil" })).toBeInTheDocument(),
    );

    const agendaBtn = screen.getByRole("button", { name: /Agenda .* liberadas/ });
    fireEvent.click(agendaBtn);

    const permDetail = screen.getByLabelText("Funções de Agenda");
    const checkbox = within(permDetail).getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    expect(
      screen.getByText("Você está personalizando as permissões deste colaborador"),
    ).toBeInTheDocument();

    // Clica em Restaurar
    const undoBtn = screen.getByRole("button", { name: "Restaurar" });
    fireEvent.click(undoBtn);

    expect(toastMocks.success).toHaveBeenCalledWith(
      "Permissões restauradas para o modelo base.",
    );
    expect(
      screen.queryByText("Você está personalizando as permissões deste colaborador"),
    ).toBeNull();
  });

  it("aplica ações rápidas em lote no módulo (Sem acesso e Tudo)", async () => {
    render(<InviteModal {...defaultProps} />);
    const perfilSelect = screen.getByLabelText(/Perfil de acesso/);
    fireEvent.change(perfilSelect, { target: { value: "clinico" } });

    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Módulos do perfil" })).toBeInTheDocument(),
    );

    const agendaBtn = screen.getByRole("button", { name: /Agenda .* liberadas/ });
    fireEvent.click(agendaBtn);

    // Clica em Sem acesso
    const semAcessoBtn = screen.getByRole("button", { name: "Sem acesso" });
    fireEvent.click(semAcessoBtn);

    expect(
      screen.getByText("Você está personalizando as permissões deste colaborador"),
    ).toBeInTheDocument();

    // Clica em Tudo
    const tudoBtn = screen.getByRole("button", { name: "Tudo" });
    fireEvent.click(tudoBtn);

    // Verifica que todas as funções do módulo estão liberadas
    const permDetail = screen.getByLabelText("Funções de Agenda");
    const allCheckboxes = within(permDetail).getAllByRole("checkbox");
    expect(allCheckboxes.every((cb) => cb.checked)).toBe(true);
  });

  it("abre o modal Salvar Novo Perfil de Acesso ao clicar em Criar acesso com perfil customizado", async () => {
    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept();

    // Expande módulo e desmarca uma função
    const agendaBtn = screen.getByRole("button", { name: /Agenda .* liberadas/ });
    fireEvent.click(agendaBtn);

    const permDetail = screen.getByLabelText("Funções de Agenda");
    const checkbox = within(permDetail).getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    // Submete o formulário
    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    // Abre o sub-modal de salvar novo perfil
    expect(
      screen.getByRole("dialog", { name: "Salvar Novo Perfil de Acesso" }),
    ).toBeInTheDocument();

    const nomePerfilInput = screen.getByLabelText(/Nome do Novo Perfil/);
    expect(nomePerfilInput).toBeInTheDocument();
    expect(nomePerfilInput).toHaveValue("Dentista Personalizado");
  });

  it("cria o novo perfil na API e vincula o colaborador ao confirmar no modal", async () => {
    const novoPerfilMock = {
      id: "cli-novo-uuid-123",
      nome: "Dentista Personalizado",
    };

    fetch.mockImplementation(async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("signup") || urlStr.includes("/auth/v1/")) {
        return {
          ok: true,
          json: async () => ({
            user: { id: "usr_mock_123" },
            session: { access_token: "mock_token" },
          }),
        };
      }
      if (urlStr.includes("/api/v1/equipe")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      if (urlStr.includes("/api/v1/perfis-acesso") && opts?.method === "POST") {
        return {
          ok: true,
          json: async () => novoPerfilMock,
        };
      }
      if (urlStr.includes("/permissoes") && opts?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({}),
        };
      }
      if (urlStr.includes("/api/auth/completar-perfil")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        json: async () => selectedIds,
      };
    });

    render(<InviteModal {...defaultProps} />);
    await fillValidBasicsExcept();

    const agendaBtn = screen.getByRole("button", { name: /Agenda .* liberadas/ });
    fireEvent.click(agendaBtn);

    const permDetail = screen.getByLabelText("Funções de Agenda");
    const checkbox = within(permDetail).getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    const submitBtn = screen.getByRole("button", { name: /Criar acesso/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByRole("dialog", { name: "Salvar Novo Perfil de Acesso" }),
    ).toBeInTheDocument();

    const salvarPerfilBtn = screen.getByRole("button", {
      name: "Salvar perfil e criar acesso",
    });
    fireEvent.click(salvarPerfilBtn);

    await waitFor(() => {
      expect(toastMocks.success).toHaveBeenCalledWith(
        "Acesso criado com sucesso!",
      );
    });
    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });
});
