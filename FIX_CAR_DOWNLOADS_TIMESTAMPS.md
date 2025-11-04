# 🔧 Correção: Erro "column created_at does not exist"

## ❌ Problema Identificado

Ao tentar usar o sistema WFS CAR, o seguinte erro aparece no servidor:

```
❌ Erro ao buscar status: error: column "created_at" does not exist
```

### Causa

A tabela `car_downloads` foi criada na migration original (012) com apenas a coluna `data_download`, mas o código WFS espera as colunas `created_at` e `updated_at` para manter consistência com o resto do sistema.

**Estrutura ANTIGA** (migration 012):
```sql
CREATE TABLE car_downloads (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(2),
    tipo VARCHAR(50),
    data_download TIMESTAMP,    ← Apenas esta coluna de timestamp
    ...
);
```

**Estrutura NECESSÁRIA** (para WFS funcionar):
```sql
CREATE TABLE car_downloads (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(2),
    tipo VARCHAR(50),
    data_download TIMESTAMP,
    created_at TIMESTAMP,        ← FALTANDO
    updated_at TIMESTAMP,        ← FALTANDO
    ...
);
```

---

## ✅ Solução

### Opção 1: Executar Migration Automática (Recomendado)

Criei uma migration que adiciona as colunas automaticamente:

```bash
# No terminal (Windows), na pasta do projeto:
node run-migration-014.js
```

**O que este script faz:**
1. ✅ Adiciona coluna `created_at` na tabela `car_downloads`
2. ✅ Adiciona coluna `updated_at` na tabela `car_downloads`
3. ✅ Copia valores de `data_download` para as novas colunas (registros existentes)
4. ✅ Cria trigger para atualizar `updated_at` automaticamente
5. ✅ Mostra estrutura da tabela após a correção

**Saída esperada:**
```
🔧 Executando Migration 014: Fix car_downloads timestamps

📄 Arquivo SQL lido: backend\migrations\014_fix_car_downloads_timestamps.sql
📊 Tamanho: 2150 bytes

⏳ Executando migration...

✅ Migration executada com sucesso!

📋 Estrutura da tabela car_downloads após migration:
┌─────────────────┬──────────────────┬────────────────────────┐
│  column_name    │   data_type      │   column_default       │
├─────────────────┼──────────────────┼────────────────────────┤
│ id              │ integer          │ nextval(...)           │
│ estado          │ character varying│                        │
│ tipo            │ character varying│                        │
│ data_download   │ timestamp        │ CURRENT_TIMESTAMP      │
│ created_at      │ timestamp        │ CURRENT_TIMESTAMP      │
│ updated_at      │ timestamp        │ CURRENT_TIMESTAMP      │
│ ...             │                  │                        │
└─────────────────┴──────────────────┴────────────────────────┘

🎉 Tabela car_downloads atualizada com sucesso!
✅ Colunas created_at e updated_at adicionadas
```

---

### Opção 2: Executar SQL Manualmente

Se preferir executar o SQL diretamente:

```bash
# Conectar ao banco
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos

# Dentro do psql, executar:
\i backend/migrations/014_fix_car_downloads_timestamps.sql
```

Ou via comando único:
```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -f backend/migrations/014_fix_car_downloads_timestamps.sql
```

---

### Opção 3: SQL Direto (Rápido)

Se quiser apenas corrigir rápido sem executar a migration completa:

```sql
-- Conectar ao banco e executar:
ALTER TABLE car_downloads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE car_downloads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Copiar valores existentes
UPDATE car_downloads SET created_at = data_download WHERE created_at IS NULL;
UPDATE car_downloads SET updated_at = data_download WHERE updated_at IS NULL;
```

---

## 🧪 Como Testar a Correção

### 1. Executar a migration

```bash
node run-migration-014.js
```

### 2. Reiniciar o servidor

```bash
# Parar servidor
taskkill /F /IM node.exe

# Aguardar
ping 127.0.0.1 -n 4 > nul

# Iniciar novamente
node backend/server-postgres.js
```

### 3. Testar endpoint de status

```bash
curl http://localhost:3001/api/car/wfs/status
```

**Antes (com erro):**
```json
{
  "sucesso": false,
  "erro": "column \"created_at\" does not exist"
}
```

**Depois (corrigido):**
```json
{
  "sucesso": true,
  "status": "nenhum_download",
  "mensagem": "Nenhum download foi realizado ainda"
}
```

