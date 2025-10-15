# 🗺️ CORREÇÃO DE COORDENADAS GEOGRÁFICAS

## 🎯 PROBLEMA IDENTIFICADO

Alguns marcos no banco de dados têm coordenadas em formato **Lat/Long** (graus decimais) ao invés de **UTM** (metros), o que quebra o mapa Leaflet.

### Exemplos de coordenadas incorretas:
```
E = -47.12345  (deveria ser ~650000)
N = -22.45678  (deveria ser ~7150000)
```

### Coordenadas corretas (UTM Zone 22S):
```
E = 650000.00 metros
N = 7150000.00 metros
```

---

## 🔍 PASSO 1: DIAGNÓSTICO

Antes de corrigir, execute o diagnóstico para identificar os problemas:

```bash
cd backend/scripts
node diagnostico-coordenadas.js
```

### Saída esperada:

```
╔════════════════════════════════════════════════════════════╗
║  DIAGNÓSTICO DE COORDENADAS - SISTEMA COGEP               ║
╚════════════════════════════════════════════════════════════╝

📊 Total de marcos no sistema: 2967

📋 ESTATÍSTICAS GERAIS:

   Total de marcos: 2967
   ├─ Levantados: 238
   └─ Pendentes: 2729

🗺️  ANÁLISE DE COORDENADAS:

   ✅ UTM válido: 8 (0.3%)
   ❌ Lat/Long: 230 (7.7%)
   ⚠️  Inválido: 0 (0.0%)
   ⏳ Nulo: 2729 (92.0%)

╔════════════════════════════════════════════════════════════╗
║  MARCOS COM LAT/LONG (DEVEM SER UTM)                      ║
╚════════════════════════════════════════════════════════════╝

Total: 230 marcos

Primeiros 20:
┌─────┬───────────────┬──────┬───────────┬───────────┬───────────┬────────────────────────┐
│ idx │ codigo        │ tipo │ status    │ E         │ N         │ problema               │
├─────┼───────────────┼──────┼───────────┼───────────┼───────────┼────────────────────────┤
│ 0   │ FHV-V-0001   │ V    │ LEVANTADO │ -47.1234  │ -22.4567  │ Lat/Long ao invés UTM  │
│ 1   │ FHV-M-0002   │ M    │ LEVANTADO │ -47.2345  │ -22.5678  │ Lat/Long ao invés UTM  │
└─────┴───────────────┴──────┴───────────┴───────────┴───────────┴────────────────────────┘

📊 Range de valores Lat/Long encontrados:
   E (Longitude): -75.0000 a -30.0000
   N (Latitude): -35.0000 a 6.0000

╔════════════════════════════════════════════════════════════╗
║  RECOMENDAÇÕES                                             ║
╚════════════════════════════════════════════════════════════╝

❌ CRÍTICO: 230 marcos com Lat/Long ao invés de UTM
   Ação: Execute o script de correção
   Comando: node corrigir-coordenadas-geograficas.js
```

---

## 🛠️ PASSO 2: CORREÇÃO AUTOMÁTICA

Se o diagnóstico identificou marcos com Lat/Long, execute a correção:

```bash
node corrigir-coordenadas-geograficas.js
```

### Processo:

1. **Identificação**: Script busca marcos LEVANTADOS com coordenadas suspeitas
2. **Validação**: Verifica se são realmente Lat/Long
3. **Conversão**: Converte para UTM Zone 22S
4. **Backup**: Registra valores antigos no `log_correcoes`
5. **Atualização**: Salva coordenadas corrigidas no banco

### Tempo de segurança:

```
⚠️  ATENÇÃO: Iniciaremos correção em 5 segundos...
Pressione Ctrl+C para CANCELAR
```

### Saída esperada:

```
🔄 Iniciando correções...

✅ FHV-V-0001:
   ANTES: E=-47.1234, N=-22.4567 (Lat/Long)
   DEPOIS: E=650123.45, N=7512345.67 (UTM)

✅ FHV-M-0002:
   ANTES: E=-47.2345, N=-22.5678 (Lat/Long)
   DEPOIS: E=640234.56, N=7501234.56 (UTM)

... (mostra primeiros 5)

╔════════════════════════════════════════════════════════════╗
║  CORREÇÃO CONCLUÍDA                                        ║
╚════════════════════════════════════════════════════════════╝

✅ Marcos corrigidos: 230
❌ Falhas: 0

📊 ESTATÍSTICAS ATUALIZADAS:
   Total: 2967
   Levantados: 238
   Válidos: 230

🎯 PRÓXIMOS PASSOS:
   1. Reiniciar o servidor Node.js
   2. Abrir o mapa no navegador
   3. Verificar se os marcos aparecem corretamente
```

