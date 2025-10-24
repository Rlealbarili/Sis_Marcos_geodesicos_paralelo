# 🔍 Diagnóstico de Endpoints 404

## Problema Identificado

O frontend está fazendo requisições para endpoints que não existem na API PostgreSQL:

### Endpoints com 404 (Log do Servidor)

```
❌ GET /api/clientes?limite=1000          → Intervalo: a cada 30s
❌ GET /api/propriedades-mapa             → Intervalo: ao carregar página
❌ GET /api/propriedades?limite=1         → Intervalo: a cada 30s
```

## Endpoints Funcionais (✅)

```
✅ GET /api/estatisticas                  → OK (2-25ms)
✅ GET /api/marcos?limite=X               → OK (3-29ms)
✅ GET /api/marcos/raio/:lat/:lng/:raio   → OK (12-28ms)
✅ GET /api/marcos/bbox                   → OK (9ms)
✅ GET /api/marcos/geojson                → OK (3ms)
✅ GET /api/health                        → OK (17ms)
```

## Análise do Problema

### 1. Sistema Misturado
O `frontend/script.js` contém código de **dois sistemas diferentes**:
- **Sistema de Marcos Geodésicos** (atual) ✅
- **Sistema de Propriedades/Clientes** (outro projeto) ❌

### 2. Atualização Automática
Existe uma função que roda a cada 30 segundos tentando:
- Buscar clientes
- Buscar propriedades
- Atualizar estatísticas de propriedades

### 3. Impacto
- Console cheio de erros 404
- Performance degradada (conexões inúteis)
- Logs poluídos
- Experiência do usuário prejudicada

## Frequência dos Erros

```
Tentativas em 2h30min de servidor rodando:
- /api/clientes:        ~200 requisições
- /api/propriedades:    ~200 requisições
- Total 404s:           ~400 erros

Frequência: 400 erros / 150 minutos = 2.6 erros/minuto
```

## Funções Problemáticas no Frontend

### Localizadas no script.js:

1. **`carregarClientesParaFiltros()`**
   - Tenta buscar `/api/clientes?limite=1000`
   - Provavelmente chamada na inicialização

2. **`carregarPropriedades()`**
   - Tenta buscar `/api/propriedades?limite=1`
   - Chamada em loop de 30s

3. **`carregarPropriedadesDoMapa()`**
   - Tenta buscar `/api/propriedades-mapa`
   - Chamada ao carregar mapa

4. **`iniciarAtualizacaoAutomatica()`**
   - Loop que chama funções a cada 30s
   - Inclui chamadas para APIs inexistentes

## Linha do Tempo

```
T+0s    → Página carrega
T+0s    → carregarClientesParaFiltros() → 404
T+0s    → carregarPropriedadesDoMapa() → 404
T+0s    → iniciarAtualizacaoAutomatica() inicia
T+30s   → carregarPropriedades() → 404
T+60s   → carregarPropriedades() → 404
T+90s   → carregarPropriedades() → 404
... continua a cada 30s ...
```

## Solução Recomendada

### Opção 1: Limpeza Completa (RECOMENDADO)
1. Remover todas as funções de clientes/propriedades
2. Remover chamadas no inicializador
3. Simplificar atualização automática (só estatísticas)

### Opção 2: Comentar Código
1. Comentar funções problemáticas
2. Deixar código para referência futura
3. Mais rápido mas menos limpo

### Opção 3: Criar Endpoints Vazios
1. Adicionar endpoints que retornam []
2. Evita erros mas não resolve causa raiz
3. NÃO RECOMENDADO

## Arquivos a Corrigir

```
1. frontend/script.js
   - Remover funções de clientes/propriedades
   - Limpar inicializador
   - Simplificar loop de atualização

2. frontend/index.html
   - Remover elementos UI de clientes (se existir)
   - Remover abas de propriedades (se existir)
```

## Teste de Validação

Após correções, executar:

```bash
# 1. Abrir teste-api.html
http://localhost:3001/teste-api.html

# 2. Clicar em "Executar Todos"
# Resultado esperado: TODOS VERDES

# 3. Abrir index.html
http://localhost:3001/index.html

# 4. Verificar console do navegador (F12)
# Resultado esperado: SEM ERROS 404

# 5. Verificar logs do servidor
# Resultado esperado: SEM requisições para clientes/propriedades
```

## Performance Esperada Após Correção

### Antes (Atual):
- 400+ requisições 404 em 2h30min
- Logs poluídos
- Console cheio de erros
- 2.6 erros/minuto

### Depois (Esperado):
- 0 requisições 404
- Logs limpos
- Console limpo
- Foco só em marcos geodésicos

## Próximos Passos

1. ✅ Criar `teste-api.html` (FEITO)
2. ✅ Limpar `frontend/script.js` (FEITO)
3. ✅ Testar com `teste-api.html` (FEITO - servidor OK)
4. ⚠️ Validar mapa principal (REQUER HARD REFRESH - Ctrl+Shift+R)
5. ✅ Documentar correções (FEITO - ver LIMPEZA_FRONTEND_COMPLETA.md)

---

**Criado em:** 2025-10-21
**Corrigido em:** 2025-10-21 16:15
**Status:** ✅ CORREÇÕES APLICADAS - Requer hard refresh no navegador (Ctrl+Shift+R) para ver mudanças

## Correções Aplicadas

### Funções Removidas ✅
- `carregarClientesParaFiltros()` - linha ~3736
- `carregarPropriedades()` - linha ~931
- `criarCamadasPropriedades()` - linha ~956
- `adicionarInteracoesPoligono()` - linha ~997

### Chamadas Removidas ✅
- Inicialização: `carregarClientesParaFiltros()` - linha 30
- Inicialização: `carregarPropriedades()` - linha 646
- Estatísticas: `/api/propriedades?limite=1` - linha 3514
- Estatísticas: `/api/clientes?limite=1` - linha 3524

### Resultado ✅
- 0 erros 404 esperados após hard refresh
- Apenas endpoints de marcos geodésicos
- Performance otimizada

**Ver detalhes completos em:** `LIMPEZA_FRONTEND_COMPLETA.md`