### 4. Testar busca de municípios

```bash
curl http://localhost:3001/api/car/wfs/municipios/PR
```

**Deve retornar:**
```json
{
  "sucesso": true,
  "estado": "PR",
  "municipios": ["Curitiba", "Ponta Grossa", ...],
  "total": 399
}
```

### 5. Testar interface web

1. Abra: `http://localhost:3001/car-download-auto.html`
2. Selecione estado: **Paraná (PR)**
3. **Agora deve carregar a lista de municípios!** ✅
4. Teste o download de um município pequeno

---

## 📊 Antes vs Depois

### Estrutura da Tabela

| Situação | Colunas de Timestamp |
|----------|---------------------|
| **ANTES** | `data_download` apenas |
| **DEPOIS** | `data_download`, `created_at`, `updated_at` |

### Funcionamento dos Endpoints

| Endpoint | Antes | Depois |
|----------|-------|--------|
| `/api/car/wfs/status` | ❌ Erro SQL | ✅ Funciona |
| `/api/car/wfs/municipios/:estado` | ❌ Sem municípios | ✅ Lista municípios |
| `/api/car/download-wfs` | ❌ Erro ao registrar | ✅ Funciona |
| Interface - Lista de municípios | ❌ Vazia | ✅ Populada |

---

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `backend/migrations/014_fix_car_downloads_timestamps.sql` | Migration SQL |
| `run-migration-014.js` | Script Node.js para executar migration |
| `FIX_CAR_DOWNLOADS_TIMESTAMPS.md` | Esta documentação |

---

## 🔍 Verificar se a Correção Foi Aplicada

Para verificar se as colunas foram adicionadas:

```bash
set PGPASSWORD=marcos123
psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -c "\d car_downloads"
```

Deve mostrar:
```
                    Table "public.car_downloads"
     Column      |            Type             |     Modifiers
-----------------+-----------------------------+-------------------
 id              | integer                     | not null default...
 estado          | character varying(2)        | not null
 tipo            | character varying(50)       | not null
 data_download   | timestamp without time zone | default now()
 arquivo_nome    | character varying(255)      |
 arquivo_tamanho | bigint                      |
 total_registros | integer                     |
 status          | character varying(20)       | default 'processando'
 erro_mensagem   | text                        |
 created_at      | timestamp without time zone | default now()      ← NOVO!
 updated_at      | timestamp without time zone | default now()      ← NOVO!
```

---

## 💡 Por Que Este Erro Aconteceu?

1. **Migration 012** criou a tabela `car_downloads` com `data_download`
2. **Código WFS** foi implementado usando `created_at` e `updated_at` (padrão do sistema)
3. **Inconsistência** entre schema do banco e código

### Lição Aprendida

Sempre manter consistência entre:
- ✅ Definição de schema (migrations)
- ✅ Código que acessa o banco
- ✅ Padrões do resto do sistema

---

## 🚀 Próximos Passos Após a Correção

1. ✅ Executar migration 014
2. ✅ Reiniciar servidor
3. ✅ Testar endpoints WFS
4. ✅ Fazer download de um município de teste
5. ✅ Verificar dados importados

---

## 🐛 Troubleshooting

### Migration não encontra o arquivo

```bash
# Verificar se o arquivo existe
dir backend\migrations\014_fix_car_downloads_timestamps.sql

# Se não existir, execute git pull
git pull origin claude/continue-previous-session-011CUoJ1HrcunVSdn8aJb5Z1
```

### Erro de permissão no banco

```bash
# Verificar se o PostgreSQL está rodando
netstat -ano | findstr :5434

# Verificar senha
echo %POSTGRES_PASSWORD%

# Deve mostrar: marcos123
```

### Migration executada mas erro persiste

```bash
# Limpar cache do Node.js
npm cache clean --force

# Reiniciar servidor completamente
taskkill /F /IM node.exe
taskkill /F /IM postgres.exe
# Aguardar 10 segundos
# Iniciar PostgreSQL novamente
# Iniciar servidor Node.js
```

---

**Implementado em**: 2025-11-04
**Migration**: 014_fix_car_downloads_timestamps.sql
**Status**: ✅ Solução pronta, aguardando execução no ambiente de produção
**Impacto**: Resolve erro de colunas faltantes e permite funcionamento completo do sistema WFS
