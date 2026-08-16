import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AnamneseCatalogoPicker } from './AnamneseCatalogoPicker';

describe('AnamneseCatalogoPicker', () => {
  it('busca, seleciona catálogo e permite texto livre sem limpar chips', async () => {
    const user = userEvent.setup();
    const searchFn = vi.fn().mockResolvedValue([{ id: 'a1', nome: 'Amoxicilina' }]);
    const onChange = vi.fn();

    const { rerender } = render(
      <AnamneseCatalogoPicker
        searchFn={searchFn}
        catalogoItens={[]}
        textosLivres={[]}
        onChange={onChange}
        hideAusencia
      />,
    );

    await user.type(screen.getByPlaceholderText('Buscar no catálogo…'), 'am');
    await waitFor(() => expect(searchFn).toHaveBeenCalledWith('am'), { timeout: 2000 });
    await user.click(await screen.findByRole('button', { name: 'Amoxicilina' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      catalogoItens: [expect.objectContaining({ id: 'a1', nome: 'Amoxicilina' })],
      textosLivres: [],
    }));

    rerender(
      <AnamneseCatalogoPicker
        searchFn={searchFn}
        catalogoItens={[{ id: 'a1', nome: 'Amoxicilina', fonte: 'catalogo' }]}
        textosLivres={[]}
        onChange={onChange}
        hideAusencia
      />,
    );

    expect(screen.getByText('Amoxicilina').closest('[data-chip="catalogo"]')).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: /Não encontrei/i })[0]);
    await user.type(screen.getByPlaceholderText('Descreva o item…'), 'remédio amarelo');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      catalogoItens: [expect.objectContaining({ id: 'a1' })],
      textosLivres: [expect.objectContaining({ texto: 'remédio amarelo', fonte: 'livre' })],
    }));
  }, 15000);

  it('distinguie chip de catálogo e chip de texto', () => {
    render(
      <AnamneseCatalogoPicker
        catalogoItens={[{ id: '1', nome: 'Dipirona' }]}
        textosLivres={[{ idLocal: 't1', texto: 'comprimido rosa', fonte: 'livre' }]}
        readOnly
      />,
    );
    expect(screen.getByText('Dipirona').closest('[data-chip="catalogo"]')).toBeTruthy();
    expect(screen.getByText('comprimido rosa').closest('[data-chip="livre"]')).toBeTruthy();
  });
});
