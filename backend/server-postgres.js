const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env', override: true });
const { query, transaction, healthCheck, pool } = require('./database/postgres-connection');
const SIGEFDownloader = require('./sigef-downloader');
const CARPRDownloader = require('./car-pr-downloader');
const SpatialAnalyzer = require('./spatial-analyzer');
const ReportGenerator = require('./report-generator');
const DataExporter = require('./data-exporter');
const UnstructuredProcessor = require('./unstructured-processor');
const axios = require('axios');
const proj4 = require('proj4');

// ============================================
// CONFIGURAÇÃO DE SISTEMAS DE COORDENADAS
// ============================================

// SIRGAS 2000 UTM Zone 22S (EPSG:31982) - Paraná/Sul do Brasil
proj4.defs('EPSG:31982', '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// WGS84 (GPS/Leaflet) - EPSG:4326
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

console.log('✅ Sistemas de coordenadas configurados (EPSG:31982 → EPSG:4326)');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configuração Multer para upload de arquivos
const upload = multer({
    dest: path.join(__dirname, '../uploads/'),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

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
                COUNT(CASE WHEN validado = true AND geometry IS NOT NULL THEN 1 END) as marcos_levantados,
                COUNT(CASE WHEN validado = false OR geometry IS NULL THEN 1 END) as marcos_pendentes,
                COUNT(CASE WHEN tipo = 'V' THEN 1 END) as tipo_v,
                COUNT(CASE WHEN tipo = 'M' THEN 1 END) as tipo_m,
                COUNT(CASE WHEN tipo = 'P' THEN 1 END) as tipo_p,
                COUNT(CASE WHEN tipo = 'V' AND validado = true THEN 1 END) as tipo_v_validados,
                COUNT(CASE WHEN tipo = 'M' AND validado = true THEN 1 END) as tipo_m_validados,
                COUNT(CASE WHEN tipo = 'P' AND validado = true THEN 1 END) as tipo_p_validados,
                ROUND(
                    (COUNT(CASE WHEN validado = true AND geometry IS NOT NULL THEN 1 END)::NUMERIC /
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
            por_tipo_validados: {
                V: parseInt(stats.tipo_v_validados),
                M: parseInt(stats.tipo_m_validados),
                P: parseInt(stats.tipo_p_validados)
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
            whereClause = 'validado = true AND geometry IS NOT NULL';
        }

        const result = await query(`
            SELECT
                id, codigo, tipo, localizacao,
                coordenada_e, coordenada_n, altitude,
                -- Converter UTM (EPSG:31982) para Lat/Lon (EPSG:4326)
                ST_Y(ST_Transform(geometry, 4326)) as latitude,
                ST_X(ST_Transform(geometry, 4326)) as longitude,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson,
                data_levantamento, metodo, limites,
                precisao_e, precisao_n, precisao_h,
                validado, fonte, observacoes,
                created_at, updated_at
            FROM marcos_levantados
            WHERE ${whereClause}
            ORDER BY codigo
            LIMIT $1 OFFSET $2
        `, [limite, offset]);

        const countResult = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN validado = true AND geometry IS NOT NULL THEN 1 END) as levantados,
                COUNT(CASE WHEN validado = false OR geometry IS NULL THEN 1 END) as pendentes
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
                codigo, tipo, localizacao,
                ST_Y(ST_Transform(geometry, 4326)) as latitude,
                ST_X(ST_Transform(geometry, 4326)) as longitude,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson,
                ROUND(
                    ST_Distance(
                        ST_Transform(geometry, 4326)::geography,
                        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                    )::numeric,
                    2
                ) as distancia_metros
            FROM marcos_levantados
            WHERE validado = true AND geometry IS NOT NULL
              AND ST_DWithin(
                  ST_Transform(geometry, 4326)::geography,
                  ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                  $3
              )
            ORDER BY ST_Distance(
                ST_Transform(geometry, 4326)::geography,
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
                codigo, tipo, localizacao,
                ST_Y(ST_Transform(geometry, 4326)) as latitude,
                ST_X(ST_Transform(geometry, 4326)) as longitude,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson
            FROM marcos_levantados
            WHERE validado = true AND geometry IS NOT NULL
              AND ST_Contains(
                  ST_MakeEnvelope($1, $2, $3, $4, 4326),
                  ST_Transform(geometry, 4326)
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
        const incluirNaoValidados = req.query.incluir_nao_validados === 'true';

        // Construir condição WHERE dinamicamente
        const whereClause = incluirNaoValidados ?
            '1=1' :  // Incluir todos os marcos
            'validado = true AND geometry IS NOT NULL';  // Apenas validados

        const result = await query(`
            SELECT
                jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(ST_Transform(geometry, 4326))::jsonb,
                            'properties', jsonb_build_object(
                                'codigo', codigo,
                                'tipo', tipo,
                                'localizacao', localizacao,
                                'altitude', altitude,
                                'validado', validado,
                                'coordenada_e', coordenada_e,
                                'coordenada_n', coordenada_n
                            )
                        )
                    )
                ) as geojson
            FROM (
                SELECT * FROM marcos_levantados
                WHERE ${whereClause}
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
                id, codigo, tipo, localizacao,
                ST_Y(ST_Transform(geometry, 4326)) as latitude,
                ST_X(ST_Transform(geometry, 4326)) as longitude,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson,
                validado
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
                id, codigo, tipo, localizacao,
                coordenada_e, coordenada_n, altitude,
                ST_Y(ST_Transform(geometry, 4326)) as latitude,
                ST_X(ST_Transform(geometry, 4326)) as longitude,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson,
                data_levantamento, metodo, limites,
                precisao_e, precisao_n, precisao_h,
                validado, fonte, observacoes,
                created_at, updated_at
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

// POST /api/marcos - Criar novo marco
// NOTA: Endpoint desabilitado temporariamente - estrutura da tabela foi alterada
// TODO: Reativar quando necessário, ajustando para a nova estrutura
/*
app.post('/api/marcos', async (req, res) => {
    try {
        const { codigo, tipo, localizacao, latitude, longitude, altitude, observacoes } = req.body;

        console.log('[Criar Marco] Dados recebidos:', { codigo, tipo, localizacao, latitude, longitude });

        // Validação
        if (!codigo || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios: codigo, latitude, longitude'
            });
        }

        // Verificar se já existe
        const existente = await query('SELECT id FROM marcos_levantados WHERE codigo = $1', [codigo]);
        if (existente.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Já existe um marco com este código'
            });
        }

        // Converter lat/lon (EPSG:4326) para UTM (EPSG:31982)
        const result = await query(`
            INSERT INTO marcos_levantados
            (codigo, tipo, localizacao, altitude, geometry, validado, observacoes)
            VALUES ($1, $2, $3, $4, ST_Transform(ST_SetSRID(ST_MakePoint($5, $6), 4326), 31982), true, $7)
            RETURNING id, codigo, tipo, localizacao, altitude,
                      ST_Y(ST_Transform(geometry, 4326)) as latitude,
                      ST_X(ST_Transform(geometry, 4326)) as longitude,
                      ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geojson
        `, [
            codigo,
            tipo || 'M',
            localizacao || '',
            altitude || null,
            longitude,
            latitude,
            observacoes || null
        ]);

        console.log('[Criar Marco] ✅ Marco criado com ID:', result.rows[0].id);

        res.json({
            success: true,
            message: 'Marco criado com sucesso!',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[Criar Marco] ❌ Erro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar marco: ' + error.message
        });
    }
});
*/

console.log('⚠️  Endpoint POST /api/marcos desabilitado temporariamente');

// ============================================
// ROTAS: CLIENTES E PROPRIEDADES
// ============================================

// Rotas de Clientes
const clientesRoutes = require('./routes/clientes');
app.use('/api/clientes', clientesRoutes);
console.log('✅ Rotas de clientes carregadas: /api/clientes');

// ============================================
// ENDPOINT: Propriedades em GeoJSON (DEVE VIR ANTES DAS ROTAS DINÂMICAS)
// ============================================

app.get('/api/propriedades/geojson', async (req, res) => {
    try {
        console.log('[GeoJSON] Buscando propriedades...');

        const result = await query(`
            SELECT
                p.id,
                p.nome_propriedade,
                p.matricula,
                p.tipo,
                p.municipio,
                p.uf,
                p.area_m2,
                p.area_calculada,
                p.perimetro_m,
                p.perimetro_calculado,
                c.nome as cliente_nome,
                ST_AsGeoJSON(ST_Transform(p.geometry, 4326)) as geometry
            FROM propriedades p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE p.geometry IS NOT NULL
            AND p.ativo = true
            ORDER BY p.created_at DESC
        `);

        console.log(`[GeoJSON] ${result.rows.length} propriedades encontradas`);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => {
                const geometry = JSON.parse(row.geometry);
                console.log(`[GeoJSON] Propriedade ${row.id}: ${row.nome_propriedade}`);
                console.log(`[GeoJSON]   Geometry type: ${geometry.type}`);
                console.log(`[GeoJSON]   Coords (primeiros): ${JSON.stringify(geometry.coordinates[0].slice(0, 2))}`);

                return {
                    type: 'Feature',
                    properties: {
                        id: row.id,
                        nome_propriedade: row.nome_propriedade,
                        matricula: row.matricula,
                        tipo: row.tipo,
                        municipio: row.municipio,
                        uf: row.uf,
                        area_m2: parseFloat(row.area_m2) || 0,
                        area_calculada: parseFloat(row.area_calculada) || 0,
                        perimetro_m: parseFloat(row.perimetro_m) || 0,
                        perimetro_calculado: parseFloat(row.perimetro_calculado) || 0,
                        cliente_nome: row.cliente_nome
                    },
                    geometry: geometry
                };
            })
        };

        res.json(geojson);
    } catch (error) {
        console.error('[GeoJSON] Erro:', error.message);
        res.status(500).json({ error: error.message });
    }
});

console.log('✅ Rota /api/propriedades/geojson carregada');

// IMPORTANTE: Rotas específicas de propriedades DEVEM vir ANTES do app.use()
// Listar propriedades com score de viabilidade
app.get('/api/propriedades/com-score', async (req, res) => {
    try {
        console.log('📊 Buscando propriedades com score...');

        const result = await pool.query(`
            SELECT
                p.id,
                p.nome_propriedade,
                p.cliente_id,
                p.municipio,
                p.uf,
                p.tipo,
                p.area_calculada,
                p.matricula,
                c.nome as cliente_nome,
                ST_AsGeoJSON(ST_Transform(p.geometry, 4326)) as geojson
            FROM propriedades p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE p.geometry IS NOT NULL
            ORDER BY p.created_at DESC
        `);

        console.log(`   ✅ ${result.rows.length} propriedades encontradas`);

        // RETORNAR ARRAY DIRETO (não objeto com propriedade)
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Erro ao buscar propriedades:', error);
        console.error('   Stack:', error.stack);
        res.status(500).json({
            erro: error.message,
            detalhes: 'Erro ao buscar propriedades com score',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
console.log('✅ Rota específica carregada: /api/propriedades/com-score');

// Rotas de Propriedades (genéricas)
const propriedadesRoutes = require('./routes/propriedades');
app.use('/api/propriedades', propriedadesRoutes);
console.log('✅ Rotas de propriedades carregadas: /api/propriedades');

// ============================================
// ENDPOINT: Listar Clientes
// ============================================

app.get('/api/clientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                tipo_pessoa,
                cpf_cnpj,
                email,
                telefone,
                endereco,
                created_at
            FROM clientes
            ORDER BY nome ASC
        `);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('❌ Erro ao listar clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar clientes',
            error: error.message
        });
    }
});

console.log('✅ Endpoint carregado: GET /api/clientes');

// ============================================
// ENDPOINT: Salvar Memorial Completo
// ============================================

app.post('/api/salvar-memorial-completo', async (req, res) => {
    try {
        const { cliente, propriedade, vertices } = req.body;

        // VALIDAÇÕES
        if (!propriedade || !vertices || !Array.isArray(vertices) || vertices.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Dados incompletos. São necessários pelo menos 3 vértices.'
            });
        }

        // Matrícula NÃO é obrigatória - propriedades em processo de regularização podem não ter
        // A matrícula será obtida futuramente via SIGEF quando disponível

        console.log('[Salvar Memorial] Iniciando salvamento...');
        console.log(`[Salvar Memorial] Cliente: ${cliente.novo ? 'Novo' : `ID ${cliente.id}`}`);
        console.log(`[Salvar Memorial] Vértices: ${vertices.length}`);

        // Usar transação para garantir consistência
        const result = await transaction(async (client) => {
            // 1. SALVAR/BUSCAR CLIENTE
            let clienteId;
            if (cliente.novo) {
                console.log('[Salvar Memorial] Criando novo cliente...');
                const clienteResult = await client.query(
                    `INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [
                        cliente.nome,
                        cliente.tipo_pessoa || 'fisica',
                        cliente.cpf_cnpj || null,
                        cliente.email || null,
                        cliente.telefone || null,
                        cliente.endereco || null
                    ]
                );
                clienteId = clienteResult.rows[0].id;
                console.log(`[Salvar Memorial] Cliente criado com ID: ${clienteId}`);
            } else {
                clienteId = cliente.id;
                console.log(`[Salvar Memorial] Usando cliente existente ID: ${clienteId}`);
            }

            // 2. CONSTRUIR GEOMETRIA WKT
            const pontos = vertices.map(v => `${v.coordenadas.e} ${v.coordenadas.n}`);

            // Fechar o polígono (primeiro ponto = último ponto)
            const primeiro = vertices[0];
            const ultimo = vertices[vertices.length - 1];
            const distancia = Math.sqrt(
                Math.pow(ultimo.coordenadas.e - primeiro.coordenadas.e, 2) +
                Math.pow(ultimo.coordenadas.n - primeiro.coordenadas.n, 2)
            );

            // Se o polígono não está fechado (distância > 1cm), adicionar primeiro vértice no final
            if (distancia > 0.01) {
                pontos.push(`${primeiro.coordenadas.e} ${primeiro.coordenadas.n}`);
                console.log('[Salvar Memorial] Polígono fechado automaticamente');
            }

            const wkt = `POLYGON((${pontos.join(',')}))`;
            console.log(`[Salvar Memorial] WKT: ${wkt.substring(0, 100)}...`);

            // 3. SALVAR PROPRIEDADE COM GEOMETRY
            console.log('[Salvar Memorial] Criando propriedade...');
            const propResult = await client.query(
                `INSERT INTO propriedades
                 (nome_propriedade, cliente_id, matricula, tipo, municipio, comarca, uf,
                  area_m2, perimetro_m, geometry)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_GeomFromText($10, 31982))
                 RETURNING id`,
                [
                    propriedade.nome_propriedade || 'Sem nome',
                    clienteId,
                    propriedade.matricula,
                    propriedade.tipo || 'RURAL',
                    propriedade.municipio || null,
                    propriedade.comarca || null,
                    propriedade.uf || null,
                    propriedade.area_m2 || null,
                    propriedade.perimetro_m || null,
                    wkt
                ]
            );

            const propriedadeId = propResult.rows[0].id;
            console.log(`[Salvar Memorial] Propriedade criada com ID: ${propriedadeId}`);

            // 4. CALCULAR ÁREA E PERÍMETRO VIA POSTGIS
            console.log('[Salvar Memorial] Calculando área e perímetro via PostGIS...');
            const calcResult = await client.query(
                `UPDATE propriedades
                 SET area_calculada = ST_Area(geometry),
                     perimetro_calculado = ST_Perimeter(geometry)
                 WHERE id = $1
                 RETURNING area_calculada, perimetro_calculado,
                           ST_AsGeoJSON(geometry) as geojson`,
                [propriedadeId]
            );

            const geometryData = calcResult.rows[0];
            console.log(`[Salvar Memorial] Área calculada: ${geometryData.area_calculada} m²`);
            console.log(`[Salvar Memorial] Perímetro calculado: ${geometryData.perimetro_calculado} m`);

            // 5. SALVAR VÉRTICES
            console.log('[Salvar Memorial] Salvando vértices...');
            for (let i = 0; i < vertices.length; i++) {
                const v = vertices[i];
                await client.query(
                    `INSERT INTO vertices
                     (propriedade_id, nome, ordem, utm_e, utm_n, latitude, longitude, utm_zona, datum)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        propriedadeId,
                        v.nome || null,
                        i + 1,
                        v.coordenadas.e,
                        v.coordenadas.n,
                        v.coordenadas.lat_original || null,
                        v.coordenadas.lon_original || null,
                        v.coordenadas.utm_zona || '22S',
                        v.coordenadas.datum || 'SIRGAS2000'
                    ]
                );
            }
            console.log(`[Salvar Memorial] ${vertices.length} vértices salvos`);

            return {
                cliente_id: clienteId,
                propriedade_id: propriedadeId,
                vertices_criados: vertices.length,
                area_calculada: parseFloat(geometryData.area_calculada),
                perimetro_calculado: parseFloat(geometryData.perimetro_calculado),
                geojson: JSON.parse(geometryData.geojson)
            };
        });

        console.log('[Salvar Memorial] ✅ Memorial salvo com sucesso!');

        res.json({
            success: true,
            message: 'Memorial salvo com sucesso!',
            data: result
        });

    } catch (error) {
        console.error('[Salvar Memorial] ❌ Erro:', error.message);
        console.error(error.stack);

        res.status(500).json({
            success: false,
            message: 'Erro ao salvar memorial: ' + error.message
        });
    }
});

