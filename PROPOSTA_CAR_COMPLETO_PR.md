# 🌾 PROPOSTA: BASE COMPLETA CAR-PR NO BANCO DE DADOS

## 📊 DIAGNÓSTICO

### Problema Atual:
- ✅ **SIGEF:** Base completa do Paraná no banco (atualização automática)
- ✅ **Hidrografia:** Base completa do Paraná no banco (atualização a cada 3 meses)
- ❌ **CAR:** Download SOB DEMANDA via API (incompleto e ineficiente)

### Por que o Atual NÃO Funciona:
1. **Download sob demanda** - Só baixa quando identifica confrontante com CAR
2. **Dados incompletos** - GeoPR WFS expõe apenas `area_imovel_car` (perímetro)
3. **Não testável** - Difícil validar se realmente funciona
4. **Inconsistente** - SIGEF e Hidrografia estão completos, mas CAR não

---

## 🎯 OBJETIVO

**Ter a BASE COMPLETA do CAR do Paraná no banco de dados**, similar ao que já temos para SIGEF e Hidrografia.

**Benefícios:**
- ✅ Análise fundiária mais rica e completa
- ✅ Identificação automática de confrontantes CAR
- ✅ Dados sempre disponíveis (não depende de API externa)
- ✅ Performance superior (consultas locais)
- ✅ Consistência com SIGEF e Hidrografia

---

## 🔍 PESQUISA DE FONTES DISPONÍVEIS

### OPÇÃO 1: GeoPR WFS (IAT-PR) ⭐ RECOMENDADA FASE 1

**URL:** `https://geoserver.pr.gov.br/geoserver/wfs`

**Camada:** `base_geo:area_imovel_car`

**Vantagens:**
- ✅ Oficial do estado do Paraná (IAT - Instituto Água e Terra)
- ✅ Mesma infraestrutura que já usamos
- ✅ WFS robusto e confiável
- ✅ Dados em EPSG:31982 (SIRGAS 2000 UTM 22S)
- ✅ Atualização regular pelo estado
- ✅ Download rápido (requisição única)

**Limitações:**
- ⚠️ Apenas **área do imóvel** (perímetro/polígono principal)
- ❌ Não inclui: Reserva Legal, APP, Uso do Solo, Vegetação Nativa, Hidrografia do imóvel

**Dados Disponíveis:**
```json
{
  "codigo_car": "PR-4104907-ABC123...",
  "municipio": "Castro",
  "area_ha": 2228.47,
  "situacao": "Ativo",
  "data_cadastro": "2020-05-15",
  "geometry": {...}  // Polígono em EPSG:31982
}
```

---

### OPÇÃO 2: Biblioteca Python SICAR ⭐ RECOMENDADA FASE 2

**Repositório:** https://github.com/urbanogilson/SICAR

**Vantagens:**
- ✅ Open source e gratuito
- ✅ Download de **TODAS as camadas** do CAR:
  - Área do imóvel (perímetro)
  - Reserva Legal
  - APP (Área de Preservação Permanente)
  - Uso do Solo
  - Vegetação Nativa
  - Hidrografia do imóvel
  - Áreas Consolidadas
- ✅ Comunidade ativa (800+ stars no GitHub)
- ✅ Suporte a captcha automático
- ✅ Download por estado completo

**Desvantagens:**
- ⚠️ Requer Python instalado
- ⚠️ Download mais lento (múltiplas requisições)
- ⚠️ Sistema SICAR frequentemente fora do ar

**Exemplo de Uso:**
```python
from SICAR import Sicar, State

car = Sicar()

# Download completo do Paraná (todas as camadas)
car.download_state(
    state=State.PR,
    output_folder='data/car/PR',
    layers=['area', 'reserva_legal', 'app', 'uso_solo', 'vegetacao']
)
```

---

### OPÇÃO 3: Download Manual (NÃO RECOMENDADA)

**URL:** https://www.car.gov.br/publico/estados/downloads

