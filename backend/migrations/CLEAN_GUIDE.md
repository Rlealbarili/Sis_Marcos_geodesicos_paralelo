# 🧹 Guia de Limpeza de Migrações

## 📋 Problema

A pasta `migrations/` contém arquivos extras que não são migrações:
- ❌ `EXAMPLES.sql` - É documentação, não migração
- ❌ `002_add_status_campo.sql` - Migração duplicada (já existe em 001)

## ✅ Solução

Execute o script de limpeza:

```bash
npm run db:clean
```

## 🎯 O Que o Script Faz

### 1. Cria pasta `docs/`
```
backend/migrations/docs/
```

### 2. Move arquivo de exemplos
```
EXAMPLES.sql → docs/EXAMPLES.sql
```

### 3. Remove migração duplicada
```
002_add_status_campo.sql (removido)
```

## 📂 Estrutura Antes

```
backend/migrations/
├── 001_create_integrated_schema.sql  ✅ (migração principal)
├── 002_add_status_campo.sql          ❌ (duplicada)
├── EXAMPLES.sql                      ❌ (não é migração)
├── README.md
├── QUICK_START.md
└── run-migration.js
```

## 📂 Estrutura Depois

```
backend/migrations/
├── 001_create_integrated_schema.sql  ✅ (migração principal)
├── README.md
├── QUICK_START.md
├── CLEAN_GUIDE.md
├── run-migration.js
└── docs/
    └── EXAMPLES.sql                  ✅ (movido para documentação)
```

## 🚀 Uso

### Opção 1: Via NPM
```bash
npm run db:clean
```

### Opção 2: Via Node
```bash
node backend/clean-migrations.js
```

## 📊 Saída Esperada

```
====================================
🧹 LIMPEZA DE MIGRAÇÕES EXTRAS
====================================

✅ Pasta migrations/docs/ criada
✅ EXAMPLES.sql movido para migrations/docs/
✅ 002_add_status_campo.sql removido (migração duplicada)

📋 Migrações SQL restantes em migrations/:
   - 001_create_integrated_schema.sql

📚 Arquivos de documentação em migrations/docs/:
   - EXAMPLES.sql

📂 Estrutura final de migrations/:
   📄 001_create_integrated_schema.sql
   📄 CLEAN_GUIDE.md
   📄 QUICK_START.md
   📄 README.md
   📁 docs
   📄 run-migration.js

====================================
✅ LIMPEZA CONCLUÍDA!
====================================

📌 Próximos passos:
   1. npm run db:reset
   2. npm run migrate
   3. npm run migrate:verify
```

## ⚠️ Importante

Execute a limpeza **antes** de resetar e migrar:

```bash
# 1. Limpar migrações extras
npm run db:clean

# 2. Resetar banco
npm run db:reset

# 3. Aplicar migração
npm run migrate

# 4. Verificar
npm run migrate:verify
```

## 🔍 Validação

### Verificar arquivos SQL:
```bash
# Windows
dir backend\migrations\*.sql

# Linux/Mac
ls backend/migrations/*.sql
```

**Resultado esperado:**
```
001_create_integrated_schema.sql
```

### Verificar docs:
```bash
# Windows
dir backend\migrations\docs\*.sql

# Linux/Mac
ls backend/migrations/docs/*.sql
```

**Resultado esperado:**
```
EXAMPLES.sql
```

## 🐛 Troubleshooting

### Script não encontra EXAMPLES.sql
**Causa:** Arquivo já foi movido anteriormente

**Solução:** Nenhuma ação necessária, arquivo já está em `docs/`

### Script não encontra 002_add_status_campo.sql
**Causa:** Arquivo já foi removido anteriormente

**Solução:** Nenhuma ação necessária, arquivo já foi removido

### Erro "ENOENT: no such file or directory"
**Causa:** Pasta migrations não existe

**Solução:** Verificar estrutura do projeto

## 📝 Por Que Fazer Limpeza?

### Problema com EXAMPLES.sql
- ❌ Sistema de migração tenta executar como migração
- ❌ Contém múltiplos comandos de exemplo (INSERT, SELECT, etc.)
- ❌ Não é idempotente
- ❌ Causa erros na migração

### Problema com 002_add_status_campo.sql
- ❌ Coluna `status_campo` já existe em `001_create_integrated_schema.sql`
- ❌ Causa erro: "duplicate column name"
- ❌ Migração redundante

### Solução
- ✅ Manter apenas `001_create_integrated_schema.sql`
- ✅ Mover exemplos para `docs/`
- ✅ Sistema de migração executa apenas arquivos válidos

## 🎉 Resultado Final

Após a limpeza:
- ✅ Apenas 1 migração válida: `001_create_integrated_schema.sql`
- ✅ Exemplos SQL organizados em `docs/EXAMPLES.sql`
- ✅ Sistema de migração funciona corretamente
- ✅ Sem erros de duplicação ou comandos inválidos

---

**Data:** 2025-10-13
**Versão:** 1.0.0
