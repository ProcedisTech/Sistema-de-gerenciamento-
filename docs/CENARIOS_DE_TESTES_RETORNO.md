# Cenários de Testes: Fluxos de Retorno Clínico

Este documento consolida os cenários de testes e regras de negócio para os fluxos de retorno clínico, agendados e avulsos, vinculados ao plano de tratamento e ao histórico do paciente.

---

## 🧪 Cenário de Teste: Retorno Avulso de Procedimento do Plano (Sem Agendamento Prévio Hoje)

### 📌 Contexto & Objetivo

O profissional de saúde recebe o paciente no consultório para avaliação de retorno de um procedimento realizado anteriormente no âmbito de um Plano de Tratamento. No entanto, **não havia nenhum retorno ou horário previamente agendado na agenda para o dia de hoje**.

O objetivo deste teste é validar se o fluxo "avulso" amarra com perfeição todas as pontas no prontuário, na agenda e no cronograma do plano de tratamento, sem exigir que a recepcionista crie agendamento prévio.

---

### 📋 Pré-condições

1. Paciente cadastrado com pelo menos 1 Plano de Tratamento (ativo ou recém-concluído).
2. O plano contém ao menos um item de procedimento com status **Finalizado** (já realizado).
3. **Nenhum agendamento** cadastrado para o paciente na data de hoje (`tb_agenda`).

---

### 🔄 Passo a Passo do Teste

1. Acessar o paciente e abrir o **Hub de Atendimento** (ou clicar em **"Iniciar Retorno"**).
2. No modal **"Iniciar retorno"**:
   - Observar a seção superior: **📌 PROCEDIMENTOS DO PLANO DE TRATAMENTO - CONCLUÍDOS NO PLANO**.
   - Selecionar o card do procedimento concluído que será avaliado.
   - Clicar no botão principal **"Iniciar retorno"**.
3. Na tela de atendimento de retorno:
   - Verificar se o cabeçalho indica atendimento de Retorno vinculado ao procedimento correto.
   - Preencher a avaliação de retorno (satisfação, simetria, dor).
   - Capturar fotos de retorno (categoria Retorno/Depois).
   - Preencher eventuais observações clínicas.
4. Clicar em **"Encerrar Consulta"** / **"Salvar"**.

---

### ✅ Resultados Esperados (Critérios de Aceite)

| Camada                                           | Comportamento Esperado                                                                                                                                                                                                                                                                                                                                                   |
| :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agenda (`tb_agenda`)**                         | A rotina `registrarAgendaAvulsa` é acionada em segundo plano e cria um slot retroativo na data de hoje com:<br>• `dataAgendamento` = Data atual (`YYYY-MM-DD`).<br>• `horaInicio` e `horaFim` = Horários reais da consulta.<br>• `tipoProcedimento` = Retorno.<br>• `statusCodigo` = `realizado`.<br>• `procedimentoFeitoOrigemId` = ID do procedimento pai selecionado. |
| **Prontuário (`tb_procedimento_feito`)**         | O atendimento é gravado com:<br>• `hora_inicio` = Timestamp da data de hoje.<br>• `procedimento_feito_origem_id` = ID do procedimento pai selecionado.<br>• `planejamento_item_id` = ID do item do plano correspondente.<br>• `status` = `finalizado`.                                                                                                                   |
| **Cronograma do Plano (`PlanoVisitasTimeline`)** | O item do plano ganha o registro do retorno e a timeline exibe uma visita dedicada:<br>• **Visita X · Retorno Clínico · [Data de Hoje]** com badge verde **Concluída**.<br>• Não duplica procedimentos indevidamente nem quebra a numeração das visitas.                                                                                                                 |
| **Galeria & Comparativo de Fotos**               | As fotos capturadas no retorno são associadas à visita de hoje e ficam disponíveis para comparação lado a lado ("Antes x Retorno") diretamente no visualizador do plano.                                                                                                                                                                                                 |
| **Modal "Iniciar Retorno" (Futuro)**             | Ao abrir o modal novamente para este paciente, o procedimento pai exibirá o badge: `1 RETORNO REALIZADO` (ou `N RETORNOS REALIZADOS`).                                                                                                                                                                                                                                   |

---

## 📌 Cenário B (Futuro): Retorno no Mesmo Dia de Outro Procedimento

- Quando o paciente realiza uma sessão de um novo procedimento no mesmo dia em que faz o retorno de um procedimento anterior, o sistema deve consolidar ambos os eventos sob a mesma visita diária no cronograma.
