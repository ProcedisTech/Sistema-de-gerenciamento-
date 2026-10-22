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

// Regressão prevenida: consulta por módulo e edição de perfis respeitam a seleção e a autorização do convite.

vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
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
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => selectedIds })),
  );
});
afterEach(() => {
  cleanup();
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

  it("preserva rascunho ao usar modelo como base sem confirmação extra", async () => {
    const onEditarPerfilNaAba = vi.fn();
    render(
      <InviteModal
        {...defaultProps}
        onEditarPerfilNaAba={onEditarPerfilNaAba}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Pessoa do convite" },
    });
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "clinico" },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Criar perfil com base neste modelo",
      }),
    );
    expect(onEditarPerfilNaAba).toHaveBeenCalledWith(
      "copy:clinico",
      expect.objectContaining({
        form: expect.objectContaining({
          nome: "Pessoa do convite",
          perfilAcessoId: "clinico",
        }),
      }),
    );
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
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
      "Pacientes6/6 liberadasCompleto",
      "Atendimento0/6 liberadasSem acesso",
      "Prontuário0/9 liberadasSem acesso",
      "Documentos0/6 liberadasSem acesso",
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
    expect(within(panel).getAllByRole("listitem")).toHaveLength(9);
    expect(
      within(panel).getByText("Visualizar Agenda").closest("li"),
    ).toHaveTextContent("Liberada");
    expect(
      within(panel).getByText("Criar Agendamento").closest("li"),
    ).toHaveTextContent("Bloqueada");
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
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ["custom", "Editar este perfil", "custom"],
    ["custom", "Criar novo com base neste", "copy:custom"],
    ["clinico", "Criar perfil com base neste modelo", "copy:clinico"],
  ])(
    "abre a ação %s / %s com destino %s e rascunho completo",
    async (profile, label, destination) => {
      render(<InviteModal {...defaultProps} />);
      fireEvent.change(screen.getByLabelText("Nome Completo"), {
        target: { value: "Rascunho" },
      });
      fireEvent.change(screen.getByLabelText("Telefone Celular (Opcional)"), {
        target: { value: "11999999999" },
      });
      await chooseProfile(profile);
      if (profile === "custom") {
        expect(
          screen.getByText(/alterações afetam os colaboradores/),
        ).toBeInTheDocument();
        expect(screen.getByText("Perfil da sua Clínica")).toBeInTheDocument();
      } else {
        expect(
          screen.queryByRole("button", { name: "Editar este perfil" }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByText("Modelo do Sistema · protegido"),
        ).toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(defaultProps.onEditarPerfilNaAba).toHaveBeenCalledWith(
        destination,
        expect.objectContaining({
          form: expect.objectContaining({
            nome: "Rascunho",
            perfilAcessoId: profile,
          }),
          telefoneCountryCode: "BR",
          telefoneNumero: "(11) 99999-9999",
        }),
      );
    },
  );

  it.each(["clinico", "custom"])(
    "mantém consulta sem CTAs de mutação sem autorização (%s)",
    async (profile) => {
      render(<InviteModal {...defaultProps} canEditConfigPerfil={false} />);
      await chooseProfile(profile);
      expect(
        screen.queryByRole("button", {
          name: /Editar este perfil|Criar (perfil|novo) com base/,
        }),
      ).not.toBeInTheDocument();
      fireEvent.click(moduleButton("Agenda"));
      expect(
        screen.getByRole("region", { name: "Funções de Agenda" }),
      ).toBeInTheDocument();
      expect(defaultProps.onEditarPerfilNaAba).not.toHaveBeenCalled();
    },
  );

  it("oculta ações quando o callback do editor não está disponível", async () => {
    render(<InviteModal {...defaultProps} onEditarPerfilNaAba={undefined} />);
    await chooseProfile("custom");
    expect(
      screen.queryByRole("button", {
        name: /Editar este perfil|Criar novo com base/,
      }),
    ).not.toBeInTheDocument();
  });

  it("recolhe ao trocar ou limpar perfil e ao fechar o convite", async () => {
    render(<InviteModal {...defaultProps} />);
    await chooseProfile();
    fireEvent.click(moduleButton("Agenda"));
    await chooseProfile("custom");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(moduleButton("Agenda")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(moduleButton("Agenda"));
    fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
      target: { value: "" },
    });
    expect(
      screen.queryByRole("group", { name: "Módulos do perfil" }),
    ).not.toBeInTheDocument();
    await chooseProfile("clinico");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(moduleButton("Agenda"));
    fireEvent.click(screen.getByRole("button", { name: "Fechar convite" }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("esconde dados anteriores em loading/erro e permite tentar novamente sem reabrir painel", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
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
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await waitFor(() => expect(finishRequest).toBeTypeOf("function"));
    await act(async () => finishRequest({ ok: false }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar",
    );
    expect(
      screen.queryByRole("group", { name: "Módulos do perfil" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar acesso" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("button", { name: /^Agenda / });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
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
