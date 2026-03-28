# 🚀 GUIA RÁPIDO DE ATIVAÇÃO

## ⏱️ Tempo Estimado: 5 minutos

## Passo 1: Editar main.jsx

Abra o arquivo `src/main.jsx`:

```javascript
// ❌ ANTES:
import App from './components/App'

// ✅ DEPOIS:
import App from './components/AppRefactored'
```

## Passo 2: Salvar Arquivo

Ctrl+S ou Cmd+S

## Passo 3: Testar

Execute no terminal:
```bash
npm run dev
```

## Passo 4: Validar Funcionamento

- ✅ Login aparece
- ✅ Pode fazer login (Rafael / PROcedi)
- ✅ Dashboard carrega
- ✅ Pode navegar entre as 5 etapas
- ✅ Pode desenhar no canvas
- ✅ Pode finalizar

## 🎉 Pronto!

Se tudo funcionou, a refatoração está **ativa**!

## ❓ Algo deu errado?

### Erro: "Cannot find module"
```
✅ Solução: Verifique se o arquivo existe em './components/AppRefactored'
```

### Erro: "Props undefined"
```
✅ Solução: Algum prop não está sendo passado. Verifique imports
```

### Canvas não funciona
```
✅ Solução: Verifique se canvasRef está sendo passado corretamente
```

### Estado não atualiza
```
✅ Solução: Verifique se os setters estão sendo chamados
```

## 📞 Próximas Etapas

1. **Backup do original** (opcional):
   ```bash
   cp src/components/App.jsx src/components/App.jsx.backup
   ```

2. **Implementar Agenda** (próximo sprint)

3. **Implementar Pacientes** (próximo sprint)

4. **Adicionar Testes** (quando estável)

---

**Status**: ✅ Pronto para ativar
**Data**: 28/03/2026

