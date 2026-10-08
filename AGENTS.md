# AGENTS.md — Regras e Diretrizes do Workspace Procedi

## 🎯 Protocolo Obrigatório de Planejamento (`/plan` Trigger)

Sempre que o usuário:

1. Digitar o comando `/plan`
2. Usar comandos ou frases como: _"planeje"_, _"faça um plano"_, _"crie um plano"_, _"elabore um plano"_, _"prepare a implementação"_
3. Solicitar arquitetura, refatoração estrutural ou plano de implementação para qualquer funcionalidade

O agente é **ESTRITAMENTE OBRIGADO A:**

1. **Ativar e ler a skill:** Executar `view_file` em [adversarial-plan-audit](file:///c:/Users/Microsoft/Documents/saas/Sistema-de-gerenciamento-/.agents/skills/adversarial-plan-audit/SKILL.md).
2. **Executar o Single-Pass Exhaustion Protocol:** Varrer de ponta a ponta todas as 7 camadas (Camadas 0 a 6) usando ferramentas de busca e leitura de arquivo (`view_file`, `grep_search`).
3. **Proibição de Planos Rasos / Parciais:** É proibido entregar plano conceitual superficial esperando que o usuário aponte pontas soltas ou peça revisão. O plano já deve nascer exaustivo na primeira passagem.
4. **Camada 0 Obrigatória:** Todo plano DEVE conter a seção `💡 Melhorias Proativas Antecipadas & Otimizações de UX` identificando atalhos de ergonomia, prevenção de dados órfãos, consistência clínica e regras de negócio antes de submeter ao usuário.

---

## 🛡️ Diretrizes de Execução e Código

- Respeitar a regra de autorização estrita de modificação (`strict-modification-authorization.md`).
- Comandos Git: O usuário gerencia seus commits (_"deixa que os comandos git eu rodo"_). O agente nunca executa `git commit` ou `git push` via shell sem pedido expresso.
- Nenhuma modificação sem compilação prévia e verificação de lint (`npm run build`, `npm run lint`).
