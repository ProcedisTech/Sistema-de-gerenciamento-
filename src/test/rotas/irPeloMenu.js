/** Barra de baixo (móvel): Configurações e Sair ficam dentro do "Menu" (decisão 12). Abre o dialog e clica o item. */
import { fireEvent, screen, within } from '@testing-library/react';

export async function abrirMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  return within(await screen.findByRole('dialog', { name: 'Menu' }));
}

export async function irPeloMenu(nome) {
  const dialogo = await abrirMenu();
  fireEvent.click(dialogo.getByRole('button', { name: nome }));
}
