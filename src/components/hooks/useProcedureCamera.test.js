import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProcedureCamera } from './useProcedureCamera.js';

describe('useProcedureCamera - replaceEvaluationCapturedPhotoAt', () => {
  let revokeObjectURLSpy;

  beforeEach(() => {
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    revokeObjectURLSpy.mockRestore();
  });

  it('NÃO revoga a Blob URL quando newUrl é igual a old.url (preservação de foto limpa)', () => {
    const { result } = renderHook(() =>
      useProcedureCamera({
        currentStep: 3,
        journeyId: 'j-1',
        setJourneyId: vi.fn(),
        selectedPatientCpf: '12345678901',
        cpf: '12345678901',
        setPatients: vi.fn(),
        isProcedimentoMode: false,
      })
    );

    const cleanUrl = 'blob:http://localhost:5173/clean-photo-123';
    const mockBlob = new Blob(['clean-image'], { type: 'image/jpeg' });

    // Injeta foto inicial na lista de avaliação
    act(() => {
      result.current.setEvaluationCapturedPhotos([
        { url: cleanUrl, blob: mockBlob, meta: { vista: 'frontal' } },
      ]);
    });

    expect(result.current.evaluationCapturedPhotos).toHaveLength(1);

    // Substitui mantendo a foto limpa e adicionando marcações vetoriais
    act(() => {
      result.current.replaceEvaluationCapturedPhotoAt(0, {
        url: cleanUrl, // mesma URL
        cleanUrl,
        blob: mockBlob,
        cleanBlob: mockBlob,
        pontos: [{ id: 'p-1', x: 50, y: 50 }],
        procedimentosMapeados: [{ catalogoProcedimentoSaudeId: 'cat-1', pontosCount: 1 }],
      });
    });

    // A URL NUNCA deve ser revogada quando é a mesma da foto ativa
    expect(revokeObjectURLSpy).not.toHaveBeenCalledWith(cleanUrl);

    // O snapshot deve preservar os dados vetoriais intactos
    const updated = result.current.evaluationCapturedPhotos[0];
    expect(updated.url).toBe(cleanUrl);
    expect(updated.cleanUrl).toBe(cleanUrl);
    expect(updated.pontos).toHaveLength(1);
    expect(updated.pontos[0].id).toBe('p-1');
    expect(updated.procedimentosMapeados).toHaveLength(1);
    expect(updated.isAnnotated).toBe(true);
  });

  it('REVOGA a Blob URL antiga quando newUrl for realmente diferente', () => {
    const { result } = renderHook(() =>
      useProcedureCamera({
        currentStep: 3,
        journeyId: 'j-1',
        setJourneyId: vi.fn(),
        selectedPatientCpf: '12345678901',
        cpf: '12345678901',
        setPatients: vi.fn(),
        isProcedimentoMode: false,
      })
    );

    const oldUrl = 'blob:http://localhost:5173/old-photo-111';
    const newUrl = 'blob:http://localhost:5173/new-photo-222';

    act(() => {
      result.current.setEvaluationCapturedPhotos([
        { url: oldUrl, blob: null, meta: {} },
      ]);
    });

    act(() => {
      result.current.replaceEvaluationCapturedPhotoAt(0, {
        url: newUrl,
      });
    });

    // A URL antiga deve ser revogada porque uma nova URL distinta a substituiu
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(oldUrl);
    expect(result.current.evaluationCapturedPhotos[0].url).toBe(newUrl);
  });

  it('permite atualização parcial (ex.: uploaded: true e fotoId) sem fornecer newUrl e sem revogar URL existente', () => {
    const { result } = renderHook(() =>
      useProcedureCamera({
        currentStep: 3,
        journeyId: 'j-1',
        setJourneyId: vi.fn(),
        selectedPatientCpf: '12345678901',
        cpf: '12345678901',
        setPatients: vi.fn(),
        isProcedimentoMode: false,
      })
    );

    const initialUrl = 'blob:http://localhost:5173/photo-abc';
    act(() => {
      result.current.setEvaluationCapturedPhotos([
        { url: initialUrl, blob: null, meta: {} },
      ]);
    });

    act(() => {
      result.current.replaceEvaluationCapturedPhotoAt(0, {
        uploaded: true,
        fotoId: 'foto-uuid-999',
      });
    });

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    const photo = result.current.evaluationCapturedPhotos[0];
    expect(photo.url).toBe(initialUrl);
    expect(photo.uploaded).toBe(true);
    expect(photo.fotoId).toBe('foto-uuid-999');
  });
});
