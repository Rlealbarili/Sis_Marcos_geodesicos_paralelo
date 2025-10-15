# Migrações do Banco de Dados

Este diretório contém as migrações SQL para o sistema de marcos geodésicos.

## 📋 Migrações Disponíveis

### 001_create_integrated_schema.sql
**Data:** 2025-10-13
**Descrição:** Adiciona schema completo integrado ao sistema

**Adiciona:**
- ✅ Tabela `clientes` - Gestão de proprietários
- ✅ Tabela `propriedades` - Gestão de imóveis/terrenos
- ✅ Tabela `vertices` - Pontos dos polígonos
- ✅ Tabela `memoriais_importados` - Histórico de importações
- ✅ Views úteis para consultas
- ✅ Triggers para automação
- ✅ Índices para performance
- ✅ Dados de teste

## 🚀 Como Executar

### Opção 1: Script Automatizado (Recomendado)

```bash
node backend/migrations/run-migration.js
```

**Vantagens:**
- ✅ Cria backup automático
- ✅ Mostra progresso detalhado
- ✅ Valida as alterações
- ✅ Testa as views criadas
- ⚠️ Aborta em caso de erro

### Opção 2: SQLite CLI

```bash
# Windows
sqlite3 database\marcos.db < backend\migrations\001_create_integrated_schema.sql

# Linux/Mac
sqlite3 database/marcos.db < backend/migrations/001_create_integrated_schema.sql
```

### Opção 3: Node.js Manual

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./database/marcos.db');
const sql = fs.readFileSync('./backend/migrations/001_create_integrated_schema.sql', 'utf8');
db.exec(sql);
db.close();
```

## 📊 Estrutura das Novas Tabelas

### clientes
Gerencia informações dos proprietários:
- Nome, CPF/CNPJ, Contato
- Endereço completo
- Timestamps automáticos

### propriedades
Armazena dados de terrenos/imóveis:
- Vínculo com cliente
- Matrícula, tipo (Rural/Urbano/Loteamento)
- Localização (município, comarca, distrito)
- Medidas (área m², hectares, perímetro)
- Memorial descritivo JSON
- Status (Ativo/Inativo/Pendente)

### vertices
Pontos que formam o polígono:
- Vínculo com propriedade
- Coordenadas geográficas (lat/long)
- Coordenadas UTM (E, N, zona, datum)
- Azimute e distância
- Confrontante
- Ordem sequencial

### memoriais_importados
Histórico de importações:
- Arquivo processado
- Estatísticas de extração
- Status (Processado/Erro/Pendente)
- JSON completo do resultado
- Vínculo com propriedade criada

## 🔍 Views Criadas

### vw_propriedades_completas
Propriedades com todos os dados do cliente e contagem de vértices.

```sql
SELECT * FROM vw_propriedades_completas WHERE municipio = 'Curitiba';
```

### vw_estatisticas_clientes
Estatísticas agregadas por cliente (total propriedades, área total, etc).

```sql
SELECT * FROM vw_estatisticas_clientes ORDER BY area_total_hectares DESC;
```

### vw_historico_importacoes
Histórico completo de importações com dados vinculados.

```sql
SELECT * FROM vw_historico_importacoes WHERE status = 'PROCESSADO' ORDER BY data_importacao DESC;
```

## ⚙️ Triggers Automáticos

### update_clientes_timestamp
Atualiza `updated_at` automaticamente ao modificar cliente.

### update_propriedades_timestamp
Atualiza `updated_at` automaticamente ao modificar propriedade.

### calc_area_hectares_insert / calc_area_hectares_update
Calcula área em hectares automaticamente quando área em m² é informada.

## 🧪 Dados de Teste

A migração inclui dados de teste:
- 1 cliente teste
- 1 propriedade teste (50.000 m²)
- 4 vértices teste (quadrado)
- 1 memorial teste

**Para remover dados de teste:**
```sql
DELETE FROM memoriais_importados WHERE id = 1;
DELETE FROM vertices WHERE propriedade_id = 1;
DELETE FROM propriedades WHERE id = 1;
DELETE FROM clientes WHERE id = 1;
```

## 🔒 Backup e Segurança

**IMPORTANTE:** Sempre faça backup antes de executar migrações!

### Backup manual:
```bash
# Windows
copy database\marcos.db database\marcos_backup.db

# Linux/Mac
cp database/marcos.db database/marcos_backup.db
```

### Restaurar backup:
```bash
# Windows
copy database\marcos_backup.db database\marcos.db

# Linux/Mac
cp database/marcos_backup.db database/marcos.db
```

## ✅ Validação

Após executar a migração, verificar:

```sql
-- Listar todas as tabelas
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Verificar estrutura de uma tabela
PRAGMA table_info(propriedades);

-- Contar registros de teste
SELECT 'Clientes' as tabela, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'Propriedades', COUNT(*) FROM propriedades
UNION ALL
SELECT 'Vértices', COUNT(*) FROM vertices
UNION ALL
SELECT 'Memoriais', COUNT(*) FROM memoriais_importados;

-- Testar views
SELECT * FROM vw_propriedades_completas;
SELECT * FROM vw_estatisticas_clientes;
```

## 📝 Notas Importantes

1. **Integridade Referencial**: Todas as tabelas usam FOREIGN KEYs com CASCADE/SET NULL
2. **Performance**: Índices criados nos campos mais consultados
3. **Compatibilidade**: SQLite 3.x necessário
4. **Encoding**: UTF-8 para suporte a caracteres especiais

## 🐛 Troubleshooting

### Erro: "table already exists"
- A migração é idempotente (usa `IF NOT EXISTS`)
- Pode executar múltiplas vezes sem problemas

### Erro: "FOREIGN KEY constraint failed"
- Verificar se há dados órfãos antes da migração
- Limpar dados inconsistentes

### Performance lenta após migração
- Executar: `VACUUM;`
- Executar: `ANALYZE;`

## 📚 Referências

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [SQL Triggers](https://www.sqlite.org/lang_createtrigger.html)
- [SQL Views](https://www.sqlite.org/lang_createview.html)

## 🔄 Próximas Migrações

Para criar novas migrações, usar o padrão:
```
002_nome_descritivo.sql
003_outro_nome.sql
```

Sempre incluir:
- Header com data e descrição
- IF NOT EXISTS em CREATE
- Comentários explicativos
- Seção de validação