**Vantagens:**
- ✅ Interface oficial do governo federal
- ✅ Todas as camadas disponíveis

**Desvantagens:**
- ❌ Requer download manual
- ❌ Captcha obrigatório
- ❌ Não automatizável
- ❌ Sistema frequentemente indisponível

---

## 🏆 ESTRATÉGIA RECOMENDADA

### ABORDAGEM HÍBRIDA (Fases Incrementais)

#### **FASE 1 (IMEDIATO) - GeoPR WFS:**
Download completo da base CAR-PR via WFS do GeoPR

**O que teremos:**
- ✅ Todos os imóveis CAR do Paraná no banco
- ✅ Área e perímetro dos imóveis
- ✅ Código CAR, município, situação
- ✅ Geometria completa em EPSG:31982
- ✅ Atualização automática (igual SIGEF)

**O que NÃO teremos ainda:**
- ❌ Reserva Legal
- ❌ APP
- ❌ Uso do Solo

#### **FASE 2 (FUTURO) - Python SICAR:**
Complementar com camadas adicionais via biblioteca Python

**O que teremos:**
- ✅ Reserva Legal
- ✅ APP
- ✅ Uso do Solo
- ✅ Vegetação Nativa
- ✅ Hidrografia do imóvel

**Quando executar:**
- Mensalmente (ou a pedido)
- Processo assíncrono em background

---

## 💻 IMPLEMENTAÇÃO TÉCNICA - FASE 1

### 1. Estrutura de Banco de Dados

```sql
-- Tabela principal CAR (similar a sigef_parcelas)
CREATE TABLE IF NOT EXISTS car_imoveis (
    id SERIAL PRIMARY KEY,
    codigo_car VARCHAR(50) UNIQUE NOT NULL,
    municipio VARCHAR(100),
    uf CHAR(2) DEFAULT 'PR',
    area_ha NUMERIC(12, 4),
    area_m2 NUMERIC(12, 2),
    perimetro_m NUMERIC(12, 2),
    situacao VARCHAR(50),  -- Ativo, Pendente, Cancelado
    data_cadastro DATE,
    data_atualizacao DATE,
    proprietario VARCHAR(200),  -- Disponível em alguns casos
    cpf_cnpj VARCHAR(20),       -- Pode ser NULL (dado restrito)
    geometry GEOMETRY(Polygon, 31982),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_car_codigo ON car_imoveis(codigo_car);
CREATE INDEX idx_car_municipio ON car_imoveis(municipio);
CREATE INDEX idx_car_geom ON car_imoveis USING GIST(geometry);
CREATE INDEX idx_car_situacao ON car_imoveis(situacao);

-- Tabela de controle de downloads
CREATE TABLE IF NOT EXISTS car_downloads (
    id SERIAL PRIMARY KEY,
    estado CHAR(2) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'area_imovel',
    status VARCHAR(50) DEFAULT 'pendente',  -- pendente, processando, concluido, erro
    data_download TIMESTAMP,
    total_registros INTEGER,
    arquivo_nome VARCHAR(255),
    arquivo_tamanho BIGINT,
    erro_mensagem TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estado, tipo)
);
```

### 2. Módulo Downloader (car-pr-downloader.js)

