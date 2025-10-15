# 🔄 Guia de Reset do Banco de Dados

## ⚠️ Quando Usar o Reset

Use o script de reset quando:

- ❌ Erro "table has no column named..."
- ❌ Conflito de schema entre versões
- ❌ Migrações não aplicam corretamente
- ❌ Estrutura do banco inconsistente
- ⚠️ Você quer limpar e recomeçar as migrações

## 🚨 IMPORTANTE

O reset vai:
- ✅ **Preservar** a tabela `marcos` (dados principais)
- ❌ **Remover** todas as outras tabelas (clientes, propriedades, vertices, etc.)
- ❌ **Remover** todas as views
- ❌ **Remover** todos os triggers
- 🔒 **Criar backup automático** antes de qualquer mudança

## 🚀 Como Usar

### Método 1: Via NPM (Recomendado)

```bash
# 1. Resetar banco (cria backup automático)
npm run db:reset

# 2. Aplicar migrações
npm run migrate

# 3. Verificar resultado
npm run migrate:verify
```

### Método 2: Via Node

```bash
# 1. Resetar
node backend/reset-database.js

# 2. Migrar
node backend/migrate.js migrate

# 3. Verificar
node backend/migrate.js verify
```

## 📋 Processo Completo

### Passo 1: Reset do Banco
```bash
npm run db:reset
```

**O que acontece:**
```
====================================
RESET DO BANCO DE DADOS
====================================

📦 Criando backup: marcos_backup_1234567890.db
✅ Backup criado com sucesso!

📊 Tabelas antes do reset:
   - clientes
   - marcos
   - memoriais_importados
   - poligonos
   - propriedades
   - schema_migrations
   - vertices

🗑️  Removendo tabelas conflitantes...

🔧 Removendo triggers...
   Removendo trigger: update_clientes_timestamp
   Removendo trigger: update_propriedades_timestamp
   ...

👁️  Removendo views...
   Removendo view: vw_propriedades_completas
   Removendo view: vw_estatisticas_clientes
   ...

📋 Removendo tabelas...
   Removendo tabela: clientes
   Removendo tabela: propriedades
   Removendo tabela: vertices
   Removendo tabela: memoriais_importados
   ...

✅ Limpeza concluída com sucesso!

📊 Tabelas após reset:
   - marcos

✅ Tabela 'marcos' preservada: 150 registros

====================================
✅ RESET CONCLUÍDO COM SUCESSO!
====================================

📌 Próximo passo:
   npm run migrate

📦 Backup salvo em:
   marcos_backup_1234567890.db
====================================
```

### Passo 2: Aplicar Migrações
```bash
npm run migrate
```

**Resultado esperado:**
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

### Passo 3: Verificar
```bash
npm run migrate:verify
```

## 🐛 Troubleshooting

### Erro: "cannot open database file"
**Causa:** Banco não existe ou caminho incorreto

**Solução:**
```bash
# Verificar se o arquivo existe
dir database\marcos.db

# Se não existe, o servidor criará na primeira execução
npm start
```

### Erro: "database is locked"
**Causa:** Outro processo está usando o banco

**Solução:**
1. Fechar o servidor Node.js
2. Fechar qualquer cliente SQLite aberto
3. Executar reset novamente

### Tabela 'marcos' foi removida acidentalmente
**Causa:** Não deve acontecer, mas se acontecer...

**Solução:**
```bash
# Restaurar do backup
copy database\marcos_backup_*.db database\marcos.db
```

### Reset não remove todas as tabelas
**Causa:** Tabelas criadas manualmente não estão na lista

**Solução:** Adicionar ao array `tabelasParaRemover` em `reset-database.js`

## 🔒 Segurança dos Dados

### Backup Automático
Cada execução do reset cria um backup automático:
```
database/marcos_backup_1697123456789.db
```

### Dados Preservados
- ✅ Tabela `marcos` é **sempre** preservada
- ✅ Todos os marcos geodésicos permanecem intactos
- ✅ Histórico de levantamentos mantido

### Dados Removidos
- ❌ Clientes (serão recriados)
- ❌ Propriedades (serão recriadas)
- ❌ Vértices (serão recriados)
- ❌ Memoriais importados (histórico perdido)

### Como Restaurar Backup Manualmente
```bash
# Windows
copy database\marcos_backup_1234567890.db database\marcos.db

# Linux/Mac
cp database/marcos_backup_1234567890.db database/marcos.db
```

## 📊 Comparação: Antes vs Depois

### Antes do Reset
```
Tabelas:
- clientes (antiga, schema incompatível)
- marcos (dados principais)
- memoriais_importados
- poligonos
- propriedades (antigas)
- schema_migrations (controle antigo)
- vertices

Views:
- vw_propriedades_completas
- vw_estatisticas_clientes

Triggers:
- update_clientes_timestamp
- calc_area_hectares
```

### Depois do Reset
```
Tabelas:
- marcos (preservada!)

Views: (nenhuma)

Triggers: (nenhum)
```

### Depois de Migrar
```
Tabelas:
- clientes (nova estrutura)
- marcos (preservada)
- memoriais_importados (nova)
- propriedades (nova)
- schema_migrations (controle novo)
- vertices (nova)

Views:
- vw_propriedades_completas
- vw_estatisticas_clientes
- vw_historico_importacoes

Triggers:
- update_clientes_timestamp
- update_propriedades_timestamp
- calc_area_hectares_insert
- calc_area_hectares_update
```

## ⚡ Workflow Recomendado

### Para Desenvolvimento
```bash
# 1. Fazer reset completo
npm run db:reset

# 2. Aplicar migrações
npm run migrate

# 3. Verificar
npm run migrate:verify

# 4. Iniciar servidor
npm start
```

### Para Produção
```bash
# ⚠️ CUIDADO! Em produção, use apenas se necessário

# 1. Fazer backup manual COMPLETO
copy database\marcos.db database\marcos_backup_manual.db

# 2. Resetar
npm run db:reset

# 3. Migrar
npm run migrate

# 4. Validar
npm run migrate:verify

# 5. Reimportar dados (se necessário)
# ... scripts de reimportação ...
```

## 📝 Checklist Pós-Reset

Após executar reset + migrate, verificar:

- [ ] Backup foi criado
- [ ] Tabela `marcos` foi preservada
- [ ] Migrações aplicaram sem erro
- [ ] 4 novas tabelas foram criadas
- [ ] 3 views foram criadas
- [ ] Triggers foram criados
- [ ] Dados de teste estão presentes
- [ ] Servidor inicia sem erros
- [ ] Frontend carrega corretamente

## 🆘 Em Caso de Problemas

1. **Verificar backup**
   ```bash
   dir database\marcos_backup_*.db
   ```

2. **Ver logs detalhados**
   - Executar com Node diretamente
   - Verificar mensagens de erro

3. **Restaurar backup**
   ```bash
   copy database\marcos_backup_*.db database\marcos.db
   ```

4. **Reportar issue**
   - Copiar mensagem de erro completa
   - Incluir output do reset
   - Informar versão do Node e SQLite

---

## 💡 Dicas Importantes

- ✅ Sempre execute em **ambiente de desenvolvimento** primeiro
- ✅ Faça **backup manual** adicional em produção
- ✅ Verifique se o **servidor está parado** antes do reset
- ✅ Teste as **migrações** após o reset
- ⚠️ Em produção, considere **migração incremental** em vez de reset

---

**Última atualização:** 2025-10-13
**Versão:** 1.0.0
