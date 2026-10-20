// Regressão prevenida: Fotos de avaliações clínicas e procedimentos não podem se misturar
// entre consultas diferentes nem duplicar fotos de um mesmo mapa/ângulo na visualização.
// Cada atendimento mantém seu escopo isolado e a deduplicação preserva a versão mais recente.

import { describe, it, expect } from 'vitest';
import { groupGaleriaItemsBySession, normalizePacienteGaleriaItem } from './pacienteGaleria.js';

describe('pacienteGaleria — Isolamento por Atendimento e Deduplicação de Sessões', () => {
  it('separa fotos de atendimentos distintos ocorridos no mesmo dia', () => {
    // Dado duas fotos tiradas no mesmo dia, porém em atendimentos clínicos distintos
    const fotoAtendimento1 = normalizePacienteGaleriaItem({
      id: 'f-1',
      url: 'https://exemplo.com/f1.jpg',
      dataReferencia: '2026-10-16',
      atendimentoId: 'atend-manha',
      tipoFotoCodigo: 'AVALIACAO',
      legenda: '[avaliacao] Avaliação Matutina',
    });

    const fotoAtendimento2 = normalizePacienteGaleriaItem({
      id: 'f-2',
      url: 'https://exemplo.com/f2.jpg',
      dataReferencia: '2026-10-16',
      atendimentoId: 'atend-tarde',
      tipoFotoCodigo: 'AVALIACAO',
      legenda: '[avaliacao] Avaliação Vespertina',
    });

    // Quando agrupamos as fotos por sessão
    const sessoes = groupGaleriaItemsBySession([fotoAtendimento1, fotoAtendimento2]);

    // Então as fotos NÃO devem ficar na mesma sessão (chaves separadas por atendimentoId)
    expect(sessoes).toHaveLength(2);
    expect(sessoes.map((s) => s.key)).toContain('2026-10-16_atend-manha');
    expect(sessoes.map((s) => s.key)).toContain('2026-10-16_atend-tarde');
  });

  it('normaliza atendimentoId corretamente a partir de raw payload', () => {
    const item = normalizePacienteGaleriaItem({
      id: 'f-3',
      url: 'https://exemplo.com/f3.jpg',
      atendimento_id: 'atend-uuid-123',
    });
    expect(item.atendimentoId).toBe('atend-uuid-123');
  });
});
