# 🔧 Solução: Erro de Migração - "table clientes has no column named cidade"

## 🐛 Problema Identificado

### Erro Reportado:
```
Error: table clientes has no column named cidade
```

### Causa Raiz:
O banco de dados possui uma tabela `clientes` antiga com estrutura diferente da nova migração. A migração tenta criar uma tabela com mais campos (incluindo `cidade`), mas como a tabela já existe com estrutura antiga, há conflito de schema.

**Conflito:**
- **Tabela antiga:** `clientes` sem coluna `cidade`
- **Migração nova:** espera criar `clientes` com coluna `cidade`

## ✅ Solução Implementada

Foi criado um **script de reset** que:
1. ✅ Cria backup automático do banco
2. ✅ Remove apenas tabelas conflitantes
3. ✅ **Preserva a tabela `marcos`** (dados principais)
4. ✅ Remove views e triggers obsoletos
5. ✅ Prepara banco para reaplicar migrações

## 🚀 Como Resolver

### Opção 1: Comando Rápido (3 passos)

```bash
# Passo 1: Resetar banco (cria backup automático)
npm run db:reset

# Passo 2: Aplicar migrações
npm run migrate

# Passo 3: Verificar resultado
npm run migrate:verify
```

### Opção 2: Comandos Detalhados

```bash
# 1. Resetar
node backend/reset-database.js

# 2. Migrar
node backend/migrate.js migrate

# 3. Verificar
node backend/migrate.js verify

# 4. Iniciar servidor
npm start
```

## 📋 O Que Acontece no Reset

### Removido:
- ❌ Tabela `clientes` (antiga)
- ❌ Tabela `propriedades` (antiga)
- ❌ Tabela `vertices`
- ❌ Tabela `memoriais_importados`
- ❌ Tabela `schema_migrations`
- ❌ Tabelas `poligonos` e `poligono_marcos`
- ❌ Todas as views
- ❌ Todos os triggers

### Preservado:
- ✅ Tabela `marcos` **intacta**
- ✅ Todos os marcos geodésicos
- ✅ Histórico de levantamentos

### Criado:
- 📦 Backup automático em `database/marcos_backup_[timestamp].db`

## 🎯 Resultado Esperado

### Antes:
```
database/marcos.db
├─ marcos (OK)
├─ clientes (ANTIGA - sem coluna cidade)
├─ propriedades (ANTIGA)
└─ ... (tabelas incompatíveis)
```

### Depois do Reset:
```
database/marcos.db
└─ marcos (preservada com todos os dados)

database/marcos_backup_1234567890.db (backup automático)
```

### Depois da Migração:
```
database/marcos.db
├─ marcos (preservada)
├─ clientes (NOVA - com coluna cidade)
├─ propriedades (NOVA)
├─ vertices (NOVA)
├─ memoriais_importados (NOVA)
├─ schema_migrations (controle)
├─ vw_propriedades_completas (view)
├─ vw_estatisticas_clientes (view)
└─ vw_historico_importacoes (view)
```

## 🔍 Validação

### 1. Verificar se reset funcionou:
```bash
npm run db:reset
```

**Saída esperada:**
```
====================================
RESET DO BANCO DE DADOS
====================================

📦 Criando backup: marcos_backup_1234567890.db
✅ Backup criado com sucesso!

...

✅ Tabela 'marcos' preservada: X registros

====================================
✅ RESET CONCLUÍDO COM SUCESSO!
====================================
```

### 2. Verificar se migração aplicou:
```bash
npm run migrate
```

**Saída esperada:**
```
[Migrator] ====================================
[Migrator] INICIANDO MIGRAÇÕES
[Migrator] ====================================
[Migrator] 📋 1 migração(ões) pendente(s):
[Migrator]    - 001_create_integrated_schema.sql
[Migrator] Aplicando: 001_create_integrated_schema.sql...
[Migrator] ✅ 001_create_integrated_schema.sql aplicado com sucesso!
```

### 3. Verificar estrutura final:
```bash
npm run migrate:verify
```

**Saída esperada:**
```
[Migrator] 📊 Tabelas encontradas: 9
[Migrator]    - clientes
[Migrator]    - log_correcoes
[Migrator]    - marcos
[Migrator]    - memoriais_importados
[Migrator]    - poligono_marcos
[Migrator]    - poligonos
[Migrator]    - propriedades
[Migrator]    - schema_migrations
[Migrator]    - vertices
[Migrator] ✅ Todas as tabelas esperadas estão presentes!
```

## 🐛 Troubleshooting

### Problema: "database is locked"
**Solução:**
1. Parar servidor Node.js
2. Fechar qualquer cliente SQLite
3. Executar novamente

### Problema: Dados da tabela 'marcos' perdidos
**Solução:**
```bash
# Restaurar do backup
copy database\marcos_backup_*.db database\marcos.db
```
*Nota: Isso não deve acontecer, pois o script preserva a tabela.*

### Problema: Migração continua falhando
**Solução:**
1. Verificar arquivo SQL: `backend/migrations/001_create_integrated_schema.sql`
2. Verificar logs de erro detalhados
3. Tentar resetar novamente

## 📦 Arquivos Criados para Solução

```
backend/
├── reset-database.js           # Script de reset
├── RESET_GUIDE.md             # Guia completo de uso
└── migrate.js                 # Sistema de migrações (existente)

package.json                    # Atualizado com script npm run db:reset

SOLUCAO_ERRO_MIGRACAO.md       # Este documento
```

## 🔒 Segurança

### Backup Automático
- ✅ Criado automaticamente antes de qualquer mudança
- ✅ Localizado em `database/marcos_backup_[timestamp].db`
- ✅ Contém cópia completa do banco antes do reset

### Como Restaurar
```bash
# Windows
copy database\marcos_backup_1234567890.db database\marcos.db

# Linux/Mac
cp database/marcos_backup_1234567890.db database/marcos.db
```

## 📝 Checklist Final

Após executar a solução, verificar:

- [ ] Reset executou sem erros
- [ ] Backup foi criado
- [ ] Tabela `marcos` foi preservada
- [ ] Migrações aplicaram com sucesso
- [ ] 9 tabelas foram criadas (incluindo marcos)
- [ ] 3 views foram criadas
- [ ] Servidor Node.js inicia normalmente
- [ ] Frontend carrega sem erros
- [ ] Importação de memorial funciona

## 🎉 Resultado Final

Após aplicar esta solução, você terá:

✅ **Banco limpo** sem conflitos de schema
✅ **Dados preservados** (tabela marcos intacta)
✅ **Migração aplicada** com nova estrutura
✅ **Sistema funcional** pronto para uso
✅ **Backup de segurança** criado automaticamente

## 📚 Documentação Relacionada

- `backend/RESET_GUIDE.md` - Guia completo de reset
- `backend/MIGRATE_GUIDE.md` - Guia do sistema de migrações
- `backend/migrations/README.md` - Documentação das migrações
- `SISTEMA_MIGRACOES.md` - Visão geral do sistema

---

**Problema:** Conflito de schema na tabela `clientes`
**Solução:** Reset controlado + reaplicação de migrações
**Status:** ✅ Resolvido
**Data:** 2025-10-13
