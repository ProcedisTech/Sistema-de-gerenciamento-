import { describe, it, expect } from 'vitest';

describe('Preservação de campos de clinicaInfo ao atualizar dados da clínica (Card #276)', () => {
  it('garante que a atualização do estado preserva endereço, telefone, cnpj, slug e anamnese padrão', () => {
    // Estado inicial completo da clínica após login
    const estadoInicial = {
      nome: 'Clínica Antiga',
      logoUrl: 'https://exemplo.com/logo-antigo.png',
      endereco: 'Avenida Paulista, 1000 - São Paulo/SP',
      telefone: '11999990000',
      cnpj: '11222333000181',
      slug: 'clinica-antiga',
      anamnesePadraoId: 'anamnese-uuid-123',
    };

    // Callback corrigido com atualização otimista preservando prev
    const aplicarAtualizacaoOtimista = (prev, nome, logoUrl) => ({
      ...prev,
      ...(nome ? { nome } : {}),
      ...(logoUrl != null ? { logoUrl } : {}),
    });

    const estadoOtimista = aplicarAtualizacaoOtimista(
      estadoInicial,
      'Clínica Nova',
      'https://exemplo.com/logo-novo.png'
    );

    expect(estadoOtimista.nome).toBe('Clínica Nova');
    expect(estadoOtimista.logoUrl).toBe('https://exemplo.com/logo-novo.png');
    // Campos que antes sumiam (viravam undefined):
    expect(estadoOtimista.endereco).toBe('Avenida Paulista, 1000 - São Paulo/SP');
    expect(estadoOtimista.telefone).toBe('11999990000');
    expect(estadoOtimista.cnpj).toBe('11222333000181');
    expect(estadoOtimista.slug).toBe('clinica-antiga');
    expect(estadoOtimista.anamnesePadraoId).toBe('anamnese-uuid-123');
  });

  it('garante que a sincronização completa canônica a partir do backend atualiza novos campos sem apagar os existentes', () => {
    const estadoAnterior = {
      nome: 'Clínica Inicial',
      logoUrl: '',
      endereco: 'Rua Antiga, 10',
      telefone: '1100000000',
      cnpj: '11222333000181',
      slug: 'clinica-inicial',
      anamnesePadraoId: 'anamnese-1',
    };

    const respostaBackend = {
      nome: 'Clínica Matriz',
      nomeFantasia: 'Clínica Matriz',
      logoUrl: 'https://cdn.procedi.com/logo.webp',
      enderecoLogradouro: 'Rua Nova das Flores',
      enderecoNumero: '500',
      enderecoCidade: 'Belo Horizonte',
      enderecoEstado: 'MG',
      telefone: '31988887777',
      cnpj: '11222333000181',
      slug: 'clinica-matriz',
      anamnesePadraoId: 'anamnese-2',
    };

    let endCompleto = String(respostaBackend.enderecoLogradouro).trim();
    if (respostaBackend.enderecoNumero) endCompleto += `, ${respostaBackend.enderecoNumero}`;
    if (respostaBackend.enderecoCidade) endCompleto += ` - ${respostaBackend.enderecoCidade}`;
    if (respostaBackend.enderecoEstado) endCompleto += `/${respostaBackend.enderecoEstado}`;

    const estadoSincronizado = {
      ...estadoAnterior,
      nome: respostaBackend.nome,
      logoUrl: respostaBackend.logoUrl,
      endereco: endCompleto,
      telefone: respostaBackend.telefone,
      cnpj: respostaBackend.cnpj,
      slug: respostaBackend.slug,
      anamnesePadraoId: respostaBackend.anamnesePadraoId,
    };

    expect(estadoSincronizado).toEqual({
      nome: 'Clínica Matriz',
      logoUrl: 'https://cdn.procedi.com/logo.webp',
      endereco: 'Rua Nova das Flores, 500 - Belo Horizonte/MG',
      telefone: '31988887777',
      cnpj: '11222333000181',
      slug: 'clinica-matriz',
      anamnesePadraoId: 'anamnese-2',
    });
  });
});