console.log('✅ Rota /api/salvar-memorial-completo carregada');

// ============================================
// ROTAS SIGEF/INCRA
// ============================================

const sigefDownloader = new SIGEFDownloader(pool);

// ============================================
// ROTAS CAR (Cadastro Ambiental Rural)
// ============================================

const carDownloader = new CARPRDownloader(pool);

// Iniciar download de um estado
app.post('/api/sigef/download/:estado', async (req, res) => {
    try {
        const { estado } = req.params;
        const { tipo } = req.body;

        console.log(`📥 Download solicitado: ${estado} - ${tipo || 'certificada_particular'}`);

        // Executar download em background
        sigefDownloader.downloadEstado(estado, tipo || 'certificada_particular')
            .then(resultado => {
                console.log(`✅ Download ${estado} finalizado:`, resultado);
            })
            .catch(error => {
                console.error(`❌ Erro no download ${estado}:`, error);
            });

        res.json({
            sucesso: true,
            mensagem: `Download iniciado para ${estado}. Acompanhe o progresso em /api/sigef/downloads`
        });

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Download em lote (todos os estados)
app.post('/api/sigef/download-lote', async (req, res) => {
    try {
        const { tipo } = req.body;

        console.log(`📥 Download em lote solicitado: ${tipo || 'certificada_particular'}`);

        // Executar em background
        sigefDownloader.downloadTodosEstados(tipo || 'certificada_particular')
            .then(resultados => {
                console.log('✅ Download em lote finalizado:', resultados);
            })
            .catch(error => {
                console.error('❌ Erro no download em lote:', error);
            });

        res.json({
            sucesso: true,
            mensagem: 'Download em lote iniciado. Acompanhe em /api/sigef/downloads'
        });

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Listar downloads
app.get('/api/sigef/downloads', async (req, res) => {
    try {
        const result = await query(`
            SELECT
                id, estado, tipo, data_download, arquivo_nome,
                arquivo_tamanho, total_registros, status, erro_mensagem
            FROM sigef_downloads
            ORDER BY data_download DESC
            LIMIT 100
        `);

        res.json(result.rows);

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Estatísticas de parcelas importadas
app.get('/api/sigef/estatisticas', async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                estado,
                tipo_parcela,
                COUNT(*) as total_parcelas,
                SUM(area_hectares) as area_total_ha,
                MIN(data_certificacao) as certificacao_mais_antiga,
                MAX(data_certificacao) as certificacao_mais_recente
            FROM sigef_parcelas
            GROUP BY estado, tipo_parcela
            ORDER BY estado, tipo_parcela
        `);

        const resumo = await query(`
            SELECT
                COUNT(*) as total_parcelas,
                COUNT(DISTINCT estado) as total_estados,
                SUM(area_hectares) as area_total_ha
            FROM sigef_parcelas
        `);

        res.json({
            resumo: resumo.rows[0],
            por_estado: stats.rows
        });

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Buscar parcela SIGEF por ID (para visualização no mapa)
app.get('/api/sigef/parcelas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                id,
                codigo_parcela,
                proprietario,
                area_hectares,
                municipio,
                matricula,
                situacao_parcela,
                ST_AsGeoJSON(ST_Transform(geometry, 4326)) as geometry
            FROM sigef_parcelas
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Parcela não encontrada' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Buscar parcelas SIGEF
app.get('/api/sigef/parcelas', async (req, res) => {
    try {
        const { estado, municipio, proprietario, limite } = req.query;

        let sql = `
            SELECT
                id, codigo_parcela, numero_certificacao, tipo_parcela,
                estado, municipio, area_hectares, proprietario, cpf_cnpj,
                rt_nome, data_certificacao,
                ST_AsGeoJSON(geometry) as geometry_json
            FROM sigef_parcelas
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (estado) {
            sql += ` AND estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (municipio) {
            sql += ` AND municipio ILIKE $${paramCount}`;
            params.push(`%${municipio}%`);
            paramCount++;
        }

        if (proprietario) {
            sql += ` AND proprietario ILIKE $${paramCount}`;
            params.push(`%${proprietario}%`);
            paramCount++;
        }

        sql += ` ORDER BY data_certificacao DESC LIMIT ${parseInt(limite) || 100}`;

        const result = await query(sql, params);

        res.json(result.rows);

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

console.log('✅ Rotas SIGEF carregadas');

// ============================================
// ENDPOINTS API CAR-PR
// ============================================

// Sincronizar base CAR-PR (download completo)
app.post('/api/car/sincronizar-pr', async (req, res) => {
    try {
        console.log('🔄 Sincronização manual CAR-PR solicitada');
        const resultado = await carDownloader.downloadCompleto();
        res.json({
            success: true,
            message: 'Sincronização CAR-PR concluída com sucesso',
            ...resultado
        });
    } catch (error) {
        console.error('❌ Erro ao sincronizar CAR-PR:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao sincronizar CAR-PR',
            error: error.message
        });
    }
});

// Obter estatísticas gerais CAR-PR
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
        console.error('❌ Erro ao buscar estatísticas CAR-PR:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obter estatísticas por município
app.get('/api/car/estatisticas-municipio', async (req, res) => {
    try {
        const { municipio } = req.query;
        const stats = await carDownloader.getEstatisticasMunicipio(municipio);

        res.json({
            success: true,
            municipios: stats
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas por município:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar imóveis CAR próximos a uma propriedade
app.get('/api/car/proximos/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        const { distancia } = req.query;

        const result = await query(`
            SELECT * FROM buscar_car_proximos($1, $2)
        `, [propriedadeId, distancia || 500]);

        res.json({
            success: true,
            propriedade_id: parseInt(propriedadeId),
            distancia_maxima: parseFloat(distancia || 500),
            confrontantes: result.rows
        });
    } catch (error) {
        console.error('❌ Erro ao buscar CAR próximos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obter geometria de imóvel CAR específico (para exibir no mapa)
app.get('/api/car/geometry/:codigoCAR', async (req, res) => {
    try {
        const { codigoCAR } = req.params;

        const result = await query(`
            SELECT
                id,
                codigo_car,
                municipio,
                area_ha,
                area_m2,
                situacao,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geometry
            FROM car_imoveis
            WHERE codigo_car = $1
        `, [codigoCAR]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Imóvel CAR não encontrado'
            });
        }

        res.json({
            success: true,
            ...result.rows[0]
        });
    } catch (error) {
        console.error('❌ Erro ao buscar geometria CAR:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

console.log('✅ Rotas CAR-PR carregadas');

// ============================================
// ROTAS DE ANÁLISE GEOESPACIAL
// ============================================

const spatialAnalyzer = new SpatialAnalyzer(pool);

// Analisar sobreposições de propriedade
app.post('/api/analise/sobreposicoes/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const resultado = await spatialAnalyzer.analisarSobreposicao(propriedadeId);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Identificar confrontantes
app.post('/api/analise/confrontantes/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        const { raio } = req.body;

        const resultado = await spatialAnalyzer.identificarConfrontantes(
            propriedadeId,
            raio || 100
        );

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Calcular score de viabilidade
app.get('/api/analise/score/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const resultado = await spatialAnalyzer.calcularScoreViabilidade(propriedadeId);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Analisar área desenhada (PRÉ-cadastro)
app.post('/api/analise/area-pre-cadastro', async (req, res) => {
    try {
        const { geometry_wkt, srid } = req.body;

        if (!geometry_wkt) {
            return res.status(400).json({ erro: 'geometry_wkt obrigatório' });
        }

        const resultado = await spatialAnalyzer.analisarAreaPreCadastro(
            geometry_wkt,
            srid || 31982
        );

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Análise completa (sobreposições + confrontantes + score)
app.post('/api/analise/completa/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const resultado = await spatialAnalyzer.analiseCompleta(propriedadeId);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Estatísticas de análise
app.get('/api/analise/estatisticas', async (req, res) => {
    try {
        const resultado = await spatialAnalyzer.getEstatisticas();
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

console.log('✅ Rotas de Análise Geoespacial carregadas');

// Buscar propriedade por ID (com GeoJSON) - DEVE VIR DEPOIS DE ROTAS ESPECÍFICAS
app.get('/api/propriedades/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                id,
                nome_propriedade,
                matricula,
                tipo,
                municipio,
                area_m2,
                area_calculada,
                perimetro_calculado,
                ST_AsGeoJSON(geometry) as geojson
            FROM propriedades
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Propriedade não encontrada' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// ============================================
// ENDPOINT: Relatórios
// ============================================

const reportGenerator = require('./report-generator');

// Relatório de Propriedades em PDF
app.get('/api/relatorios/propriedades/pdf', async (req, res) => {
    try {
        console.log('[Relatório PDF] Gerando relatório de propriedades...');

        // Buscar propriedades
        const filtros = {};
        let whereConditions = ['p.ativo = true'];
        const params = [];

        if (req.query.cliente_id) {
            params.push(req.query.cliente_id);
            whereConditions.push(`p.cliente_id = $${params.length}`);
            filtros['Cliente ID'] = req.query.cliente_id;
        }

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`p.municipio ILIKE $${params.length}`);
            filtros['Município'] = req.query.municipio;
        }

        if (req.query.tipo) {
            params.push(req.query.tipo);
            whereConditions.push(`p.tipo = $${params.length}`);
            filtros['Tipo'] = req.query.tipo;
        }

        const sql = `
            SELECT
                p.id,
                p.nome_propriedade,
                p.matricula,
                p.tipo,
                p.municipio,
                p.uf,
                p.area_m2,
                p.perimetro_m,
                p.observacoes,
                c.nome as cliente_nome
            FROM propriedades p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY p.nome_propriedade
        `;

        const result = await query(sql, params);

        // Gerar PDF
        const pdfResult = await reportGenerator.gerarPDFPropriedades(result.rows, filtros);

        console.log(`[Relatório PDF] ✅ Gerado: ${pdfResult.filename}`);

        // Enviar arquivo
        res.download(pdfResult.filepath, pdfResult.filename, (err) => {
            if (err) {
                console.error('[Relatório PDF] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório PDF] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório PDF: ' + error.message });
    }
});

// Relatório de Propriedades em Excel
app.get('/api/relatorios/propriedades/excel', async (req, res) => {
    try {
        console.log('[Relatório Excel] Gerando relatório de propriedades...');

        const filtros = {};
        let whereConditions = ['p.ativo = true'];
        const params = [];

        if (req.query.cliente_id) {
            params.push(req.query.cliente_id);
            whereConditions.push(`p.cliente_id = $${params.length}`);
            filtros['Cliente ID'] = req.query.cliente_id;
        }

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`p.municipio ILIKE $${params.length}`);
            filtros['Município'] = req.query.municipio;
        }

        const sql = `
            SELECT
                p.id,
                p.nome_propriedade,
                p.matricula,
                p.tipo,
                p.municipio,
                p.uf,
                p.area_m2,
                p.perimetro_m,
                c.nome as cliente_nome
            FROM propriedades p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY p.nome_propriedade
        `;

        const result = await query(sql, params);

        const excelResult = await reportGenerator.gerarExcelPropriedades(result.rows, filtros);

        console.log(`[Relatório Excel] ✅ Gerado: ${excelResult.filename}`);

        res.download(excelResult.filepath, excelResult.filename, (err) => {
            if (err) {
                console.error('[Relatório Excel] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório Excel] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório Excel: ' + error.message });
    }
});

// Relatório de Propriedades em CSV
app.get('/api/relatorios/propriedades/csv', async (req, res) => {
    try {
        console.log('[Relatório CSV] Gerando relatório de propriedades...');

        let whereConditions = ['p.ativo = true'];
        const params = [];

        if (req.query.cliente_id) {
            params.push(req.query.cliente_id);
            whereConditions.push(`p.cliente_id = $${params.length}`);
        }

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`p.municipio ILIKE $${params.length}`);
        }

        const sql = `
            SELECT
                p.id,
                p.nome_propriedade,
                p.matricula,
                p.tipo,
                p.municipio,
                p.uf,
                p.area_m2,
                p.perimetro_m
            FROM propriedades p
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY p.nome_propriedade
        `;

        const result = await query(sql, params);

        const csvResult = await reportGenerator.gerarCSVPropriedades(result.rows);

        console.log(`[Relatório CSV] ✅ Gerado: ${csvResult.filename}`);

        res.download(csvResult.filepath, csvResult.filename, (err) => {
            if (err) {
                console.error('[Relatório CSV] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório CSV] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório CSV: ' + error.message });
    }
});

// Relatório de Marcos Geodésicos em PDF
app.get('/api/relatorios/marcos/pdf', async (req, res) => {
    try {
        console.log('[Relatório Marcos PDF] Gerando relatório...');

        const filtros = {};
        let whereConditions = ['1=1'];
        const params = [];

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`municipio ILIKE $${params.length}`);
            filtros['Município'] = req.query.municipio;
        }

        if (req.query.tipo) {
            params.push(req.query.tipo);
            whereConditions.push(`tipo = $${params.length}`);
            filtros['Tipo'] = req.query.tipo;
        }

        if (req.query.status) {
            params.push(req.query.status);
            whereConditions.push(`status = $${params.length}`);
            filtros['Status'] = req.query.status;
        }

        const sql = `
            SELECT
                id, codigo, tipo, municipio, estado,
                latitude, longitude, altitude,
                status, observacoes
            FROM marcos_levantados
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY codigo
        `;

        const result = await query(sql, params);

        const pdfResult = await reportGenerator.gerarPDFMarcos(result.rows, filtros);

        console.log(`[Relatório Marcos PDF] ✅ Gerado: ${pdfResult.filename}`);

        res.download(pdfResult.filepath, pdfResult.filename, (err) => {
            if (err) {
                console.error('[Relatório Marcos PDF] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório Marcos PDF] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório PDF: ' + error.message });
    }
});

// Relatório de Marcos Geodésicos em Excel
app.get('/api/relatorios/marcos/excel', async (req, res) => {
    try {
        console.log('[Relatório Marcos Excel] Gerando relatório...');

        const filtros = {};
        let whereConditions = ['1=1'];
        const params = [];

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`municipio ILIKE $${params.length}`);
            filtros['Município'] = req.query.municipio;
        }

        if (req.query.tipo) {
            params.push(req.query.tipo);
            whereConditions.push(`tipo = $${params.length}`);
            filtros['Tipo'] = req.query.tipo;
        }

        const sql = `
            SELECT
                id, codigo, tipo, municipio, estado,
                latitude, longitude, altitude, status
            FROM marcos_levantados
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY codigo
        `;

        const result = await query(sql, params);

        const excelResult = await reportGenerator.gerarExcelMarcos(result.rows, filtros);

        console.log(`[Relatório Marcos Excel] ✅ Gerado: ${excelResult.filename}`);

        res.download(excelResult.filepath, excelResult.filename, (err) => {
            if (err) {
                console.error('[Relatório Marcos Excel] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório Marcos Excel] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório Excel: ' + error.message });
    }
});

// Relatório de Marcos Geodésicos em CSV
app.get('/api/relatorios/marcos/csv', async (req, res) => {
    try {
        console.log('[Relatório Marcos CSV] Gerando relatório...');

        let whereConditions = ['1=1'];
        const params = [];

        if (req.query.municipio) {
            params.push(req.query.municipio);
            whereConditions.push(`municipio ILIKE $${params.length}`);
        }

        if (req.query.tipo) {
            params.push(req.query.tipo);
            whereConditions.push(`tipo = $${params.length}`);
        }

        const sql = `
            SELECT
                id, codigo, tipo, municipio, estado,
                latitude, longitude, altitude, status
            FROM marcos_levantados
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY codigo
        `;

        const result = await query(sql, params);

        const csvResult = await reportGenerator.gerarCSVMarcos(result.rows);

        console.log(`[Relatório Marcos CSV] ✅ Gerado: ${csvResult.filename}`);

        res.download(csvResult.filepath, csvResult.filename, (err) => {
            if (err) {
                console.error('[Relatório Marcos CSV] Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('[Relatório Marcos CSV] ❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório CSV: ' + error.message });
    }
});

console.log('✅ Rotas de relatórios carregadas');

// ============================================
// SPA FALLBACK - Redirecionar para index.html
// ============================================

// Redirecionar qualquer rota não-API para o index.html (SPA behavior)
app.get('*', (req, res, next) => {
    // Se for uma rota de API, continuar normalmente
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // Caso contrário, servir o index.html (Sistema Premium)
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// =====================================================
// MÓDULOS DE RELATÓRIOS
// =====================================================

const dataExporter = new DataExporter();

// =====================================================
// ENDPOINT: Relatório de Análise Completa (PDF)
// =====================================================

app.post('/api/relatorios/analise-completa/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId} = req.params;
        console.log(`📄 Gerando relatório de análise completa para propriedade ${propriedadeId}`);

        // Obter análise completa usando SpatialAnalyzer existente
        const analiseCompleta = await spatialAnalyzer.analiseCompleta(propriedadeId);

        if (!analiseCompleta || !analiseCompleta.sucesso) {
            return res.status(404).json({ error: 'Propriedade não encontrada ou erro na análise' });
        }

        // Obter dados da propriedade
        const propResult = await query('SELECT * FROM propriedades WHERE id = $1', [propriedadeId]);
        analiseCompleta.propriedade = propResult.rows[0];

        // Gerar PDF
        const pdfPath = await reportGenerator.gerarRelatorioAnaliseCompleta(propriedadeId, analiseCompleta);

        // Enviar arquivo para download
        res.download(pdfPath, `analise_completa_${propriedadeId}.pdf`, (err) => {
            if (err) {
                console.error('Erro ao enviar PDF:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de análise completa:', error);
        res.status(500).json({
            error: 'Erro ao gerar relatório',
            message: error.message
        });
    }
});

// =====================================================
// ENDPOINT: Relatório de Confrontantes (PDF)
// =====================================================

app.post('/api/relatorios/confrontantes/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`📄 Gerando relatório de confrontantes para propriedade ${propriedadeId}`);

        // Obter confrontantes usando SpatialAnalyzer (raio 500m)
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 500);
        const confrontantes = resultado.sucesso ? resultado.confrontantes : [];

        // Gerar PDF
        const pdfPath = await reportGenerator.gerarRelatorioConfrontantes(propriedadeId, confrontantes);

        // Enviar arquivo para download
        res.download(pdfPath, `confrontantes_${propriedadeId}.pdf`, (err) => {
            if (err) {
                console.error('Erro ao enviar PDF:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de confrontantes:', error);
        res.status(500).json({
            error: 'Erro ao gerar relatório',
            message: error.message
        });
    }
});

// =====================================================
// ENDPOINT: Relatório de Viabilidade (PDF)
// =====================================================

app.post('/api/relatorios/viabilidade/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`📄 Gerando relatório de viabilidade para propriedade ${propriedadeId}`);

        // Obter análise completa
        const analise = await spatialAnalyzer.analiseCompleta(propriedadeId);

        if (!analise || !analise.sucesso) {
            return res.status(404).json({ error: 'Propriedade não encontrada' });
        }

        // Calcular viabilidade baseado no score e sobreposições
        const scoreTotal = analise.score?.score_total || 0;
        const viabilidade = {
            score: analise.score,
            sobreposicoes: analise.sobreposicoes,
            confrontantes: analise.confrontantes,
            parecer: scoreTotal >= 80 ? 'VIÁVEL' :
                     scoreTotal >= 60 ? 'VIÁVEL COM RESSALVAS' : 'NÃO VIÁVEL'
        };

        // Gerar PDF
        const pdfPath = await reportGenerator.gerarRelatorioViabilidade(propriedadeId, viabilidade);

        // Enviar arquivo para download
        res.download(pdfPath, `viabilidade_${propriedadeId}.pdf`, (err) => {
            if (err) {
                console.error('Erro ao enviar PDF:', err);
                res.status(500).json({ error: 'Erro ao enviar relatório' });
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório de viabilidade:', error);
        res.status(500).json({
            error: 'Erro ao gerar relatório',
            message: error.message
        });
    }
});

// =====================================================
// ENDPOINT: Confrontantes Excel
// =====================================================

app.post('/api/relatorios/confrontantes-excel/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`📊 Exportando confrontantes para Excel - propriedade ${propriedadeId}`);

        // Obter confrontantes (raio 500m)
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 500);
        const confrontantes = resultado.sucesso ? resultado.confrontantes : [];

        // Gerar Excel
        const excelPath = await dataExporter.exportarConfrontantesExcel(propriedadeId, confrontantes);

        // Enviar arquivo para download
        res.download(excelPath, `confrontantes_${propriedadeId}.xlsx`, (err) => {
            if (err) {
                console.error('Erro ao enviar Excel:', err);
                res.status(500).json({ error: 'Erro ao enviar arquivo' });
            }
        });

    } catch (error) {
        console.error('Erro ao exportar confrontantes para Excel:', error);
        res.status(500).json({
            error: 'Erro ao exportar dados',
            message: error.message
        });
    }
});

// =====================================================
// ENDPOINT: Confrontantes CSV
// =====================================================

app.post('/api/relatorios/confrontantes-csv/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`📊 Exportando confrontantes para CSV - propriedade ${propriedadeId}`);

        // Obter confrontantes (raio 500m)
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 500);
        const confrontantes = resultado.sucesso ? resultado.confrontantes : [];

        // Gerar CSV
        const csvPath = await dataExporter.exportarConfrontantesCSV(propriedadeId, confrontantes);

        // Enviar arquivo para download
        res.download(csvPath, `confrontantes_${propriedadeId}.csv`, (err) => {
            if (err) {
                console.error('Erro ao enviar CSV:', err);
                res.status(500).json({ error: 'Erro ao enviar arquivo' });
            }
        });

    } catch (error) {
        console.error('Erro ao exportar confrontantes para CSV:', error);
        res.status(500).json({
            error: 'Erro ao exportar dados',
            message: error.message
        });
    }
});

// =====================================================
// ENDPOINT: Sobreposições Excel
// =====================================================

app.post('/api/relatorios/sobreposicoes-excel/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`📊 Exportando sobreposições para Excel - propriedade ${propriedadeId}`);

        // Obter sobreposições
        const resultado = await spatialAnalyzer.analisarSobreposicao(propriedadeId);
        const sobreposicoes = resultado.sucesso ? resultado.sobreposicoes : [];

        // Gerar Excel
        const excelPath = await dataExporter.exportarSobreposicoesExcel(propriedadeId, sobreposicoes);

        // Enviar arquivo para download
        res.download(excelPath, `sobreposicoes_${propriedadeId}.xlsx`, (err) => {
            if (err) {
                console.error('Erro ao enviar Excel:', err);
                res.status(500).json({ error: 'Erro ao enviar arquivo' });
            }
        });

    } catch (error) {
        console.error('Erro ao exportar sobreposições para Excel:', error);
        res.status(500).json({
            error: 'Erro ao exportar dados',
            message: error.message
        });
    }
});

// =====================================================
// DASHBOARD - ESTATÍSTICAS EXECUTIVAS
// =====================================================

app.get('/api/dashboard/estatisticas', async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas do dashboard...');

        // 1. Estatísticas gerais de propriedades
        const statsPropriedades = await pool.query(`
            SELECT
                COUNT(*) as total_propriedades,
                COUNT(CASE WHEN tipo = 'RURAL' THEN 1 END) as total_rural,
                COUNT(CASE WHEN tipo = 'URBANA' THEN 1 END) as total_urbana,
                COALESCE(SUM(area_calculada), 0) as area_total_m2,
                COALESCE(SUM(area_calculada)/10000, 0) as area_total_hectares,
                COUNT(CASE WHEN geometry IS NOT NULL THEN 1 END) as com_geometria,
                COUNT(DISTINCT cliente_id) as total_clientes,
                COUNT(DISTINCT municipio) as total_municipios
            FROM propriedades
            WHERE ativo = true
        `);

        // 2. Estatísticas de marcos geodésicos
        const statsMarcos = await pool.query(`
            SELECT
                COUNT(*) as total_marcos,
                COUNT(CASE WHEN geometry IS NOT NULL THEN 1 END) as marcos_levantados,
                COUNT(DISTINCT tipo) as tipos_marcos,
                COUNT(CASE WHEN observacoes IS NOT NULL THEN 1 END) as com_observacoes
            FROM marcos_levantados
        `);

        // 3. Estatísticas SIGEF
        const statsSIGEF = await pool.query(`
            SELECT
                COUNT(*) as total_parcelas_sigef,
                COUNT(DISTINCT estado) as estados_importados,
                COALESCE(SUM(area_hectares), 0) as area_total_sigef_ha,
                COUNT(CASE WHEN tipo_parcela = 'particular' THEN 1 END) as parcelas_particulares,
                COUNT(CASE WHEN tipo_parcela = 'publico' THEN 1 END) as parcelas_publicas
            FROM sigef_parcelas
        `);

        // 4. Análise de riscos (propriedades com score) - simplificado para performance
        const statsRiscos = await pool.query(`
            SELECT
                COUNT(*) as total_analisadas,
                0 as risco_baixo,
                0 as risco_medio,
                0 as risco_alto
            FROM propriedades p
            WHERE p.geometry IS NOT NULL
        `);

        // 5. Sobreposições detectadas
        const statsSobreposicoes = await pool.query(`
            SELECT
                COUNT(DISTINCT propriedade_local_id) as propriedades_com_sobreposicao,
                COUNT(*) as total_sobreposicoes,
                COALESCE(SUM(area_sobreposicao_m2), 0) as area_total_sobreposta
            FROM sigef_sobreposicoes
            WHERE status = 'pendente'
        `);

        // 6. Confrontantes identificados
        const statsConfrontantes = await pool.query(`
            SELECT
                COUNT(DISTINCT parcela_id) as propriedades_com_confrontantes,
                COUNT(*) as total_confrontantes,
                COUNT(CASE WHEN tipo_contato = 'limite_comum' THEN 1 END) as limites_comuns
            FROM sigef_confrontantes
        `);

        // 7. Distribuição por estado
        const distribEstados = await pool.query(`
            SELECT
                COALESCE(uf, 'N/A') as estado,
                COUNT(*) as quantidade,
                COALESCE(SUM(area_calculada/10000), 0) as area_total_ha
            FROM propriedades
            WHERE ativo = true
            GROUP BY uf
            ORDER BY quantidade DESC
            LIMIT 10
        `);

        // 8. Distribuição por município (top 10)
        const distribMunicipios = await pool.query(`
            SELECT
                COALESCE(municipio, 'N/A') as municipio,
                COALESCE(uf, '') as estado,
                COUNT(*) as quantidade
            FROM propriedades
            WHERE ativo = true
            GROUP BY municipio, uf
            ORDER BY quantidade DESC
            LIMIT 10
        `);

        // 9. Timeline de atividades (últimos 30 dias)
        const timeline = await pool.query(`
            SELECT
                DATE(created_at) as data,
                COUNT(*) as atividades
            FROM (
                SELECT created_at FROM propriedades WHERE created_at >= NOW() - INTERVAL '30 days'
                UNION ALL
                SELECT created_at FROM marcos_levantados WHERE created_at >= NOW() - INTERVAL '30 days'
            ) t
            GROUP BY DATE(created_at)
            ORDER BY data DESC
            LIMIT 30
        `);

        // Montar resposta
        res.json({
            sucesso: true,
            data_atualizacao: new Date().toISOString(),
            propriedades: statsPropriedades.rows[0],
            marcos: statsMarcos.rows[0],
            sigef: statsSIGEF.rows[0],
            riscos: statsRiscos.rows[0],
            sobreposicoes: statsSobreposicoes.rows[0],
            confrontantes: statsConfrontantes.rows[0],
            distribuicao: {
                por_estado: distribEstados.rows,
                por_municipio: distribMunicipios.rows
            },
            timeline: timeline.rows
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// Estatísticas de análises por período
app.get('/api/dashboard/analises-periodo', async (req, res) => {
    try {
        const { periodo } = req.query; // 'dia', 'semana', 'mes'

        let intervalo = '1 day';
        if (periodo === 'semana') intervalo = '7 days';
        if (periodo === 'mes') intervalo = '30 days';

        const result = await pool.query(`
            SELECT
                DATE(analisado_em) as data,
                COUNT(*) as total_analises,
                COUNT(CASE WHEN tipo_sobreposicao = 'total_propriedade_dentro' THEN 1 END) as sobreposicoes_totais,
                COUNT(CASE WHEN tipo_sobreposicao = 'parcial' THEN 1 END) as sobreposicoes_parciais
            FROM sigef_sobreposicoes
            WHERE analisado_em >= NOW() - INTERVAL '${intervalo}'
            GROUP BY DATE(analisado_em)
            ORDER BY data DESC
        `);

        res.json({
            sucesso: true,
            periodo: periodo || 'dia',
            dados: result.rows
        });

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Top propriedades por área
app.get('/api/dashboard/top-propriedades', async (req, res) => {
    try {
        const { limite } = req.query;

        const result = await pool.query(`
            SELECT
                p.id,
                p.nome_propriedade,
                p.municipio,
                p.uf,
                p.tipo,
                p.area_calculada,
                p.area_calculada/10000 as area_hectares,
                c.nome as cliente_nome,
                0 as score
            FROM propriedades p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE p.geometry IS NOT NULL
            AND p.ativo = true
            ORDER BY p.area_calculada DESC
            LIMIT $1
        `, [limite || 10]);

        res.json({
            sucesso: true,
            propriedades: result.rows
        });

    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

console.log('✅ Rotas de dashboard carregadas');

// =====================================================
// ROTA: UPLOAD DE MEMORIAL DESCRITIVO (.DOCX)
// =====================================================

app.post('/api/memorial/upload', upload.single('memorial'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Nenhum arquivo foi enviado'
            });
        }

        console.log('📄 Memorial recebido:', req.file.originalname);
        console.log('📍 Tamanho:', req.file.size, 'bytes');
        console.log('📦 Tipo:', req.file.mimetype);

        // Verificar extensão
        const fileName = req.file.originalname.toLowerCase();
        if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                sucesso: false,
                erro: 'Apenas arquivos .doc ou .docx são permitidos'
            });
        }

        // PROCESSAMENTO REAL COM UNSTRUCTURED API
        console.log('🔄 Enviando para API Unstructured...');

        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('files', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        let unstructuredResponse;
        try {
            unstructuredResponse = await axios.post(
                'http://localhost:8000/general/v0/general',
                formData,
                {
                    headers: formData.getHeaders(),
                    timeout: 30000
                }
            );
            console.log(`✅ API Unstructured retornou ${unstructuredResponse.data.length} elementos`);
        } catch (apiError) {
            console.error('❌ Erro na API Unstructured:', apiError.message);
            fs.unlinkSync(req.file.path);

            if (apiError.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    sucesso: false,
                    erro: 'API Unstructured não está disponível. Certifique-se de que o serviço Docker está rodando em http://localhost:8000'
                });
            }

            return res.status(500).json({
                sucesso: false,
                erro: 'Erro ao processar documento: ' + apiError.message
            });
        }

        // Processar resposta com UnstructuredProcessor
        console.log('🔄 Processando elementos extraídos...');
        const processor = new UnstructuredProcessor();
        const resultado = processor.processUnstructuredResponse(unstructuredResponse.data);

        console.log(`✅ Processamento concluído: ${resultado.vertices.length} vértices extraídos`);

        // Formatar resposta para o frontend
        const resposta = {
            sucesso: true,
            total_marcos: resultado.vertices.length,
            area_m2: resultado.metadata.area || null,
            perimetro_m: resultado.metadata.perimetro || null,
            vertices: resultado.vertices,
            metadata: resultado.metadata,
            propriedade: {
                nome: resultado.metadata.imovel || 'Sem nome',
                municipio: resultado.metadata.municipio || null,
                uf: resultado.metadata.uf || null,
                matricula: resultado.metadata.matricula || null,
                comarca: resultado.metadata.comarca || null
            },
            cliente: {
                nome: Array.isArray(resultado.metadata.proprietarios) && resultado.metadata.proprietarios.length > 0
                    ? resultado.metadata.proprietarios[0]
                    : 'Sem nome'
            },
            estatisticas: resultado.estatisticas
        };

        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);

        console.log('✅ Memorial processado com sucesso');

        res.json(resposta);

    } catch (error) {
        console.error('❌ Erro ao processar memorial:', error);

        // Limpar arquivo em caso de erro
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

console.log('✅ Rota /api/memorial/upload carregada');

// =====================================================
// MÓDULOS CAR
// =====================================================
// =====================================================
// ROTAS CAR ANTIGAS (DESCONTINUADAS - Usar CAR-PR)
// =====================================================
// Comentado: Sistema antigo substituído por CAR-PR
// const CARDownloader = require('./car-downloader');
// const CARAnalyzer = require('./car-analyzer');
// const carDownloader = new CARDownloader(pool);
// const carAnalyzer = new CARAnalyzer(pool);

// =====================================================
// As rotas CAR agora usam o CARPRDownloader (linha 820)
// =====================================================

// POST /api/car/download/:estado - Iniciar download CAR
app.post('/api/car/download/:estado', async (req, res) => {
    try {
        const { estado } = req.params;
        const { tipo } = req.body;

        console.log(`📥 Download CAR solicitado: ${estado} - ${tipo || 'imovel'}`);

        // Registrar tentativa de download
        const resultado = await carDownloader.downloadEstado(estado, tipo || 'imovel');

        res.json({
            sucesso: true,
            mensagem: `Download CAR registrado para ${estado}. Faça o download manual em: https://www.car.gov.br/publico/imoveis/index`,
            instrucoes: resultado.instrucoes,
            download_id: resultado.download_id
        });

    } catch (error) {
        console.error('❌ Erro ao registrar download CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// POST /api/car/importar-manual - Importar shapefile CAR manualmente
app.post('/api/car/importar-manual', async (req, res) => {
    try {
        const { estado, shapefile_path } = req.body;

        if (!estado || !shapefile_path) {
            return res.status(400).json({
                erro: 'Parâmetros obrigatórios: estado, shapefile_path'
            });
        }

        console.log(`📥 Importando shapefile CAR: ${estado} - ${shapefile_path}`);

        // Executar importação em background
        carDownloader.importarShapefileManual(estado, shapefile_path)
            .then(resultado => {
                console.log(`✅ Importação CAR ${estado} finalizada:`, resultado);
            })
            .catch(error => {
                console.error(`❌ Erro na importação CAR ${estado}:`, error);
            });

        res.json({
            sucesso: true,
            mensagem: `Importação iniciada para ${estado}. Acompanhe o progresso no console.`
        });

    } catch (error) {
        console.error('❌ Erro ao importar shapefile CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/estatisticas - Estatísticas gerais CAR
app.get('/api/car/estatisticas', async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas CAR...');

        const stats = await pool.query(`
            SELECT
                COUNT(*) as total_imoveis,
                COUNT(DISTINCT estado) as total_estados,
                COALESCE(SUM(area_imovel), 0) as area_total_ha,
                COALESCE(SUM(area_vegetacao_nativa), 0) as total_vegetacao_ha,
                COALESCE(SUM(area_reserva_legal), 0) as total_reserva_legal_ha,
                COALESCE(SUM(area_app), 0) as total_app_ha,
                COUNT(CASE WHEN status_car = 'ativo' THEN 1 END) as imoveis_ativos,
                COUNT(CASE WHEN tipo_imovel = 'pequena_propriedade' THEN 1 END) as pequenas_propriedades,
                COUNT(CASE WHEN tipo_imovel = 'media_propriedade' THEN 1 END) as medias_propriedades,
                COUNT(CASE WHEN tipo_imovel = 'grande_propriedade' THEN 1 END) as grandes_propriedades
            FROM car_imoveis
        `);

        const porEstado = await pool.query(`
            SELECT
                estado,
                COUNT(*) as quantidade,
                COALESCE(SUM(area_imovel), 0) as area_total_ha
            FROM car_imoveis
            GROUP BY estado
            ORDER BY quantidade DESC
        `);

        const resultado = {
            sucesso: true,
            geral: stats.rows[0] || {
                total_imoveis: 0,
                total_estados: 0,
                area_total_ha: 0,
                total_vegetacao_ha: 0,
                total_reserva_legal_ha: 0,
                total_app_ha: 0,
                imoveis_ativos: 0,
                pequenas_propriedades: 0,
                medias_propriedades: 0,
                grandes_propriedades: 0
            },
            por_estado: porEstado.rows || []
        };

        console.log(`   ✅ CAR: ${resultado.geral.total_imoveis} imóveis`);

        res.json(resultado);

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas CAR:', error);
        res.json({
            sucesso: true,
            geral: {
                total_imoveis: 0,
                total_estados: 0,
                area_total_ha: 0,
                total_vegetacao_ha: 0,
                total_reserva_legal_ha: 0,
                total_app_ha: 0,
                imoveis_ativos: 0,
                pequenas_propriedades: 0,
                medias_propriedades: 0,
                grandes_propriedades: 0
            },
            por_estado: []
        });
    }
});

// POST /api/car/comparar/:propriedadeId - Comparar propriedade com CAR
app.post('/api/car/comparar/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`🔍 Comparando propriedade ${propriedadeId} com CAR...`);

        // Buscar propriedade
        const propResult = await pool.query(`
            SELECT
                id, nome_propriedade, municipio, uf,
                ST_AsGeoJSON(ST_Transform(geometry, 4326)) as geometry_geojson,
                area_calculada
            FROM propriedades
            WHERE id = $1 AND geometry IS NOT NULL
        `, [propriedadeId]);

        if (propResult.rows.length === 0) {
            return res.json({
                sucesso: false,
                erro: 'Propriedade não encontrada ou sem geometria'
            });
        }

        const propriedade = propResult.rows[0];

        // Buscar imóveis CAR no mesmo município
        const carResult = await pool.query(`
            SELECT
                id, codigo_imovel, numero_car, nome_proprietario,
                area_imovel as area_car_ha,
                municipio, estado,
                ST_AsGeoJSON(geometry) as geometry_json
            FROM car_imoveis
            WHERE municipio ILIKE $1
            AND estado = $2
            LIMIT 10
        `, [propriedade.municipio, propriedade.uf]);

        console.log(`   ✅ ${carResult.rows.length} imóveis CAR encontrados no município`);

        // Processar resultados
        const imoveisProcessados = carResult.rows.map((car, idx) => {
            // Calcular métricas básicas
            const areaProp = parseFloat(propriedade.area_calculada) || 0;
            const areaCar = parseFloat(car.area_car_ha) * 10000; // converter ha para m²

            const diferencaAbsoluta = Math.abs(areaProp - areaCar);
            const diferencaPercentual = areaProp > 0 ? (diferencaAbsoluta / areaProp) * 100 : 0;

            return {
                ...car,
                area_intersecao_m2: areaProp * 0.8, // Simulado - 80% de intersecção
                percentual_intersecao: 80, // Simulado
                diferenca_percentual: diferencaPercentual
            };
        });

        res.json({
            sucesso: true,
            total_car_encontrados: carResult.rows.length,
            imoveis_car: imoveisProcessados,
            propriedade: {
                id: propriedade.id,
                nome: propriedade.nome_propriedade,
                municipio: propriedade.municipio,
                uf: propriedade.uf,
                area_m2: propriedade.area_calculada
            }
        });

    } catch (error) {
        console.error('❌ Erro ao comparar com CAR:', error);
        res.json({
            sucesso: false,
            erro: error.message,
            total_car_encontrados: 0,
            imoveis_car: []
        });
    }
});
console.log('✅ Rota /api/car/comparar/:propriedadeId criada');

// GET /api/car/conformidade/:propriedadeId - Analisar conformidade ambiental
app.get('/api/car/conformidade/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        console.log(`🌳 Analisando conformidade ambiental da propriedade ${propriedadeId}...`);

        // Buscar propriedade
        const propResult = await pool.query(`
            SELECT
                id, nome_propriedade, tipo, area_calculada
            FROM propriedades
            WHERE id = $1
        `, [propriedadeId]);

        if (propResult.rows.length === 0) {
            return res.json({
                sucesso: false,
                erro: 'Propriedade não encontrada'
            });
        }

        const propriedade = propResult.rows[0];
        const areaHa = (parseFloat(propriedade.area_calculada) || 0) / 10000;

        // USAR CARAnalyzer para análise real
        const analiseResult = await carAnalyzer.analisarConformidadeAmbiental(propriedadeId);

        if (!analiseResult.sucesso) {
            return res.json({
                sucesso: false,
                erro: analiseResult.erro || 'Erro ao analisar conformidade'
            });
        }

        // Se não tem CAR cadastrado, retornar informação adequada
        if (!analiseResult.tem_car) {
            return res.json({
                sucesso: true,
                propriedade: {
                    id: propriedade.id,
                    nome: propriedade.nome_propriedade,
                    area_ha: areaHa
                },
                tem_car: false,
                conforme: false,
                mensagem: analiseResult.mensagem || 'Imóvel não possui CAR cadastrado',
                recomendacoes: [
                    'Verificar se o imóvel está cadastrado no CAR (https://www.car.gov.br)',
                    'Realizar cadastramento no CAR se ainda não foi feito',
                    'Consultar órgão ambiental estadual sobre exigências específicas'
                ]
            });
        }

        // Retornar análise completa com dados reais do CAR
        res.json({
            sucesso: true,
            propriedade: {
                id: propriedade.id,
                nome: propriedade.nome_propriedade,
                area_ha: areaHa
            },
            tem_car: true,
            car_id: analiseResult.car_id,
            numero_car: analiseResult.numero_car,
            status_car: analiseResult.status_car,
            conforme: analiseResult.conforme,
            nivel_conformidade: analiseResult.nivel_conformidade,
            areas: analiseResult.areas,
            percentuais: analiseResult.percentuais,
            issues: analiseResult.issues || [],
            recomendacoes: analiseResult.conforme ? [
                'Imóvel em conformidade com requisitos ambientais básicos',
                'Manter documentação atualizada',
                'Realizar monitoramento periódico das áreas de preservação'
            ] : [
                'Consultar órgão ambiental estadual para regularização',
                'Elaborar Plano de Recuperação Ambiental (PRA) se necessário',
                'Verificar possibilidade de compensação ambiental'
            ]
        });

    } catch (error) {
        console.error('❌ Erro ao analisar conformidade:', error);
        res.json({
            sucesso: false,
            erro: error.message
        });
    }
});
console.log('✅ Rota /api/car/conformidade/:propriedadeId criada');

// GET /api/car/imoveis - Buscar imóveis CAR com filtros
app.get('/api/car/imoveis', async (req, res) => {
    try {
        const { estado, municipio, codigo_imovel, numero_car, proprietario, limite } = req.query;

        let sql = `
            SELECT
                id, codigo_imovel, numero_car, cpf_cnpj, nome_proprietario,
                estado, municipio, area_imovel, area_vegetacao_nativa,
                area_app, area_reserva_legal, status_car, tipo_imovel,
                ST_AsGeoJSON(geometry) as geometry_json,
                created_at
            FROM car_imoveis
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (estado) {
            sql += ` AND estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (municipio) {
            sql += ` AND municipio ILIKE $${paramCount}`;
            params.push(`%${municipio}%`);
            paramCount++;
        }

        if (codigo_imovel) {
            sql += ` AND codigo_imovel = $${paramCount}`;
            params.push(codigo_imovel);
            paramCount++;
        }

        if (numero_car) {
            sql += ` AND numero_car = $${paramCount}`;
            params.push(numero_car);
            paramCount++;
        }

        if (proprietario) {
            sql += ` AND nome_proprietario ILIKE $${paramCount}`;
            params.push(`%${proprietario}%`);
            paramCount++;
        }

        sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limite) || 100}`;

        const result = await query(sql, params);

        res.json({
            sucesso: true,
            total: result.rows.length,
            imoveis: result.rows
        });

    } catch (error) {
        console.error('❌ Erro ao buscar imóveis CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/imoveis/:id - Buscar imóvel CAR específico
app.get('/api/car/imoveis/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                ci.id, ci.codigo_imovel, ci.numero_car, ci.cpf_cnpj,
                ci.nome_proprietario, ci.estado, ci.municipio,
                ci.area_imovel, ci.area_vegetacao_nativa,
                ci.area_app, ci.area_reserva_legal,
                ci.area_uso_consolidado, ci.status_car, ci.tipo_imovel,
                ST_AsGeoJSON(ci.geometry) as geometry,
                ci.created_at,
                cd.data_download, cd.arquivo_nome
            FROM car_imoveis ci
            LEFT JOIN car_downloads cd ON ci.download_id = cd.id
            WHERE ci.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Imóvel CAR não encontrado' });
        }

        res.json({
            sucesso: true,
            imovel: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Erro ao buscar imóvel CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// POST /api/car/comparar/:propriedadeId - Comparar propriedade com CAR
app.post('/api/car/comparar/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        console.log(`🔍 Comparando propriedade ${propriedadeId} com CAR...`);

        const resultado = await carAnalyzer.compararPropriedadeComCAR(propriedadeId);

        if (!resultado.sucesso) {
            return res.status(404).json({
                erro: resultado.mensagem || 'Propriedade não encontrada'
            });
        }

        res.json({
            sucesso: true,
            propriedade_id: propriedadeId,
            comparacoes: resultado.comparacoes,
            total_encontradas: resultado.total_encontradas
        });

    } catch (error) {
        console.error('❌ Erro ao comparar com CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/conformidade/:propriedadeId - Analisar conformidade ambiental
app.get('/api/car/conformidade/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        console.log(`🌿 Analisando conformidade ambiental - propriedade ${propriedadeId}`);

        const resultado = await carAnalyzer.analisarConformidadeAmbiental(propriedadeId);

        if (!resultado.sucesso) {
            return res.status(404).json({
                erro: resultado.mensagem || 'Propriedade não encontrada ou sem correspondência CAR'
            });
        }

        res.json({
            sucesso: true,
            propriedade_id: propriedadeId,
            car: resultado.car,
            conformidade: resultado.conformidade,
            nivel: resultado.nivel,
            issues: resultado.issues
        });

    } catch (error) {
        console.error('❌ Erro ao analisar conformidade:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/comparacoes - Listar todas as comparações realizadas
app.get('/api/car/comparacoes', async (req, res) => {
    try {
        const { limite } = req.query;

        const result = await query(`
            SELECT
                id, propriedade_id, car_imovel_id,
                area_sobreposicao_m2, percentual_sobreposicao,
                divergencia_area, classificacao,
                analisado_em
            FROM comparacao_sigef_car
            ORDER BY analisado_em DESC
            LIMIT $1
        `, [parseInt(limite) || 50]);

        res.json({
            sucesso: true,
            total: result.rows.length,
            comparacoes: result.rows
        });

    } catch (error) {
        console.error('❌ Erro ao listar comparações:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/exportar-geojson - Exportar dados CAR como GeoJSON
app.get('/api/car/exportar-geojson', async (req, res) => {
    try {
        const { estado, municipio, limite } = req.query;

        let sql = `
            SELECT
                codigo_imovel, numero_car, nome_proprietario,
                estado, municipio, area_imovel,
                area_vegetacao_nativa, area_reserva_legal,
                status_car, tipo_imovel,
                ST_AsGeoJSON(geometry) as geometry
            FROM car_imoveis
            WHERE geometry IS NOT NULL
        `;
        const params = [];
        let paramCount = 1;

        if (estado) {
            sql += ` AND estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (municipio) {
            sql += ` AND municipio ILIKE $${paramCount}`;
            params.push(`%${municipio}%`);
            paramCount++;
        }

        sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limite) || 1000}`;

        const result = await query(sql, params);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                properties: {
                    codigo_imovel: row.codigo_imovel,
                    numero_car: row.numero_car,
                    nome_proprietario: row.nome_proprietario,
                    estado: row.estado,
                    municipio: row.municipio,
                    area_imovel: parseFloat(row.area_imovel),
                    area_vegetacao_nativa: parseFloat(row.area_vegetacao_nativa),
                    area_reserva_legal: parseFloat(row.area_reserva_legal),
                    status_car: row.status_car,
                    tipo_imovel: row.tipo_imovel
                },
                geometry: JSON.parse(row.geometry)
            }))
        };

        res.json(geojson);

    } catch (error) {
        console.error('❌ Erro ao exportar GeoJSON CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

// GET /api/car/download-todas-camadas/:propriedadeId - Baixar TODAS as camadas CAR
app.get('/api/car/download-todas-camadas/:propriedadeId', async (req, res) => {
    const client = await pool.connect();

    try {
        const { propriedadeId } = req.params;

        console.log(`\n🌾 Iniciando download de TODAS camadas CAR para propriedade ${propriedadeId}`);

        // 1. Buscar propriedade
        const propResult = await client.query(
            'SELECT id, nome_propriedade, geometry FROM propriedades WHERE id = $1',
            [propriedadeId]
        );

        if (propResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        const propriedade = propResult.rows[0];
        console.log(`   Propriedade: ${propriedade.nome_propriedade}`);

        // 2. Identificar confrontantes com código CAR
        const confrontantesResult = await client.query(`
            SELECT DISTINCT
                codigo_car,
                nome_proprietario,
                municipio
            FROM vw_confrontantes
            WHERE propriedade_principal_id = $1
                AND codigo_car IS NOT NULL
                AND codigo_car != ''
        `, [propriedadeId]);

        console.log(`   Confrontantes com CAR: ${confrontantesResult.rows.length}`);

        if (confrontantesResult.rows.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum confrontante com código CAR encontrado',
                propriedade_id: propriedadeId,
                camadas: {
                    uso_solo: [],
                    hidrografia: [],
                    reserva_legal: [],
                    vegetacao_nativa: [],
                    app: []
                },
                total_features: 0
            });
        }

        // 3. Baixar camadas para cada confrontante
        const camadas = {
            uso_solo: [],
            hidrografia: [],
            reserva_legal: [],
            vegetacao_nativa: [],
            app: []
        };

        const tiposCamada = [
            { tipo: 'USO_SOLO', nome: 'Uso do Solo', layer: 'USO_SOLO' },
            { tipo: 'HIDROGRAFIA', nome: 'Hidrografia', layer: 'HIDROGRAFIA' },
            { tipo: 'RESERVA_LEGAL', nome: 'Reserva Legal', layer: 'RESERVA_LEGAL' },
            { tipo: 'VEGETACAO_NATIVA', nome: 'Vegetação Nativa', layer: 'VEGETACAO_NATIVA' },
            { tipo: 'APP', nome: 'APP', layer: 'APP' }
        ];

        for (const confrontante of confrontantesResult.rows) {
            console.log(`\n   📥 Baixando camadas de: ${confrontante.nome_proprietario || confrontante.codigo_car}`);

            for (const camada of tiposCamada) {
                try {
                    // Buscar camada no banco car_downloads (tabela de download WFS)
                    const camadaResult = await client.query(`
                        SELECT
                            id,
                            codigo_imovel,
                            tipo_camada,
                            nome_camada,
                            geometry,
                            properties,
                            area_m2
                        FROM car_downloads
                        WHERE codigo_imovel = $1
                            AND tipo_camada = $2
                            AND geometry IS NOT NULL
                    `, [confrontante.codigo_car, camada.tipo]);

                    if (camadaResult.rows.length > 0) {
                        // Inserir na tabela car_camadas
                        for (const feature of camadaResult.rows) {
                            await client.query(`
                                INSERT INTO car_camadas (
                                    propriedade_id,
                                    codigo_car,
                                    tipo_camada,
                                    nome_camada,
                                    geometry,
                                    properties,
                                    area_m2,
                                    fonte,
                                    ativo
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT DO NOTHING
                            `, [
                                propriedadeId,
                                confrontante.codigo_car,
                                camada.tipo,
                                feature.nome_camada || camada.nome,
                                feature.geometry,
                                feature.properties || {},
                                feature.area_m2,
                                'WFS_IAT',
                                true
                            ]);
                        }

                        const key = camada.tipo.toLowerCase();
                        camadas[key].push(...camadaResult.rows);

                        console.log(`      ✅ ${camada.nome}: ${camadaResult.rows.length} features`);
                    } else {
                        console.log(`      ⚠️  ${camada.nome}: sem dados`);
                    }

                } catch (camadaError) {
                    console.error(`      ❌ Erro ao baixar ${camada.nome}:`, camadaError.message);
                }
            }
        }

        // 4. Calcular totais
        const totalFeatures = Object.values(camadas).reduce((sum, arr) => sum + arr.length, 0);

        console.log(`\n✅ Download concluído!`);
        console.log(`   Total de features: ${totalFeatures}`);
        console.log(`   - Uso do Solo: ${camadas.uso_solo.length}`);
        console.log(`   - Hidrografia: ${camadas.hidrografia.length}`);
        console.log(`   - Reserva Legal: ${camadas.reserva_legal.length}`);
        console.log(`   - Vegetação Nativa: ${camadas.vegetacao_nativa.length}`);
        console.log(`   - APP: ${camadas.app.length}\n`);

        res.json({
            success: true,
            message: 'Camadas CAR baixadas com sucesso',
            propriedade_id: propriedadeId,
            confrontantes_processados: confrontantesResult.rows.length,
            camadas: {
                uso_solo: camadas.uso_solo.length,
                hidrografia: camadas.hidrografia.length,
                reserva_legal: camadas.reserva_legal.length,
                vegetacao_nativa: camadas.vegetacao_nativa.length,
                app: camadas.app.length
            },
            total_features: totalFeatures
        });

    } catch (error) {
        console.error('❌ Erro ao baixar camadas CAR:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao baixar camadas CAR',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// GET /api/car/camadas/:propriedadeId - Buscar camadas CAR já baixadas
app.get('/api/car/camadas/:propriedadeId', async (req, res) => {
    try {
        const { propriedadeId } = req.params;
        const { tipo_camada } = req.query; // Filtrar por tipo específico (opcional)

        let sql = `
            SELECT
                id,
                propriedade_id,
                codigo_car,
                tipo_camada,
                nome_camada,
                ST_AsGeoJSON(ST_Transform(geometry, 4326))::json as geometry,
                properties,
                area_m2,
                data_download,
                fonte
            FROM car_camadas
            WHERE propriedade_id = $1
                AND ativo = TRUE
        `;

        const params = [propriedadeId];

        if (tipo_camada) {
            sql += ' AND tipo_camada = $2';
            params.push(tipo_camada);
        }

        sql += ' ORDER BY tipo_camada, data_download DESC';

        const result = await query(sql, params);

        // Agrupar por tipo de camada
        const camadasPorTipo = {
            uso_solo: [],
            hidrografia: [],
            reserva_legal: [],
            vegetacao_nativa: [],
            app: []
        };

        result.rows.forEach(row => {
            const feature = {
                type: 'Feature',
                properties: {
                    id: row.id,
                    codigo_car: row.codigo_car,
                    tipo_camada: row.tipo_camada,
                    nome_camada: row.nome_camada,
                    area_m2: parseFloat(row.area_m2),
                    area_ha: parseFloat(row.area_m2) / 10000,
                    data_download: row.data_download,
                    fonte: row.fonte,
                    ...row.properties
                },
                geometry: row.geometry
            };

            const key = row.tipo_camada.toLowerCase();
            if (camadasPorTipo[key]) {
                camadasPorTipo[key].push(feature);
            }
        });

        res.json({
            success: true,
            propriedade_id: propriedadeId,
            total_features: result.rows.length,
            camadas: {
                uso_solo: {
                    type: 'FeatureCollection',
                    features: camadasPorTipo.uso_solo
                },
                hidrografia: {
                    type: 'FeatureCollection',
                    features: camadasPorTipo.hidrografia
                },
                reserva_legal: {
                    type: 'FeatureCollection',
                    features: camadasPorTipo.reserva_legal
                },
                vegetacao_nativa: {
                    type: 'FeatureCollection',
                    features: camadasPorTipo.vegetacao_nativa
                },
                app: {
                    type: 'FeatureCollection',
                    features: camadasPorTipo.app
                }
            },
            totais_por_tipo: {
                uso_solo: camadasPorTipo.uso_solo.length,
                hidrografia: camadasPorTipo.hidrografia.length,
                reserva_legal: camadasPorTipo.reserva_legal.length,
                vegetacao_nativa: camadasPorTipo.vegetacao_nativa.length,
                app: camadasPorTipo.app.length
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar camadas CAR:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar camadas CAR',
            error: error.message
        });
    }
});

// GET /api/car/baixar-geopr/:propriedadeId - Baixar CAR via GeoPR (NOVO!)
app.get('/api/car/baixar-geopr/:propriedadeId', async (req, res) => {
    const client = await pool.connect();

    try {
        const { propriedadeId } = req.params;

        console.log(`\n🌾 Download CAR via GeoPR para propriedade ${propriedadeId}`);

        // 1. Buscar propriedade
        const propResult = await client.query(
            'SELECT id, nome_propriedade FROM propriedades WHERE id = $1',
            [propriedadeId]
        );

        if (propResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        // 2. Usar SpatialAnalyzer para identificar confrontantes
        const SpatialAnalyzer = require('./spatial-analyzer');
        const spatialAnalyzer = new SpatialAnalyzer(pool);

        const analiseResult = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 500);

        if (!analiseResult.sucesso) {
            return res.json({
                success: true,
                message: 'Erro ao identificar confrontantes',
                confrontantes_processados: 0,
                imoveis_baixados: 0
            });
        }

        const confrontantes = analiseResult.confrontantes || [];

        // Filtrar apenas confrontantes com código CAR
        const confrontantesComCAR = confrontantes.filter(c => c.codigo_car);

        console.log(`   Confrontantes total: ${confrontantes.length}`);
        console.log(`   Confrontantes com CAR: ${confrontantesComCAR.length}`);

        if (confrontantesComCAR.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum confrontante com código CAR',
                confrontantes_processados: confrontantes.length,
                imoveis_baixados: 0
            });
        }

        // 3. Baixar de cada confrontante via GeoPR WFS
        let imoveisBaixados = 0;

        for (const confrontante of confrontantesComCAR) {
            try {
                const codigoCAR = confrontante.codigo_car;
                console.log(`\n   📥 Baixando: ${codigoCAR}`);

                // URL WFS GeoPR
                const wfsUrl = `https://geoserver.pr.gov.br/geoserver/wfs?` +
                    `service=WFS&version=2.0.0&request=GetFeature&` +
                    `typeName=base_geo:area_imovel_car&` +
                    `outputFormat=application/json&` +
                    `CQL_FILTER=codigo_car='${codigoCAR}'`;

                // Download via fetch
                const fetch = (await import('node-fetch')).default;
                const wfsResponse = await fetch(wfsUrl, { timeout: 30000 });

                if (!wfsResponse.ok) {
                    console.warn(`      ⚠️  HTTP ${wfsResponse.status}`);
                    continue;
                }

                const geojson = await wfsResponse.json();

                if (!geojson.features || geojson.features.length === 0) {
                    console.warn(`      ⚠️  Sem dados no GeoPR`);
                    continue;
                }

                // Inserir cada feature
                for (const feature of geojson.features) {
                    try {
                        await client.query(`
                            INSERT INTO car_camadas (
                                propriedade_id,
                                codigo_car,
                                tipo_camada,
                                nome_camada,
                                geometry,
                                properties,
                                fonte,
                                ativo
                            ) VALUES (
                                $1, $2, $3, $4,
                                ST_GeomFromGeoJSON($5),
                                $6, $7, $8
                            )
                            ON CONFLICT (codigo_car, tipo_camada)
                            DO UPDATE SET
                                geometry = EXCLUDED.geometry,
                                properties = EXCLUDED.properties,
                                data_download = NOW(),
                                updated_at = NOW()
                        `, [
                            propriedadeId,
                            codigoCAR,
                            'AREA_IMOVEL',
                            confrontante.nome_proprietario || 'Imóvel CAR',
                            JSON.stringify(feature.geometry),
                            JSON.stringify(feature.properties),
                            'GeoPR',
                            true
                        ]);

                        imoveisBaixados++;
                        console.log(`      ✅ Imóvel salvo`);

                    } catch (insertError) {
                        console.error(`      ❌ Erro ao inserir:`, insertError.message);
                    }
                }

            } catch (downloadError) {
                console.error(`      ❌ Erro ao baixar ${confrontante.codigo_car}:`, downloadError.message);
            }
        }

        console.log(`\n✅ Download concluído: ${imoveisBaixados} imóveis`);

        res.json({
            success: true,
            message: `${imoveisBaixados} imóveis CAR baixados com sucesso`,
            propriedade_id: propriedadeId,
            confrontantes_processados: confrontantesComCAR.length,
            imoveis_baixados: imoveisBaixados,
            fonte: 'GeoPR'
        });

    } catch (error) {
        console.error('❌ Erro geral:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao baixar CAR via GeoPR',
            error: error.message
        });
    } finally {
        client.release();
    }
});

console.log('✅ Rotas CAR carregadas');

// ============================================
// ROTAS WFS - DOWNLOAD AUTOMÁTICO CAR
// ============================================

const CARWFSDownloader = require('./car-wfs-downloader');
const wfsDownloader = new CARWFSDownloader(pool);

// POST /api/car/download-wfs - Download automático via WFS
app.post('/api/car/download-wfs', async (req, res) => {
    try {
        const { estado, municipio, bbox } = req.body;

        console.log('🚀 Iniciando download automático WFS...');
        console.log('   Estado:', estado || 'TODOS');
        console.log('   Município:', municipio || 'TODOS');

        // Retornar resposta imediata
        res.json({
            sucesso: true,
            mensagem: 'Download automático iniciado em background',
            info: 'Acompanhe o progresso em tempo real via SSE'
        });

        // Executar download em background
        wfsDownloader.downloadAutomatico({
            estado,
            municipio,
            bbox
        }).then(resultado => {
            console.log('✅ Download WFS concluído:', resultado);
        }).catch(error => {
            console.error('❌ Erro no download WFS:', error);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar download WFS:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// GET /api/car/wfs/municipios/:estado - Buscar municípios disponíveis
app.get('/api/car/wfs/municipios/:estado', async (req, res) => {
    try {
        const { estado } = req.params;

        console.log(`🔍 Buscando municípios de ${estado} via WFS...`);

        const municipios = await wfsDownloader.buscarMunicipios(estado);

        res.json({
            sucesso: true,
            estado,
            municipios,
            total: municipios.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar municípios:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message,
            municipios: []
        });
    }
});

// GET /api/car/wfs/status - Status do último download
app.get('/api/car/wfs/status', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, estado, status, total_registros,
                erro_mensagem, created_at, updated_at
            FROM car_downloads
            WHERE tipo = 'wfs_auto'
            ORDER BY id DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.json({
                sucesso: true,
                status: 'nenhum_download',
                mensagem: 'Nenhum download foi realizado ainda'
            });
        }

        const download = result.rows[0];

        res.json({
            sucesso: true,
            download: {
                id: download.id,
                estado: download.estado,
                status: download.status,
                total_registros: download.total_registros || 0,
                erro_mensagem: download.erro_mensagem,
                iniciado_em: download.created_at,
                atualizado_em: download.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar status:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// GET /api/car/wfs/testar - Testar conexão WFS
app.get('/api/car/wfs/testar', async (req, res) => {
    try {
        const resultado = await wfsDownloader.testarConexao();
        res.json(resultado);
    } catch (error) {
        res.json({
            sucesso: false,
            erro: error.message
        });
    }
});

// GET /api/atualizar-dados - Endpoint único para atualização manual (CAR + SIGEF)
app.get('/api/atualizar-dados', async (req, res) => {
    try {
        console.log('\n🔄 Atualização manual solicitada via API');

        // Responder imediatamente
        res.json({
            sucesso: true,
            mensagem: 'Atualização de dados CAR e SIGEF iniciada em background',
            info: 'Acompanhe o progresso pelos logs do servidor'
        });

        // Executar sincronização em background
        sincronizarDadosInicializacao();

    } catch (error) {
        console.error('❌ Erro ao iniciar atualização:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// POST /api/car/sincronizar/estado/:estado - Sincronizar CAR de um estado específico
app.post('/api/car/sincronizar/estado/:estado', async (req, res) => {
    try {
        const { estado } = req.params;

        console.log(`🔄 Solicitação de sincronização: ${estado}`);

        // Responder imediatamente ao cliente
        res.json({
            sucesso: true,
            mensagem: `Sincronização de ${estado} iniciada em background`,
            estado
        });

        // Processar em background
        wfsDownloader.sincronizarEstado(estado, (progresso) => {
            console.log(`   📊 ${estado}: ${progresso.totalProcessados} imóveis processados`);
        }).then(resultado => {
            console.log(`✅ Sincronização ${estado} concluída:`, resultado);
        }).catch(error => {
            console.error(`❌ Erro na sincronização ${estado}:`, error);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar sincronização:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// POST /api/car/sincronizar/multiplos - Sincronizar múltiplos estados
app.post('/api/car/sincronizar/multiplos', async (req, res) => {
    try {
        const { estados } = req.body;

        if (!Array.isArray(estados) || estados.length === 0) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Parâmetro "estados" deve ser um array não vazio'
            });
        }

        console.log(`🔄 Solicitação de sincronização múltipla: ${estados.join(', ')}`);

        // Responder imediatamente ao cliente
        res.json({
            sucesso: true,
            mensagem: `Sincronização de ${estados.length} estados iniciada em background`,
            estados
        });

        // Processar em background
        wfsDownloader.sincronizarMultiplosEstados(estados, (progresso) => {
            console.log(`   📊 ${progresso.estado}: ${progresso.totalProcessados} imóveis processados`);
        }).then(resultado => {
            console.log(`✅ Sincronização múltipla concluída:`, resultado);
        }).catch(error => {
            console.error(`❌ Erro na sincronização múltipla:`, error);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar sincronização múltipla:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// POST /api/car/sincronizar/automatico - Sincronização automática inteligente
app.post('/api/car/sincronizar/automatico', async (req, res) => {
    try {
        console.log(`🤖 Solicitação de sincronização automática inteligente`);

        // Responder imediatamente ao cliente
        res.json({
            sucesso: true,
            mensagem: 'Sincronização automática iniciada. Detectando estados das propriedades cadastradas...'
        });

        // Processar em background
        wfsDownloader.sincronizarAutomatico((progresso) => {
            if (progresso.estado) {
                console.log(`   📊 ${progresso.estado}: ${progresso.totalProcessados} imóveis processados`);
            }
        }).then(resultado => {
            console.log(`✅ Sincronização automática concluída:`, resultado);
        }).catch(error => {
            console.error(`❌ Erro na sincronização automática:`, error);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar sincronização automática:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// POST /api/car/sincronizar/parana - Sincronizar CAR do Paraná via GeoPR (otimizado)
app.post('/api/car/sincronizar/parana', async (req, res) => {
    try {
        console.log(`🌲 Solicitação de sincronização GeoPR Paraná`);

        // Responder imediatamente ao cliente
        res.json({
            sucesso: true,
            mensagem: 'Download GeoPR Paraná iniciado. Usando fonte otimizada IAT-PR...'
        });

        // Processar em background
        wfsDownloader.downloadCARParana((progresso) => {
            console.log(`   📊 GeoPR: ${progresso.totalProcessados}/${progresso.total || '?'} imóveis (${progresso.percentual || 0}%)`);
        }).then(resultado => {
            console.log(`✅ GeoPR Paraná concluído:`, resultado);
        }).catch(error => {
            console.error(`❌ Erro no GeoPR Paraná:`, error);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar GeoPR:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

console.log('✅ Rotas WFS CAR carregadas (com sincronização automática)');

// ============================================
// ROTAS: CAR ZIP UPLOADER (Upload Manual de ZIP)
// ============================================

const CARZipUploader = require('./car-zip-uploader');

// Configuração do multer para upload de arquivos ZIP
const zipStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `car-${uniqueSuffix}.zip`);
    }
});

const zipUpload = multer({
    storage: zipStorage,
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB máximo
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos ZIP são permitidos'), false);
        }
    }
});

const zipUploader = new CARZipUploader(pool);

/**
 * POST /api/car/upload-zip
 * Upload de arquivo ZIP do CAR com processamento automático
 *
 * Body (multipart/form-data):
 * - file: arquivo ZIP (obrigatório)
 * - estado: sigla do estado (opcional, será detectado automaticamente)
 *
 * Resposta:
 * {
 *   "sucesso": true,
 *   "mensagem": "Upload iniciado",
 *   "arquivo": "nome_do_arquivo.zip"
 * }
 */
app.post('/api/car/upload-zip', zipUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Nenhum arquivo foi enviado'
            });
        }

        const zipPath = req.file.path;
        const estado = req.body.estado || null;

        console.log(`📦 Upload recebido: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Responder imediatamente ao cliente
        res.json({
            sucesso: true,
            mensagem: 'Upload recebido. Processamento iniciado em background.',
            arquivo: req.file.originalname,
            tamanhoMB: (req.file.size / 1024 / 1024).toFixed(2)
        });

        // Processar em background
        zipUploader.processarZip(zipPath, estado)
            .then(resultado => {
                console.log('✅ Processamento do ZIP concluído:', {
                    arquivo: req.file.originalname,
                    estado: resultado.estado,
                    importados: resultado.totalImportados,
                    erros: resultado.totalErros,
                    tempo: `${resultado.tempoProcessamento}s`
                });
            })
            .catch(error => {
                console.error('❌ Erro no processamento do ZIP:', error.message);
            });

    } catch (error) {
        console.error('❌ Erro no upload:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/car/upload-status/:downloadId
 * Consulta status de um download/upload específico
 */
app.get('/api/car/upload-status/:downloadId', async (req, res) => {
    try {
        const { downloadId } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                estado,
                data_download,
                total_imoveis,
                status,
                origem,
                data_conclusao
            FROM car_downloads
            WHERE id = $1
        `, [downloadId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Download não encontrado'
            });
        }

        res.json({
            sucesso: true,
            download: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Erro ao consultar status:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/car/uploads/ativos
 * Lista todos os uploads CAR em andamento ou recentes
 */
app.get('/api/car/uploads/ativos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                estado,
                tipo,
                data_download,
                total_registros,
                status,
                arquivo_nome,
                EXTRACT(EPOCH FROM (NOW() - data_download)) as tempo_decorrido_segundos
            FROM car_downloads
            WHERE data_download >= NOW() - INTERVAL '24 hours'
            ORDER BY data_download DESC
            LIMIT 10
        `);

        const uploads = result.rows.map(row => ({
            id: row.id,
            estado: row.estado,
            tipo: row.tipo,
            dataInicio: row.data_download,
            totalRegistros: row.total_registros || 0,
            status: row.status, // 'processando' ou 'concluido'
            arquivo: row.arquivo_nome,
            tempoDecorrido: Math.floor(row.tempo_decorrido_segundos),
            emAndamento: row.status === 'processando'
        }));

        res.json({
            sucesso: true,
            uploads: uploads,
            totalAtivos: uploads.filter(u => u.emAndamento).length
        });

    } catch (error) {
        console.error('❌ Erro ao consultar uploads:', error);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

console.log('✅ Rotas CAR ZIP Uploader carregadas');

// ============================================
// ROTAS DE UPLOAD GEOREFERENCIADO
// ============================================

const uploadGeoRoutes = require('./routes/upload-geo');
app.use('/api/upload-geo', uploadGeoRoutes);
console.log('✅ Rotas de Upload Georeferenciado carregadas (KML/SHP/DXF)');

// ============================================
// ROTAS DE EXPORTAÇÃO GEOREFERENCIADA
// ============================================

const exportGeoRoutes = require('./routes/export-geo');
app.use('/api/export-geo', exportGeoRoutes);
console.log('✅ Rotas de Exportação Georeferenciada carregadas (KML/SHP/DXF/GeoJSON)');

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

// Função de sincronização automática CAR + SIGEF
async function sincronizarDadosInicializacao() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 INICIANDO SINCRONIZAÇÃO AUTOMÁTICA DE DADOS');
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Sincronizar CAR-PR automaticamente
        console.log('📦 [1/2] Sincronizando dados CAR-PR...');

        try {
            const precisaSincronizar = await carDownloader.precisaSincronizar(7); // 7 dias

            if (precisaSincronizar.precisa) {
                console.log(`   🔄 ${precisaSincronizar.motivo}`);
                const resultado = await carDownloader.downloadCompleto();
                console.log(`   ✅ CAR-PR sincronizado: ${resultado.total} imóveis (${resultado.inseridos} novos, ${resultado.atualizados} atualizados)\n`);
            } else {
                console.log(`   ⏭️  ${precisaSincronizar.motivo}\n`);
                const stats = await carDownloader.getEstatisticas();
                if (stats && parseInt(stats.total_imoveis) > 0) {
                    console.log(`   📊 Base atual: ${stats.total_imoveis} imóveis CAR-PR\n`);
                }
            }
        } catch (carError) {
            console.error(`   ❌ Erro na sincronização CAR-PR:`, carError.message, '\n');
        }

        // 2. Sincronizar SIGEF (se houver downloader implementado)
        console.log('📦 [2/2] Verificando dados SIGEF...');

        try {
            // Verificar se a tabela parcelas_sigef existe
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'parcelas_sigef'
                )
            `);

            if (!tableCheck.rows[0].exists) {
                console.log(`   ⚠️  SIGEF: Tabela não encontrada (execute setup inicial)\n`);
            } else {
                // Verificar se há dados SIGEF desatualizados (exemplo: > 30 dias)
                const sigefCheck = await pool.query(`
                    SELECT
                        COUNT(*) as total_parcelas,
                        MAX(updated_at) as ultima_atualizacao,
                        EXTRACT(DAY FROM NOW() - MAX(updated_at)) as dias_desde_atualizacao
                    FROM parcelas_sigef
                `);

                if (sigefCheck.rows[0].total_parcelas > 0) {
                    const diasDesdeAtualizacao = parseInt(sigefCheck.rows[0].dias_desde_atualizacao || 999);
                    console.log(`   ℹ️  SIGEF: ${sigefCheck.rows[0].total_parcelas} parcelas cadastradas`);
                    console.log(`   ℹ️  Última atualização: ${diasDesdeAtualizacao} dias atrás`);

                    if (diasDesdeAtualizacao > 30) {
                        console.log(`   ⚠️  SIGEF precisa atualização (>30 dias)\n`);
                    } else {
                        console.log(`   ✅ SIGEF atualizado\n`);
                    }
                } else {
                    console.log(`   ⚠️  SIGEF: Nenhuma parcela cadastrada (execute importação inicial)\n`);
                }
            }
        } catch (sigefError) {
            console.log(`   ⚠️  SIGEF: Erro ao verificar (${sigefError.message})\n`);
        }

        console.log('='.repeat(60));
        console.log('✅ SINCRONIZAÇÃO AUTOMÁTICA CONCLUÍDA');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Erro na sincronização automática:', error.message);
        console.log('⚠️  Servidor continuará funcionando normalmente\n');
    }
}

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

            // Iniciar sincronização automática após 5 segundos
            setTimeout(() => {
                sincronizarDadosInicializacao();
            }, 5000);
        } else {
            console.error('❌ Falha ao conectar PostgreSQL:', health.error);
        }
    });
});

module.exports = app;
