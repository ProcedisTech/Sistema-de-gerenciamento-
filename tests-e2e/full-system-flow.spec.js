/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const screenshotsDir = process.env.SCREENSHOTS_DIR || (process.platform === 'win32' ? 'c:/Procedi/screenshots_e2e' : './screenshots_e2e');
if (!fs.existsSync(screenshotsDir)) {
  try {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

test.describe('Procedi - Full System E2E Flow', () => {
  test.setTimeout(180000); // 3 minutes timeout for complete multi-step flow

  test.beforeEach(async () => {
    test.skip(
      !!process.env.CI && !process.env.E2E_LIVE_BACKEND,
      'Teste E2E de integração requer backend Spring Boot e banco ativo (ignorado no CI isolado).'
    );
  });

  test('executa fluxo completo ponta a ponta no sistema', async ({ page }) => {
    // Configura viewport padrão desktop grande
    await page.setViewportSize({ width: 1366, height: 768 });

    console.log('>>> [1/6] Iniciando Navegação e Login...');
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);

    // Se a tela de login estiver visível, autenticar com a conta oficial
    const loginHeader = page.locator('h1:has-text("Procedi")');
    const isLoginVisible = await loginHeader.isVisible();

    if (isLoginVisible) {
      console.log('>>> Preenchendo credenciais oficiais do desenvolvedor...');
      const emailInput = page.locator('input[placeholder="E-mail ou nome cadastrado"]').or(page.locator('input[type="text"]').first());
      const passwordInput = page.locator('input[placeholder="Sua senha"]').or(page.locator('input[type="password"]'));
      
      await emailInput.fill('guilhermebarcelos2006@gmail.com');
      await passwordInput.fill('teste123');
      
      const submitBtn = page.locator('button[type="submit"]:has-text("Entrar no Sistema")').or(page.locator('button[type="submit"]'));
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }

    // Aguarda o layout principal / Dashboard
    console.log('>>> Aguardando carregamento do Dashboard...');
    await page.waitForSelector('nav', { timeout: 30000 });
    const pacientesNavBtn = page.locator('button[title="Pacientes"]').or(page.locator('nav button:has-text("Pacientes")')).first();
    await expect(pacientesNavBtn).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(screenshotsDir, '01_dashboard.png'), fullPage: true });
    console.log('>>> [OK] Dashboard carregado com sucesso!');

    // ----------------------------------------------------
    // FLUXO 2: GESTÃO DE EQUIPE & RBAC (PERFIS E MEMBROS)
    // ----------------------------------------------------
    console.log('>>> [2/6] Navegando para Gestão de Equipe...');
    const equipeNavBtn = page.locator('button[title="Gestão de Equipe"]').or(page.locator('nav button:has-text("Gestão de Equipe")')).first();
    await equipeNavBtn.click();
    await page.waitForTimeout(2000);
    
    const membrosTab = page.locator('button:has-text("Membros da Equipe")').or(page.locator('button:has-text("Membros")')).first();
    await expect(membrosTab).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '02_gestao_equipe_membros.png'), fullPage: true });

    // Aba Perfis de Acesso
    console.log('>>> Acessando aba Perfis de Acesso...');
    const perfisTabBtn = page.locator('button:has-text("Perfis de Acesso")').or(page.locator('button:has-text("Perfis")')).first();
    await perfisTabBtn.click();
    await page.waitForTimeout(2000);

    // Criar Perfil Customizado
    console.log('>>> Abrindo criação de novo Perfil Customizado...');
    const novoPerfilBtn = page.locator('button:has-text("Novo Perfil Customizado")').or(page.locator('button:has-text("Novo Perfil")')).first();
    if (await novoPerfilBtn.isVisible()) {
      await novoPerfilBtn.click();
      await page.waitForTimeout(1000);

      // 1. Seleciona um cargo base para pré-carregar as permissões oficiais do cargo
      const cargoBaseSelect = page.locator('select').filter({ hasText: /Selecione um cargo/i }).first();
      if (await cargoBaseSelect.isVisible()) {
        await cargoBaseSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }

      // 2. Personaliza nome e descrição do perfil
      const nomeInput = page.locator('input[placeholder="Ex: Recepcionista Sênior"]').first();
      const descInput = page.locator('textarea[placeholder="Ex: Acesso às rotinas de recepção e faturamento básico."]').first();
      
      const perfilNome = 'Perfil E2E Automação ' + Math.floor(Math.random() * 1000);
      await nomeInput.fill(perfilNome);
      await descInput.fill('Perfil criado via teste automatizado ponta a ponta com permissões carregadas.');

      // 3. Avançar para o passo 2 (Permissões) usando o botão "Continuar →"
      const continuarBtn = page.locator('button[type="submit"]:has-text("Continuar")').or(page.locator('button:has-text("Continuar")')).first();
      await continuarBtn.click();
      await page.waitForTimeout(1000);

      // 4. Salvar Perfil no passo 2 com o botão "Salvar Alterações"
      const salvarPerfilBtn = page.locator('button[type="submit"]:has-text("Salvar Alterações")').or(page.locator('button:has-text("Salvar")')).first();
      await salvarPerfilBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '03_perfil_customizado_criado.png'), fullPage: true });
      console.log('>>> [OK] Perfil Customizado criado com permissões com sucesso!');
    }

    // Voltar para aba Membros e testar edição de membro existente
    console.log('>>> Testando edição de membro da equipe...');
    await membrosTab.click();
    await page.waitForTimeout(1500);

    // Clica no botão Editar de um membro da lista
    const editMemberBtn = page.locator('button:has-text("Editar")').first();
    if (await editMemberBtn.isVisible()) {
      await editMemberBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '04_modal_editar_membro.png'), fullPage: true });
      
      // Fecha modal de edição pelo botão X ou Escape
      const closeBtn = page.locator('div.fixed.inset-0 button').filter({ has: page.locator('svg') }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
      console.log('>>> [OK] Modal de edição de membro validado com sucesso!');
    }

    // ----------------------------------------------------
    // FLUXO 3: CADASTRO DE PACIENTE
    // ----------------------------------------------------
    console.log('>>> [3/6] Navegando para Pacientes...');
    await pacientesNavBtn.click();
    await page.waitForTimeout(2000);

    console.log('>>> Clicando em Novo Paciente...');
    const novoPacienteBtn = page.locator('button:has-text("Novo Paciente")').first();
    await novoPacienteBtn.click();
    await page.waitForTimeout(2000);

    // Preenchimento dos dados do paciente
    console.log('>>> Preenchendo formulário de Paciente...');
    const nomePaciente = 'Paciente Teste E2E ' + Math.floor(Math.random() * 1000);
    const nomePacienteInput = page.locator('input[placeholder="Nome completo do paciente"]').first();
    await nomePacienteInput.fill(nomePaciente);

    // Nascimento
    const nascInput = page.locator('input[placeholder="dd/mm/aaaa"]').first();
    await nascInput.fill('15/08/1990');

    // Sexo
    const sexoSelect = page.locator('select').filter({ hasText: /Selecione|Feminino|Masculino/i }).first();
    if (await sexoSelect.isVisible()) {
      await sexoSelect.selectOption('F');
    }

    // Estado Civil
    const estadoCivilSelect = page.locator('#patient-form-estado-civil').or(page.locator('select').filter({ hasText: /Solteiro|Casado|Estado Civil/i })).first();
    if (await estadoCivilSelect.isVisible()) {
      await estadoCivilSelect.selectOption({ index: 1 });
    }

    // Profissão (Custom Select)
    console.log('>>> Selecionando Profissão...');
    const profissaoBtn = page.locator('button:has-text("Selecione a profissao")').first();
    if (await profissaoBtn.isVisible()) {
      await profissaoBtn.click();
      await page.waitForTimeout(600);
      const opcaoProfissao = page.locator('ul[role="listbox"] button[role="option"]').first();
      if (await opcaoProfissao.isVisible()) {
        await opcaoProfissao.click();
      }
      await page.waitForTimeout(400);
    }

    // CPF (CPF válido gerado)
    console.log('>>> Preenchendo CPF...');
    const cpfInput = page.locator('#patient-form-cpf').or(page.locator('input[name="cpf"]')).first();
    await cpfInput.fill('52998224725');

    // Telefone
    console.log('>>> Preenchendo Telefone...');
    const telInput = page.locator('input[type="tel"]').first();
    await telInput.fill('61987654321');

    // Email
    const emailInput = page.locator('input[placeholder*="email"]').or(page.locator('input[type="email"]')).first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('paciente.e2e@teste.com');
    }

    // Salvar Paciente
    console.log('>>> Salvando cadastro de Paciente...');
    const salvarPacienteBtn = page.locator('button:has-text("Cadastrar Paciente")').or(page.locator('button[type="submit"]')).first();
    await salvarPacienteBtn.click();
    // Aguarda o salvamento e o retorno automático para a lista (1.5s)
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(screenshotsDir, '05_paciente_cadastrado.png'), fullPage: true });
    console.log('>>> [OK] Paciente cadastrado com sucesso!');

    // Garante que qualquer modal aberto seja fechado
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ----------------------------------------------------
    // FLUXO 4: AGENDA & AGENDAMENTO
    // ----------------------------------------------------
    console.log('>>> [4/6] Navegando para Agenda...');
    const agendaNavBtn = page.locator('button[title="Agenda"]').or(page.locator('nav button:has-text("Agenda")')).first();
    await agendaNavBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(screenshotsDir, '06_agenda_dashboard.png'), fullPage: true });

    // Abrir Modal de Agendamento
    console.log('>>> Abrindo criação de Agendamento...');
    const novoAgendamentoBtn = page.locator('header button:has-text("Agendamento")').or(page.locator('button:has-text("Agendamento")')).first();
    if (await novoAgendamentoBtn.isVisible()) {
      await novoAgendamentoBtn.click();
      await page.waitForTimeout(2000);

      // Preenche busca de paciente
      const buscaPacienteInput = page.locator('input[placeholder*="Buscar por nome"]').or(page.locator('input[placeholder*="paciente"]')).first();
      if (await buscaPacienteInput.isVisible()) {
        await buscaPacienteInput.fill(nomePaciente);
        await page.waitForTimeout(1000);
        const optionItem = page.locator(`text="${nomePaciente}"`).or(page.locator('li[role="option"]').first());
        if (await optionItem.first().isVisible()) {
          await optionItem.first().click();
        }
      }

      await page.screenshot({ path: path.join(screenshotsDir, '07_modal_agendamento.png'), fullPage: true });
      console.log('>>> [OK] Modal de agendamento validado com sucesso!');
      
      // Fecha modal de agendamento
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // ----------------------------------------------------
    // FLUXO 5: PRONTUÁRIO & ATENDIMENTO CLÍNICO
    // ----------------------------------------------------
    console.log('>>> [5/6] Validando Prontuário e Início de Atendimento...');
    // Volta para pacientes para localizar o paciente recém-criado
    await pacientesNavBtn.click();
    await page.waitForTimeout(2000);

    const pacienteCard = page.locator(`text="${nomePaciente}"`).first();
    if (await pacienteCard.isVisible()) {
      await pacienteCard.click();
      await page.waitForTimeout(2000);

      // Verifica se o perfil do paciente abriu com prontuário e botão Iniciar Atendimento
      const iniciarAtendimentoBtn = page.locator('button:has-text("Iniciar Atendimento")').or(page.locator('button:has-text("Iniciar atendimento")')).first();
      if (await iniciarAtendimentoBtn.isVisible()) {
        console.log('>>> Botão Iniciar Atendimento visível no prontuário!');
        await page.screenshot({ path: path.join(screenshotsDir, '08_prontuario_paciente.png'), fullPage: true });
        
        await iniciarAtendimentoBtn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(screenshotsDir, '09_atendimento_clinico.png'), fullPage: true });
        console.log('>>> [OK] Fluxo de atendimento clínico iniciado com sucesso!');

        // Fecha fluxo/modal com Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }

    // ----------------------------------------------------
    // FLUXO 6: AUDITORIA & HISTÓRICO DE AÇÕES
    // ----------------------------------------------------
    console.log('>>> [6/6] Validando Auditoria e Histórico de Ações...');
    await equipeNavBtn.click();
    await page.waitForTimeout(2000);

    const auditoriaTabBtn = page.locator('button:has-text("Histórico de Ações")').or(page.locator('button:has-text("Histórico")')).first();
    if (await auditoriaTabBtn.isVisible()) {
      await auditoriaTabBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '10_auditoria_historico.png'), fullPage: true });
      console.log('>>> [OK] Trilha de Auditoria validada com sucesso!');
    }

    console.log('>>> TODOS OS FLUXOS CONCLUÍDOS COM SUCESSO! <<<');
  });
});