```javascript
const fetch = require('node-fetch');
const { Pool } = require('pg');

class CARPRDownloader {
    constructor(pool) {
        this.pool = pool;
        this.wfsUrl = 'https://geoserver.pr.gov.br/geoserver/wfs';
        this.layerName = 'base_geo:area_imovel_car';
        this.srsName = 'EPSG:31982';
    }

    async downloadCompleto() {
        console.log('🌾 Iniciando download completo CAR-PR...');

        const client = await this.pool.connect();

        try {
            // 1. Registrar início do download
            await client.query(`
                INSERT INTO car_downloads (estado, tipo, status, data_download)
                VALUES ('PR', 'area_imovel', 'processando', CURRENT_TIMESTAMP)
                ON CONFLICT (estado, tipo) DO UPDATE SET
                    status = 'processando',
                    data_download = CURRENT_TIMESTAMP,
                    total_registros = NULL,
                    erro_mensagem = NULL
            `);

            // 2. Fazer requisição WFS GetFeature (todos os imóveis CAR-PR)
            const wfsRequest = `${this.wfsUrl}?` +
                `service=WFS&` +
                `version=2.0.0&` +
                `request=GetFeature&` +
                `typeName=${this.layerName}&` +
                `outputFormat=application/json&` +
                `srsName=${this.srsName}`;

            console.log('📥 Baixando dados do GeoPR...');
            const response = await fetch(wfsRequest, { timeout: 300000 }); // 5 min

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const geojson = await response.json();
            const features = geojson.features || [];

            console.log(`✅ ${features.length} imóveis CAR baixados`);

            // 3. Inserir/atualizar no banco (em lote)
            let inseridos = 0;
            let atualizados = 0;

            await client.query('BEGIN');

            for (const feature of features) {
                const props = feature.properties;
                const geom = feature.geometry;

                const result = await client.query(`
                    INSERT INTO car_imoveis (
                        codigo_car, municipio, uf, area_ha, area_m2,
                        situacao, data_cadastro, geometry
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7,
                        ST_GeomFromGeoJSON($8)
                    )
                    ON CONFLICT (codigo_car) DO UPDATE SET
                        municipio = EXCLUDED.municipio,
                        area_ha = EXCLUDED.area_ha,
                        area_m2 = EXCLUDED.area_m2,
                        situacao = EXCLUDED.situacao,
                        geometry = EXCLUDED.geometry,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING (xmax = 0) AS inserted
                `, [
                    props.codigo_car || props.cod_imovel,
                    props.municipio || props.nome_municipio,
                    'PR',
                    props.area_ha || (props.area_m2 / 10000),
                    props.area_m2 || (props.area_ha * 10000),
                    props.situacao || props.ind_status || 'Ativo',
                    props.data_cadastro || null,
                    JSON.stringify(geom)
                ]);

                if (result.rows[0].inserted) {
                    inseridos++;
                } else {
                    atualizados++;
                }
            }

            await client.query('COMMIT');

            // 4. Atualizar status do download
            await client.query(`
                UPDATE car_downloads
                SET status = 'concluido',
                    total_registros = $1
                WHERE estado = 'PR' AND tipo = 'area_imovel'
            `, [features.length]);

            console.log(`✅ Download CAR-PR concluído!`);
            console.log(`   📊 Total: ${features.length} imóveis`);
            console.log(`   ➕ Inseridos: ${inseridos}`);
            console.log(`   🔄 Atualizados: ${atualizados}`);

            return {
                sucesso: true,
                total: features.length,
                inseridos,
                atualizados
            };

        } catch (error) {
            await client.query('ROLLBACK');

            // Registrar erro
            await client.query(`
                UPDATE car_downloads
                SET status = 'erro',
                    erro_mensagem = $1
                WHERE estado = 'PR' AND tipo = 'area_imovel'
            `, [error.message]);

            console.error('❌ Erro ao baixar CAR-PR:', error);
            throw error;

        } finally {
            client.release();
        }
    }

    async getUltimaAtualizacao() {
        const result = await this.pool.query(`
            SELECT data_download, total_registros, status
            FROM car_downloads
            WHERE estado = 'PR' AND tipo = 'area_imovel'
            ORDER BY data_download DESC
            LIMIT 1
        `);

        return result.rows[0] || null;
    }

    async getEstatisticas() {
        const result = await this.pool.query(`
            SELECT
                COUNT(*) as total_imoveis,
                COUNT(DISTINCT municipio) as total_municipios,
                SUM(area_ha) as area_total_ha,
                COUNT(CASE WHEN situacao = 'Ativo' THEN 1 END) as ativos,
                COUNT(CASE WHEN situacao = 'Pendente' THEN 1 END) as pendentes,
                COUNT(CASE WHEN situacao = 'Cancelado' THEN 1 END) as cancelados
            FROM car_imoveis
            WHERE uf = 'PR'
        `);

        return result.rows[0];
    }
}

module.exports = CARPRDownloader;
```

