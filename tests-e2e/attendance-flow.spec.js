import { test, expect } from '@playwright/test';

test.describe('Procedi - Attendance & Clinical Journey Flow', () => {
  test.setTimeout(90000);

  test('abre prontuario do paciente e valida inicio de atendimento', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });

    console.log('>>> Navegando para a aplicacao...');
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);

    // Se estiver no login
    const loginHeader = page.locator('h1:has-text("Procedi")');
    if (await loginHeader.isVisible()) {
      await page.locator('input[placeholder="E-mail ou nome cadastrado"]').or(page.locator('input[type="text"]').first()).fill('guilhermebarcelos2006@gmail.com');
      await page.locator('input[placeholder="Sua senha"]').or(page.locator('input[type="password"]')).fill('teste123');
      await page.locator('button[type="submit"]:has-text("Entrar no Sistema")').click();
      await page.waitForTimeout(3000);
    }

    await page.waitForSelector('nav', { timeout: 20000 });

    // Navega para Pacientes
    const pacientesNavBtn = page.locator('button[title="Pacientes"]').or(page.locator('nav button:has-text("Pacientes")')).first();
    await pacientesNavBtn.click();
    await page.waitForTimeout(2000);

    // Clica no botão "Ver mais" do paciente "Paciente Teste Ee"
    console.log('>>> Abrindo prontuário do paciente...');
    const verMaisBtn = page.locator('button:has-text("Ver mais")').last();
    await verMaisBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'c:/Procedi/screenshots_e2e/08_prontuario_paciente.png', fullPage: true });
    console.log('>>> [OK] Prontuário aberto com sucesso!');

    // Localiza e clica no botão "Iniciar Atendimento" visível no drawer
    console.log('>>> Clicando no botão Iniciar Atendimento do drawer...');
    const iniciarBtn = page.locator('button:has-text("Iniciar Atendimento"):visible').last();
    await expect(iniciarBtn).toBeVisible({ timeout: 10000 });
    await iniciarBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'c:/Procedi/screenshots_e2e/09_atendimento_clinico.png', fullPage: true });
    console.log('>>> [OK] Atendimento Clínico iniciado com sucesso!');
  });
});
