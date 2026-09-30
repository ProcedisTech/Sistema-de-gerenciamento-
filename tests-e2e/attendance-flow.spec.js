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

test.describe('Procedi - Attendance & Clinical Journey Flow', () => {
  test.setTimeout(90000);

  test.beforeEach(async () => {
    test.skip(
      !!process.env.CI && !process.env.E2E_LIVE_BACKEND,
      'Teste E2E de integração requer backend Spring Boot e banco ativo (ignorado no CI isolado).'
    );
  });

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
    await page.screenshot({ path: path.join(screenshotsDir, '08_prontuario_paciente.png'), fullPage: true });
    console.log('>>> [OK] Prontuário aberto com sucesso!');

    // Localiza e clica no botão "Iniciar Atendimento" visível no drawer
    console.log('>>> Clicando no botão Iniciar Atendimento do drawer...');
    const iniciarBtn = page.locator('button:has-text("Iniciar Atendimento"):visible').last();
    await expect(iniciarBtn).toBeVisible({ timeout: 10000 });
    await iniciarBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '09_atendimento_clinico.png'), fullPage: true });
    console.log('>>> [OK] Atendimento Clínico iniciado com sucesso!');
  });
});
