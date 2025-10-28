const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });
const { query, transaction, healthCheck } = require('./database/postgres-connection');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// ============================================
// ENDPOINT: Health Check
// ============================================

app.get('/api/health', async (req, res) => {
    try {
        const health = await healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

// ============================================
// ENDPOINT: Estatísticas
// ============================================

app.get('/api/estatisticas', async (req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*) as total_marcos,
                COUNT(CASE WHEN geom IS NOT NULL THEN 1 END) as marcos_levantados,
                COUNT(CASE WHEN geom IS NULL THEN 1 END) as marcos_pendentes,
                COUNT(CASE WHEN tipo = 'V' THEN 1 END) as tipo_v,
                COUNT(CASE WHEN tipo = 'M' THEN 1 END) as tipo_m,
                COUNT(CASE WHEN tipo = 'P' THEN 1 END) as tipo_p,
                ROUND(
                    (COUNT(CASE WHEN geom IS NOT NULL THEN 1 END)::NUMERIC /
                    NULLIF(COUNT(*)::NUMERIC, 0) * 100), 2
                ) as percentual_levantados
            FROM marcos_levantados
        `);

        const stats = result.rows[0];

        res.json({
            total_marcos: parseInt(stats.total_marcos),
            marcos_levantados: parseInt(stats.marcos_levantados),
            marcos_pendentes: parseInt(stats.marcos_pendentes),
            por_tipo: {
                V: parseInt(stats.tipo_v),
                M: parseInt(stats.tipo_m),
                P: parseInt(stats.tipo_p)
            },
            percentual_levantados: parseFloat(stats.percentual_levantados)
        });
    } catch (error) {
        console.error('Erro em /api/estatisticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// ============================================
// ENDPOINT: Listar Marcos
// ============================================

app.get('/api/marcos', async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite) || 1000, 10000);
        const offset = parseInt(req.query.offset) || 0;
        const levantados = req.query.levantados === 'true';

        let whereClause = '1=1';
        if (levantados) {
            whereClause = 'geom IS NOT NULL';
        }

        const result = await query(`
            SELECT
                id, codigo, tipo, municipio, estado,
                coordenada_e, coordenada_n, altitude,
                latitude, longitude,
                ST_AsGeoJSON(geom)::json as geojson,
                data_levantamento, metodo,
                precisao_horizontal, precisao_vertical,
                observacoes, status,
                criado_em, atualizado_em
            FROM marcos_levantados
            WHERE ${whereClause}
            ORDER BY codigo
            LIMIT $1 OFFSET $2
        `, [limite, offset]);

        const countResult = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN geom IS NOT NULL THEN 1 END) as levantados,
                COUNT(CASE WHEN geom IS NULL THEN 1 END) as pendentes
            FROM marcos_levantados
        `);

        res.json({
            data: result.rows,
            total: parseInt(countResult.rows[0].total),
            levantados: parseInt(countResult.rows[0].levantados),
            pendentes: parseInt(countResult.rows[0].pendentes),
            limite: limite,
            offset: offset
        });
    } catch (error) {
        console.error('Erro em /api/marcos:', error);
        res.status(500).json({ error: 'Erro ao buscar marcos' });
    }
});

// ============================================
// ENDPOINT NOVO: Busca por Raio (ANTES de /:codigo)
// ============================================

app.get('/api/marcos/raio/:lat/:lng/:raio', async (req, res) => {
    try {
        const lat = parseFloat(req.params.lat);
        const lng = parseFloat(req.params.lng);
        const raio = parseFloat(req.params.raio);

        if (isNaN(lat) || isNaN(lng) || isNaN(raio)) {
            return res.status(400).json({ error: 'Parâmetros inválidos' });
        }

        const result = await query(`
            SELECT
                codigo, tipo, municipio,
                latitude, longitude,
                ST_AsGeoJSON(geom)::json as geojson,
                ROUND(
                    ST_Distance(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                    )::numeric,
                    2
                ) as distancia_metros
            FROM marcos_levantados
            WHERE geom IS NOT NULL
              AND ST_DWithin(
                  geom::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            )
        `, [lat, lng, raio]);

        res.json({
            centro: { lat, lng },
            raio_metros: raio,
            total_encontrados: result.rows.length,
            marcos: result.rows
        });
    } catch (error) {
        console.error('Erro em /api/marcos/raio:', error);
        res.status(500).json({ error: 'Erro na busca por raio' });
    }
});

// ============================================
// ENDPOINT NOVO: Busca por BBox (Retângulo)
// ============================================

