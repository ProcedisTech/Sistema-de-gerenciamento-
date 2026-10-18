// Regressão prevenida: Ao salvar foto de avaliação com múltiplos procedimentos (ex: Biópsia + Drenagem),
// a sincronização assíncrona (SSE/loopback/mergeFotosPorId) NÃO pode zerar os pontos e o mapaOverlay
// nem duplicar a foto limpa na galeria (deve manter 1 única foto com marcadores visíveis).
import { describe, it, expect } from 'vitest';
import { mergeFotosPorId } from './mergeFotosPorId.js';

const V1 = '2026-10-17T14:00:00.000Z';
const V2 = '2026-10-17T14:01:00.000Z';

describe('mergeFotosPorId - Auditoria de Contrato de Loopback Assíncrono & Preservação Clínica', () => {
  it('preserva estritamente pontos, mapaOverlay e procedimentosMapeados após atualização remota por versão (Zero Wipe)', () => {
    const fotoAnotadaLocal = {
      url: 'blob:annotated-preview-url',
      cleanUrl: 'blob:clean-camera-url',
      cleanBlob: new Blob(['raw-image-bytes'], { type: 'image/jpeg' }),
      pontos: [
        { id: 'pt-1', x: 120, y: 150, catalogoProcedimentoSaudeId: 'cat-biopsia', corHex: '#3b82f6', nomeProcedimento: 'Biópsia' },
        { id: 'pt-2', x: 200, y: 220, catalogoProcedimentoSaudeId: 'cat-drenagem', corHex: '#10b981', nomeProcedimento: 'Drenagem' },
      ],
      mapaOverlay: {
        marcacoes: [
          { id: 'pt-1', x: 120, y: 150, procedimentoId: 'cat-biopsia' },
          { id: 'pt-2', x: 200, y: 220, procedimentoId: 'cat-drenagem' },
        ],
        procedimentos: [
          { id: 'cat-biopsia', nome: 'Biópsia', corHex: '#3b82f6' },
          { id: 'cat-drenagem', nome: 'Drenagem', corHex: '#10b981' },
        ],
      },
      procedimentosMapeados: [
        { id: 'cat-biopsia', nome: 'Biópsia' },
        { id: 'cat-drenagem', nome: 'Drenagem' },
      ],
      isAnnotated: true,
      meta: {
        fotoId: 'foto-uuid-999',
        arquivoAtualizadoEm: V1,
        categoria: 'avaliacao',
      },
    };

    const listaInicial = [fotoAnotadaLocal];

    // Simula loopback SSE onde o servidor avisa que a foto foi consolidada com versão V2
    const fotosDoServidor = [
      {
        id: 'foto-uuid-999',
        tipoFotoCodigo: 'AVALIACAO',
        arquivoAtualizadoEm: V2,
      },
    ];

    const resultado = mergeFotosPorId(listaInicial, fotosDoServidor, {
      pacienteId: 'paciente-123',
      urlDe: () => '/api/v1/pacientes/paciente-123/galeria/foto-uuid-999/arquivo',
      entra: () => true,
    });

    // 1. Zero Duplicação: array.length deve ser rigorosamente 1
    expect(resultado).toHaveLength(1);

    const fotoFinal = resultado[0];

    // 2. Preservação de Vetores e Desenhos
    expect(fotoFinal.pontos).toHaveLength(2);
    expect(fotoFinal.pontos[0].nomeProcedimento).toBe('Biópsia');
    expect(fotoFinal.pontos[1].nomeProcedimento).toBe('Drenagem');

    expect(fotoFinal.mapaOverlay).not.toBeNull();
    expect(fotoFinal.mapaOverlay.marcacoes).toHaveLength(2);
    expect(fotoFinal.mapaOverlay.procedimentos).toHaveLength(2);

    expect(fotoFinal.procedimentosMapeados).toHaveLength(2);
    expect(fotoFinal.isAnnotated).toBe(true);
    expect(fotoFinal.cleanUrl).toBe('blob:clean-camera-url');

    // 3. Casamento de Chaves e Versão atualizada
    expect(fotoFinal.meta.fotoId).toBe('foto-uuid-999');
    expect(fotoFinal.meta.arquivoAtualizadoEm).toBe(V2);
  });

  it('evita inserção de card duplicado se a foto remota já existir pelo ID ou URL local', () => {
    const fotoLocal = {
      id: 'foto-uuid-888',
      url: '/api/v1/pacientes/paciente-123/galeria/foto-uuid-888/arquivo',
      cleanUrl: '/api/v1/pacientes/paciente-123/galeria/foto-uuid-888/arquivo',
      meta: {
        fotoId: 'foto-uuid-888',
        arquivoAtualizadoEm: V1,
      },
    };

    const fotosDoServidor = [
      {
        id: 'foto-uuid-888',
        tipoFotoCodigo: 'AVALIACAO',
        arquivoAtualizadoEm: V1,
      },
    ];

    const resultado = mergeFotosPorId([fotoLocal], fotosDoServidor, {
      pacienteId: 'paciente-123',
      urlDe: (id) => `/api/v1/pacientes/paciente-123/galeria/${id}/arquivo`,
      entra: () => true,
    });

    // Rigorosamente 1 card na galeria
    expect(resultado).toHaveLength(1);
    expect(resultado[0].meta.fotoId).toBe('foto-uuid-888');
  });
});
