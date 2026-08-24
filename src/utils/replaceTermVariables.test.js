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
        '<p>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — TOXINA BOTULÍNICA</p>' +
        '<p>Eu, gui, portador(a) do CPF 53872906003, declaro ter sido informado(a) e bem orientado(a) pelo(a) Dr</p>' +
        '<p>.(a) guilherme</p>' +
        '<p>barcelos sobre a ação da Toxina Botulínica do tipo A (que remove o relaxamento dos músculos), suas i</p>' +
        '<p>ndicações e contraindicações, e que o efeito da mesma inicia-</p>' +
        '<p>se cerca de 48 a 72 horas após a aplicação, e tem efeito máximo em torno de 15 dias após a aplicação</p>' +
        '<p>. A indicação do tratamento com a Toxina Botulínica é preconizada para o relaxamento do músculo e d</p>' +
        '<p>iminuição da contração excessiva, e a mesma é transitória, geralmente por um período de 1 a 3 meses.</p>' +
        '<p>Esse período depende de diferentes fatores associados ao paciente, à sua musculatura, ao tipo da pa</p>' +
        '<p>tologia, bem como outros elementos.</p>' +
        '<p>Os efeitos indesejáveis são raros e temporários e dependem, dentre outros fatores, da musculatura de</p>' +
        '<p>cada paciente e da região aplicada, podendo ocasionar:</p>' +
        '<p>• Equimoses ou hematomas (manchamento no local da aplicação, transitório de 5 a 7 dias) e sangrame</p>' +
        '<p>nto e/ou dor durante a injeção;</p>' +
        '<p>• Reação alérgica na pele, hipersensibilidade e/ou dor no local aplicado por horas ou dias, a dep</p>' +
        '<p>ender da região aplicada;</p>' +
        '<p>• Sensação de franqueza ao mastigar e/ou diminuição na amplitude do sorriso;</p>' +
        '<p>• Diminuição na largura da face em pacientes com os músculos masseteres e/ou temporais hiper</p>' +
        '<p>trofiados;</p>' +
        '<p>• Assimetria;</p>' +
        '<p>Queda das pálpebras e/ou sobrancelhas (ptose), e/ou sensação de pálpebras inchadas;</p>' +
        '<p>• Alargamento da área entre as sobrancelhas.</p>' +
        '<p>Fui também claramente informado(a) a respeito das seguintes contraindicações e da previsibilidade do</p>' +
        '<p>s tratamentos:</p>' +
        '<p>• O tratamento não está indicado em caso de gravidez e/ou amamentação.</p>';

      const result = replaceTermVariables(brokenHtml, {});
      expect(result).toContain('pelo(a) Dr.(a) guilherme barcelos');
      expect(result).toContain('suas indicações e contraindicações');
      expect(result).toContain('inicia-se');
      expect(result).toContain('sangramento e/ou dor durante a injeção;');
      expect(result).toContain('a depender da região aplicada;');
      expect(result).toContain('hipertrofiados;');
      expect(result).toContain('previsibilidade dos tratamentos:');
      expect(result).toContain('<li>Queda das pálpebras e/ou sobrancelhas (ptose), e/ou sensação de pálpebras inchadas;</li>');
    });

    it('preserva 100% da formatação rica do Quill (strong, em, u, ol, span, classes ql-align-*)', () => {
      const richHtml =
        '<p class="ql-align-center"><strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO</strong></p>' +
        '<p class="ql-align-center"><em>Procedimento de Harmonização Facial</em></p>' +
        '<p>Eu, <strong>[NOME DO PACIENTE]</strong>, portador do CPF <u>[CPF DO PACIENTE]</u>, declaro que fui devidamente esclarecido(a) sobre:</p>' +
        '<ol>' +
        '<li>O procedimento a ser realizado e seus <strong>benefícios</strong>;</li>' +
        '<li>Os <span style="color: red;">riscos</span> e cuidados pós-operatórios;</li>' +
        '<li>A possibilidade de <em>efeitos transitórios</em> como edema e hematoma.</li>' +
        '</ol>' +
        '<p class="ql-align-right">Assinado em [DATA DE NASCIMENTO DO PACIENTE].</p>';

      const ctx = {
        pac: {
          nome: 'Maria Silva',
          cpf: '123.456.789-00',
          dataNascimento: '1990-05-15',
        },
      };

      const result = replaceTermVariables(richHtml, ctx);
      expect(result).toContain('<p class="ql-align-center"><strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO</strong></p>');
      expect(result).toContain('<p class="ql-align-center"><em>Procedimento de Harmonização Facial</em></p>');
      expect(result).toContain('Eu, <strong>Maria Silva</strong>, portador do CPF <u>123.456.789-00</u>');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>O procedimento a ser realizado e seus <strong>benefícios</strong>;</li>');
      expect(result).toContain('<li>Os <span style="color: red;">riscos</span> e cuidados pós-operatórios;</li>');
      expect(result).toContain('<li>A possibilidade de <em>efeitos transitórios</em> como edema e hematoma.</li>');
      expect(result).toContain('</ol>');
      expect(result).toContain('<p class="ql-align-right">Assinado em 15/05/1990.</p>');
    });

    it('repara quebras de linha em HTML preservando tags internas como strong e classes de alinhamento', () => {
      const brokenWithTags =
        '<p class="ql-align-justify">Eu, <strong>[NOME DO PACIENTE]</strong>, portador do CPF [CPF DO PACIENTE], declaro ter sido informado pelo Dr</p>' +
        '<p>.(a) <strong>[NOME DO PROFISSIONAL]</strong></p>' +
        '<p>sobre a ação da Toxina Botulínica, suas i</p>' +
        '<p>ndicações e contraindicações, e que o efeito inicia-</p>' +
        '<p>se cerca de 48 horas após aplicação.</p>';

      const ctx = {
        pac: { nome: 'gui', cpf: '53872906003' },
        prof: { nome: 'guilherme barcelos' },
      };

      const result = replaceTermVariables(brokenWithTags, ctx);
      expect(result).toContain('Eu, <strong>gui</strong>, portador do CPF 53872906003, declaro ter sido informado pelo Dr.(a) <strong>guilherme barcelos</strong>');
      expect(result).toContain('sobre a ação da Toxina Botulínica, suas indicações e contraindicações, e que o efeito inicia-se cerca de 48 horas após aplicação.');
    });

    it('substitui tokens de procedimento automaticamente quando informado no contexto', () => {
      const template =
        'Autorizo o procedimento para [NOME DO PROCEDIMENTO]. Descrição do tratamento: [DESCRIÇÃO DO TRATAMENTO].';

      const ctx = {
        procedimento: { nome: 'Preenchimento Facial' },
      };

      const result = replaceTermVariables(template, ctx);
      expect(result).toBe(
        'Autorizo o procedimento para Preenchimento Facial. Descrição do tratamento: Preenchimento Facial.'
      );
    });

    it('substitui token de procedimento por linha tracejada quando nao informado no contexto', () => {
      const template = 'Descrição do tratamento: [NOME DO PROCEDIMENTO]';
      const result = replaceTermVariables(template, {});
      expect(result).toBe('Descrição do tratamento: _____________________________________________');
    });
  });
});
