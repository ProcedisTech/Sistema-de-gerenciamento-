# Bateria Definitiva de Testes de Homologação Clínica — Plataforma Procedi

**Documento de Validação Exaustiva Pré-Lançamento (End-to-End & Banco de Dados)**  
_Ambiente: Desenvolvimento / Staging / Produção_  
_Data de Emissão: 11/09/2026_  
_Critério de Liberação: 100% dos testes Críticos e Altos aprovados sem desvios._

---

## 📋 Sumário dos Módulos Avaliados

1. [Módulo 1: Gestão de Planos de Tratamento](#módulo-1-gestão-de-planos-de-tratamento)
2. [Módulo 2: Agendamento, Reagendamento e Sincronização com Agenda](#módulo-2-agendamento-reagendamento-e-sincronização-com-agenda)
3. [Módulo 3: Hub de Consulta & Execução do Procedimento do Plano](#módulo-3-hub-de-consulta--execução-do-procedimento-do-plano)
4. [Módulo 4: Ciclo de Retornos (Retornos Rápidos, Múltiplos Retornos, Retoques e Reagendamento)](#módulo-4-ciclo-de-retornos)
5. [Módulo 5: Galeria de Fotos, Mapas de Aplicação e Prateleiras por Categoria](#módulo-5-galeria-de-fotos-mapas-de-aplicação-e-prateleiras)
6. [Módulo 6: Atendimentos Avulsos e Segregação Absoluta](#módulo-6-atendimentos-avulsos-e-segregação-absoluta)
7. [Módulo 7: Acesso Cruzado e Navegação (Perfil vs Hub vs Agenda)](#módulo-7-acesso-cruzado-e-navegação)
8. [Módulo 8: Auditoria de Banco de Dados e Persistência Real](#módulo-8-auditoria-de-banco-de-dados-e-persistência-real)
9. [Módulo 9: Resiliência, Recarregamento (F5), Sessão e Responsividade](#módulo-9-resiliência-recarregamento-f5-sessão-e-responsividade)
10. [Módulo 10: Matriz de Aceite Final (Go / No-Go)](#módulo-10-matriz-de-aceite-final)

---

## Módulo 1: Gestão de Planos de Tratamento

### `TEST-PLN-001` — Criação de Plano Monoprocedimento com 1 Sessão

- **Gravidade**: 🔴 **CRÍTICA**
- **Pré-condição**: Paciente cadastrado ativo.
- **Passo a Passo**:
  1. No perfil do paciente, abrir a aba **"Planos & Evolução"**.
  2. Clicar em **"Novo Plano de Tratamento"**.
  3. Preencher nome do plano (ex: _"Harmonização Facial - Rinomodelação"_).
  4. Adicionar 1 item: Procedimento _"Rinomodelação"_, 1 sessão, valor R$ 1.800,00.
  5. Salvar o plano.
- **Resultado Esperado na UI**:
  - O card do plano é renderizado no topo da lista com status **"EM ANDAMENTO"**.
  - O item de planejamento aparece listado com status **"PLANEJADO"** (ou badge correspondente) e botão de **"Agendar"** visível.
  - O valor total do plano reflete exatamente R$ 1.800,00.
- **Validação no Banco de Dados**:
  ```sql
  SELECT id, paciente_id, titulo, status, valor_total FROM planos_tratamento WHERE paciente_id = '<ID_PACIENTE>';
  SELECT id, plano_id, procedimento_id, sessoes_total, sessoes_feitas, status FROM itens_planejamento WHERE plano_id = '<ID_PLANO>';
  ```

  - _1 registro em `planos_tratamento` com status correspondente e valor 1800.00._
  - _1 registro em `itens_planejamento` associado ao plano com `sessoes_total = 1` e `sessoes_feitas = 0`._
- **O que NÃO pode acontecer**: Erro 500 no backend; card sumir após F5; valor total zerado.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-PLN-002` — Criação de Plano Multiprocedimentos com Múltiplas Sessões

- **Gravidade**: 🔴 **CRÍTICA**
- **Pré-condição**: Paciente cadastrado.
- **Passo a Passo**:
  1. Criar novo plano _"Protocolo Rejuvenescimento Global"_.
  2. Adicionar Item 1: _"Toxina Botulínica 3 Áreas"_ (1 sessão - R$ 1.200,00).
  3. Adicionar Item 2: _"Bioestimulador de Colágeno (Radiesse)"_ (3 sessões - R$ 3.600,00).
  4. Adicionar Item 3: _"Peeling Químico Médio"_ (2 sessões - R$ 800,00).
  5. Salvar o plano.
- **Resultado Esperado na UI**:
  - Soma total correta: R$ 5.600,00.
  - Cada procedimento exibe sua respectiva barra/contador de sessões (ex: 0/1, 0/3, 0/2).
  - Timeline de visitas inicializada ou vazia aguardando agendamentos.
- **Validação no Banco de Dados**:
  - `SELECT COUNT(*) FROM itens_planejamento WHERE plano_id = '<ID_PLANO>';` retorna **3**.
- **O que NÃO pode acontecer**: Itens duplicados; soma matemática incorreta; erro de chave estrangeira no insert em lote.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-PLN-003` — Edição Dinâmica do Plano (Adicionar e Remover Itens Antes da Execução)

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. Abrir o plano criado em `TEST-PLN-002`.
  2. Clicar em **"Editar Plano"**.
  3. Adicionar um novo item: _"Microagulhamento"_ (1 sessão - R$ 450,00).
  4. Remover o item _"Peeling Químico Médio"_ (que ainda não tinha agendamento/execução).
  5. Salvar alterações.
- **Resultado Esperado na UI**:
  - Novo valor total recalculado: R$ 5.250,00.
  - Item removido desaparece imediatamente sem deixar resíduos visuais.
  - Novo item aparece pronto para agendamento.
- **Validação no Banco**:
  - O item removido foi deletado ou marcado como inativo/cancelado no banco.
  - O novo item existe com ID válido vinculado ao plano.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-PLN-004` — Conclusão Automática do Plano & Modal Celebrativo da Clínica

- **Gravidade**: 🔴 **CRÍTICA**
- **Pré-condição**: Plano com 1 procedimento de 1 sessão restante.
- **Passo a Passo**:
  1. Executar e finalizar a última sessão pendente do plano.
  2. Observar a transição de status do plano.
- **Resultado Esperado na UI**:
  - O plano transiciona seu status para **"CONCLUÍDO"**.
  - O modal exclusivo de parabenização/conclusão da clínica (`PlanoConcluidoClinicaModal.jsx`) abre com visual comemorativo e bloqueia cliques externos.
  - Ao fechar o modal, o plano aparece na lista com badge verde de concluído e arquivamento opcional.
- **Validação no Banco**:
  - `status = 'CONCLUIDO'` e timestamp `concluido_em` preenchido em `planos_tratamento`.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 2: Agendamento, Reagendamento e Sincronização com Agenda

### `TEST-AGE-001` — Agendamento de Item de Plano Direto para a Agenda

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. No card do procedimento dentro do plano, clicar em **"Agendar"** ou **"Agendar Sessão 1"**.
  2. O modal de agendamento deve abrir **pré-preenchido** com:
     - Paciente correto selecionado e travado.
     - Procedimento correto vinculado.
     - Indicador de que o agendamento pertence ao Plano X (com `planejamentoItemId`).
  3. Selecionar data (ex: amanhã às 14:00) e profissional.
  4. Confirmar o agendamento.
- **Resultado Esperado na UI**:
  - Toast de confirmação com sucesso.
  - No plano de tratamento, o item passa para o status **"AGENDADO"**, exibindo a data, hora e nome do profissional.
  - Na tela da **Agenda**, no dia e horário selecionados, o compromisso aparece no slot com tag de identificação do plano.
- **Validação no Banco de Dados**:
  ```sql
  SELECT id, paciente_id, procedimento_id, planejamento_item_id, data_hora_inicio, status
  FROM agendamentos WHERE planejamento_item_id = '<ID_ITEM>';
  ```

  - `planejamento_item_id` deve estar estritamente preenchido apontando para o item.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-AGE-002` — Reagendamento de Procedimento de Plano (Via Plano)

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. No card do item já agendado no plano, clicar em **"Reagendar"**.
  2. Alterar a data para 3 dias depois e mudar o horário das 14:00 para as 16:30.
  3. Confirmar o reagendamento.
- **Resultado Esperado na UI**:
  - O card do plano atualiza a data/hora imediatamente sem necessidade de F5 manual.
  - Na visualização da Agenda, o compromisso original das 14:00 foi movido para o novo dia às 16:30.
- **Validação no Banco**:
  - O registro de agendamento em `agendamentos` teve seu `data_hora_inicio` atualizado (ou o antigo cancelado e o novo criado com o mesmo `planejamento_item_id`).
- **O que NÃO pode acontecer**: Manter o horário antigo ocupado na agenda criando agendamento fantasma duplo.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-AGE-003` — Reagendamento de Procedimento de Plano (Via Tela da Agenda)

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Acessar a tela principal da **Agenda**.
  2. Localizar o agendamento do plano e clicar em **Reagendar / Editar**.
  3. Mudar o dia/horário do compromisso.
  4. Salvar e voltar ao perfil do paciente na aba **"Planos & Evolução"**.
- **Resultado Esperado na UI**:
  - O plano de tratamento reflete a nova data e horário sincronizados em tempo real.
- **Validação no Banco**:
  - Integridade mantida entre `agendamentos` e o item em `itens_planejamento`.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-AGE-004` — Cancelamento de Agendamento de Item de Plano

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. Na agenda ou no plano, cancelar o agendamento de uma sessão não realizada.
- **Resultado Esperado na UI**:
  - O compromisso sai da grade ativa da agenda.
  - No plano de tratamento, o item volta para o status **"PLANEJADO"** (ou "Pendente"), e o botão **"Agendar"** volta a ficar disponível.
  - As sessões concluídas anteriormente permanecem intocadas.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 3: Hub de Consulta & Execução do Procedimento do Plano

### `TEST-HUB-001` — Iniciar Atendimento a partir do Card do Plano

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Na aba de planos do paciente, clicar em **"Iniciar Atendimento"** no item agendado para o dia.
- **Resultado Esperado na UI**:
  - O sistema transiciona para o **Hub de Consulta** com:
    - Paciente carregado no topo.
    - O procedimento do plano já pré-selecionado na lista de procedimentos a realizar.
    - O vínculo do `planejamentoItemId` preservado no estado da consulta.
- **O que NÃO pode acontecer**: Abrir consulta em branco obrigando o profissional a redigitar o nome do procedimento ou selecionar o paciente novamente.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-HUB-002` — Iniciar Atendimento Direto pelo Header/Ação Rápida do Paciente

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. No perfil do paciente, clicar no botão verde principal **"Iniciar atendimento"** do cabeçalho.
  2. Se o paciente possuir um agendamento para hoje vinculado a plano:
     - O sistema deve sugerir ou carregar automaticamente os itens do plano agendados para hoje.
  3. Se não houver agendamento para hoje:
     - Permitir escolher entre iniciar uma sessão de plano existente ou realizar um procedimento avulso.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-HUB-003` — Finalização da Consulta e Registro do Procedimento Executado

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. No Hub de Consulta, preencher os dados clínicos (observações, anestésico utilizado, lote do produto se houver).
  2. Capturar ou anexar fotos (Antes, Marcação/Mapa, Depois).
  3. Clicar em **"Finalizar Procedimento"** / **"Concluir Atendimento"**.
- **Resultado Esperado na UI**:
  - Toast de sucesso com fechamento elegante do Hub.
  - Ao retornar ao perfil do paciente:
    - Na aba **"Prontuário"**, o procedimento aparece registrado no histórico com data, hora, profissional e observações.
    - Na aba **"Planos & Evolução"**, o item do plano avança de sessão (ex: de 0/1 para 1/1, ou de 1/3 para 2/3).
    - As fotos registradas aparecem na visita correspondente do plano.
- **Validação no Banco de Dados**:
  ```sql
  SELECT id, paciente_id, procedimento_id, planejamento_item_id, status, observacao, profissional_id, criado_em
  FROM procedimentos_feitos WHERE paciente_id = '<ID_PACIENTE>' ORDER BY criado_em DESC LIMIT 1;
  ```

  - `planejamento_item_id` deve corresponder ao ID do item do plano.
  - `itens_planejamento.sessoes_feitas` incrementado em +1.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-HUB-004` — Execução de Múltiplos Procedimentos na Mesma Consulta

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Iniciar atendimento para um paciente que fará 2 procedimentos na mesma sessão (ex: _"Toxina"_ do Plano A + _"Preenchimento"_ do Plano A, ou 1 do plano + 1 avulso).
  2. Finalizar ambos os procedimentos na mesma jornada de consulta.
- **Resultado Esperado na UI**:
  - Ambos os itens são finalizados e computados simultaneamente.
  - A timeline de visitas do plano agrupa ambos na mesma **Visita** do dia.
- **Validação no Banco**:
  - Dois registros em `procedimentos_feitos`, ambos associados aos seus respectivos `planejamento_item_id`.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 4: Ciclo de Retornos

### `TEST-RET-001` — Agendamento de Retorno Rápido ao Finalizar Consulta (Atalhos +15d, +30d)

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. No finalizador da consulta ou no popover de retorno do procedimento recém-executado, selecionar o atalho **"+15 dias"** ou **"+30 dias"**.
  2. O modal da agenda deve calcular a data exata respeitando dias úteis e horário sugerido.
  3. Confirmar o agendamento do retorno.
- **Resultado Esperado na UI**:
  - Na timeline do plano, o card do retorno aparece aninhado ou associado ao procedimento pai.
  - Na tela da agenda, o retorno aparece com a identificação clara: _"Retorno: [Nome do Procedimento]"_.
- **Validação no Banco de Dados**:
  ```sql
  SELECT id, paciente_id, tipo, procedimento_origem_id, data_hora_inicio
  FROM agendamentos WHERE paciente_id = '<ID_PACIENTE>' AND (tipo = 'RETORNO' OR is_retorno = true);
  ```
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-RET-002` — Múltiplos Retornos para o Mesmo Procedimento

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. Em um procedimento executado (ex: _"Toxina Botulínica"_):
     - Agendar o 1º retorno (+15 dias para avaliação).
  2. No 1º retorno, realizar um pequeno retoque.
  3. Agendar um 2º retorno (+30 dias adicionais para conferência final).
- **Resultado Esperado na UI**:
  - O card do procedimento exibe badge indicando: **"2 retornos"**.
  - Ao expandir, ambos os retornos aparecem listados com suas respectivas datas e status.
  - A timeline não colapsa e nem sobrepõe as informações dos retornos.
- **Validação no Banco**:
  - Ambos os retornos possuem referência correta ao procedimento pai (`parent_procedimento_feito_id` ou equivalente).
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-RET-003` — Reagendamento de Retorno

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Localizar o retorno agendado na timeline do plano.
  2. Clicar no botão **"Reagendar"** do retorno.
  3. Modificar a data e horário.
  4. Salvar.
- **Resultado Esperado na UI**:
  - Data atualizada imediatamente no plano sem duplicar cards.
  - Na Agenda, o compromisso do retorno foi deslocado para o novo horário.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 5: Galeria de Fotos, Mapas de Aplicação e Prateleiras

### `TEST-FOT-001` — Upload/Captura e Categorização Automática nas Prateleiras do Plano

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Em uma sessão de plano, anexar fotos categorizadas:
     - 1 foto como _"Antes"_
     - 1 foto com marcações anatômicas como _"Mapa de Aplicação"_
     - 1 foto como _"Depois"_
     - 1 foto como _"Avaliação"_
  2. Salvar e abrir a aba **"Planos & Evolução"** do paciente.
  3. Expandir a visita correspondente.
- **Resultado Esperado na UI**:
  - A seção de fotos da visita exibe as prateleiras horizontais separadas, **uma embaixo da outra**:
    - `ANTES · 1 FOTO` (com miniatura)
    - `MAPA DE APLICAÇÃO · 1 FOTO` (com miniatura do mapa)
    - `DEPOIS · 1 FOTO` (com miniatura)
    - `AVALIAÇÃO · 1 FOTO` (com miniatura)
  - Layout limpo, sem sobreposição, com badges neutros e rolagem horizontal suave em cada prateleira se houver mais fotos.
- **Validação no Banco de Dados**:
  ```sql
  SELECT id, paciente_id, categoria, planejamento_item_id, procedimento_feito_id, url
  FROM paciente_galeria_arquivos WHERE paciente_id = '<ID_PACIENTE>' ORDER BY criado_em DESC;
  ```

  - Cada arquivo com sua respectiva categoria (`antes`, `mapa`, `depois`, `avaliacao`) e chaves estrangeiras preenchidas.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-FOT-002` — Mapa de Aplicação Anatômica e Persistência de Coordenadas

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Abrir a ferramenta de câmera / mapa de aplicação anatômica facial/corporal.
  2. Inserir 4 pontos de marcação de toxina (com doses: ex. 4U, 4U, 2U, 2U).
  3. Salvar o mapa vinculado ao procedimento.
  4. Abrir a miniatura do mapa na timeline do plano e no lightbox.
- **Resultado Esperado na UI**:
  - A miniatura exibe os círculos vermelhos/brancos com as marcações perfeitamente alinhadas sobre a foto base.
  - No lightbox em tela cheia, os pontos escalam perfeitamente junto com a imagem sem deslocamento de coordenadas.
- **Validação no Banco**:
  ```sql
  SELECT id, foto_id, marcacoes_json FROM mapas_marcacao WHERE foto_id = '<ID_FOTO>';
  ```

  - `marcacoes_json` contém o array com as coordenadas `x`, `y` (em porcentagem relativa) e dosagens.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-FOT-003` — Lightbox Pan/Zoom e Navegação por Teclado

- **Gravidade**: 🟡 **MÉDIA**
- **Passo a Passo**:
  1. Clicar em qualquer foto de um procedimento com múltiplas fotos.
  2. O modal Lightbox deve abrir em tela cheia.
  3. Pressionar a **Seta Direita (→)** do teclado para avançar e **Seta Esquerda (←)** para voltar.
  4. Usar o scroll do mouse ou pinch com 2 dedos (no tablet) para dar zoom (1x até 8x).
  5. Arrastar a imagem ampliada (pan).
  6. Pressionar **Escape** ou clicar no **"X"** para fechar.
- **Resultado Esperado na UI**:
  - Navegação suave e instantânea entre as fotos da visita.
  - Zoom de alta fidelidade sem travar a renderização.
  - Reset limpo do zoom ao mudar de foto ou fechar.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 6: Atendimentos Avulsos e Segregação Absoluta

### `TEST-AVU-001` — Registro de Atendimento Avulso e Aparecimento na Nova Aba

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Iniciar atendimento direto selecionando um procedimento **avulso** (sem vincular a nenhum plano de tratamento, ex: _"Biópsia de Pele"_ ou _"Remoção de Sinal"_).
  2. Adicionar observação clínica.
  3. Adicionar fotos (Antes, Depois, Mapa).
  4. Finalizar o atendimento.
- **Resultado Esperado na UI**:
  - No perfil do paciente, abrir a aba **"Atendimentos Avulsos"**:
    - O atendimento aparece listado com status "Finalizado" e badge de contador de fotos.
    - Ao expandir, as fotos aparecem organizadas **por categoria em prateleiras separadas, uma embaixo da outra** (`ANTES`, `MAPA DE APLICAÇÃO`, `DEPOIS`).
  - Abrir a aba **"Planos & Evolução"**:
    - Esse atendimento **NÃO** aparece aqui. Zero poluição nos planos estruturados.
- **Validação no Banco**:
  - `procedimentos_feitos.planejamento_item_id` é **NULL** (ou vazio).
  - O utilitário `planoGaleriaResolver` classifica o registro estritamente como `atendimentosAvulsos`.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-AVU-002` — Retorno Vinculado a Atendimento Avulso

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. No atendimento avulso registrado no `TEST-AVU-001`, agendar um retorno para retirada de pontos (+7 dias).
  2. Verificar a aba **"Atendimentos Avulsos"**.
- **Resultado Esperado na UI**:
  - O card do atendimento avulso exibe a seção amarela de **"Retornos Vinculados (1)"**, com data e profissional.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-AVU-003` — Paciente Sem Atendimentos Avulsos (Empty State)

- **Gravidade**: 🟡 **MÉDIA**
- **Passo a Passo**:
  1. Selecionar um paciente novo ou que possui apenas planos de tratamento.
  2. Clicar na aba **"Atendimentos Avulsos"**.
- **Resultado Esperado na UI**:
  - Renderização do _empty state_ elegante com ícone de sparkles e texto amigável: _"Nenhum atendimento avulso registrado para este paciente."_
  - Zero erros no console JavaScript.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 7: Acesso Cruzado e Navegação

### `TEST-NAV-001` — Acesso ao Plano via Prontuário Eletrônico

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. Na aba **"Prontuário"**, localizar uma entrada de procedimento realizado que pertencia a um plano.
  2. Verificar a existência do link/atalho para o plano de origem.
  3. Clicar no atalho.
- **Resultado Esperado na UI**:
  - Redirecionamento suave para a aba **"Planos & Evolução"**, com foco/scroll no plano correspondente.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-NAV-002` — Transição Fluida entre Abas Superiores no Perfil do Paciente

- **Gravidade**: 🟡 **MÉDIA**
- **Passo a Passo**:
  1. Alternar repetidamente entre: **Planos & Evolução** ➔ **Atendimentos Avulsos** ➔ **Prontuário** ➔ **Anamnese** ➔ **Documentos**.
- **Resultado Esperado na UI**:
  - Transição instantânea sem "piscar" tela em branco.
  - Em monitores compactos e tablets (820px), a barra de abas não quebra em duas linhas e não exibe barra de rolagem cinza feia (utilitário `.no-scrollbar` ativo).
  - Nenhum texto cortado com `...` truncado.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 8: Auditoria de Banco de Dados e Persistência Real

### `TEST-BD-001` — Verificação de Chaves Estrangeiras e Órfãos

- **Gravidade**: 🔴 **CRÍTICA**
- **Consulta de Auditoria SQL**:

  ```sql
  -- Verificar se existem itens de planejamento sem plano pai
  SELECT id FROM itens_planejamento WHERE plano_id NOT IN (SELECT id FROM planos_tratamento);

  -- Verificar se existem procedimentos_feitos apontando para itens inexistentes
  SELECT id, planejamento_item_id FROM procedimentos_feitos
  WHERE planejamento_item_id IS NOT NULL
    AND planejamento_item_id NOT IN (SELECT id FROM itens_planejamento);

  -- Verificar fotos vinculadas a procedimentos_feitos inexistentes
  SELECT id, procedimento_feito_id FROM paciente_galeria_arquivos
  WHERE procedimento_feito_id IS NOT NULL
    AND procedimento_feito_id NOT IN (SELECT id FROM procedimentos_feitos);
  ```

- **Resultado Esperado**: Todas as consultas retornam **0 linhas**.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-BD-002` — Persistência Real após Parada e Reinício do Backend

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Criar um plano completo com procedimentos, fotos e agendamento de retorno.
  2. Reiniciar o servidor backend (Spring Boot) e o frontend (Vite).
  3. Acessar a aplicação novamente e abrir o perfil do mesmo paciente.
- **Resultado Esperado**:
  - Todos os dados, datas, fotos, status e prateleiras permanecem exatamente iguais.
  - Zero dependência de `localStorage` temporário para dados mestres clínicos.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 9: Resiliência, Recarregamento (F5), Sessão e Responsividade

### `TEST-RES-001` — Pressionar F5 (Recarregar Página) em Todas as Telas-Chave

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Abrir a aba **"Planos & Evolução"** de um paciente e dar **F5 (Ctrl + R)**.
  2. Abrir a aba **"Atendimentos Avulsos"** e dar **F5**.
  3. Abrir um plano expandido com fotos e dar **F5**.
- **Resultado Esperado**:
  - A aplicação carrega perfeitamente sem tela branca, sem erro de `undefined is not an object` e sem perder o paciente ativo.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-RES-002` — Teste de Usabilidade em Tablet (iPad / Samsung Galaxy Tab — 820px)

- **Gravidade**: 🔴 **CRÍTICA**
- **Passo a Passo**:
  1. Redimensionar a tela do navegador para 820px de largura (ou abrir em tablet real).
  2. Verificar:
     - Botões de ação (Iniciar Atendimento, Agendar, Reagendar) têm área de toque confortável (mínimo 44px de altura).
     - As prateleiras horizontais de fotos deslizam suavemente com o toque.
     - As abas superiores rolam lateralmente sem sumir ou quebrar layout.
- [ ] Aprovado | [ ] Reprovado

---

### `TEST-RES-003` — Alerta de Timeout de Sessão Inativa

- **Gravidade**: 🟠 **ALTA**
- **Passo a Passo**:
  1. Deixar o sistema inativo pelo tempo limite configurado.
  2. Verificar a exibição do modal de aviso de expiração de sessão (`SessionTimeoutWarningModal.jsx`).
  3. Clicar em **"Continuar conectado"**.
- **Resultado Esperado**:
  - A sessão é renovada e o profissional não perde o trabalho em andamento.
- [ ] Aprovado | [ ] Reprovado

---

## Módulo 10: Matriz de Aceite Final

| Módulo                           |  Testes Totais  |    Críticos     | Aprovados  |           Status           |
| -------------------------------- | :-------------: | :-------------: | :--------: | :------------------------: |
| 1. Gestão de Planos              |        4        |        3        |    [ ]     |    Pendente Homologação    |
| 2. Agendamento & Reagendamento   |        4        |        3        |    [ ]     |    Pendente Homologação    |
| 3. Hub de Consulta & Execução    |        4        |        4        |    [ ]     |    Pendente Homologação    |
| 4. Ciclo de Retornos             |        3        |        2        |    [ ]     |    Pendente Homologação    |
| 5. Galeria & Mapas Anatômicos    |        3        |        2        |    [ ]     |    Pendente Homologação    |
| 6. Atendimentos Avulsos          |        3        |        2        |    [ ]     |    Pendente Homologação    |
| 7. Navegação e Acesso Cruzado    |        2        |        0        |    [ ]     |    Pendente Homologação    |
| 8. Integridade no Banco de Dados |        2        |        2        |    [ ]     |    Pendente Homologação    |
| 9. Resiliência, F5 e Tablet      |        3        |        2        |    [ ]     |    Pendente Homologação    |
| **TOTAL GERAL**                  | **28 Cenários** | **20 Críticos** | **0 / 28** | ⏳ **Aguardando Execução** |

---

### 🛡️ Regra de Liberação (Go / No-Go para Produção Real):

> **GO (Liberado):** 28/28 testes aprovados.  
> **NO-GO (Bloqueado):** Qualquer falha em teste marcado com 🔴 **CRÍTICA** (especialmente persistência no banco, duplicação de agendamento na agenda ou vazamento entre plano e avulso).
