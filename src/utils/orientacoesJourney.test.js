import { describe, it, expect } from 'vitest';
import {
  getPresetOrientacoesByProcedimento,
  normalizeOrientacoesTemplateResponse,
  normalizeWaPhoneDigits,
  PREENCHIMENTO_ORIENTACOES,
  TOXINA_ORIENTACOES,
  BIOESTIMULADOR_ORIENTACOES,
  FIOS_ORIENTACOES,
  PEELING_LASER_ORIENTACOES,
  DEFAULT_ORIENTACOES,
} from './orientacoesJourney.js';

describe('orientacoesJourney', () => {
  describe('getPresetOrientacoesByProcedimento', () => {
    it('retorna orientações de preenchimento para termos relacionados a ácido hialurônico e áreas faciais', () => {
      expect(getPresetOrientacoesByProcedimento(['Preenchimento Facial'])).toEqual(PREENCHIMENTO_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Preenchimento Labial'])).toEqual(PREENCHIMENTO_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Ácido Hialurônico'])).toEqual(PREENCHIMENTO_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Malar e Mandíbula'])).toEqual(PREENCHIMENTO_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento('Preenchimento de Olheiras')).toEqual(PREENCHIMENTO_ORIENTACOES);
    });

    it('retorna orientações de toxina para termos relacionados a botox e toxina botulínica', () => {
      expect(getPresetOrientacoesByProcedimento(['Toxina Botulínica'])).toEqual(TOXINA_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Aplicação de Botox'])).toEqual(TOXINA_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Dysport Terço Superior'])).toEqual(TOXINA_ORIENTACOES);
    });

    it('retorna orientações de bioestimulador para sculptra, radiesse, elleva', () => {
      expect(getPresetOrientacoesByProcedimento(['Bioestimulador de Colágeno'])).toEqual(BIOESTIMULADOR_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Sculptra Facial'])).toEqual(BIOESTIMULADOR_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Radiesse'])).toEqual(BIOESTIMULADOR_ORIENTACOES);
    });

    it('retorna orientações de fios de sustentação para fios PDO', () => {
      expect(getPresetOrientacoesByProcedimento(['Fios de PDO'])).toEqual(FIOS_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Fios de Sustentação'])).toEqual(FIOS_ORIENTACOES);
    });

    it('retorna orientações de peeling / laser para microagulhamento e peelings', () => {
      expect(getPresetOrientacoesByProcedimento(['Peeling Químico'])).toEqual(PEELING_LASER_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Laser Lavieen'])).toEqual(PEELING_LASER_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Microagulhamento com Drug Delivery'])).toEqual(PEELING_LASER_ORIENTACOES);
    });

    it('retorna orientações padrão para procedimentos não mapeados ou lista vazia', () => {
      expect(getPresetOrientacoesByProcedimento([])).toEqual(DEFAULT_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento(['Consulta de Avaliação'])).toEqual(DEFAULT_ORIENTACOES);
      expect(getPresetOrientacoesByProcedimento('')).toEqual(DEFAULT_ORIENTACOES);
    });
  });

  describe('normalizeOrientacoesTemplateResponse', () => {
    it('normaliza array de itens do backend', () => {
      const raw = [{ descricao: 'Cuidado 1', ordem: 0 }, { texto: 'Cuidado 2', ordem: 1 }];
      const res = normalizeOrientacoesTemplateResponse(raw);
      expect(res).toHaveLength(2);
      expect(res[0].descricao).toBe('Cuidado 1');
      expect(res[1].descricao).toBe('Cuidado 2');
    });

    it('retorna array vazio para entrada nula ou inválida', () => {
      expect(normalizeOrientacoesTemplateResponse(null)).toEqual([]);
      expect(normalizeOrientacoesTemplateResponse({})).toEqual([]);
    });
  });

  describe('normalizeWaPhoneDigits', () => {
    it('adiciona prefixo 55 para números brasileiros sem DDI', () => {
      expect(normalizeWaPhoneDigits('61985963447')).toBe('5561985963447');
    });

    it('mantém prefixo se já começar com 55', () => {
      expect(normalizeWaPhoneDigits('+55 (61) 98596-3447')).toBe('5561985963447');
    });
  });
});
