import { getBirthdayAlertInfo, getBirthdayBadgeLabel, parsePatientBirthDate } from './birthday.js';

describe('getBirthdayBadgeLabel', () => {
  const hoje = '2026-09-12';

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
    expect(getBirthdayBadgeLabel('1990-10-03', '2026-09-28')).toBe('Aniversário em 5 dias');
  });

  it('virada de ano', () => {
    expect(getBirthdayBadgeLabel('1990-01-02', '2026-12-27')).toBe('Aniversário em 6 dias');
  });

  describe('29/02', () => {
    it('ano não bissexto (2027): 28/02 é hoje', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', '2027-02-28')).toBe('Aniversariante hoje!');
    });

    it('ano não bissexto (2027): 27/02 é amanhã', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', '2027-02-27')).toBe('Aniversário amanhã');
    });

    it('ano não bissexto: final de janeiro não entra na janela', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', '2027-01-25')).toBeNull();
    });

    it('ano bissexto (2028): 29/02 é hoje', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', '2028-02-29')).toBe('Aniversariante hoje!');
    });

    it('ano bissexto (2028): 28/02 é véspera, não o aniversário', () => {
      expect(getBirthdayBadgeLabel('2000-02-29', '2028-02-28')).toBe('Aniversário amanhã');
    });
  });

  it.each([null, undefined, '', 'abc', '1990-13-01'])('data ausente ou inválida (%s) → null', (raw) => {
    expect(getBirthdayBadgeLabel(raw, hoje)).toBeNull();
  });

  it('sem hoje da clínica → null', () => {
    expect(getBirthdayBadgeLabel('1990-09-12', null)).toBeNull();
  });

  it('fora de todos os casos → null', () => {
    expect(getBirthdayBadgeLabel('1990-03-15', hoje)).toBeNull();
    expect(getBirthdayBadgeLabel('1990-10-05', '2026-09-28')).toBeNull();
  });
});

describe('getBirthdayAlertInfo', () => {
  it('idade que completa e dias até o aniversário de 29/02', () => {
    const parts = parsePatientBirthDate('2000-02-29');
    expect(getBirthdayAlertInfo(parts, '2027-02-20')).toMatchObject({
      daysUntil: 8,
      isToday: false,
      turningAge: 27,
      dataIso: '2027-02-28',
    });
    expect(getBirthdayAlertInfo(parts, '2028-02-29')).toMatchObject({
      daysUntil: 0,
      isToday: true,
      turningAge: 28,
      dataIso: '2028-02-29',
    });
  });

  it('data de nascimento não volta um dia em nenhum fuso do processo', () => {
    expect(parsePatientBirthDate('1990-09-12')).toEqual({ y: 1990, m: 9, d: 12 });
  });
});
