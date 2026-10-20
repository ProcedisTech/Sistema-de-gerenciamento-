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

## 🧪 Protocolo Obrigatório de Regressão Zero & Testes Automatizados (Zero-Regression Policy)

Sempre que um bug, regressão ou inconsistência clínica for identificado e corrigido:

1. **Proibição Estrita de Fix sem Teste:** É terminantemente proibido declarar qualquer bug ou regressão corrigido sem a entrega simultânea de teste automatizado correspondente.
2. **Padrão de Co-location (Ao lado do Código):**
   - Testes unitários e de componente React DEVEM ficar na mesma pasta do arquivo original com a extensão `.test.jsx` ou `.test.js` (ex: `FotoVistaCanvas.jsx` ➔ `FotoVistaCanvas.test.jsx`).
   - Testes de fluxo multi-componente ou de ponta a ponta residem na pasta `src/test/` (ex: `src/test/consulta/`).
3. **Documentação Semântica para IAs e Desenvolvedores Futuros:**
   - Todo teste de regressão DEVE conter comentário no topo explicando a regra de negócio clínica e o cenário prevenido (ex: `// Regressão prevenida: Pontos de Botox mantêm cor azul ao selecionar Preenchimento`).
   - Usar blocos claros de `describe`, `it` e asserções semânticas que expliquem o _porquê_ da regra, para que nenhuma IA futura altere ou remova a proteção achando que é descartável.
4. **Critério de Aceite do PR/Fix:**
   - O teste deve falhar sem o fix e passar verde com o fix.
   - `npm test <caminho-do-teste>` 100% verde e `npm run build` compilando limpo.
5. **Proibição Estrita de Mocks Mascaradores em Integração (Anti-Isolated-Mock Rule):**
   - É terminantemente **PROIBIDO** testar componentes filhos (ex: etapas de formulário, modais, telas de assinatura LGPD) injetando props pré-resolvidas ou mocks estáticos quando a regra de negócio depende de derivação do container pai (`AppRefactored` ou hook de controle).
   - O teste de regressão DEVE exercitar a função ou hook integrador real que deriva os dados a partir do estado bruto (ex: simular múltiplos procedimentos selecionados em `procedimentosSessao` e assertar que a resolução gerada pelo container entrega TODOS os termos e bloqueios exigidos para o filho).
6. **Auditoria de Contrato de Loopback Assíncrono & Merge (Async Loopback & Merge Parity):**
   - Sempre que um recurso for salvo/criado localmente e depois sincronizado via SSE, polling, WebSocket ou re-fetch, o teste automatizado DEVE alimentar o objeto gerado localmente na rotina real de mesclagem (`mergeFotosPorId`, updaters de lista).
   - O teste DEVE assertar expressamente:
     1. Zero Duplicação: `array.length` após o loopback é rigorosamente idêntico ao pré-loopback;
     2. Casamento de Chaves: IDs de correlação (`id`, `fotoId`, `meta.fotoId`) coincidem em ambas as pontas;
     3. Preservação de Blobs e Desenhos: O merge remoto NÃO sobrescreve blobs/canvas locais em memória com URLs de API vazias ou inacessíveis;
     4. Transição de Etapas: A passagem de dados entre telas (ex: Avaliação ➔ Procedimento) não multiplica nem duplica fotos.
7. **Anti-Shadowing de Estado & Ciclo Adição-Remoção-Abertura (State Shadowing & Deletion Parity):**
   - É proibido manter variáveis de estado concorrentes/espelhadas para a mesma entidade (ex: `procedimentosSessao` e `procedimentosLote`). Deve existir uma ÚNICA fonte de verdade, ou sincronização atômica mandatória.
   - Todo fluxo multi-entidade DEVE conter teste automatizado do ciclo: `Adicionar A, B` ➔ `Adicionar C` ➔ `Remover C (via UI/chip X)` ➔ `Abrir modais dependentes (Mapa Fullscreen, galeria, termos)` ➔ Assertar que C foi expurgado de TODAS as superfícies e que não há estado sombra ressuscitando o item.
8. **Teste Adversarial de Colisão Forçada em Recursos Finitos (Pigeonhole Collision Test):**
   - É proibido testar algoritmos de distribuição de recursos finitos (paleta de 12 cores, slots, etc.) apenas com IDs sequenciais ou aleatórios convenientes que não colidem.
   - O teste DEVE usar intencionalmente pelo menos 2 IDs que gerem o MESMO hash base (`hashUuid(id) % 12`), comprovando que o mecanismo anti-colisão desvia o segundo item para uma cor livre e que 100% das superfícies (cards, chips, mapas e fullscreen toolbars) renderizam cores distintas.

---

## 🛡️ Diretrizes de Execução e Código

- Respeitar a regra de autorização estrita de modificação (`strict-modification-authorization.md`).
- Comandos Git: O usuário gerencia seus commits (_"deixa que os comandos git eu rodo"_). O agente nunca executa `git commit` ou `git push` via shell sem pedido expresso.
- Nenhuma modificação sem compilação prévia e verificação de lint (`npm run build`, `npm run lint`).
