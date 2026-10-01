import { getBirthdayBadgeLabel } from './birthday.js';

const at = (y, m, d) => new Date(y, m - 1, d, 10, 0);

describe('getBirthdayBadgeLabel', () => {
  const hoje = at(2026, 9, 12);

  it('aniversário hoje', () => {
    expect(getBirthdayBadgeLabel('1990-09-12', hoje)).toBe('Aniversariante hoje!');
  });

  it('aniversário amanhã', () => {
    expect(getBirthdayBadgeLabel('1990-09-13', hoje)).toBe('Aniversário amanhã');
  });

  it.each([2, 3, 4, 5, 6])('aniversário em %i dias', (n) => {
    const dia = String(12 + n).padStart(2, '0');
    expect(getBirthdayBadgeLabel(`1990-09-${dia}`, hoje)).toBe(`Aniversário em ${n} dias`);
  });

  it('do mês antes do dia (fora da janela de 7 dias)', () => {
    expect(getBirthdayBadgeLabel('1990-09-28', hoje)).toBe('Aniversariante do mês');
  });

  it('do mês depois do dia (aniversário já passou)', () => {
    expect(getBirthdayBadgeLabel('1990-09-05', hoje)).toBe('Aniversariante do mês');
  });

  it('7 dias no mesmo mês vira do mês', () => {
    expect(getBirthdayBadgeLabel('1990-09-19', hoje)).toBe('Aniversariante do mês');
  });

  it('virada de mês', () => {
    expect(getBirthdayBadgeLabel('1990-10-03', at(2026, 9, 28))).toBe('Aniversário em 5 dias');
  });

  it('virada de ano', () => {
    expect(getBirthdayBadgeLabel('1990-01-02', at(2026, 12, 27))).toBe('Aniversário em 6 dias');
  });

  describe('29/02', () => {
    it('ano não bissexto: 28/02 é hoje', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', at(2027, 2, 28))).toBe('Aniversariante hoje!');
    });

    it('ano não bissexto: 27/02 é amanhã', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', at(2027, 2, 27))).toBe('Aniversário amanhã');
    });

    it('ano não bissexto: final de janeiro não entra na janela', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', at(2027, 1, 25))).toBeNull();
    });

    it('ano bissexto: 29/02 é hoje', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', at(2028, 2, 29))).toBe('Aniversariante hoje!');
    });
  });

  it.each([null, undefined, '', 'abc', '1990-13-01'])('data ausente ou inválida (%s) → null', (raw) => {
    expect(getBirthdayBadgeLabel(raw, hoje)).toBeNull();
  });

  it('fora de todos os casos → null', () => {
    expect(getBirthdayBadgeLabel('1990-03-15', hoje)).toBeNull();
    expect(getBirthdayBadgeLabel('1990-10-05', at(2026, 9, 28))).toBeNull();
  });
});
