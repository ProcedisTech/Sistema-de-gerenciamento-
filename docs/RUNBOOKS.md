# Runbooks SRE

## SLOs iniciais sugeridos
- Disponibilidade API mensal: **99.5%**
- p95 de `POST /api/auth/login`: **< 500ms**
- Taxa de erro 5xx: **< 1%**

## RTO / RPO
- **RTO**: 60 minutos
- **RPO**: 15 minutos

## Incidente: API fora do ar
1. Verificar processo backend.
2. Checar conectividade com PostgreSQL.
3. Validar variaveis de ambiente (`DATABASE_URL`, `JWT_SECRET`).
4. Executar health check:
```bash
curl -s http://localhost:3001/api/health
```
5. Se banco indisponivel, abrir incidente DB e aplicar plano de contingencia.

## Incidente: falha de login generalizada
1. Verificar `users` no banco.
2. Confirmar hash da senha admin.
3. Revisar rate limiter e origem CORS.
4. Testar manualmente:
```bash
curl -i -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Rafael","password":"PROcedi"}'
```

## Incidente: migration falhou no deploy
1. Nao prosseguir com deploy de frontend dependente.
2. Identificar migration com erro na tabela `schema_migrations`.
3. Corrigir script SQL e reaplicar.
4. Se necessario, restaurar snapshot do banco.

## Backup e restore (referencia)
### Backup logico
```bash
pg_dump "$DATABASE_URL" --format=custom --file=procedi.backup
```

### Restore
```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" procedi.backup
```

## Rotacao de segredos
- `JWT_SECRET`: a cada 90 dias.
- Senha do usuario DB: a cada 90 dias.
- Hash/senha admin: a cada 60 dias.

Procedimento:
1. Atualizar segredo no cofre.
2. Atualizar variaveis do ambiente.
3. Reiniciar aplicacao com janela controlada.
4. Validar login e health.

## Checklist pos-deploy
- [ ] `GET /api/health` retorna `ok: true`
- [ ] `database: up`
- [ ] Login/logout funcionando
- [ ] Logs sem erro critico de inicializacao
- [ ] Migration aplicada conforme esperado

