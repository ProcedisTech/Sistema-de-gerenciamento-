import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato do cliente para concluir-presencial + corrida 409.
 * Espelha a lógica de handleConfirmPat (Step4LGPD) sem montar o orquestrador.
 */
async function persistPacienteCanvas({
  backendAssinaturaId,
  dataUrl,
  concluirPresencial,
  buscar,
}) {
  if (!backendAssinaturaId) {
    return { kind: 'criar' };
  }
  try {
    const resultado = await concluirPresencial(backendAssinaturaId, {
      assinaturaPaciente: dataUrl,
      metodoCodigo: 'DISPOSITIVO_CLINICA',
    });
    return { kind: 'success', resultado };
  } catch (e) {
    if (e?.status === 409) {
      const res = await buscar(backendAssinaturaId);
      if (res?.statusCodigo === 'ASSINADO' || res?.assinaturaPaciente) {
        return { kind: 'success', resultado: res };
      }
      return { kind: 'conflict_non_retryable' };
    }
    return { kind: 'retryable_error', error: e };
  }
}

describe('persistPacienteCanvas (contrato QR→tablet)', () => {
  let concluirPresencial;
  let buscar;

  beforeEach(() => {
    concluirPresencial = vi.fn();
    buscar = vi.fn();
  });

  it('com id chama concluirPresencial (não criar)', async () => {
    concluirPresencial.mockResolvedValue({ id: 'a1', statusCodigo: 'ASSINADO' });
    const out = await persistPacienteCanvas({
      backendAssinaturaId: 'a1',
      dataUrl: 'data:image/png;base64,x',
      concluirPresencial,
      buscar,
    });
    expect(out.kind).toBe('success');
    expect(concluirPresencial).toHaveBeenCalledWith('a1', expect.objectContaining({
      assinaturaPaciente: 'data:image/png;base64,x',
      metodoCodigo: 'DISPOSITIVO_CLINICA',
    }));
    expect(buscar).not.toHaveBeenCalled();
  });

  it('sem id indica caminho criar (tablet direto)', async () => {
    const out = await persistPacienteCanvas({
      backendAssinaturaId: null,
      dataUrl: 'data:image/png;base64,x',
      concluirPresencial,
      buscar,
    });
    expect(out.kind).toBe('criar');
    expect(concluirPresencial).not.toHaveBeenCalled();
  });

  it('409 + buscar ASSINADO = sucesso sem retry de concluir', async () => {
    const err = new Error('conflict');
    err.status = 409;
    concluirPresencial.mockRejectedValue(err);
    buscar.mockResolvedValue({ id: 'a1', statusCodigo: 'ASSINADO', assinaturaPaciente: 'data:...' });

    const out = await persistPacienteCanvas({
      backendAssinaturaId: 'a1',
      dataUrl: 'data:image/png;base64,x',
      concluirPresencial,
      buscar,
    });

    expect(out.kind).toBe('success');
    expect(out.resultado.statusCodigo).toBe('ASSINADO');
    expect(concluirPresencial).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith('a1');
  });

  it('409 + buscar não ASSINADO = conflict_non_retryable', async () => {
    const err = new Error('conflict');
    err.status = 409;
    concluirPresencial.mockRejectedValue(err);
    buscar.mockResolvedValue({ id: 'a1', statusCodigo: 'RECUSADO' });

    const out = await persistPacienteCanvas({
      backendAssinaturaId: 'a1',
      dataUrl: 'data:image/png;base64,x',
      concluirPresencial,
      buscar,
    });

    expect(out.kind).toBe('conflict_non_retryable');
  });

  it('falha rede = retryable_error', async () => {
    concluirPresencial.mockRejectedValue(new Error('network'));
    const out = await persistPacienteCanvas({
      backendAssinaturaId: 'a1',
      dataUrl: 'data:image/png;base64,x',
      concluirPresencial,
      buscar,
    });
    expect(out.kind).toBe('retryable_error');
  });
});
