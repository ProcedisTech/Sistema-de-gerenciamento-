const CHAVE = 'procedi_saida_manual';

export const saidaManual = {
  marcar() {
    try {
      sessionStorage.setItem(CHAVE, '1');
    } catch {
      // ignore
    }
  },
  existe() {
    try {
      return sessionStorage.getItem(CHAVE) === '1';
    } catch {
      return false;
    }
  },
  limpar() {
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      // ignore
    }
  },
};
