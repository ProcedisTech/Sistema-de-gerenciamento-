import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AuditoriaView } from './AuditoriaView';
import { dentroDoPeriodo } from './AuditoriaUtils';

const stubs = vi.hoisted(() => ({ list: vi.fn(), equipe: vi.fn(), registrar: vi.fn(), error: vi.fn(), canExportPdf: true, save: vi.fn(), table: vi.fn(), text: vi.fn(), clinica: vi.fn() }));
vi.mock('../../services/api', () => ({ auditoriaApi: { list: stubs.list, registrarExportacao: stubs.registrar }, equipeApi: { list: stubs.equipe }, clinicaApi: { buscar: stubs.clinica } }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => ({ canExportPdf: stubs.canExportPdf }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: stubs.error }) }));
vi.mock('../hooks/useFusoClinica', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
vi.mock('jspdf', () => ({ default: class { internal = {pageSize: {getWidth: () => 297, getHeight: () => 210}}; setFontSize() {} text(...args) {stubs.text(...args);} setTextColor() {} setFont() {} setDrawColor() {} setLineWidth() {} line() {} splitTextToSize(text) {return [text];} getNumberOfPages() {return 1;} setPage() {} save(...args) { stubs.save(...args); } } }));
vi.mock('jspdf-autotable', () => ({ default: stubs.table }));
const records = Array.from({ length: 18 }, (_, i) => ({ id: `r${i}`, roleUserId: i < 16 ? 'p1' : 'p2', nomeUsuario: i < 16 ? 'Pessoa A' : 'Pessoa B', criadoEm: `2026-10-04T${String(23 - i).padStart(2, '0')}:00:00Z`, acao: i < 16 ? 'PACIENTE_EDITAR' : 'USUARIO_CRIAR', suspeito: i === 17, entidade: 'PACIENTE', descricao: `Registro ${i}` }));
beforeEach(() => { vi.clearAllMocks(); stubs.clinica.mockResolvedValue({ nome: 'Clínica Aurora', cnpj: '11222333000181' }); stubs.table.mockImplementation((doc, options) => options.willDrawPage?.()); stubs.canExportPdf = true; stubs.list.mockResolvedValue({ content: records, totalElements: 250 }); stubs.equipe.mockResolvedValue([]); stubs.registrar.mockResolvedValue({}); });
afterEach(cleanup);

 describe('AuditoriaView', () => {
  it('usa dados reais retornados nos filtros e reinicia paginação para busca, ação e suspeitas', async () => {
    render(<AuditoriaView />);
    await screen.findByText('Página 1 de 4');
    expect(screen.getByText(/Mostrando as 18 ações mais recentes de 250/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByText('Página 2 de 4')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar registro'), { target: { value: 'Pessoa B' } });
    await screen.findByText('Página 1 de 1');
    expect(screen.getAllByRole('button', { name: /Ver detalhes:/ })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Mostrar apenas ações suspeitas'));
    expect(screen.getAllByRole('button', { name: /Ver detalhes:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    fireEvent.change(screen.getByLabelText('Ação'), { target: { value: 'USUARIO_CRIAR' } });
    expect(screen.getAllByRole('button', { name: /Ver detalhes:/ })).toHaveLength(2);
  });
  it('mostra erro explícito, bloqueia PDF e permite repetir a consulta', async () => {
    stubs.list.mockRejectedValueOnce(new Error('offline'));
    render(<AuditoriaView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o histórico');
    expect(screen.getByRole('button', { name: 'Exportar / PDF' })).toBeDisabled();
    expect(screen.queryByText('Nenhum registro de auditoria')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Página 1 de 4');
  });
  it('impede relatório sem dados da clínica e permite tentar novamente', async () => {
    stubs.clinica.mockRejectedValueOnce(new Error('indisponível'));
    render(<AuditoriaView />);
    await screen.findByText('Não foi possível carregar os dados da clínica para o relatório.');
    expect(screen.getByRole('button', { name: 'Exportar / PDF' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar / PDF' })).toBeEnabled());
  });
  it('não gera PDF quando o registro obrigatório da exportação falha', async () => {
    stubs.registrar.mockRejectedValueOnce(new Error('registro indisponível'));
    render(<AuditoriaView />);
    await screen.findByText('Página 1 de 4');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar / PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir / Salvar PDF' }));
    await waitFor(() => expect(stubs.error).toHaveBeenCalledWith(expect.stringContaining('PDF não gerado')));
    expect(stubs.save).not.toHaveBeenCalled();
  });
  it('exporta todos os registros filtrados e respeita permissão e escopo por pessoa', async () => {
    const { rerender } = render(<AuditoriaView roleUserId="p1" />);
    await screen.findByText('Página 1 de 4');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar / PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir / Salvar PDF' }));
    await waitFor(() => expect(stubs.save).toHaveBeenCalledWith('relatorio_auditoria.pdf'));
    expect(stubs.table.mock.calls[0][1].body).toHaveLength(16);
    expect(stubs.table.mock.calls[0][1].head[0]).toEqual(['DATA E RESPONSÁVEL', 'AÇÃO REALIZADA', 'ORIGEM E SINALIZAÇÃO']);
    expect(stubs.text.mock.calls.flat().join(' ')).toContain('Clínica Aurora');
    expect(stubs.text.mock.calls.flat().join(' ')).toContain('11.222.333/0001-81');
    expect(screen.getByText('Clínica Aurora')).toBeInTheDocument();
    rerender(<AuditoriaView roleUserId="p2" />);
    await waitFor(() => expect(screen.getByLabelText('Responsável')).toHaveValue('p2'));
    expect(screen.getAllByRole('button', { name: /Ver detalhes:/ })).toHaveLength(2);
    stubs.canExportPdf = false;
    rerender(<AuditoriaView roleUserId="p2" />);
    expect(screen.queryByRole('button', { name: 'Exportar / PDF' })).not.toBeInTheDocument();
  });
});

it('distingue últimos sete e trinta dias', () => {
  const agora = Date.parse('2026-10-05T12:00:00Z');
  expect(dentroDoPeriodo('2026-09-30T12:00:00Z', '7', 'America/Sao_Paulo', agora)).toBe(true);
  expect(dentroDoPeriodo('2026-09-20T12:00:00Z', '7', 'America/Sao_Paulo', agora)).toBe(false);
  expect(dentroDoPeriodo('2026-09-20T12:00:00Z', '30', 'America/Sao_Paulo', agora)).toBe(true);
  expect(dentroDoPeriodo('2026-09-01T12:00:00Z', '30', 'America/Sao_Paulo', agora)).toBe(false);
});
