import { describe, expect, it } from 'vitest';
import { buildGaleriaArquivoFallbackPath } from '../hooks/usePacienteGaleriaArquivoBlobUrl.js';

describe('buildGaleriaArquivoFallbackPath', () => {
  it('monta path /arquivo com paciente e foto', () => {
    expect(buildGaleriaArquivoFallbackPath('pac-1', 'foto-2')).toBe(
      '/api/v1/pacientes/pac-1/galeria/foto-2/arquivo',
    );
  });

  it('retorna null sem ids', () => {
    expect(buildGaleriaArquivoFallbackPath(null, 'foto')).toBeNull();
    expect(buildGaleriaArquivoFallbackPath('pac', '')).toBeNull();
  });
});
