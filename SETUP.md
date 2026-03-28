# 🚀 Setup e Instruções de Desenvolvimento

## ✅ Problema Resolvido

Os erros `ECONNREFUSED` eram causados porque o **servidor backend não estava rodando**. 

Agora que você iniciou com `node index.js`, o servidor está na porta `3001` e o Vite (porta `5173`) consegue fazer proxy das requisições `/api` sem erros.

---

## 📋 Modo de Desenvolvimento (Recomendado)

Para desenvolver com **ambos os servidores rodando automaticamente**:

```bash
npm run dev:full
```

Isso usa `concurrently` para rodar:
- ✅ **Vite** (Frontend) - `http://localhost:5173`
- ✅ **Node.js** (Backend) - `http://localhost:3001`

---

## 🛠️ Alternativa: Rodar Separadamente

### Terminal 1 - Frontend (Vite)
```bash
npm run dev
```

### Terminal 2 - Backend (Node.js)
```bash
npm run server
# ou
cd server && npm run dev
```

---

## 🔐 Credenciais de Teste

- **Usuário:** `Rafael`
- **Senha:** `PROcedi`

---

## 📚 Estrutura

```
├── src/                    # Frontend React + Vite
│   ├── components/App.jsx  # Aplicação principal
│   ├── styles/
│   └── assets/
│
├── server/                 # Backend Node.js + Express
│   ├── index.js           # Servidor principal
│   ├── routes/auth.js     # Rotas de autenticação
│   ├── middleware/        # Middlewares (ex: autenticação)
│   └── package.json
│
└── package.json           # Scripts e dependências
```

---

## 🌐 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login (req: `{username, password}`) |
| GET | `/api/auth/me` | Dados do usuário logado |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/health` | Health check |

---

## ⚙️ Variáveis de Ambiente (Opcional)

Criar `.env` na raiz do projeto ou em `server/.env`:

```env
# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=procedi-dev-jwt-secret-please-change-me-0123456789abcdef
ADMIN_USERNAME=Rafael
ADMIN_PASSWORD=PROcedi
COOKIE_NAME=procedi_token

# Frontend (em .env.local ou index.html)
VITE_API_BASE_URL=http://localhost:3001
```

---

## 🐛 Troubleshooting

### "ECONNREFUSED" errors
- ✅ Certifique-se que o servidor está rodando com `npm run server`
- ✅ Use `npm run dev:full` para rodar tudo junto

### Erros de CORS
- ✅ Verificar `vite.config.js` (proxy configurado para `/api` → `localhost:3001`)
- ✅ Verificar `server/index.js` (CORS habilitado)

### Porta já em uso
```bash
# Encontrar processo na porta 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object -Property State, OwningProcess

# Matar processo (substitua PID pelo número do processo)
Stop-Process -Id <PID> -Force
```

---

## 📦 Instalar Dependências

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

---

## ✨ Pronto para Desenvolver!

A aplicação está funcionando. Os erros de conexão desapareceram!

Se precisar de ajuda, consulte este arquivo ou revise `package.json` para outros scripts.

