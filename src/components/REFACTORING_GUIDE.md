# 📋 Refatoração do App.jsx - Guia de Estrutura

## 📂 Estrutura de Diretórios

```
src/components/
├── App.jsx                 (Original - manter por compatibilidade)
├── AppRefactored.jsx       (Novo - versão refatorada, pronto para uso)
│
├── auth/
│   ├── LoginForm.jsx       (Formulário de login)
│   ├── CookieConsent.jsx   (Banner de consentimento cookies)
│   └── index.js            (Exports)
│
├── layout/
│   ├── Sidebar.jsx         (Navegação lateral)
│   ├── Stepper.jsx         (Indicador de progresso das etapas)
│   └── index.js            (Exports)
│
├── journey/
│   ├── Step1CheckIn.jsx       (Etapa 1: Identificação do paciente)
│   ├── Step2Anamnese.jsx      (Etapa 2: Histórico médico)
│   ├── Step3Evaluation.jsx    (Etapa 3: Mapeamento com canvas)
│   ├── Step4LGPD.jsx          (Etapa 4: Termo de consentimento)
│   ├── Step5Finalization.jsx  (Etapa 5: Orientações finais)
│   └── index.js               (Exports)
│
├── hooks/
│   ├── useAuthState.js         (Estados de autenticação)
│   ├── usePatientState.js      (Estados de pacientes)
│   ├── useJourneyState.js      (Estados da jornada/etapas)
│   ├── useAppointmentState.js  (Estados de agenda/agendamentos)
│   └── index.js                (Exports)
│
├── utils/
│   ├── formatters.js      (Máscaras, cálculos, utilitários)
│   └── index.js           (Exports)
│
├── agenda/          (Planejado - componentes de agenda)
├── patients/        (Planejado - componentes de pacientes)
└── canvas/          (Planejado - componentes de canvas)
```

## 🎯 Padrão de Importação

### Importação dos Hooks
```javascript
import { useAuthState, usePatientState, useJourneyState, useAppointmentState } from './hooks';
```

### Importação dos Componentes
```javascript
import { LoginForm, CookieConsent } from './auth';
import { Sidebar, Stepper } from './layout';
import { Step1CheckIn, Step2Anamnese, Step3Evaluation, Step4LGPD, Step5Finalization } from './journey';
```

### Importação de Utilitários
```javascript
import { maskCPF, maskTelefone, api, calculateAgeFromISODate } from './utils';
```

## 📊 Como Usar

### 1. Trocar o App Original

Para usar a versão refatorada, substitua a importação em `src/main.jsx`:

```javascript
// Antes
import App from './components/App';

// Depois
import App from './components/AppRefactored';
```

### 2. Estrutura de um Hook de Estado

Todos os hooks seguem este padrão:
```javascript
export const useExemploState = () => {
  const [state1, setState1] = useState(...);
  const [state2, setState2] = useState(...);
  
  return {
    state1, setState1,
    state2, setState2,
  };
};
```

### 3. Usando um Componente de Etapa

```javascript
<Step1CheckIn
  activeTab={journeyState.activeTab}
  setActiveTab={journeyState.setActiveTab}
  // ... mais props
/>
```

## 🧩 Benefícios da Refatoração

✅ **Componentes Isolados**: Cada etapa é um componente independente, fácil de testar
✅ **Hooks Reutilizáveis**: Estados compartilhados através de hooks customizados
✅ **Importações Limpas**: Diretórios bem organizados com arquivos index.js
✅ **Manutenção Simplificada**: Encontrar e editar funcionalidades é mais rápido
✅ **Escalabilidade**: Fácil adicionar novas etapas ou componentes
✅ **Testes Unitários**: Componentes pequenos são mais fáceis de testar

## 📝 Próximos Passos

1. **Implementar componentes de Agenda** (`agenda/AgendaView.jsx`, `agenda/AgendaModal.jsx`)
2. **Implementar componentes de Pacientes** (`patients/PatientsView.jsx`, `patients/PatientProfile.jsx`)
3. **Separar lógica de canvas** para componentes reutilizáveis
4. **Adicionar Context API** se necessário state global mais complexo
5. **Criar testes unitários** para cada componente
6. **Documentar APIs** de componentes para equipe

## ⚙️ Migração Gradual

Se preferir migrar gradualmente:

1. Manter o App.jsx original
2. Testar AppRefactored.jsx em branch separado
3. Migrar uma funcionalidade por vez
4. Validar comportamento idêntico
5. Fazer merge quando tudo estiver funcionando

## 🐛 Debugging

- Verificar imports: `import { ... } from './hooks'`
- Validar props sendo passadas corretamente
- Usar React DevTools para inspecionar estado dos hooks
- Logs em useEffect para rastrear mudanças

---

**Data de Criação**: 28/03/2026
**Status**: ✅ Implementação Concluída (Etapa 1-5 da Jornada)
**Próximo**: Agenda e Pacientes

