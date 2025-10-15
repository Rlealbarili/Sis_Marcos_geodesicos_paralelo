# 🚀 Sistema de Migrações - Documentação Completa

## 📦 O Que Foi Criado

### 1. **Script Principal de Migração**
📄 `backend/migrate.js`
- Sistema completo de controle de versão do banco
- Suporte a transações automáticas
- Registro de histórico em `schema_migrations`
- Comandos: migrate, status, verify

### 2. **Migração Inicial**
📄 `backend/migrations/001_create_integrated_schema.sql`
- 4 novas tabelas (clientes, propriedades, vertices, memoriais_importados)
- 3 views úteis para consultas
- 4 triggers para automação
- Índices para performance
- Dados de teste incluídos

### 3. **Scripts NPM**
📄 `package.json` (atualizado)
```bash
npm run migrate          # Aplicar migrações
npm run migrate:status   # Ver status
npm run migrate:verify   # Verificar banco
```

### 4. **Documentação Completa**
- 📄 `backend/migrations/README.md` - Guia completo de migrações
- 📄 `backend/migrations/QUICK_START.md` - Guia rápido
- 📄 `backend/migrations/EXAMPLES.sql` - 50+ exemplos de queries
- 📄 `backend/MIGRATE_GUIDE.md` - Guia detalhado do script
- 📄 `SISTEMA_MIGRACOES.md` - Este documento

### 5. **Scripts Auxiliares**
- 📄 `backend/migrations/run-migration.js` - Executar migração com backup
- 📄 `backend/test-migrate.js` - Testar sistema de migrações

### 6. **Configuração**
- 📄 `.gitignore` (atualizado) - Ignora backups e arquivos temporários

---

## 🎯 Estrutura do Banco de Dados

```
┌─────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS                        │
│                 sistema-marcos-geodesicos                │
└─────────────────────────────────────────────────────────┘

┌─────────────────┐
│    clientes     │  👥 Proprietários
├─────────────────┤
│ id              │
│ nome            │
│ cpf_cnpj        │
│ telefone        │
│ email           │
│ endereco        │
│ cidade          │
│ estado          │
│ observacoes     │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│  propriedades   │  🏘️ Terrenos/Imóveis
├─────────────────┤
│ id              │
│ cliente_id      │ ──┐
│ nome_propriedade│   │
│ matricula       │   │
│ tipo            │   │
│ municipio       │   │
│ comarca         │   │
│ uf              │   │
│ area_m2         │   │
│ area_hectares   │   │ (calculado automaticamente)
│ perimetro_m     │   │
│ memorial_json   │   │
│ status          │   │
│ created_at      │   │
│ updated_at      │   │
└─────────────────┘   │
        │             │
        │ 1:N         │ 1:N
        ▼             ▼
┌─────────────────┐ ┌───────────────────────┐
│    vertices     │ │ memoriais_importados  │ 📝 Histórico
├─────────────────┤ ├───────────────────────┤
│ id              │ │ id                    │
│ propriedade_id  │ │ propriedade_id        │
│ nome            │ │ arquivo_nome          │
│ ordem           │ │ arquivo_tamanho       │
│ latitude        │ │ vertices_extraidos    │
│ longitude       │ │ metadados_extraidos   │
│ utm_e           │ │ taxa_sucesso          │
│ utm_n           │ │ status                │
│ utm_zona        │ │ resultado_json        │
│ datum           │ │ usuario               │
│ azimute         │ │ data_importacao       │
│ distancia_m     │ └───────────────────────┘
│ confrontante    │
│ tipo            │
│ created_at      │
└─────────────────┘

┌─────────────────┐
│     marcos      │  🗺️ Base geodésica (existente)
├─────────────────┤
│ id              │
│ codigo          │
│ tipo            │
│ localizacao     │
│ coordenada_e    │
│ coordenada_n    │
│ ...             │
└─────────────────┘

┌─────────────────────┐
│ schema_migrations   │  📋 Controle de migrações
├─────────────────────┤
│ id                  │
│ version             │
│ name                │
│ applied_at          │
└─────────────────────┘
```

---

## 🚀 Como Usar

### Primeira Vez (Setup Inicial)

```bash
# 1. Instalar dependências (se ainda não fez)
npm install

# 2. Verificar migrações pendentes
npm run migrate:status

# 3. Aplicar migrações
npm run migrate

# 4. Verificar resultado
npm run migrate:verify
```

### Comandos Disponíveis

```bash
# Via NPM (recomendado)
npm run migrate          # Aplicar migrações pendentes
npm run migrate:status   # Ver status das migrações
npm run migrate:verify   # Verificar estrutura do banco

# Via Node diretamente
node backend/migrate.js migrate
node backend/migrate.js status
node backend/migrate.js verify

# Script com backup automático
node backend/migrations/run-migration.js

# Testar sistema
node backend/test-migrate.js
```

---

## 📊 Views Disponíveis

### 1. vw_propriedades_completas
Propriedades com todos os dados do cliente e contagem de vértices.

```sql
SELECT * FROM vw_propriedades_completas WHERE municipio = 'Curitiba';
```

### 2. vw_estatisticas_clientes
Estatísticas agregadas por cliente.

```sql
SELECT * FROM vw_estatisticas_clientes ORDER BY area_total_hectares DESC;
```

