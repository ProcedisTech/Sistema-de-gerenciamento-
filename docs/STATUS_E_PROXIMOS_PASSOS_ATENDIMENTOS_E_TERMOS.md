# Procedi — Status do Desenvolvimento e Próximos Passos

**Documento de Continuidade e Handover para Desenvolvimento Remoto (CEUB)**  
_Data de referência: 11/09/2026_

---

## 📌 1. Resumo Executivo

Este documento resume as implementações recém-concluídas no frontend da plataforma **Procedi** e fornece o guia completo com a arquitetura do próximo passo (**Passo 2: Vinculação visual de Termos Assinados aos Planos e Atendimentos Avulsos**), permitindo retomar o desenvolvimento imediatamente em qualquer máquina (ex: laboratório da faculdade CEUB).

---

## ✅ 2. O que foi feito e concluído (Passo 1)

### Objetivo Concluído:

Criar uma **aba exclusiva e dedicada para "Atendimentos Avulsos"** no perfil do paciente, separando procedimentos pontuais e fotos soltas dos planos de tratamento estruturados ("Planos & Evolução"), com testes automatizados e validação de responsividade (Desktop e Tablet).

### Arquivos Criados e Alterados:

1. **`src/components/patients/AtendimentosAvulsosTab.jsx`** _(NOVO)_:
   - Integra o hook `usePlanosPaciente` e o utilitário `resolverFotosEPlanos`.
   - Aplica a **regra de negócio estrita**: procedimentos que pertençam a qualquer item de planejamento são filtrados e nunca vazam para a pasta avulsa.
   - Inclui feedback de carregamento (`Loader2`), tratamento de erro com botão de re-tentativa e _empty state_ elegante quando o paciente não tiver registros avulsos.
   - Renderiza a pasta de registros pontuais com `initialOpen={true}`.

2. **`src/components/patients/PatientProfileView.jsx`** _(ALTERADO)_:
   - Adicionada a aba `{ key: 'avulsos', label: 'Atendimentos Avulsos', title: 'Atendimentos e Procedimentos Avulsos', icon: Sparkles }`.
   - Corrigido o hook da galeria (`pacientesGaleriaApi.list`) para carregar fotos também quando o usuário acessa diretamente a aba `avulsos`.
   - Ajustada a barra superior de abas para utilizar `.no-scrollbar` e padding flexível, garantindo que os nomes das abas nunca fiquem cortados (`truncate`) e sem barras cinzas feias em telas de tablets ou monitores compactos.

3. **`src/components/planos/PlanosTab.jsx`** _(ALTERADO)_:
   - Removida a renderização antiga e duplicada da `PastaAtendimentosAvulsos` no rodapé dos planos.
   - Removido o filtro obsoleto `"Pasta Avulsos"`, mantendo a navegação focada em `Todos`, `Em Andamento` e `Concluídos`.

4. **`src/components/planos/PastaAtendimentosAvulsos.jsx`** _(ALTERADO)_:
   - Adicionada a prop `initialOpen = false` para permitir abertura padrão na aba própria.
   - **Prateleiras de Fotos por Categoria**: As fotos dos atendimentos avulsos agora são organizadas por categoria clínica (`Antes`, `Mapa de Aplicação`, `Depois`, `Avaliação`, `Outros Registros`), dispostas **uma embaixo da outra separadamente** em prateleiras horizontais idênticas às visitas do plano (`PlanoVisitasTimeline.jsx`), com badges informativos e lightbox integrado com paginação entre fotos.

5. **`src/styles/index.css`** _(ALTERADO)_:
   - Adicionada a classe utilitária `.no-scrollbar` (cross-browser: Chrome, Safari, Edge, Firefox).

6. **`src/components/patients/AtendimentosAvulsosTab.test.jsx`** _(NOVO)_:
   - Suíte com 5 testes unitários cobrindo: estado de loading, erro com retry, empty state, isolamento rigoroso plano x avulso e pluralização de badge (`1 atendimento` / `2 atendimentos`).

### Status de Qualidade:

- **Testes**: 311 testes unitários passando (`npm run test:run` = 45/45 arquivos verdes).
- **Build de Produção**: `npm run build` executado com êxito (zero erros de sintaxe ou bundle).
- **Validação Visual**: Verificado em browser em 820px (tablet) e 1200px (desktop) com screenshots capturados.

---

## 🎯 3. O Próximo Passo: Passo 2 (Termos Assinados)

### 3.1. Necessidade do Negócio

O profissional clínico precisa, ao visualizar um atendimento realizado (seja uma visita de um plano de tratamento ou um procedimento avulso):

1. Ver claramente as **fotos registradas** (antes, depois, marcação, etc.).
2. Ver **junto com as fotos o Termo de Consentimento Livre e Esclarecido (TCLE) assinado** pelo paciente para aquele ato médico/estético.
3. Ter um acesso rápido e visual para **abrir/conferir o documento assinado**, seu hash de integridade ou baixar o PDF.

---

### 3.2. Mapeamento dos Dados no Frontend

#### Onde estão os termos assinados hoje no paciente?