---

## ✅ PASSO 3: VALIDAÇÃO

Após a correção:

### 1. Executar diagnóstico novamente

```bash
node diagnostico-coordenadas.js
```

**Resultado esperado:**
```
✅ UTM válido: 238 (8.0%)
❌ Lat/Long: 0 (0.0%)
```

### 2. Reiniciar servidor

```bash
cd backend
npm start
```

### 3. Testar mapa

1. Abrir: `http://localhost:3000`
2. Clicar em: **Mapa de Marcos**
3. Verificar:
   - ✅ Mapa carrega sem erros
   - ✅ 238 marcadores visíveis
   - ✅ Console sem erros

### 4. Verificar console do navegador (F12)

```
🗺️ Carregando marcos no mapa...
📊 API retornou: 238 marcos levantados
✅ Mapa: 238 marcos plotados com sucesso
```

---

## 📋 DETALHES TÉCNICOS

### Critérios de detecção

O script identifica coordenadas em Lat/Long usando:

1. **Valores pequenos**: `|E| < 1000` e `|N| < 1000`
2. **Range Brasil**:
   - Longitude: -75° a -30°
   - Latitude: -35° a 6°

### Conversão

```javascript
Entrada:  [longitude, latitude] em graus decimais
Projeção: EPSG:4326 → EPSG:31982
Saída:    [easting, northing] em metros
```

### Validação pós-conversão

```javascript
E: 166.000 - 834.000 metros (UTM Zone 22S)
N: 0 - 10.000.000 metros
```

### Backup automático

Todas as correções são registradas em `log_correcoes`:

```sql
INSERT INTO log_correcoes (
    marco_id,
    coordenada_e_antiga,  -- Lat/Long original
    coordenada_n_antiga,  -- Lat/Long original
    coordenada_e_nova,    -- UTM corrigido
    coordenada_n_nova,    -- UTM corrigido
    motivo,               -- 'Conversão automática: Lat/Long → UTM'
    usuario               -- 'SISTEMA-CORRECAO'
)
```

---

## 🆘 TROUBLESHOOTING

### Problema: "Module proj4 not found"

```bash
cd backend
npm install proj4
```

### Problema: "Database is locked"

**Solução:** Parar o servidor Node.js antes de executar os scripts

```bash
# Parar servidor (Ctrl+C)
# Depois executar script
node corrigir-coordenadas-geograficas.js
```

### Problema: "Conversão falhou"

**Causas:**
- Coordenadas fora do Brasil
- Valores extremamente inválidos

**Solução:** Revisar marco manualmente

### Problema: Mapa ainda não funciona

**Verificar:**

1. Coordenadas foram realmente corrigidas?
   ```bash
   node diagnostico-coordenadas.js
   ```

2. Servidor foi reiniciado?
   ```bash
   npm start
   ```

3. Cache do navegador?
   ```
   Ctrl+F5 (hard reload)
   ```

---

## 📊 FLUXO COMPLETO

```
1. DIAGNÓSTICO
   └─> node diagnostico-coordenadas.js
       └─> Identifica 230 marcos com Lat/Long

2. CORREÇÃO
   └─> node corrigir-coordenadas-geograficas.js
       └─> Converte 230 marcos para UTM
           └─> Registra em log_correcoes
               └─> Atualiza banco

3. VALIDAÇÃO
   └─> node diagnostico-coordenadas.js
       └─> Confirma: 0 marcos com Lat/Long
           └─> Todos os 238 LEVANTADOS têm UTM válido

4. TESTE
   └─> Reiniciar servidor
       └─> Abrir mapa
           └─> 238 marcos plotados com sucesso ✅
```

---

## ⚠️ AVISOS IMPORTANTES

1. **Backup**: Faça backup do banco antes de executar correções
2. **Servidor parado**: Sempre pare o servidor antes de executar scripts
3. **Timeout de 5s**: Tempo para revisar e cancelar se necessário
4. **Transação**: Correção usa transação (tudo ou nada)
5. **Log**: Todas as alterações são registradas

---

## 📚 REFERÊNCIAS

- **Projeção UTM Zone 22S**: EPSG:31982
- **WGS84 (Lat/Long)**: EPSG:4326
- **Biblioteca**: proj4js
- **Range válido**: Curitiba/PR está em ~650000 E, ~7150000 N

---

**Desenvolvido por:** Sistema COGEP
**Versão:** 1.0.0
**Data:** 2025-01-08
