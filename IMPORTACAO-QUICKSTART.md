# ⚡ IMPORTAÇÃO RÁPIDA - COGEP STABILIZER

## 🎯 Objetivo

Importar **2967 marcos** (238 LEVANTADOS + 2729 PENDENTES) processados pelo agente COGEP-STABILIZER.

---

## 📋 CHECKLIST RÁPIDO

### ✅ Pré-requisitos

- [ ] Arquivos CSV na raiz do projeto:
  - `marcos_consolidados.csv` (238 marcos)
  - `marcos_invalidos.csv` (2729 marcos)
- [ ] Servidor Node.js **parado**
- [ ] Backup do banco (opcional, mas recomendado)

### 🚀 Execução (3 passos)

#### 1️⃣ Validar arquivos CSV (opcional, mas recomendado)

```bash
cd backend/scripts
node validar-csv.js
```

**Resultado esperado:**
```
✅ TODOS OS ARQUIVOS ESTÃO VÁLIDOS!
```

#### 2️⃣ Executar importação

```bash
node importar-dados-consolidados.js
```

**Aguardar:** 5 segundos (tempo de segurança)

**Para cancelar:** `Ctrl+C` antes dos 5 segundos

#### 3️⃣ Reiniciar servidor

```bash
cd backend
npm start
```

---

## 📊 RESULTADO ESPERADO

### Dashboard
- **Total:** 2967 marcos
- **Tipo V:** ~1200
- **Tipo M:** ~950
- **Tipo P:** ~817

### Mapa GIS
- **Exibe:** 238 marcos (apenas LEVANTADOS)
- **Não exibe:** 2729 marcos PENDENTES

### Consulta de Marcos
- **Busca sem filtros:** 2967 marcos
- **Filtros:** Funcionam para ambos os status

### Validação de Coordenadas
- **Levantados:** 238 (230 válidos + 8 inválidos)
- **Pendentes:** 2729 (sem coordenadas)

---

## ⚠️ AVISOS IMPORTANTES

1. **LIMPEZA TOTAL:** Deleta TODOS os marcos existentes
2. **IRREVERSÍVEL:** Não há rollback automático
3. **DOWNTIME:** Servidor deve estar parado
4. **TEMPO:** ~10-30 segundos

---

## 🆘 PROBLEMAS COMUNS

### Arquivo não encontrado
```
❌ Arquivo não encontrado: marcos_consolidados.csv
```
**Solução:** Colocar arquivos na raiz do projeto

### Erro de validação
```
⚠️  Sem coordenadas: 50/100 (50.0%)
```
**Solução:** Verificar se está usando o arquivo correto (consolidados vs inválidos)

### Servidor ainda rodando
```
Error: Database is locked
```
**Solução:** Parar o servidor antes da importação

---

## 📝 COMANDOS ÚTEIS

### Backup do banco (antes da importação)

```bash
# Windows
copy database\marcos.db database\marcos.db.backup

# Linux/Mac
cp database/marcos.db database/marcos.db.backup
```

### Restaurar backup (se necessário)

```bash
# Windows
copy database\marcos.db.backup database\marcos.db

# Linux/Mac
cp database/marcos.db.backup database/marcos.db
```

### Ver estatísticas atuais

```bash
cd backend/scripts
node ver-estatisticas.js
```

---

## 📌 PRÓXIMOS PASSOS APÓS IMPORTAÇÃO

1. ✅ Abrir sistema no navegador: `http://localhost:3000`
2. ✅ Verificar Dashboard (2967 marcos)
3. ✅ Verificar Mapa (238 marcos)
4. ✅ Verificar Validação (estatísticas atualizadas)
5. ✅ Testar filtros e buscas

---

## 📚 DOCUMENTAÇÃO COMPLETA

Para mais detalhes, consulte:
- `backend/scripts/README-IMPORTACAO.md`

---

**Desenvolvido por:** Sistema COGEP
**Versão:** 1.0.0
**Data:** 2025-01-07
