# 📦 IMPORTAÇÃO DE DADOS CONSOLIDADOS - COGEP STABILIZER

## 🎯 OBJETIVO

Este script realiza uma **importação completa** dos dados processados pelo agente COGEP-STABILIZER, substituindo todos os marcos existentes no banco de dados pelos novos dados consolidados.

## 📊 DADOS A IMPORTAR

| Arquivo | Registros | Status | Descrição |
|---------|-----------|--------|-----------|
| `marcos_consolidados.csv` | 238 | LEVANTADO | Marcos com coordenadas válidas (aparecem no mapa) |
| `marcos_invalidos.csv` | 2729 | PENDENTE | Marcos sem coordenadas (consultáveis, não no mapa) |
| **TOTAL** | **2967** | - | Total de marcos no sistema |

## ⚠️ AVISOS IMPORTANTES

1. **LIMPEZA TOTAL**: O script deleta TODOS os marcos existentes antes da importação
2. **NÃO HÁ ROLLBACK**: A operação é irreversível (faça backup se necessário)
3. **DOWNTIME**: O servidor deve estar parado durante a execução
4. **TEMPO**: A operação leva aproximadamente 10-30 segundos

## 📋 PRÉ-REQUISITOS

### 1. Arquivos CSV na raiz do projeto

```
sistema-marcos-geodesicos/
├── marcos_consolidados.csv    ← 238 marcos LEVANTADOS
├── marcos_invalidos.csv       ← 2729 marcos PENDENTES
├── backend/
├── frontend/
└── database/
```

### 2. Formato dos arquivos CSV

**Colunas esperadas (15 no total):**
```csv
codigo,tipo,localizacao,metodo,limites,coordenada_e,desvio_e,coordenada_n,desvio_n,altitude_h,desvio_h,lote,data_levantamento,observacoes,origem
```

**Exemplo:**
```csv
FHV-V-0001,V,JUFAP,PA1,LA3,500000.00,0.01,7500000.00,0.01,100.00,0.01,088B,2024-01-15,Marco de referência,CAMPO
```

### 3. Servidor Node.js parado

```bash
# Parar o servidor antes de executar o script
# Ctrl+C no terminal onde o servidor está rodando
```

## 🚀 EXECUÇÃO

### Passo 1: Navegar até a pasta de scripts

```bash
cd backend/scripts
```

### Passo 2: Executar o script

```bash
node importar-dados-consolidados.js
```

### Passo 3: Confirmar a operação

O script exibe um aviso de segurança e aguarda **5 segundos** antes de iniciar:

```
╔════════════════════════════════════════════════════════════╗
║  IMPORTAÇÃO DE DADOS CONSOLIDADOS - COGEP STABILIZER      ║
║  ⚠️  LIMPEZA TOTAL + SUBSTITUIÇÃO COMPLETA                 ║
╚════════════════════════════════════════════════════════════╝

⚠️  ATENÇÃO: Esta operação irá DELETAR TODOS os marcos existentes!

Arquivos a processar:
  1. marcos_consolidados.csv (238 marcos LEVANTADOS)
  2. marcos_invalidos.csv (2729 marcos PENDENTES)

🔥 DELEÇÃO TOTAL + IMPORTAÇÃO COMPLETA

Pressione Ctrl+C para CANCELAR ou aguarde 5 segundos...
```

**Para CANCELAR:** Pressione `Ctrl+C` antes dos 5 segundos

**Para CONTINUAR:** Aguarde os 5 segundos

## 📈 ETAPAS DO PROCESSO

### 1️⃣ Estatísticas Antes

```
📦 PASSO 1: Estatísticas do banco ANTES da limpeza
   Total: 100 marcos
   Ativos: 95 marcos
```

### 2️⃣ Limpeza Total

```
🧹 PASSO 2: LIMPEZA TOTAL DO BANCO
   Deletando todos os marcos...
   ✅ 100 marcos deletados
   ✅ Contador ID resetado
```

### 3️⃣ Importação

```
📥 PASSO 3: IMPORTAÇÃO DOS DADOS CONSOLIDADOS

📂 Processando: marcos_consolidados.csv
   Status: LEVANTADO
   Colunas: 15
   Linhas: 238
   ✅ Importados: 238

📂 Processando: marcos_invalidos.csv
   Status: PENDENTE
   Colunas: 15
   Linhas: 2729
   📊 Progresso: 500 marcos...
   📊 Progresso: 1000 marcos...
   📊 Progresso: 1500 marcos...
   📊 Progresso: 2000 marcos...
   📊 Progresso: 2500 marcos...
   ✅ Importados: 2729

⏳ Executando transação de importação...
```

### 4️⃣ Validação Automática

```
🔍 PASSO 4: VALIDAÇÃO AUTOMÁTICA
   Validando coordenadas dos marcos LEVANTADOS...
   ✅ Válidos: 230
   ❌ Inválidos: 8
```