app.get('/api/marcos/bbox', async (req, res) => {
    try {
        const { minLat, minLng, maxLat, maxLng } = req.query;

        if (!minLat || !minLng || !maxLat || !maxLng) {
            return res.status(400).json({ error: 'Parâmetros bbox obrigatórios' });
        }

        const result = await query(`
            SELECT
                codigo, tipo, municipio,
                latitude, longitude,
                ST_AsGeoJSON(geom)::json as geojson
            FROM marcos_levantados
            WHERE geom IS NOT NULL
              AND ST_Contains(
                  ST_MakeEnvelope($1, $2, $3, $4, 4326),
                  geom
              )
            ORDER BY codigo
        `, [parseFloat(minLng), parseFloat(minLat), parseFloat(maxLng), parseFloat(maxLat)]);

        res.json({
            bbox: { minLat, minLng, maxLat, maxLng },
            total_encontrados: result.rows.length,
            marcos: result.rows
        });
    } catch (error) {
        console.error('Erro em /api/marcos/bbox:', error);
        res.status(500).json({ error: 'Erro na busca por bbox' });
    }
});

// ============================================
// ENDPOINT NOVO: GeoJSON Collection
// ============================================

app.get('/api/marcos/geojson', async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite) || 1000, 10000);

        const result = await query(`
            SELECT
                jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(geom)::jsonb,
                            'properties', jsonb_build_object(
                                'codigo', codigo,
                                'tipo', tipo,
                                'municipio', municipio,
                                'estado', estado,
                                'altitude', altitude
                            )
                        )
                    )
                ) as geojson
            FROM (
                SELECT * FROM marcos_levantados
                WHERE geom IS NOT NULL
                ORDER BY codigo
                LIMIT $1
            ) subquery
        `, [limite]);

        res.json(result.rows[0].geojson);
    } catch (error) {
        console.error('Erro em /api/marcos/geojson:', error);
        res.status(500).json({ error: 'Erro ao gerar GeoJSON' });
    }
});

// ============================================
// ENDPOINT: Buscar com Filtros
// ============================================

app.get('/api/marcos/buscar', async (req, res) => {
    try {
        const { tipo, municipio, estado, status } = req.query;

        const conditions = [];
        const params = [];
        let paramCount = 1;

        if (tipo) {
            conditions.push(`tipo = $${paramCount++}`);
            params.push(tipo);
        }

        if (municipio) {
            conditions.push(`municipio ILIKE $${paramCount++}`);
            params.push(`%${municipio}%`);
        }

        if (estado) {
            conditions.push(`estado = $${paramCount++}`);
            params.push(estado);
        }

        if (status) {
            conditions.push(`status = $${paramCount++}`);
            params.push(status);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const result = await query(`
            SELECT
                id, codigo, tipo, municipio, estado,
                latitude, longitude,
                ST_AsGeoJSON(geom)::json as geojson,
                status
            FROM marcos_levantados
            ${whereClause}
            ORDER BY codigo
            LIMIT 1000
        `, params);

        res.json({
            filtros: { tipo, municipio, estado, status },
            total: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erro em /api/marcos/buscar:', error);
        res.status(500).json({ error: 'Erro na busca' });
    }
});

// ============================================
// ENDPOINT: Exportar Excel (compatibilidade)
// ============================================

app.get('/api/marcos/exportar', async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM marcos_levantados ORDER BY codigo
        `);

        // Aqui você pode adicionar lógica de exportação Excel se necessário
        // Por enquanto, retorna JSON
        res.json({
            total: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Erro em /api/marcos/exportar:', error);
        res.status(500).json({ error: 'Erro ao exportar dados' });
    }
});

// ============================================
// ENDPOINT: Buscar Marco por Código (ÚLTIMO)
// ============================================

app.get('/api/marcos/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;

        const result = await query(`
            SELECT
                id, codigo, tipo, municipio, estado,
                coordenada_e, coordenada_n, altitude,
                latitude, longitude,
                ST_AsGeoJSON(geom)::json as geojson,
                data_levantamento, metodo,
                precisao_horizontal, precisao_vertical,
                observacoes, status,
                criado_em, atualizado_em
            FROM marcos_levantados
            WHERE codigo = $1
        `, [codigo]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Marco não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro em /api/marcos/:codigo:', error);
        res.status(500).json({ error: 'Erro ao buscar marco' });
    }
});

// ============================================
// ROTAS: CLIENTES E PROPRIEDADES
// ============================================

// Rotas de Clientes
const clientesRoutes = require('./routes/clientes');
app.use('/api/clientes', clientesRoutes);

// Rotas de Propriedades
const propriedadesRoutes = require('./routes/propriedades');
app.use('/api/propriedades', propriedadesRoutes);

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 SERVIDOR POSTGRESQL + POSTGIS INICIADO');
    console.log('='.repeat(60));
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🐘 PostgreSQL: localhost:5433`);
    console.log(`📅 Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(60) + '\n');

    // Health check inicial
    healthCheck().then(health => {
        if (health.status === 'OK') {
            console.log('✅ PostgreSQL conectado');
            console.log(`🐘 Versão: ${health.version}\n`);
        } else {
            console.error('❌ Falha ao conectar PostgreSQL:', health.error);
        }
    });
});

module.exports = app;
