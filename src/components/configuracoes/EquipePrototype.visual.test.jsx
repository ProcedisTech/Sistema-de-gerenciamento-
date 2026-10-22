/* global process */
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { writeFileSync } from "node:fs";
import fixtures from "../../test/fixtures/equipePrototype.json";
import { GestaoUsuariosView } from "./GestaoUsuariosView";
vi.mock("../../contexts/OrgContext", () => ({
  useOrg: () => ({ roleUserId: "dono-0" }),
}));
vi.mock("../../contexts/useToast.js", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("../../hooks/usePapel", () => ({
  usePapel: () => ({
    canSeeConfigEquipe: true,
    canCreateUsers: true,
    canManageUsers: true,
    canDeleteUsers: true,
    canSeeConfigPerfil: true,
    canEditConfigPerfil: true,
    canSeeConfigAuditoria: true,
    canExportPdf: true,
    canSeeAgenda: true,
    canSeeAgendaMulti: true,
  }),
}));
vi.mock("../hooks/useAgoraDaClinica.js", () => ({
  useAgoraDaClinica: () => ({
    hojeIso: "2026-10-01",
    fuso: "America/Sao_Paulo",
  }),
}));
vi.mock("../../hooks/useEstadosCivis.js", () => ({
  useEstadosCivis: () => ({ estadosCivis: [], loading: false }),
}));
vi.mock("../../services/api", () => ({
  authHeadersForFetch: async () => ({}),
  configuracoesClinicaApi: { buscar: async () => ({}) },
  clinicaApi: { buscar: async () => ({ nome: "Clínica Aurora", cnpj: "11222333000181" }) },
  agendasApi: {
    byRange: async () => [
      {
        id: "fixture-agenda",
        profissionalRoleUserId: "prof-0",
        pacienteId: "fixture-paciente",
        pacienteNome: "Paciente ilustrativo",
        dataAgendamento: "2026-10-01",
        horaInicio: "10:00",
        horaFim: "10:30",
        statusCodigo: "REALIZADO",
        catalogoProcedimentoNome: "Procedimento ilustrativo",
      },
    ],
  },
  disponibilidadeApi: { buscar: async () => [] },
  equipeApi: { list: async () => fixtures.people },
  auditoriaApi: {
    list: async () => ({
      content: [
        {
          id: "fixture-audit",
          roleUserId: "sec1-0",
          nomeUsuario: "Eduarda Prado",
          criadoEm: "2026-10-01T13:00:00Z",
          acao: "PACIENTE_EDITAR",
          entidade: "PACIENTE",
          descricao: "Alteração ilustrativa",
          suspeito: true,
          dadosAntigos: '{"nome":"Antes"}',
          dadosNovos: '{"nome":"Depois"}',
        },
      ],
      totalElements: 1,
    }),
  },
  getApiErrorDetail: () => "",
  getApiErrorToastMessage: (_, msg) => msg,
}));
vi.mock("../hooks/useFusoClinica", () => ({
  useFusoClinica: () => ({ fuso: "America/Sao_Paulo" }),
}));
vi.mock("../../config/apiEnv", () => ({ resolveApiUrl: (p) => p }));
const exportView = (name) => {
  if (!process.env.PROTOTYPE_VISUAL_EXPORT) return;
  const styles = [
    "/src/styles/index.css",
    ...[
      "equipePrototypeBase",
      "gestaoEquipe",
      "equipePessoa",
      "gestaoPerfilEditor",
      "invitePrototype",
      "auditoria",
    ].map((n) => `/src/components/configuracoes/${n}.css`),
  ];
  writeFileSync(
    `public/__visual-${name}.html`,
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join("")}<style>body{margin:0;background:#f8fafc}.evidence-main{padding:24px 32px;min-width:0}@media(max-width:767px){.evidence-main{padding:16px}}.prototype-perfil-editor .sticky-sum{left:0}</style><body><main class="evidence-main">${document.body.innerHTML}</main></body></html>`,
  );
};
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        const u = String(url);
        const id = u.match(/perfis-acesso\/([^/]+)\/permissoes/);
        if (id) return fixtures.permissions[id[1]] || [];
        if (u.endsWith("/equipe")) return fixtures.people;
        if (u.endsWith("/roles"))
          return [
            { id: "recepcao", nome: "RECEPCIONISTA" },
            { id: "dentista", nome: "DENTISTA" },
          ];
        if (u.endsWith("/perfis-acesso")) return fixtures.profiles;
        if (u.endsWith("/permissoes")) return fixtures.catalog;
        return [];
      },
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("reproduz o painel com dados do HTML e conserva rascunho durante o editor", async () => {
  render(<GestaoUsuariosView />);
  await screen.findByRole("button", { name: "Ver Eduarda Prado" });
  await waitFor(() =>
    expect(document.querySelector(".rail").textContent).toContain("2 de 53"),
  );
  const rail = document.querySelector(".rail");
  expect(
    [...rail.querySelectorAll(".rgl")].map((n) => n.textContent.trim()),
  ).toEqual(["Da sua clínica", "Modelos prontos"]);
  expect([...rail.querySelectorAll(".dot")].map((n) => n.className)).toEqual([
    "dot all",
    "dot dono",
    "dot cli",
    "dot cli",
    "dot cli",
    "dot tpl",
    "dot tpl",
    "dot tpl",
  ]);
  expect(
    [...rail.querySelectorAll(".rit .nm b")].map((n) => n.textContent),
  ).toEqual([
    "Toda a equipe",
    "Dono",
    "Secretaria-1",
    "Secretaria-2",
    "Secretaria-3",
    "Administrador",
    "Sócio / Investidor",
    "Profissional Clínico",
  ]);
  exportView("equipe");
  fireEvent.click(within(rail).getByRole("button", { name: /Dono.*53 de 53/ }));
  exportView("dono");
  fireEvent.click(
    within(rail).getByRole("button", { name: /Administrador.*52 de 53/ }),
  );
  exportView("modelo");
  fireEvent.click(within(rail).getByRole("button", { name: /Toda a equipe/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Ver Profissional Clínico 1" }),
  );
  exportView("profissional");
  for (const name of [
    "Agenda",
    "Atendimentos",
    "Pacientes",
    "Acesso",
    "Histórico",
  ]) {
    fireEvent.click(screen.getByRole("tab", { name, exact: true }));
    exportView("profissional-" + name.toLowerCase());
  }
  fireEvent.click(
    screen
      .getAllByRole("button", { name: "Gestão de Equipe", exact: true })
      .at(-1),
  );

  fireEvent.click(
    within(rail).getByRole("button", { name: /Secretaria-1.*2 de 53/ }),
  );
  exportView("perfil-personalizado");
  fireEvent.click(screen.getByRole("button", { name: "Ver Eduarda Prado" }));
  exportView("pessoa");
  for (const name of [
    "Agenda",
    "Atendimentos",
    "Pacientes",
    "Acesso",
    "Histórico",
  ]) {
    fireEvent.click(screen.getByRole("tab", { name, exact: true }));
    exportView("pessoa-" + name.toLowerCase());
  }
  fireEvent.click(
    screen
      .getAllByRole("button", { name: "Gestão de Equipe", exact: true })
      .at(-1),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Convidar pessoa", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Nome Completo"), {
    target: { value: "Rascunho preservado" },
  });
  fireEvent.change(screen.getByLabelText("Perfil de acesso"), {
    target: { value: "sec1" },
  });
  await screen.findByRole("group", { name: "Módulos do perfil" });
  exportView("convite");
  fireEvent.click(screen.getByRole("button", { name: "Editar este perfil" }));
  expect(screen.getByLabelText("Nome do perfil")).toHaveValue("Secretaria-1");
  await waitFor(() =>
    expect(document.querySelector(".sum .big").textContent).toContain("2"),
  );
  exportView("editor");
  fireEvent.click(
    screen.getByRole("button", { name: "Cancelar", exact: true }),
  );
  expect(screen.getByLabelText("Nome Completo")).toHaveValue(
    "Rascunho preservado",
  );
  expect(screen.getByLabelText("Perfil de acesso")).toHaveValue("sec1");
  fireEvent.click(screen.getByRole("button", { name: "Fechar convite" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Histórico / Auditoria", exact: true }),
  );
  await screen.findByRole("button", { name: /Ver detalhes:/ });
  exportView("auditoria");
  fireEvent.click(screen.getByRole("button", { name: /Ver detalhes:/ }));
  exportView("auditoria-detalhes");
  fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Exportar / PDF", exact: true }));
  expect(screen.getByRole("dialog", { name: "Relatório de auditoria" })).toBeInTheDocument();
  exportView("auditoria-relatorio");
  expect(
    fetch.mock.calls.every(([, opts]) => !opts.method || opts.method === "GET"),
  ).toBe(true);
}, 15000);
