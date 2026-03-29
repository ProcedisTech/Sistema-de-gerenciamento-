# Implementacao PostgreSQL

## Objetivo
Este documento define o modelo de dados e o processo operacional para persistencia do sistema em PostgreSQL.

## Pre-requisitos
- PostgreSQL 15+
- Usuario com permissao de criar tabelas e indices
- Variavel `DATABASE_URL` configurada

Exemplo:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/procedi"
```

## Comandos
Executar dentro de `server/`:
```bash
npm run migrate
npm run seed-admin
```

## Schema inicial (migration `001_init.sql`)
Tabelas principais:
- `users`: usuarios da aplicacao para autenticacao.
- `patients`: cadastro principal do paciente.
- `patient_notes`: notas por paciente.
- `patient_documents`: termos/documentos.
- `patient_procedures`: historico de procedimentos.
- `appointments`: agenda.
- `journeys`: ciclo de jornada/atendimento.
- `journey_photos`: metadados de fotos da jornada.
- `schema_migrations`: controle de versao de migrations.

## Convencoes de modelagem
- PKs UUID para entidades de negocio.
- Datas de auditoria: `created_at`, `updated_at`.
- JSONB para listas flexiveis (`medicamentos`, `queixas_esteticas`).
- CPF com indice unico normalizado por expressao (`regexp_replace`).

## Integracao auth
`server/routes/auth.js` agora aceita lookup de usuario via repo:
- se banco estiver disponivel: valida `users.password_hash`.
- se banco indisponivel: usa fallback por env (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`).

## Estrategia de migracao incremental
### Fase 1 - Concluida
- Pool PostgreSQL.
- Migrations SQL.
- Seed de admin.
- Auth com lookup em banco + fallback.

### Fase 2 - Proxima
- Rotas `patients` persistidas (CRUD).
- Eliminacao gradual de dependencias de seed local no frontend.

### Fase 3
- Rotas `appointments` persistidas.
- KPIs de agenda calculados no backend.

### Fase 4
- Rotas `journeys` e `journey_photos` com upload controlado.
- Retencao e governanca LGPD.

## Operacao segura
- Usar `DB_SSL_MODE=require` em cloud DB.
- Restringir acesso de rede ao banco.
- Aplicar principio do menor privilegio ao usuario da app.
- Nao reutilizar senha admin entre ambientes.

## Checklist de rollout por ambiente
- [ ] Banco criado
- [ ] `DATABASE_URL` validada
- [ ] `npm run migrate` executado
- [ ] `npm run seed-admin` executado
- [ ] `GET /api/health` responde `database: "up"`
- [ ] Login funcional com usuario seed

