# 🚀 Guia do Sistema de Migrações

## 📋 Visão Geral

O sistema de migrações gerencia automaticamente a evolução do schema do banco de dados, garantindo:

- ✅ **Controle de versão** - Rastreamento de migrações aplicadas
- ✅ **Idempotência** - Mesma migração não é aplicada duas vezes
- ✅ **Transações** - Rollback automático em caso de erro
- ✅ **Histórico** - Registro completo de todas as alterações

## 🛠️ Comandos Disponíveis

### 1. Aplicar Migrações (migrate)
```bash
node backend/migrate.js migrate
```
**O que faz:**
- Verifica migrações pendentes
- Aplica cada migração em ordem
- Registra na tabela `schema_migrations`
- Valida estrutura final do banco

**Quando usar:**
- Após criar nova migração
- Ao configurar ambiente novo
- Após fazer pull de código com migrações

### 2. Ver Status (status)
```bash
node backend/migrate.js status
```
**O que faz:**
- Lista migrações já aplicadas
- Lista migrações pendentes
- Mostra versões e datas

**Quando usar:**
- Antes de aplicar migrações
- Para verificar estado atual
- Para debug de problemas

### 3. Verificar Banco (verify)
```bash
node backend/migrate.js verify
```
**O que faz:**
- Lista todas as tabelas
- Verifica tabelas esperadas
- Conta registros em cada tabela

**Quando usar:**
- Após aplicar migrações
- Para validar estrutura
- Para troubleshooting

## 📁 Estrutura de Arquivos

```
backend/
├── migrate.js                          # Script principal
├── migrations/
│   ├── 001_create_integrated_schema.sql   # Primeira migração
│   ├── 002_add_new_feature.sql           # Próximas migrações...
│   └── README.md                          # Documentação
└── marcos.db                              # Banco de dados
```

## 📝 Como Criar Nova Migração

### 1. Criar arquivo na pasta `migrations/`
```bash
# Padrão: NNN_nome_descritivo.sql
# Exemplo:
backend/migrations/002_add_user_roles.sql
```

### 2. Estrutura da migração
```sql
-- ==========================================
-- MIGRAÇÃO 002: Adicionar Roles de Usuário
-- Data: 2025-10-14
-- Descrição: Adiciona sistema de permissões
-- ==========================================

CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_roles_name ON user_roles(name);

-- Dados iniciais
INSERT OR IGNORE INTO user_roles (name, permissions)
VALUES
    ('admin', 'all'),
    ('editor', 'read,write'),
    ('viewer', 'read');
```

### 3. Aplicar migração
```bash
node backend/migrate.js migrate
```

## 🔍 Tabela de Controle

O script cria automaticamente a tabela `schema_migrations`:

```sql
CREATE TABLE schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,           -- Ex: "001"
    name TEXT NOT NULL,                      -- Ex: "001_create_integrated_schema"
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Consultar histórico:
```sql
SELECT * FROM schema_migrations ORDER BY version;
```

## ⚡ Exemplos de Uso

### Cenário 1: Configurar novo ambiente
```bash
# 1. Clonar repositório
git clone <repo-url>
cd projeto

# 2. Instalar dependências
npm install

# 3. Aplicar todas as migrações
node backend/migrate.js migrate

# 4. Verificar
node backend/migrate.js verify
```

### Cenário 2: Atualizar banco existente
```bash
# 1. Fazer pull das mudanças
git pull

# 2. Ver status
node backend/migrate.js status

# 3. Aplicar migrações pendentes
node backend/migrate.js migrate
```

### Cenário 3: Debug de problema
```bash
# 1. Verificar estrutura
node backend/migrate.js verify

# 2. Ver histórico
node backend/migrate.js status