No perfil do paciente (`PatientProfileView.jsx`), temos a prop `assinaturas` (array vindo do backend/mock):

- Cada objeto de assinatura contém:
  ```json
  {
    "id": "uuid-da-assinatura",
    "procedimentoFeitoId": "uuid-do-procedimento",
    "tituloTermo": "TCLE - Toxina Botulínica",
    "assinadoEm": "2026-09-01T14:32:00Z",
    "pacienteNome": "Ana Silva",
    "status": "ASSINADO",
    "hashSha256": "a3f8c...",
    "pdfUrl": "/api/documentos/.../pdf"
  }
  ```
- O vínculo direto é:
  ```javascript
  const termoDoProcedimento = assinaturas.find(
    (a) => String(a.procedimentoFeitoId) === String(procedimento.id),
  );
  ```

---

### 3.3. Plano de Ação para o Passo 2

#### Sub-etapa 2.1: Criar Componente Reutilizável de Termo Assinado

Criar um componente compacto e elegante (ex: `TermoAssinadoBadgeCard.jsx` ou `TermoAnexoStrip.jsx`) com:

- Ícone de documento com selo de verificação verde (`FileCheck2` ou `ShieldCheck`).
- Nome do termo (ex: _"TCLE - Preenchimento Labial"_).
- Data e hora da assinatura formatada em pt-BR.
- Selo visual de conformidade ("Assinado digitalmente").
- Ação ao clicar: abrir modal com o visualizador do documento (`AnamneseDocumentoAssinadoView` ou pop-up de visualização de PDF/termo).

#### Sub-etapa 2.2: Vincular nos Atendimentos Avulsos (`PastaAtendimentosAvulsos.jsx`)

- Passar a prop `assinaturas` para `AtendimentosAvulsosTab.jsx` e repassá-la para `PastaAtendimentosAvulsos.jsx`.
- No card de cada procedimento avulso:
  - Localizar a assinatura correspondente pelo `procedimentoFeitoId`.
  - Exibir a seção **"Documentos e Termos Vinculados"** logo ao lado ou acima da galeria de fotos daquele atendimento.
  - Caso não haja termo assinado, mostrar um aviso discreto ou botão de vincular/solicitar termo.

#### Sub-etapa 2.3: Vincular nos Planos de Tratamento (`PlanoVisitasTimeline.jsx` / `PlanoItemCard.jsx`)

- Na timeline de visitas do plano (`PlanoVisitasTimeline.jsx`):
  - Em cada visita realizada (ou item executado com procedimento associado), exibir o card/badge do termo assinado junto com a prateleira de fotos daquela visita.
  - Permitir que o médico bata o olho na visita 1 ou 2 do plano e veja instantaneamente: **"Fotos de Evolução (Antes/Depois) + TCLE Assinado"**.

#### Sub-etapa 2.4: Testes Automatizados e Validação

- Adicionar testes unitários simulando:
  - Procedimento com termo assinado (garantir renderização do nome do termo e data).
  - Procedimento sem termo assinado (garantir que não quebre e mostre fallback adequado).
- Executar `npm run test:run` e `npm run build`.

---

## 💻 4. Prompt Pronto para colar no Antigravity no CEUB

Quando você abrir o projeto no Antigravity do CEUB, crie um novo chat e **cole exatamente o texto abaixo**:

```text
Olá! Estou continuando o desenvolvimento da plataforma Procedi a partir do documento docs_export/STATUS_E_PROXIMOS_PASSOS_ATENDIMENTOS_E_TERMOS.md.

Acabamos de concluir com êxito o Passo 1 (Aba dedicada de Atendimentos Avulsos no perfil do paciente, com 311 testes passando e build 100% verde).

Agora vamos executar o Passo 2:
"Linkar os termos assinados (TCLE) dentro dos Planos de Tratamento e nos Atendimentos Avulsos, para aparecerem visualmente junto com as fotos de cada procedimento/visita."

Por favor:
1. Leia o arquivo docs_export/STATUS_E_PROXIMOS_PASSOS_ATENDIMENTOS_E_TERMOS.md.
2. Analise os componentes PastaAtendimentosAvulsos.jsx, PlanoVisitasTimeline.jsx e AtendimentosAvulsosTab.jsx.
3. Crie um plano de implementação para o Passo 2 respeitando as regras de negócio e boas práticas visuais da aplicação.
```

---

## 📦 5. Checklist rápido para levar os arquivos (Se for usar ZIP)

Se não for usar Git e for enviar o projeto compactado por e-mail ou pendrive:

- [ ] Compactar **apenas** o código-fonte.
- [ ] **IGNORAR/EXCLUIR** as pastas: `node_modules`, `dist`, `.git` (se for muito pesada) e relatórios temporários.
- [ ] No computador do CEUB:
  1. Extrair os arquivos numa pasta.
  2. Abrir o terminal da pasta e rodar `npm install`.
  3. Rodar `npm run dev` para subir o servidor na porta 5173.
  4. Abrir a pasta no Antigravity e colar o prompt acima!