### 3. Integração com servidor (server-postgres.js)

```javascript
// Inicializar downloader CAR-PR
const CARPRDownloader = require('./car-pr-downloader');
const carDownloader = new CARPRDownloader(pool);

// Sincronização automática ao iniciar servidor
async function sincronizarDados() {
    console.log('\n============================================================');
    console.log('🔄 INICIANDO SINCRONIZAÇÃO AUTOMÁTICA DE DADOS');
    console.log('============================================================\n');

    // 1. CAR-PR
    console.log('📦 [1/3] Sincronizando dados CAR-PR...');
    try {
        const ultimaAtualizacao = await carDownloader.getUltimaAtualizacao();

        if (!ultimaAtualizacao) {
            console.log('   🔄 Primeira sincronização CAR-PR');
            await carDownloader.downloadCompleto();
        } else {
            const diasDesdeAtualizacao = Math.floor(
                (Date.now() - new Date(ultimaAtualizacao.data_download)) / (1000 * 60 * 60 * 24)
            );

            console.log(`   ℹ️  Última sincronização: ${diasDesdeAtualizacao} dias atrás`);

            if (diasDesdeAtualizacao >= 7) {
                console.log('   🔄 Atualizando dados CAR-PR...');
                await carDownloader.downloadCompleto();
            } else {
                console.log('   ⏭️  Sincronização recente, pulando...');
            }
        }
    } catch (error) {
        console.error('   ❌ Erro ao sincronizar CAR-PR:', error.message);
    }

    // 2. SIGEF (já existe)
    // 3. Hidrografia (já existe)

    console.log('\n============================================================');
    console.log('✅ SINCRONIZAÇÃO AUTOMÁTICA CONCLUÍDA');
    console.log('============================================================\n');
}

// Endpoint manual para forçar sincronização
app.get('/api/car/sincronizar-pr', async (req, res) => {
    try {
        console.log('🔄 Sincronização manual CAR-PR solicitada');
        const resultado = await carDownloader.downloadCompleto();
        res.json({
            success: true,
            message: 'Sincronização CAR-PR concluída',
            ...resultado
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao sincronizar CAR-PR',
            error: error.message
        });
    }
});

// Endpoint para estatísticas
app.get('/api/car/estatisticas-pr', async (req, res) => {
    try {
        const stats = await carDownloader.getEstatisticas();
        const ultimaAtualizacao = await carDownloader.getUltimaAtualizacao();

        res.json({
            success: true,
            estatisticas: stats,
            ultima_atualizacao: ultimaAtualizacao
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

### 4. Atualização da Análise Fundiária

Com a base completa no banco, a identificação de confrontantes CAR será AUTOMÁTICA:

```javascript
// backend/spatial-analyzer.js - Método atualizado