### 3. vw_historico_importacoes
Histórico completo de importações de memoriais.

```sql
SELECT * FROM vw_historico_importacoes WHERE status = 'PROCESSADO' LIMIT 10;
```

---

## ⚙️ Triggers Automáticos

### 1. update_clientes_timestamp
Atualiza `updated_at` automaticamente ao modificar cliente.

### 2. update_propriedades_timestamp
Atualiza `updated_at` automaticamente ao modificar propriedade.

### 3. calc_area_hectares_insert / calc_area_hectares_update
Calcula área em hectares automaticamente quando área em m² é informada.

**Exemplo:**
```sql
INSERT INTO propriedades (cliente_id, matricula, area_m2, ...)
VALUES (1, 'MAT-123', 50000, ...);
-- area_hectares será automaticamente 5.0 ha
```

---

## 🧪 Validação

### Verificar tabelas criadas:
```bash
sqlite3 database/marcos.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Resultado esperado:**
```
clientes
log_correcoes
marcos
memoriais_importados
poligono_marcos
poligonos
propriedades
schema_migrations
vertices
```

### Verificar migrações aplicadas:
```sql
SELECT * FROM schema_migrations;
```

### Contar registros de teste:
```sql
SELECT 'Clientes' as tabela, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'Propriedades', COUNT(*) FROM propriedades
UNION ALL
SELECT 'Vértices', COUNT(*) FROM vertices
UNION ALL
SELECT 'Memoriais', COUNT(*) FROM memoriais_importados;
```

---

## 🔧 Integração com Backend

### Próximos passos para integrar:

1. **Atualizar endpoint de importação**
```javascript
// Em backend/server.js
app.post('/api/importar-memorial-v2', async (req, res) => {
    // ... processamento existente ...

    // Salvar em memoriais_importados
    const memorial = db.prepare(`
        INSERT INTO memoriais_importados (
            propriedade_id, arquivo_nome, vertices_extraidos,
            resultado_json, usuario
        ) VALUES (?, ?, ?, ?, ?)
    `).run(
        propriedadeId,
        req.file.originalname,
        parsedData.vertices.length,
        JSON.stringify(parsedData),
        req.body.usuario
    );
});
```

2. **Criar endpoints REST para novas tabelas**
```javascript
// Listar propriedades
app.get('/api/propriedades', (req, res) => { ... });

// Detalhes de propriedade
app.get('/api/propriedades/:id', (req, res) => { ... });

// Vértices de uma propriedade
app.get('/api/propriedades/:id/vertices', (req, res) => { ... });

// Histórico de importações
app.get('/api/memoriais', (req, res) => { ... });
```

3. **Atualizar frontend**
- Adicionar tela de gestão de propriedades
- Visualizar vértices no mapa
- Consultar histórico de importações

---

## 📚 Documentação de Referência

### Arquivos principais:
- `backend/MIGRATE_GUIDE.md` - Guia completo do sistema
- `backend/migrations/README.md` - Documentação das migrações
- `backend/migrations/QUICK_START.md` - Início rápido
- `backend/migrations/EXAMPLES.sql` - Exemplos práticos

### Comandos úteis:
```bash
# Inspecionar banco manualmente
sqlite3 database/marcos.db

# Comandos SQLite úteis
.tables                  # Listar tabelas
.schema propriedades     # Ver estrutura de tabela
.exit                    # Sair
```

---

## 🐛 Troubleshooting

### Problema: "UNIQUE constraint failed: schema_migrations.version"
**Solução:** Migração já foi aplicada, não precisa reaplicar.

### Problema: Erro ao aplicar migração SQL
**Solução:** A transação faz rollback automático. Corrija o SQL e execute novamente.

### Problema: Migrações fora de ordem
**Solução:** Renomear arquivos seguindo padrão `001_`, `002_`, etc.

---

## ✅ Checklist de Validação

Após executar as migrações, verificar:

- [ ] Script executou sem erros
- [ ] Tabela `schema_migrations` foi criada
- [ ] 4 novas tabelas foram criadas
- [ ] 3 views foram criadas
- [ ] 4 triggers foram criados
- [ ] Dados de teste estão presentes
- [ ] Consultas nas views funcionam
- [ ] Triggers calculam automaticamente
- [ ] Sistema Node.js inicia sem erros

---

## 🎉 Resultado Final

Você agora tem:

✅ **Sistema de migrações completo** com controle de versão
✅ **4 novas tabelas** integradas ao sistema
✅ **3 views** para consultas simplificadas
✅ **4 triggers** para automação
✅ **Documentação completa** em múltiplos níveis
✅ **Scripts NPM** para facilitar uso
✅ **Backup automático** em cada migração
✅ **Exemplos práticos** de 50+ queries SQL

**Sistema pronto para evolução! 🚀**

---

## 📞 Próximos Passos

1. ✅ Executar primeira migração
2. ⏳ Criar endpoints REST para novas tabelas
3. ⏳ Atualizar frontend para usar novas features
4. ⏳ Implementar tela de gestão de propriedades
5. ⏳ Integrar importação de memorial com novas tabelas
6. ⏳ Criar relatórios usando as views

---

**Documentação criada em:** 2025-10-13
**Versão:** 1.0.0
**Sistema:** Marcos Geodésicos - COGEP
