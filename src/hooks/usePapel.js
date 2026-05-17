import { useOrg } from '../contexts/OrgContext';

export function usePapel() {
  const { papel } = useOrg();

  // Mapeamento de peso para hierarquia
  const pesos = {
    'DONO': 100,
    'NIVEL_5': 50,
    'NIVEL_4': 40,
    'NIVEL_3': 30,
    'NIVEL_2': 20,
    'NIVEL_1': 10,
    // Legado
    'ADMIN': 50,
    'PROFISSIONAL': 30,
    'RECEPCIONISTA': 20
  };

  const getPeso = (p) => pesos[p] || 0;
  const usuarioPeso = getPeso(papel);

  const isAdmin = papel === 'ADMIN' || papel === 'DONO' || papel === 'NIVEL_5';
  const isProfissional = papel === 'PROFISSIONAL' || usuarioPeso >= 30;
  const isRecepcionista = papel === 'RECEPCIONISTA' || usuarioPeso >= 20;

  /**
   * Verifica se o usuário tem um nível de acesso igual ou superior ao solicitado.
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} nivel 
   */
  const isAtLeast = (nivel) => {
    return usuarioPeso >= getPeso(nivel);
  };

  return { 
    papel, 
    isAdmin, 
    isProfissional, 
    isRecepcionista,
    isAtLeast,
    // Atalhos úteis
    isDono: papel === 'DONO',
    canManageUsers: papel === 'DONO' || papel === 'NIVEL_5',
    canSeeConfig: isAdmin || isAtLeast('NIVEL_4')
  };
}
