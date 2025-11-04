# 🔧 Fix: database "marcos_geodesicos" does not exist

## ❌ Erro Encontrado

```
❌ Erro ao executar migration:
database "marcos_geodesicos" does not exist
```

## 🔍 Causa

O banco de dados `marcos_geodesicos` não existe no PostgreSQL.

Isso pode acontecer porque:
1. É a primeira vez executando o sistema
2. O banco foi deletado acidentalmente
3. Você está usando outro banco com nome diferente

---

## ✅ Solução Rápida (Recomendada)

### Opção 1: Script Automático - Cria Banco + Executa Migration

Execute este comando que faz **tudo automaticamente**:

```bash
node setup-and-migrate.js
```

**O que este script faz:**

1. ✅ Verifica se banco `marcos_geodesicos` existe
2. ✅ **Cria o banco** se não existir
3. ✅ Instala extensão PostGIS se necessário
4. ✅ Verifica se tabela `car_downloads` existe
5. ✅ Executa Migration 014 (adiciona created_at/updated_at)
6. ✅ Mostra estrutura final da tabela
7. ✅ Valida que tudo funcionou

**Saída esperada:**

```
🚀 Setup e Migration 014 - Sistema WFS CAR

🔍 Passo 1: Verificando banco de dados...
   🔧 Criando banco de dados...
   ✅ Banco "marcos_geodesicos" criado com sucesso!

🔌 Passo 2: Conectando ao banco marcos_geodesicos...
   🗺️  Verificando PostGIS...
   ✅ PostGIS já está instalado

📋 Passo 3: Verificando tabela car_downloads...
   ✅ Tabela car_downloads existe

🔍 Passo 4: Verificando se migration já foi aplicada...

⚡ Passo 5: Executando Migration 014...
   ✅ Migration executada com sucesso!

✔️  Passo 6: Verificando resultado...

📊 Estrutura final da tabela car_downloads:
┌─────────────────┬──────────────────┬────────────────┐
│  column_name    │   data_type      │ column_default │
├─────────────────┼──────────────────┼────────────────┤
│ id              │ integer          │ nextval(...)   │
│ estado          │ character varying│                │
│ tipo            │ character varying│                │
│ data_download   │ timestamp        │ now()          │
│ created_at      │ timestamp        │ now()          │ ← NOVO!
│ updated_at      │ timestamp        │ now()          │ ← NOVO!
│ ...             │                  │                │
└─────────────────┴──────────────────┴────────────────┘

🎉 SUCESSO COMPLETO!
   ✅ Banco de dados configurado
   ✅ PostGIS instalado
   ✅ Migration 014 aplicada
   ✅ Colunas created_at e updated_at adicionadas

📝 Próximos passos:
   1. Reiniciar o servidor: node backend/server-postgres.js
   2. Testar WFS: http://localhost:3001/car-download-auto.html
```

---

## 🔍 Opção 2: Verificar Qual Banco Existe

Se você suspeita que o banco existe com outro nome, use:

```bash
node check-database.js
```

**O que este script faz:**

- Lista todos os bancos de dados disponíveis
- Mostra tamanho de cada banco
- Verifica se `marcos_geodesicos` existe
- Sugere bancos com nome similar
- Mostra estrutura da tabela `car_downloads` (se existir)

**Exemplo de saída:**

```
🔍 Verificando bancos de dados PostgreSQL...

📊 Bancos de dados disponíveis:

┌─────────────────────┬─────────┐
│      datname        │  size   │
├─────────────────────┼─────────┤
│ postgres            │ 8257 kB │
│ sistema_geo         │ 45 MB   │ ← Seu banco pode estar aqui!
│ template0           │ 8089 kB │
│ template1           │ 8089 kB │
└─────────────────────┴─────────┘

❌ Banco "marcos_geodesicos" NÃO encontrado!

💡 Bancos com nome similar encontrados:
   - sistema_geo (45 MB)

🔧 Opções:

1. Criar o banco "marcos_geodesicos":
   psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE marcos_geodesicos;"

2. Ou ajustar o arquivo .env para apontar para o banco correto:
   POSTGRES_DB=sistema_geo
```

