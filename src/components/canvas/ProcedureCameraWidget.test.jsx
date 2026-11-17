/** Widget flutuante da câmera: só "Tirar foto"; sem botão de upload de arquivos. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProcedureCameraWidget } from './ProcedureCameraWidget.jsx';

describe('ProcedureCameraWidget', () => {
  it('mostra Tirar foto e não oferece Upload nem seletor de arquivo', () => {
    const { container } = render(<ProcedureCameraWidget visible openPhotoModal={() => {}} />);
    expect(screen.getByRole('button', { name: 'Tirar foto durante o procedimento' })).toBeInTheDocument();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
