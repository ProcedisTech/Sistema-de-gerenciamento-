import { describe, expect, it } from 'vitest';
import { getVisibleCategories } from './configHubDefs';

const chaves = (flags) => getVisibleCategories(flags).map((c) => c.key);

describe('hub: categoria Notificações', () => {
  it('só com NOTIFICACAO_VER mostra só "Minhas preferências"', () => {
    const cat = getVisibleCategories({ canSeeNotificacoes: true }).find((c) => c.key === 'notificacoes');
    expect(cat.visibleItems.map((i) => i.id)).toEqual(['notif-prefs']);
  });
  it('com CONFIGURAR mostra os dois itens', () => {
    const cat = getVisibleCategories({ canSeeNotificacoes: true, canConfigurarNotificacoes: true }).find((c) => c.key === 'notificacoes');
    expect(cat.visibleItems.map((i) => i.id)).toEqual(['notif-config', 'notif-prefs']);
  });
  it('Notificações é a primeira categoria, como no protótipo', () => {
    expect(chaves({ canSeeNotificacoes: true, canSeeClinica: true })[0]).toBe('notificacoes');
  });
  it('sem nenhuma das flags a categoria some', () => {
    expect(chaves({ canSeeClinica: true })).not.toContain('notificacoes');
  });
});
