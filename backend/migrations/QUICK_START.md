# 🚀 Guia Rápido de Migração

## ⚡ Execução em 3 Passos

### 1. Backup (Opcional mas Recomendado)
```bash
# Windows
copy database\marcos.db database\marcos_backup_manual.db

# Linux/Mac
cp database/marcos.db database/marcos_backup_manual.db
```

### 2. Executar Migração
```bash
node backend/migrations/run-migration.js
```

### 3. Validar
Acesse o sistema e verifique se está tudo funcionando.

---

## 📋 Checklist Pós-Migração

- [ ] Script executou sem erros
- [ ] Backup foi criado automaticamente
- [ ] 4 novas tabelas foram criadas
- [ ] 3 views foram criadas
- [ ] Dados de teste estão presentes
- [ ] Sistema Node.js inicia normalmente
- [ ] Frontend carrega sem erros

---

## 🔍 Comandos de Verificação Rápida

### Ver tabelas criadas:
```bash
sqlite3 database/marcos.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Ver dados de teste:
```bash
sqlite3 database/marcos.db "SELECT * FROM clientes;"
sqlite3 database/marcos.db "SELECT * FROM propriedades;"
sqlite3 database/marcos.db "SELECT * FROM vertices;"
```

### Testar views:
```bash
sqlite3 database/marcos.db "SELECT * FROM vw_propriedades_completas;"
sqlite3 database/marcos.db "SELECT * FROM vw_estatisticas_clientes;"
```

---

## ⚠️ Problemas Comuns

### "SQLITE_ERROR: table already exists"
✅ Normal! A migração é idempotente e pode ser executada múltiplas vezes.

### "Cannot find module 'better-sqlite3'"
```bash
npm install
```

### "ENOENT: no such file or directory"
Verifique se está executando do diretório raiz do projeto:
```bash
cd C:\sistema-marcos-geodesicos
node backend/migrations/run-migration.js
```

---

## 🔄 Reverter Migração

Se necessário reverter, use o backup:

```bash
# Parar o servidor primeiro!

# Windows
copy database\marcos_backup_*.db database\marcos.db

# Linux/Mac
cp database/marcos_backup_*.db database/marcos.db
```

---

## 📊 Estrutura Criada

```
Sistema de Marcos Geodésicos
│
├─ clientes (Proprietários)
│   └─ id, nome, cpf_cnpj, contato, endereço
│
├─ propriedades (Terrenos/Imóveis)
│   ├─ cliente_id → clientes
│   └─ matrícula, tipo, localização, área, perímetro
│
├─ vertices (Pontos do Polígono)
│   ├─ propriedade_id → propriedades
│   └─ nome, ordem, lat/long, UTM, azimute
│
└─ memoriais_importados (Histórico)
    ├─ propriedade_id → propriedades
    └─ arquivo, vértices extraídos, JSON completo
```

---

## 🎯 Próximos Passos

Após migração bem-sucedida:

1. **Atualizar endpoint de importação** para salvar em `memoriais_importados`
2. **Criar endpoints REST** para as novas tabelas
3. **Atualizar frontend** para consumir novos endpoints
4. **Implementar tela de gestão de propriedades**
5. **Adicionar relatórios** usando as views criadas

---

## 💡 Dicas

- Os triggers calculam área em hectares automaticamente
- As views simplificam consultas complexas
- Dados de teste podem ser removidos após validação
- Backups são criados em `database/marcos_backup_*.db`

---

## 📞 Suporte

Documentação completa: `backend/migrations/README.md`
Arquivo SQL: `backend/migrations/001_create_integrated_schema.sql`
