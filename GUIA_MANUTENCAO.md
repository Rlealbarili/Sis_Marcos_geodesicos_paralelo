# 🔧 GUIA DE MANUTENÇÃO TÉCNICA - SISTEMA DE MARCOS GEODÉSICOS

**Versão:** 1.0  
**Data:** Outubro 2025  
**Público-alvo:** Desenvolvedores e Administradores de Sistema

---

## 📑 ÍNDICE

1. [Arquitetura do Sistema](#arquitetura-do-sistema)
2. [Estrutura de Arquivos](#estrutura-de-arquivos)
3. [Banco de Dados](#banco-de-dados)
4. [Backend](#backend)
5. [Frontend](#frontend)
6. [Manutenção Rotineira](#manutenção-rotineira)
7. [Troubleshooting](#troubleshooting)
8. [Backup e Recuperação](#backup-e-recuperação)
9. [Atualizações](#atualizações)
10. [Monitoramento](#monitoramento)

---

## 1. ARQUITETURA DO SISTEMA

### Stack Tecnológico

```
┌─────────────────────────────────────────────────┐
│               FRONTEND                          │
│  HTML5 + CSS3 + JavaScript (Vanilla)            │
│  Leaflet.js + Supercluster + Proj4js           │
└─────────────────────────────────────────────────┘
                    ↕ HTTP/JSON
┌─────────────────────────────────────────────────┐
│               BACKEND                           │
│  Node.js 18+ + Express.js 4.x                   │
│  Better-SQLite3 + Proj4                         │
└─────────────────────────────────────────────────┘
                    ↕ SQL
┌─────────────────────────────────────────────────┐
│            BANCO DE DADOS                       │
│  SQLite 3 (arquivo: marcos.db)                  │
│  Modo: WAL (Write-Ahead Logging)               │
└─────────────────────────────────────────────────┘
```

### Portas e Serviços

- **Backend:** `http://localhost:3000`
- **Frontend:** Servido pelo Express na mesma porta
- **Banco:** Arquivo local (sem porta)

---

## 2. ESTRUTURA DE ARQUIVOS

```
Sis_Marcos_geodesicos_paralelo-main/
│
├── backend/
│   ├── server.js                    # Servidor principal
│   ├── database/
│   │   └── marcos.db                # Banco SQLite
│   ├── scripts/
│   │   ├── limpar-banco-completo.js
│   │   ├── importar-planilha-mestre.js
│   │   └── reconverter-utm-latlng.js
│   ├── backups/                     # Backups automáticos
│   ├── relatorios/                  # Logs de processamento
│   └── package.json                 # Dependências Node
│
├── frontend/
│   ├── index.html                   # Página principal
│   ├── css/
│   │   └── style.css                # Estilos
│   └── js/
│       └── script.js                # Lógica JavaScript
│
├── documentacao/                    # NOVA - Docs do sistema
│   ├── MANUAL_DO_USUARIO.md
│   ├── GUIA_MANUTENCAO.md
│   └── API_REFERENCE.md
│
└── .env                             # Configurações (criar)
```

---

## 3. BANCO DE DADOS

### Conexão

```javascript
const Database = require('better-sqlite3');
const db = new Database('backend/database/marcos.db');

// Configurações otimizadas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');  // 64MB
db.pragma('foreign_keys = ON');
```

### Tabelas

#### marcos_levantados

```sql
CREATE TABLE marcos_levantados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL CHECK(tipo IN ('V', 'M', 'P')),
    municipio TEXT,
    estado TEXT DEFAULT 'PR',
    
    -- UTM EPSG:31982
    coordenada_e REAL CHECK(coordenada_e >= 100000 AND coordenada_e <= 900000),
    coordenada_n REAL CHECK(coordenada_n >= 6900000 AND coordenada_n <= 7600000),
    altitude REAL,
    
    -- Geographic EPSG:4326
    latitude REAL CHECK(latitude >= -29 AND latitude <= -20),
    longitude REAL CHECK(longitude >= -57 AND longitude <= -46),
    
    -- Metadados
    data_levantamento DATE,
    metodo TEXT,
    precisao_horizontal REAL CHECK(precisao_horizontal >= 0),
    precisao_vertical REAL CHECK(precisao_vertical >= 0),
    observacoes TEXT,
    status TEXT DEFAULT 'LEVANTADO',
    
    -- Auditoria
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### marcos_pendentes

Marcos cadastrados mas ainda não levantados (sem coordenadas).

```sql
CREATE TABLE marcos_pendentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL CHECK(tipo IN ('V', 'M', 'P')),
    municipio TEXT,
    estado TEXT DEFAULT 'PR',
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### historico_alteracoes

Auditoria de todas as alterações.

```sql
CREATE TABLE historico_alteracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marco_codigo TEXT NOT NULL,
    operacao TEXT NOT NULL CHECK(operacao IN ('INSERT', 'UPDATE', 'DELETE')),
    campo_alterado TEXT,
    valor_antigo TEXT,
    valor_novo TEXT,
    usuario TEXT DEFAULT 'Sistema',
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### metadados_sistema

Controle de versão e configurações.

```sql
CREATE TABLE metadados_sistema (
    chave TEXT PRIMARY KEY,
    valor TEXT,
    descricao TEXT,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Índices

```sql
-- marcos_levantados (9 índices)
CREATE INDEX idx_ml_codigo ON marcos_levantados(codigo);
CREATE INDEX idx_ml_tipo ON marcos_levantados(tipo);
CREATE INDEX idx_ml_municipio ON marcos_levantados(municipio);
CREATE INDEX idx_ml_estado ON marcos_levantados(estado);
CREATE INDEX idx_ml_coordenadas_utm ON marcos_levantados(coordenada_e, coordenada_n);
CREATE INDEX idx_ml_coordenadas_geo ON marcos_levantados(latitude, longitude);
CREATE INDEX idx_ml_status ON marcos_levantados(status);
CREATE INDEX idx_ml_data_levantamento ON marcos_levantados(data_levantamento);
CREATE INDEX idx_ml_criado_em ON marcos_levantados(criado_em);

-- marcos_pendentes (3 índices)
CREATE INDEX idx_mp_codigo ON marcos_pendentes(codigo);
CREATE INDEX idx_mp_tipo ON marcos_pendentes(tipo);
CREATE INDEX idx_mp_municipio ON marcos_pendentes(municipio);

-- historico_alteracoes (3 índices)
CREATE INDEX idx_ha_marco_codigo ON historico_alteracoes(marco_codigo);
CREATE INDEX idx_ha_operacao ON historico_alteracoes(operacao);
CREATE INDEX idx_ha_data_hora ON historico_alteracoes(data_hora);
```

### Queries Comuns

```javascript
// Buscar marco por código
const marco = db.prepare(`
    SELECT * FROM marcos_levantados WHERE codigo = ?
`).get('FHV-M-0001');

// Buscar todos com coordenadas
const levantados = db.prepare(`
    SELECT * FROM marcos_levantados 
    WHERE latitude IS NOT NULL 
    ORDER BY codigo 
    LIMIT ?
`).all(1000);

// Estatísticas
const stats = db.prepare(`
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN tipo = 'V' THEN 1 END) as vertices,
        COUNT(CASE WHEN tipo = 'M' THEN 1 END) as marcos,
        COUNT(CASE WHEN tipo = 'P' THEN 1 END) as pontos,
        COUNT(latitude) as com_coordenadas
    FROM marcos_levantados
`).get();
```

---

## 4. BACKEND

### Inicialização

```bash
cd backend
node server.js
```

### Variáveis de Ambiente

Criar arquivo `.env` na raiz:

```env
PORT=3000
NODE_ENV=production
DB_PATH=./backend/database/marcos.db
BACKUP_PATH=./backend/backups
```

### Endpoints Principais

#### GET /api/marcos

Retorna lista de marcos.

**Query params:**
- `limite` (default: 1000): Número máximo de resultados
- `offset` (default: 0): Paginação
- `levantados` (boolean): Se `true`, retorna apenas marcos com coordenadas

**Resposta:**
```json
{
  "data": [...],
  "total": 218,
  "levantados": 218,
  "pendentes": 0
}
```

#### GET /api/marcos/:codigo

Retorna marco específico.

**Resposta:**
```json
{
  "id": 1,
  "codigo": "FHV-M-0001",
  "tipo": "M",
  "latitude": -25.424569,
  "longitude": -49.615811,
  ...
}
```

#### GET /api/estatisticas

Retorna estatísticas gerais.

**Resposta:**
```json
{
  "total": 19041,
  "levantados": 218,
  "pendentes": 18823,
  "por_tipo": {
    "V": 3313,
    "M": 6927,
    "P": 8801
  }
}
```

### Middleware

```javascript
// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// JSON
app.use(express.json());

// Static files
app.use(express.static('frontend'));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
```

---

## 5. FRONTEND

### Bibliotecas Externas

```html
<!-- Leaflet.js (Mapa) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<!-- Supercluster (Clustering) -->
<script src="https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js"></script>

<!-- Proj4js (Conversão de coordenadas) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js"></script>
```

### Funções Principais

#### carregarMarcosNoMapa()

Carrega marcos do backend e renderiza no mapa.

```javascript
async function carregarMarcosNoMapa() {
    const response = await fetch('/api/marcos?levantados=true&limite=5000');
    const result = await response.json();
    
    const features = result.data.map(m => ({
        type: 'Feature',
        properties: { codigo: m.codigo, tipo: m.tipo },
        geometry: {
            type: 'Point',
            coordinates: [m.longitude, m.latitude]
        }
    }));
    
    supercluster.load(features);
    atualizarMarcadores();
}
```

#### obterCoordenadasMarco()

Valida e retorna coordenadas de um marco.

```javascript
function obterCoordenadasMarco(marco) {
    if (marco.latitude && marco.longitude) {
        const lat = parseFloat(marco.latitude);
        const lng = parseFloat(marco.longitude);
        
        if (!isNaN(lat) && !isNaN(lng) &&
            lat >= -29 && lat <= -20 &&
            lng >= -57 && lng <= -46) {
            return { lat, lng };
        }
    }
    return null;
}
```

---

## 6. MANUTENÇÃO ROTINEIRA

### Diária

✅ **Verificar logs** do servidor (erros, warnings)  
✅ **Monitorar** uso de disco (banco pode crescer)  
✅ **Testar** endpoint de saúde: `GET /api/estatisticas`

### Semanal

✅ **Backup manual** do banco de dados  
✅ **Limpar** backups antigos (manter últimas 4 semanas)  
✅ **Verificar** relatórios de importação  
✅ **Testar** funcionalidades críticas (mapa, consulta, exportar)

### Mensal

✅ **VACUUM** no banco (compactar)  
✅ **ANALYZE** (atualizar estatísticas)  
✅ **Revisar** logs de erro acumulados  
✅ **Atualizar** dependências npm (se necessário)

### Comandos Úteis

```bash
# Backup manual
cp backend/database/marcos.db backend/backups/marcos_manual_$(date +%Y%m%d).db

# Limpar backups antigos (>30 dias)
find backend/backups -name "*.db" -mtime +30 -delete

# VACUUM e ANALYZE
node -e "const db = require('better-sqlite3')('backend/database/marcos.db'); db.exec('VACUUM'); db.exec('ANALYZE'); console.log('Otimizado!');"

# Ver tamanho do banco
du -h backend/database/marcos.db

# Contar registros
node -e "const db = require('better-sqlite3')('backend/database/marcos.db'); const r = db.prepare('SELECT COUNT(*) as total FROM marcos_levantados').get(); console.log('Total:', r.total);"
```

---

## 7. TROUBLESHOOTING

### Problemas Comuns

#### Servidor não inicia

**Sintoma:** `node server.js` retorna erro

**Causas possíveis:**
1. Porta 3000 em uso
2. Banco de dados corrompido
3. Dependências não instaladas

**Solução:**
```bash
# Verificar porta
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Reinstalar dependências
cd backend
rm -rf node_modules package-lock.json
npm install

# Restaurar backup do banco
cp backend/backups/marcos_LATEST.db backend/database/marcos.db
```

#### Mapa não carrega marcos

**Sintoma:** Mapa aparece vazio

**Causas possíveis:**
1. API não retorna dados
2. Coordenadas inválidas
3. JavaScript com erro

**Solução:**
```javascript
// No console do navegador:
fetch('/api/marcos?levantados=true&limite=10')
  .then(r => r.json())
  .then(d => console.log('Dados:', d));

// Verificar erros no console (F12)
// Verificar Network tab (F12) - requisição /api/marcos deve retornar 200
```

#### Importação falha

**Sintoma:** Erro ao importar planilha

**Causas possíveis:**
1. Formato de arquivo incorreto
2. Colunas faltando
3. Dados inválidos

**Solução:**
```bash
# Ver logs do script
cat backend/relatorios/importacao_*.txt

# Ver erros específicos
cat backend/relatorios/erros_importacao_*.csv

# Testar importação manual
cd backend
node scripts/importar-planilha-mestre.js
```

---

## 8. BACKUP E RECUPERAÇÃO

### Estratégia de Backup

```
BACKUPS AUTOMÁTICOS:
├─ Antes de cada importação
├─ Antes de cada limpeza
└─ Antes de cada reconversão

BACKUP MANUAL:
└─ Semanal (cron job recomendado)
```

### Criar Backup Manual

```bash
# Backup simples
cp backend/database/marcos.db backend/backups/marcos_$(date +%Y%m%d_%H%M%S).db

# Backup com compressão
tar -czf backend/backups/marcos_$(date +%Y%m%d).tar.gz backend/database/marcos.db

# Backup remoto (exemplo com rsync)
rsync -avz backend/database/marcos.db user@servidor:/backups/
```

### Restaurar Backup

```bash
# Parar servidor
# Ctrl+C

# Restaurar
cp backend/backups/marcos_20251020_150000.db backend/database/marcos.db

# Reiniciar servidor
cd backend && node server.js
```

### Cron Job (Linux/Mac)

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 3h)
0 3 * * * cd /caminho/para/projeto && cp backend/database/marcos.db backend/backups/marcos_$(date +\%Y\%m\%d).db
```

---

## 9. ATUALIZAÇÕES

### Atualizar Dependências

```bash
# Verificar versões desatualizadas
cd backend
npm outdated

# Atualizar minor/patch versions
npm update

# Atualizar major versions (cuidado!)
npm install better-sqlite3@latest
npm install express@latest

# Testar após atualização
npm test  # se tiver testes
node server.js  # iniciar e testar manualmente
```

### Adicionar Nova Dependência

```bash
cd backend
npm install nome-do-pacote --save

# Atualizar package.json e package-lock.json
git add package.json package-lock.json
git commit -m "Adiciona dependência nome-do-pacote"
```

### Versionamento

Seguir **Semantic Versioning** (semver.org):

- **MAJOR** (1.0.0 → 2.0.0): Mudanças incompatíveis
- **MINOR** (1.0.0 → 1.1.0): Novas funcionalidades compatíveis
- **PATCH** (1.0.0 → 1.0.1): Correções de bugs

---

## 10. MONITORAMENTO

### Métricas Importantes

#### Performance
- Tempo de resposta da API (<100ms ideal)
- Tempo de carregamento do mapa (<3s ideal)
- Uso de memória do Node.js (<512MB ideal)

#### Disponibilidade
- Uptime do servidor (>99.9% ideal)
- Erros HTTP 5xx (deve ser zero)
- Taxa de sucesso de importações (>95% ideal)

### Ferramentas Recomendadas

**Para Produção:**
- **PM2**: Gerenciador de processos Node.js
- **Nginx**: Reverse proxy
- **Logrotate**: Rotação de logs
- **Prometheus + Grafana**: Monitoramento e dashboards

**Para Desenvolvimento:**
- **Nodemon**: Auto-restart no desenvolvimento
- **Chrome DevTools**: Debug frontend
- **Postman**: Testar API

### Configurar PM2 (Produção)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start backend/server.js --name "marcos-geodesicos"

# Configurar inicialização automática
pm2 startup
pm2 save

# Comandos úteis
pm2 status
pm2 logs marcos-geodesicos
pm2 restart marcos-geodesicos
pm2 stop marcos-geodesicos
```

---

## 📋 CHECKLIST DE MANUTENÇÃO

### Diário
- [ ] Verificar logs de erro
- [ ] Confirmar servidor rodando
- [ ] Testar endpoint `/api/estatisticas`

### Semanal
- [ ] Backup manual do banco
- [ ] Limpar logs antigos
- [ ] Testar funcionalidades principais

### Mensal
- [ ] VACUUM + ANALYZE no banco
- [ ] Revisar uso de disco
- [ ] Verificar atualizações de segurança
- [ ] Limpar backups >30 dias

### Trimestral
- [ ] Atualizar dependências npm
- [ ] Revisar documentação
- [ ] Planejar melhorias
- [ ] Treinar novos usuários

---

**Versão do Guia:** 1.0  
**Data:** Outubro 2025  
**Próxima revisão:** Janeiro 2026
