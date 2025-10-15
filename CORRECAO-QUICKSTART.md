# ⚡ CORREÇÃO DE COORDENADAS - GUIA RÁPIDO

## 🎯 Problema

Marcos com coordenadas em **Lat/Long** (graus) ao invés de **UTM** (metros) quebram o mapa.

Exemplo:
```
❌ ERRADO: E=-47, N=-22 (Lat/Long)
✅ CERTO:  E=650000, N=7150000 (UTM)
```

---

## 🚀 SOLUÇÃO EM 3 PASSOS

### 1️⃣ Diagnóstico (opcional, mas recomendado)

```bash
cd backend/scripts
node diagnostico-coordenadas.js
```

**Mostra:** Quantos marcos têm problemas

---

### 2️⃣ Correção Automática

```bash
node corrigir-coordenadas-geograficas.js
```

**Aguarda:** 5 segundos (tempo para cancelar com Ctrl+C)

**Faz:**
- Identifica marcos com Lat/Long
- Converte para UTM
- Salva no banco
- Registra no log

---

### 3️⃣ Validação

```bash
# Reiniciar servidor
cd backend
npm start

# Abrir navegador
http://localhost:3000

# Ir para Mapa
# Verificar: 238 marcos visíveis ✅
```

---

## 📊 RESULTADO ESPERADO

### Antes da correção:
```
❌ Lat/Long: 230 marcos
✅ UTM válido: 8 marcos
🗺️ Mapa: QUEBRADO
```

### Depois da correção:
```
✅ UTM válido: 238 marcos
❌ Lat/Long: 0 marcos
🗺️ Mapa: FUNCIONANDO
```

---

## ⚠️ AVISOS

1. **Parar servidor** antes de executar scripts
2. **5 segundos** para cancelar (Ctrl+C)
3. **Backup automático** no log_correcoes
4. **Transação**: Tudo ou nada

---

## 🆘 PROBLEMAS COMUNS

### Erro: "Module proj4 not found"
```bash
cd backend
npm install proj4
```

### Erro: "Database is locked"
```bash
# Parar servidor primeiro (Ctrl+C)
```

### Mapa ainda quebrado?
```bash
# Hard reload no navegador
Ctrl+F5
```

---

## 📝 COMANDOS ÚTEIS

```bash
# Ver estatísticas
node diagnostico-coordenadas.js

# Corrigir coordenadas
node corrigir-coordenadas-geograficas.js

# Ver estatísticas do banco
node ver-estatisticas.js
```

---

## ✅ CHECKLIST

- [ ] Servidor Node.js parado
- [ ] Executar diagnóstico
- [ ] Executar correção
- [ ] Aguardar 5 segundos
- [ ] Verificar resultado
- [ ] Reiniciar servidor
- [ ] Testar mapa

---

**Tempo total:** ~2 minutos
**Dificuldade:** Fácil
**Reversível:** Sim (via log_correcoes)