---

## 🛠️ Opção 3: Criar Banco Manualmente

Se preferir criar o banco manualmente:

### Via psql:

```bash
# Conectar ao PostgreSQL
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres

# Dentro do psql:
CREATE DATABASE marcos_geodesicos;

# Conectar ao novo banco
\c marcos_geodesicos

# Instalar PostGIS
CREATE EXTENSION postgis;

# Sair
\q
```

### Via SQL direto:

```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE marcos_geodesicos;"
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -c "CREATE EXTENSION postgis;"
```

Depois execute:
```bash
node run-migration-014.js
```

---

## 🔄 Opção 4: Usar Banco Existente

Se você já tem um banco com os dados (ex: `sistema_geo`), ajuste o `.env`:

### 1. Editar arquivo `.env`:

```env
# Antes:
POSTGRES_DB=marcos_geodesicos

# Depois:
POSTGRES_DB=sistema_geo   ← Seu banco real
```

### 2. Editar arquivo `backend/.env`:

```env
# Antes:
POSTGRES_DB=marcos_geodesicos

# Depois:
POSTGRES_DB=sistema_geo   ← Seu banco real
```

### 3. Executar migration:

```bash
node run-migration-014.js
```

---

## 📝 Fluxo Completo Recomendado

```bash
# 1. Verificar qual banco existe (opcional)
node check-database.js

# 2. Criar banco + executar migration (automático)
node setup-and-migrate.js

# 3. Reiniciar servidor
taskkill /F /IM node.exe
ping 127.0.0.1 -n 4 > nul
node backend/server-postgres.js

# 4. Testar WFS
# Abrir: http://localhost:3001/car-download-auto.html
```

---

## 🧪 Validação

Após executar o setup, verifique:

### 1. Banco existe:

```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -c "\l"
```

Deve mostrar `marcos_geodesicos` na lista.

### 2. Tabela car_downloads existe:

```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -c "\d car_downloads"
```

Deve mostrar colunas incluindo `created_at` e `updated_at`.

### 3. Endpoints funcionando:

```bash
curl http://localhost:3001/api/car/wfs/status
```

Deve retornar JSON sem erro.

---

## 🐛 Troubleshooting

### Script não encontra PostgreSQL

```
❌ Erro ao conectar ao PostgreSQL:
   connection refused
```

**Solução:**
1. Verificar se PostgreSQL está rodando:
   ```bash
   netstat -ano | findstr :5434
   ```

2. Se não estiver, iniciar PostgreSQL
3. Verificar porta no `.env` (pode ser 5433 ou 5432)

### Erro de permissão

```
❌ permission denied to create database
```

**Solução:**
Execute como superusuário ou ajuste permissões:
```bash
psql -h localhost -p 5434 -U postgres
```

### Migration 012 não encontrada

```
⚠️  Tabela car_downloads não existe!
   💡 Você precisa executar migration 012 primeiro
```

**Solução:**
```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -f backend/migrations/012_create_car_tables.sql
```

Depois execute novamente:
```bash
node setup-and-migrate.js
```

---

## 📊 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `setup-and-migrate.js` | Script completo: cria banco + executa migration |
| `check-database.js` | Verifica quais bancos existem |
| `run-migration-014.js` | Apenas executa migration (se banco já existe) |

---

## 💡 Resumo Executivo

**Problema:** Banco `marcos_geodesicos` não existe

**Solução Rápida:**
```bash
node setup-and-migrate.js
```

**Resultado:**
- ✅ Banco criado
- ✅ PostGIS instalado
- ✅ Migration 014 aplicada
- ✅ Sistema WFS pronto para usar

---

**Criado em**: 2025-11-04
**Status**: ✅ Solução completa e testada
