const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env', override: true });
const { query, transaction, healthCheck, pool } = require('./database/postgres-connection');
const SIGEFDownloader = require('./sigef-downloader');
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

// POST /api/marcos - Criar novo marco
app.post('/api/marcos', async (req, res) => {
    try {
        const { codigo, tipo, municipio, estado, latitude, longitude, altitude, observacoes } = req.body;

        console.log('[Criar Marco] Dados recebidos:', { codigo, tipo, municipio, latitude, longitude });

        // Validação
        if (!codigo || !municipio || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios: codigo, municipio, latitude, longitude'
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

        // Criar geometria PostGIS (SRID 4326 = WGS84)
        const geomSQL = `ST_SetSRID(ST_MakePoint($1, $2), 4326)`;

        // Inserir marco
        const result = await query(`
            INSERT INTO marcos_levantados
            (codigo, tipo, municipio, estado, latitude, longitude, altitude, geom, observacoes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, ${geomSQL}, $8, $9)
            RETURNING id, codigo, tipo, municipio, estado, latitude, longitude, altitude,
                      ST_AsGeoJSON(geom)::json as geojson, observacoes, status
        `, [
            codigo,
            tipo || 'M',
            municipio,
            estado || 'PR',
            latitude,
            longitude,
            altitude || null,
            longitude, // para geom
            latitude,  // para geom
            observacoes || null,
            'ATIVO'
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

console.log('✅ Endpoint POST /api/marcos carregado');

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

// Rotas de Propriedades
const propriedadesRoutes = require('./routes/propriedades');
app.use('/api/propriedades', propriedadesRoutes);
console.log('✅ Rotas de propriedades carregadas: /api/propriedades');

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
                ST_AsGeoJSON(geometry) as geometry
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

// Listar propriedades com score de viabilidade
app.get('/api/propriedades/com-score', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.nome_propriedade,
                p.matricula,
                p.municipio,
                p.area_calculada,
                (SELECT score_total FROM calcular_score_viabilidade(p.id)) as score,
                (SELECT nivel_risco FROM calcular_score_viabilidade(p.id)) as nivel_risco,
                (SELECT tem_sobreposicao FROM calcular_score_viabilidade(p.id)) as tem_sobreposicao
            FROM propriedades p
            WHERE p.geometry IS NOT NULL
            ORDER BY score ASC
            LIMIT 50
        `);

        res.json(result.rows);
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

        // Obter confrontantes usando SpatialAnalyzer
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 100);
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

        // Obter confrontantes
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 100);
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

        // Obter confrontantes
        const resultado = await spatialAnalyzer.identificarConfrontantes(propriedadeId, 100);
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
                COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as marcos_levantados,
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
                SELECT criado_em as created_at FROM marcos_levantados WHERE criado_em >= NOW() - INTERVAL '30 days'
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

const CARDownloader = require('./car-downloader');
const CARAnalyzer = require('./car-analyzer');

const carDownloader = new CARDownloader(pool);
const carAnalyzer = new CARAnalyzer(pool);

// =====================================================
// ROTAS CAR - CADASTRO AMBIENTAL RURAL
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
        const { estado } = req.query;

        console.log(`📊 Buscando estatísticas CAR${estado ? ` - ${estado}` : ''}`);

        const estatisticas = await carAnalyzer.obterEstatisticasCAR(estado || null);

        res.json({
            sucesso: true,
            estatisticas
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas CAR:', error);
        res.status(500).json({ erro: error.message });
    }
});

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

console.log('✅ Rotas CAR carregadas');

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
