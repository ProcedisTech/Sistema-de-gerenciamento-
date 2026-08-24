import { describe, it, expect } from 'vitest';
import { replaceTermVariables, formatDateBR } from './replaceTermVariables';

describe('replaceTermVariables utility', () => {
  describe('formatDateBR', () => {
    it('formata data ISO YYYY-MM-DD para DD/MM/AAAA', () => {
      expect(formatDateBR('1990-05-15')).toBe('15/05/1990');
    });

    it('preserva data já formatada em DD/MM/AAAA', () => {
      expect(formatDateBR('15/05/1990')).toBe('15/05/1990');
    });

    it('retorna string vazia para entradas nulas ou vazias', () => {
      expect(formatDateBR(null)).toBe('');
      expect(formatDateBR(undefined)).toBe('');
      expect(formatDateBR('')).toBe('');
    });
  });

  describe('replaceTermVariables', () => {
    it('substitui todos os tokens padrões com dados do contexto', () => {
      const template =
        'Eu, [NOME DO PACIENTE], CPF [CPF DO PACIENTE], nascido em [DATA DE NASCIMENTO DO PACIENTE], tel [TELEFONE DO PACIENTE], na clínica [NOME DA CLÍNICA] (CNPJ [CNPJ DA CLÍNICA]), com Dr.(a) [NOME DO PROFISSIONAL].';

      const ctx = {
        pac: {
          nome: 'Maria da Silva',
          cpf: '123.456.789-00',
          dataNascimento: '1985-10-20',
          telefone: '(11) 98888-7777',
        },
        clinica: {
          nome: 'Clínica Estética Bella',
          cnpj: '12.345.678/0001-90',
        },
        prof: {
          nome: 'Dra. Roberta Santos',
        },
      };

      const result = replaceTermVariables(template, ctx);
      expect(result).toBe(
        'Eu, Maria da Silva, CPF 123.456.789-00, nascido em 20/10/1985, tel (11) 98888-7777, na clínica Clínica Estética Bella (CNPJ 12.345.678/0001-90), com Dr.(a) Dra. Roberta Santos.'
      );
    });

    it('substitui token legado [RG DO PACIENTE] quando RG é fornecido', () => {
      const template = 'Eu, [NOME DO PACIENTE], portador do RG [RG DO PACIENTE] e CPF [CPF DO PACIENTE].';
      const ctx = {
        pac: {
          nome: 'Carlos Souza',
          cpf: '111.222.333-44',
          rg: 'MG-12.345.678',
        },
      };

      const result = replaceTermVariables(template, ctx);
      expect(result).toBe('Eu, Carlos Souza, portador do RG MG-12.345.678 e CPF 111.222.333-44.');
    });

    it('limpa graciosamente [RG DO PACIENTE] quando RG não está disponível sem vazar brackets crus', () => {
      const template = 'Eu, [NOME DO PACIENTE], portador do RG [RG DO PACIENTE] e CPF [CPF DO PACIENTE].';
      const ctx = {
        pac: {
          nome: 'Carlos Souza',
          cpf: '111.222.333-44',
        },
      };

      const result = replaceTermVariables(template, ctx);
      expect(result).not.toContain('[RG DO PACIENTE]');
      expect(result).toBe('Eu, Carlos Souza, portador do CPF 111.222.333-44.');
    });

    it('limpa cabeçalho de RG legado em template de imagem quando RG não está disponível', () => {
      const template = 'Nome: [NOME DO PACIENTE]\nCPF: [CPF DO PACIENTE]     RG: [RG DO PACIENTE]';
      const ctx = {
        pac: {
          nome: 'Ana Paula',
          cpf: '222.333.444-55',
        },
      };

      const result = replaceTermVariables(template, ctx);
      expect(result).not.toContain('[RG DO PACIENTE]');
      expect(result).toContain('Nome: Ana Paula');
      expect(result).toContain('CPF: 222.333.444-55');
    });

    it('repara HTML quebrado com quebras de linha duras de PDF/Word e restaura listas', () => {
      const brokenHtml =
        '<p>declaro ter sido informado(a) pelo(a) Dr</p><p>.(a) guilherme</p>' +
        '<p>suas i</p><p>ndicações e que o efeito da mesma inicia-</p><p>se cerca de 48 horas</p>' +
        '<p>-</p><p>Equimoses ou hematomas;</p><p>-</p><p>Reação alérgica.</p>';

      const result = replaceTermVariables(brokenHtml, {});
      expect(result).toContain('pelo(a) Dr.(a) guilherme');
      expect(result).toContain('suas indicações e que o efeito da mesma inicia-se cerca de 48 horas');
      expect(result).toContain('<ul><li>Equimoses ou hematomas;</li><li>Reação alérgica.</li></ul>');
    });
  });
});