async identificarConfrontantes(propriedadeId, distanciaMaxima = 500) {
    // ... código existente para SIGEF ...

    // NOVO: Buscar confrontantes CAR
    const carResult = await this.pool.query(`
        SELECT
            c.id,
            c.codigo_car,
            c.municipio,
            c.area_ha,
            c.situacao,
            'CAR' as fonte,
            ST_Distance(p.geometry, c.geometry) as distancia,
            ST_Intersects(p.geometry, c.geometry) as intersecta
        FROM propriedades p
        CROSS JOIN car_imoveis c
        WHERE p.id = $1
            AND ST_DWithin(p.geometry, c.geometry, $2)
            AND c.situacao = 'Ativo'
        ORDER BY distancia
    `, [propriedadeId, distanciaMaxima]);

    const confrontantesCAR = carResult.rows.map(row => ({
        id: row.id,
        codigo_car: row.codigo_car,
        nome_proprietario: `Imóvel CAR - ${row.municipio}`,
        tipo_confrontacao: row.intersecta ? 'Sobreposição' : 'Próximo',
        municipio: row.municipio,
        area_ha: parseFloat(row.area_ha),
        distancia_m: parseFloat(row.distancia),
        fonte: 'CAR'
    }));

    // Combinar confrontantes SIGEF + CAR
    return {
        sucesso: true,
        confrontantes: [...confrontantesSIGEF, ...confrontantesCAR],
        total_sigef: confrontantesSIGEF.length,
        total_car: confrontantesCAR.length
    };
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1 - Base CAR-PR Completa:

- [ ] 1. Criar migrations do banco de dados
  - [ ] Tabela `car_imoveis`
  - [ ] Tabela `car_downloads`
  - [ ] Índices espaciais e de texto

- [ ] 2. Criar módulo `car-pr-downloader.js`
  - [ ] Classe CARPRDownloader
  - [ ] Método downloadCompleto()
  - [ ] Métodos de estatísticas

- [ ] 3. Integrar com server-postgres.js
  - [ ] Sincronização automática ao iniciar
  - [ ] Endpoint GET /api/car/sincronizar-pr
  - [ ] Endpoint GET /api/car/estatisticas-pr

- [ ] 4. Atualizar spatial-analyzer.js
  - [ ] Incluir confrontantes CAR na análise
  - [ ] Combinar resultados SIGEF + CAR

- [ ] 5. Atualizar frontend
  - [ ] Exibir confrontantes CAR no mapa
  - [ ] Diferenciar visualmente (cor diferente)
  - [ ] Mostrar estatísticas CAR no dashboard

- [ ] 6. Testar funcionalidade completa
  - [ ] Download inicial
  - [ ] Análise fundiária com CAR
  - [ ] Visualização no mapa
  - [ ] Relatórios incluindo CAR

---

## 📊 RESULTADO ESPERADO

### Após Implementação:

**Dashboard:**
```
📊 Base de Dados
├── SIGEF PR: 150.577 parcelas ✅
├── Hidrografia PR: 45.230 elementos ✅
└── CAR PR: ~350.000 imóveis ✅ (NOVO!)
```

**Análise Fundiária:**
```
🔍 Propriedade: PERIMETRO F. CAPOEIRINHA
├── Confrontantes SIGEF: 8 ✅
├── Confrontantes CAR: 15 ✅ (NOVO!)
└── Score de viabilidade: 85/100
```

**Performance:**
- ✅ Identificação automática de confrontantes CAR
- ✅ Dados sempre disponíveis (consulta local)
- ✅ Análise mais rica e completa
- ✅ Consistência com SIGEF e Hidrografia

---

## ⏱️ CRONOGRAMA

| **Fase** | **Tarefa** | **Tempo Estimado** |
|---------|-----------|-------------------|
| 1 | Criar migrations banco de dados | 30 min |
| 2 | Desenvolver car-pr-downloader.js | 2 horas |
| 3 | Integrar com server-postgres.js | 1 hora |
| 4 | Atualizar spatial-analyzer.js | 1 hora |
| 5 | Atualizar frontend | 1 hora |
| 6 | Testes completos | 1 hora |
| **TOTAL** | **FASE 1 COMPLETA** | **~6-7 horas** |

---

## 🎯 CONCLUSÃO

Esta proposta implementa uma **base completa do CAR-PR no banco de dados**, consistente com SIGEF e Hidrografia que já temos.

**Vantagens Finais:**
- ✅ Dados completos e testáveis
- ✅ Performance superior
- ✅ Análise fundiária mais rica
- ✅ Identificação automática de confrontantes CAR
- ✅ Atualização automática semanal
- ✅ Consistência com sistemas existentes

**Próximos Passos:**
1. Aprovar a proposta
2. Implementar FASE 1 (6-7 horas)
3. Testar com propriedades reais
4. Planejar FASE 2 (Python SICAR) para camadas adicionais