### 5️⃣ Estatísticas Finais

```
╔════════════════════════════════════════════════════════════╗
║  IMPORTAÇÃO CONCLUÍDA COM SUCESSO                          ║
╚════════════════════════════════════════════════════════════╝

📊 ESTATÍSTICAS FINAIS:
   Total de marcos: 2967

   Por Status:
   📍 Levantados: 238 (8.0%) - Aparecem no mapa
   ⏳ Pendentes: 2729 (92.0%) - Consultáveis, não no mapa

   Por Tipo:
   V: 1200
   M: 950
   P: 817

   Validação de Coordenadas:
   ✅ Válidas: 230
   ❌ Inválidas: 8

✨ Sistema 100% funcional!

📌 PRÓXIMOS PASSOS:
   1. Reiniciar o servidor Node.js
   2. Acessar o sistema via navegador
   3. Consultar Marcos: verá todos os 2967 marcos
   4. Mapa: verá apenas os 238 levantados
   5. Validação: estatísticas atualizadas
```

## 🔍 VERIFICAÇÃO PÓS-IMPORTAÇÃO

### 1. Reiniciar o servidor

```bash
cd backend
npm start
# ou
node server.js
```

### 2. Acessar o sistema

```
http://localhost:3000
```

### 3. Verificar Dashboard

- **Total de Marcos:** 2967
- **Tipo V:** ~1200
- **Tipo M:** ~950
- **Tipo P:** ~817

### 4. Verificar Mapa

- Deve exibir apenas **238 marcos** (LEVANTADOS)
- Marcos PENDENTES não aparecem no mapa

### 5. Verificar Consulta

- Busca sem filtros: **2967 marcos**
- Filtro por tipo funciona para ambos os status
- Marcos PENDENTES aparecem na busca

### 6. Verificar Validação

```
Aba: Validação Coordenadas

Estatísticas:
- Total: 2967
- Válidos: ~230
- Inválidos: ~8
- Pendentes: 2729
```

## ❌ TRATAMENTO DE ERROS

### Arquivo não encontrado

```
⚠️  Arquivo não encontrado: marcos_consolidados.csv
```

**Solução:** Colocar o arquivo na raiz do projeto

### Linha CSV inválida

```
⚠️ Linha 123 inválida (12 campos)
```

**Solução:** Corrigir o arquivo CSV (deve ter 15 colunas)

### Erro crítico

```
❌ ERRO CRÍTICO: [mensagem do erro]
   Stack: [stack trace]

⚠️  O banco pode estar em estado inconsistente!
   Recomendação: Restaurar backup ou recriar banco.
```

**Solução:**
1. Verificar o erro no stack trace
2. Corrigir o problema
3. Restaurar backup do banco (se houver)
4. Ou recriar o banco do zero

## 🎯 COMPORTAMENTO ESPERADO

### Sistema após importação

| Funcionalidade | Comportamento |
|----------------|---------------|
| **Dashboard** | Exibe estatísticas de todos os 2967 marcos |
| **Consulta** | Lista todos os marcos (levantados + pendentes) |
| **Mapa GIS** | Exibe apenas os 238 marcos LEVANTADOS |
| **Validação** | Mostra estatísticas: 238 levantados (230 válidos + 8 inválidos) + 2729 pendentes |
| **Exportação** | Exporta todos os 2967 marcos |
| **Terrenos** | Pode usar qualquer marco na demarcação |

### Filtros

- **Por Tipo (V/M/P):** Funciona para ambos os status
- **Por Código:** Funciona para ambos os status
- **Por Localização:** Funciona para ambos os status
- **Por Status Campo:** Novo filtro para separar LEVANTADOS de PENDENTES

### Validação de Coordenadas

- **LEVANTADOS:** Validação automática (230 válidos + 8 inválidos)
- **PENDENTES:** Marcados como "Pendente Validação" (não têm coordenadas)

## 📝 NOTAS TÉCNICAS

### Performance

- Usa **transações SQLite** para máxima velocidade
- Importa ~3000 registros em 10-30 segundos
- Parse CSV robusto (suporta aspas e vírgulas nos campos)

### Integridade

- Limpa tabelas relacionadas antes de deletar marcos
- Reseta contador de ID (autoincrement)
- Valida coordenadas automaticamente após importação

### Segurança

- Timeout de 5 segundos para cancelamento
- Backup recomendado antes da execução
- Log detalhado de todas as operações

## 🆘 SUPORTE

Em caso de problemas:

1. Verificar logs do script
2. Verificar formato dos arquivos CSV
3. Verificar permissões do banco de dados
4. Consultar este README
5. Fazer backup antes de tentar novamente

---

**Desenvolvido por:** Sistema COGEP
**Versão:** 1.0.0
**Data:** 2025-01-07
