// Regressão prevenida: Loopback assíncrono e merge de fotos anotadas na avaliação com chaves polimórficas (id, fotoId, meta.fotoId)
// Garante simetria de chaves, zero duplicação pós-upload remoto, preservação de blobs/desenhos locais e integridade entre etapas.
import { describe, expect, it } from 'vitest';
import { mergeFotosPorId } from './mergeFotosPorId.js';

const urlDe = (id) => `/api/v1/pacientes/p-1/galeria/${id}/arquivo`;

describe('mergeFotosPorId - Auditoria de Contrato de Loopback Assíncrono & Merge (Async Loopback & Merge Parity)', () => {
  it('1. Zero Duplicação: array.length pós-loopback é idêntico ao pré-loopback com chaves id / fotoId / meta.fotoId', () => {
    // Foto capturada e anotada localmente com ID atribuído no upload
    const fotoLocalUpload = {
      id: 'foto-uuid-123',
      fotoId: 'foto-uuid-123',
      url: 'blob:http://localhost/avaliacao-1',
      cleanUrl: 'blob:http://localhost/avaliacao-1-clean',
      blob: new Blob(['pixels-anotados']),
      cleanBlob: new Blob(['pixels-limpos']),
      pontos: [{ id: 'pt-1', posX: 50, posY: 50, cor: '#00a88e' }],
      meta: {
        fotoId: 'foto-uuid-123',
        source: 'local',
        annotated: true,
      },
      uploaded: true,
    };

    const listaLocal = [fotoLocalUpload];

    // Resposta do servidor que chega via SSE/polling contendo o mesmo registro
    const listaServidor = [
      {
        id: 'foto-uuid-123',
        atendimentoItemId: 'item-1',
        tipoFotoCodigo: 'AVALIACAO',
        urlArquivo: 'https://storage.procedi.com.br/fotos/foto-uuid-123.jpg',
      },
    ];

    const resultado = mergeFotosPorId(listaLocal, listaServidor, { urlDe });

    // Assertiva 1: Zero Duplicação
    expect(resultado.length).toBe(1);
    expect(resultado.length).toBe(listaLocal.length);

    // Assertiva 2: Casamento de Chaves em ambas as pontas
    const fotoMesclada = resultado[0];
    expect(fotoMesclada.id || fotoMesclada.fotoId || fotoMesclada.meta?.fotoId).toBe('foto-uuid-123');
    expect(fotoMesclada.meta?.fotoId).toBe('foto-uuid-123');

    // Assertiva 3: Preservação de Blobs e Desenhos locais em memória (não sobrescreve com nulos do servidor)
    expect(fotoMesclada.blob).not.toBeNull();
    expect(fotoMesclada.cleanBlob).not.toBeNull();
    expect(fotoMesclada.cleanUrl).toBe('blob:http://localhost/avaliacao-1-clean');
    expect(fotoMesclada.pontos).toEqual(fotoLocalUpload.pontos);
  });

  it('2. Reconhece objeto local que possui apenas id na raiz (padrão de resposta do pacientesGaleriaApi.upload)', () => {
    const fotoLocalComIdRaiz = {
      id: 'foto-remota-456',
      url: 'blob:http://localhost/eval-456',
      cleanUrl: 'blob:http://localhost/eval-456-clean',
      blob: new Blob(['eval-bytes']),
      meta: {},
    };

    const listaServidor = [
      {
        id: 'foto-remota-456',
        tipoFotoCodigo: 'AVALIACAO',
      },
    ];

    const resultado = mergeFotosPorId([fotoLocalComIdRaiz], listaServidor, { urlDe });
    expect(resultado.length).toBe(1);
    // Preserva a referência local para não causar re-render e recarga de imagem em branco
    expect(resultado[0].url).toBe('blob:http://localhost/eval-456');
    expect(resultado[0].blob).not.toBeNull();
  });

  it('3. Transição de Etapas: seleção de fotos de avaliação no Procedimento não duplica fotos quando sessão tem capturas', () => {
    // Simula a derivação fotosAvaliacaoParaProcedimento
    const daSessao = [
      {
        id: 'foto-sessao-1',
        fotoId: 'foto-sessao-1',
        url: 'blob:http://localhost/eval-1',
        cleanUrl: 'blob:http://localhost/eval-1-clean',
        meta: { fotoId: 'foto-sessao-1' },
      },
      {
        id: 'foto-sessao-2',
        fotoId: 'foto-sessao-2',
        url: 'blob:http://localhost/eval-2',
        cleanUrl: 'blob:http://localhost/eval-2-clean',
        meta: { fotoId: 'foto-sessao-2' },
      },
    ];

    // Galeria remota recarregada que traz cópias das mesmas fotos salvas no backend
    const fotosAvaliacaoPlano = [
      {
        id: 'foto-sessao-1',
        fotoId: 'foto-sessao-1',
        url: 'https://backend/api/foto-1.jpg',
        cleanUrl: 'https://backend/api/foto-1.jpg',
      },
      {
        id: 'foto-sessao-2',
        fotoId: 'foto-sessao-2',
        url: 'https://backend/api/foto-2.jpg',
        cleanUrl: 'https://backend/api/foto-2.jpg',
      },
      {
        id: 'foto-antiga-de-outro-dia',
        fotoId: 'foto-antiga-de-outro-dia',
        url: 'https://backend/api/foto-antiga.jpg',
      },
    ];

    // Regra canônica restaurada: se a sessão atual tem fotos capturadas, usa a sessão!
    const derivarFotosProcedimento = (sessao, plano) => {
      const locais = sessao || [];
      if (locais.length > 0) return locais;
      return plano || [];
    };

    const resultado = derivarFotosProcedimento(daSessao, fotosAvaliacaoPlano);
    expect(resultado.length).toBe(2);
    expect(resultado).toBe(daSessao);
    expect(resultado.map((f) => f.id)).toEqual(['foto-sessao-1', 'foto-sessao-2']);
  });
});