# 3. Inspecionar banco manualmente
sqlite3 database/marcos.db
> SELECT * FROM schema_migrations;
> .tables
```

## 🎯 Boas Práticas

### ✅ DO's (Faça)

1. **Sempre use transações**
   - O script já faz isso automaticamente

2. **Use IF NOT EXISTS**
   ```sql
   CREATE TABLE IF NOT EXISTS nova_tabela (...);
   CREATE INDEX IF NOT EXISTS idx_campo ON tabela(campo);
   ```

3. **Documente a migração**
   ```sql
   -- ==========================================
   -- MIGRAÇÃO XXX: Título
   -- Data: YYYY-MM-DD
   -- Descrição: O que faz e por quê
   -- ==========================================
   ```

4. **Versione as migrações**
   ```
   001_descricao.sql
   002_descricao.sql
   003_descricao.sql
   ```

5. **Teste antes de commitar**
   ```bash
   # Teste localmente
   node backend/migrate.js migrate
   node backend/migrate.js verify
   ```

### ❌ DON'Ts (Não Faça)

1. **Nunca edite migração já aplicada**
   - Crie nova migração para correções

2. **Nunca delete arquivo de migração**
   - Se necessário, crie migração de reversão

3. **Não use DROP sem verificação**
   ```sql
   -- ❌ EVITE
   DROP TABLE usuarios;

   -- ✅ PREFIRA
   DROP TABLE IF EXISTS usuarios;
   ```

4. **Não faça migrações destrutivas sem backup**
   ```sql
   -- Sempre documente perda de dados
   -- ATENÇÃO: Esta migração remove dados antigos
   ```

## 🐛 Troubleshooting

### Erro: "UNIQUE constraint failed: schema_migrations.version"
**Causa:** Tentando aplicar migração já aplicada

**Solução:**
```bash
# Verificar status
node backend/migrate.js status

# A migração já está aplicada, não precisa reaplicar
```

### Erro: "no such table: schema_migrations"
**Causa:** Script não inicializou corretamente

**Solução:**
```bash
# Executar novamente, o script cria a tabela automaticamente
node backend/migrate.js migrate
```

### Erro ao aplicar migração SQL
**Causa:** Erro de sintaxe ou problema no SQL

**Solução:**
1. Verificar erro exibido no console
2. Corrigir arquivo SQL
3. Como a transação faz rollback, pode executar novamente:
```bash
node backend/migrate.js migrate
```

### Migrações fora de ordem
**Causa:** Arquivos não seguem padrão de numeração

**Solução:**
- Renomear arquivos para seguir padrão: `001_`, `002_`, etc.
- O script ordena alfabeticamente

## 📊 Logs e Saída

### Sucesso:
```
[Migrator] ====================================
[Migrator] INICIANDO MIGRAÇÕES
[Migrator] ====================================
[Migrator] 📋 1 migração(ões) pendente(s):
[Migrator]    - 001_create_integrated_schema.sql
[Migrator] Aplicando: 001_create_integrated_schema.sql...
[Migrator] ✅ 001_create_integrated_schema.sql aplicado com sucesso!
[Migrator] ====================================
[Migrator] ✅ MIGRAÇÕES CONCLUÍDAS
[Migrator] ====================================
```

### Nenhuma pendente:
```
[Migrator] ====================================
[Migrator] INICIANDO MIGRAÇÕES
[Migrator] ====================================
[Migrator] ✅ Nenhuma migração pendente. Banco está atualizado!
```

### Erro:
```
[Migrator] Aplicando: 002_bad_migration.sql...
[Migrator] ❌ Erro ao aplicar 002_bad_migration.sql: near "CREAT": syntax error
[Migrator] ❌ ERRO: near "CREAT": syntax error
```

## 🔄 Integração com CI/CD

### GitHub Actions exemplo:
```yaml
name: Apply Migrations
on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: node backend/migrate.js migrate
```

## 📚 Referências

- [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)
- [Database Migration Best Practices](https://www.prisma.io/dataguide/types/relational/migration-strategies)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

## 🆘 Suporte

Em caso de dúvidas:
1. Verificar logs detalhados no console
2. Consultar `backend/migrations/README.md`
3. Inspecionar `schema_migrations` no banco
4. Criar issue no repositório

---

**✨ Dica:** Execute sempre `node backend/migrate.js status` antes de aplicar migrações para ver o que será modificado!
