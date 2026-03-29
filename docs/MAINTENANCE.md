# Manutencao profunda

## Objetivo
Guia para manter o sistema com previsibilidade, seguranca e capacidade de evolucao.

## Estrategia de manutencao
1. **Estabilizar**: garantir health, logs e migrations consistentes.
2. **Observar**: medir erros de auth, latencia e disponibilidade.
3. **Evoluir**: aplicar mudancas por modulo, com rollback definido.

## Rotina diaria
- Verificar endpoint `GET /api/health`.
- Validar taxa de erro de login e respostas 5xx.
- Conferir expiracao de credenciais e certificados.
- Revisar logs de inicializacao do backend.

## Rotina semanal
- Testar backup e restore em ambiente de homologacao.
- Revisar indices de tabelas de maior crescimento (`appointments`, `journey_photos`).
- Revisar queries lentas (quando monitoramento SQL estiver habilitado).

## Rotina mensal
- Rotacionar segredos criticos (`JWT_SECRET`, senha DB, senha admin).
- Revisar permissao de usuario do banco.
- Rodar checklist de hardening em ambiente de producao.

## Politica de mudancas
- Toda alteracao de schema deve ter migration versionada.
- Nenhuma migration destrutiva sem plano de rollback documentado.
- Deploy de backend deve ocorrer antes do frontend quando houver novo contrato API.

## Testes de regressao recomendados
### Auth
- Login valido e invalido.
- Logout.
- `GET /api/auth/me` com e sem cookie.

### Banco
- `npm run migrate` idempotente.
- Seed admin atualiza usuario existente sem duplicar.
- Health reporta banco indisponivel quando conexao falha.

### Fluxo funcional
- Check-in etapa 1.
- Avanco entre etapas da jornada.
- Agendamento basico em memoria (ate migracao completa de agenda).

## Alertas operacionais minimos
- API indisponivel > 1 min.
- Taxa de erro 5xx > 2% por 5 min.
- Falhas de login acima de limiar historico.
- Falha em `npm run migrate` no deploy.

## Riscos conhecidos no estado atual
- Persistencia parcial: pacientes/agenda ainda no frontend.
- Upload de fotos de jornada ainda sem pipeline completo no backend.
- Fallback de credencial por env deve ser removido apos estabilizar `users` em todos os ambientes.

## Plano de reducao de risco
- Curto prazo: habilitar endpoints persistidos de pacientes/agenda.
- Medio prazo: desligar fallback de auth por env em producao.
- Longo prazo: trilha de auditoria completa para dados LGPD sensiveis.

