# 🔧 FIX SEGURO: Adicionar Colunas created_at e updated_at

## ⚠️ IMPORTANTE: Este guia USA SEU BANCO EXISTENTE

**NÃO cria banco novo**
**NÃO cria tabelas novas**
**APENAS adiciona 2 colunas na tabela car_downloads existente**

---

## 🎯 Seu Ambiente

```
Container: marcos-geodesicos-postgres
Porta: 5434
Banco: marcos_geodesicos (EXISTENTE)
Tabela: car_downloads (EXISTENTE)
```

---

## ✅ Solução (3 Comandos Seguros)

### Passo 1: Ver estrutura ATUAL (sem mudar nada)

```bash
docker exec -it marcos-geodesicos-postgres psql -U postgres -d marcos_geodesicos -c "\d car_downloads"
```

**Você deve ver algo como:**
```
Column        | Type         | Modifiers
--------------+--------------+-----------
id            | integer      | not null
estado        | varchar(2)   | not null
tipo          | varchar(50)  | not null
data_download | timestamp    | default now()
...
```

Se NÃO vir `created_at` e `updated_at`, prossiga para o Passo 2.

---

### Passo 2: Adicionar colunas (SEGURO com IF NOT EXISTS)

```bash
docker exec -it marcos-geodesicos-postgres psql -U postgres -d marcos_geodesicos -c "ALTER TABLE car_downloads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; ALTER TABLE car_downloads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
```

**Saída esperada:**
```
ALTER TABLE
ALTER TABLE
```

---

### Passo 3: Verificar que funcionou

```bash
docker exec -it marcos-geodesicos-postgres psql -U postgres -d marcos_geodesicos -c "\d car_downloads"
```

**Agora deve mostrar:**
```
Column        | Type         | Modifiers
--------------+--------------+-----------
id            | integer      | not null
estado        | varchar(2)   | not null
tipo          | varchar(50)  | not null
data_download | timestamp    | default now()
created_at    | timestamp    | default now()      ← NOVO!
updated_at    | timestamp    | default now()      ← NOVO!
...
```

---

## 🔄 Alternativa: Modo Interativo (Mais Controle)

Se preferir fazer passo a passo com mais controle:

```bash
# 1. Entrar no PostgreSQL do container
docker exec -it marcos-geodesicos-postgres psql -U postgres -d marcos_geodesicos

# Dentro do psql:

# 2. Ver estrutura atual
\d car_downloads

# 3. Adicionar created_at
ALTER TABLE car_downloads
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

# 4. Adicionar updated_at
ALTER TABLE car_downloads
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

# 5. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_car_downloads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_car_downloads_timestamp ON car_downloads;
CREATE TRIGGER trigger_update_car_downloads_timestamp
    BEFORE UPDATE ON car_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_car_downloads_timestamp();

# 6. Verificar resultado
\d car_downloads

# 7. Sair
\q
```

---

## 🧪 Testar Sistema WFS Após Correção

Após adicionar as colunas:

```bash
# 1. Reiniciar servidor Node.js
taskkill /F /IM node.exe
ping 127.0.0.1 -n 4 > nul
node backend/server-postgres.js

# 2. Testar endpoint de status
curl http://localhost:3001/api/car/wfs/status
```

**Antes (com erro):**
```json
{"sucesso": false, "erro": "column created_at does not exist"}
```

**Depois (funcionando):**
```json
{"sucesso": true, "status": "nenhum_download", "mensagem": "..."}
```

```bash
# 3. Testar busca de municípios
curl http://localhost:3001/api/car/wfs/municipios/PR
```

**Deve retornar lista de municípios:**
```json
{"sucesso": true, "municipios": ["Curitiba", "Ponta Grossa", ...], "total": 399}
```

---

## 📋 Checklist

- [ ] Executei Passo 1 e vi estrutura atual
- [ ] Confirmei que `created_at` e `updated_at` NÃO existem
- [ ] Executei Passo 2 para adicionar colunas
- [ ] Executei Passo 3 e confirmei que colunas foram adicionadas
- [ ] Reiniciei servidor Node.js
- [ ] Testei endpoint `/api/car/wfs/status` - sem erro
- [ ] Testei endpoint `/api/car/wfs/municipios/PR` - retorna lista
- [ ] Abri http://localhost:3001/car-download-auto.html
- [ ] Lista de municípios carrega corretamente

---

## 🛡️ Segurança

**Este guia é 100% seguro porque:**

✅ Usa `docker exec` para acessar container existente
✅ Conecta ao banco `marcos_geodesicos` existente
✅ Modifica APENAS tabela `car_downloads` existente
✅ Adiciona APENAS 2 colunas com `IF NOT EXISTS`
✅ Não afeta dados existentes
✅ Não cria objetos novos (banco/tabelas)
✅ Reversível (pode remover colunas depois se quiser)

---

## 🔙 Como Reverter (Se Necessário)

Se quiser desfazer as mudanças:

```bash
docker exec -it marcos-geodesicos-postgres psql -U postgres -d marcos_geodesicos -c "ALTER TABLE car_downloads DROP COLUMN IF EXISTS created_at; ALTER TABLE car_downloads DROP COLUMN IF EXISTS updated_at;"
```

---

**Criado em**: 2025-11-04
**Ambiente**: Docker container `marcos-geodesicos-postgres`
**Banco**: `marcos_geodesicos` (existente)
**Mudanças**: Apenas 2 colunas adicionadas em tabela existente
