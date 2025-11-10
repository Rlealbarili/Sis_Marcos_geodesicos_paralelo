/**
 * Rotas para exportação de dados georeferenciados
 * Suporta: KML, GeoJSON, Shapefile, DXF
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const tokml = require('tokml');
const shpwrite = require('shp-write');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5434,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'marcos123',
    database: process.env.DB_NAME || 'marcos_geodesicos'
});

/**
 * Buscar confrontantes de uma propriedade
 */
async function buscarConfrontantes(propriedadeId) {
    const query = `
        SELECT
            c.parcela_sigef_id,
            c.tipo_contato,
            c.distancia_m,
            c.comprimento_contato_m,
            c.azimute,
            sp.codigo_parcela,
            sp.proprietario,
            sp.area_hectares,
            sp.municipio,
            sp.matricula,
            sp.situacao_parcela,
            ST_AsGeoJSON(ST_Transform(sp.geometry, 4326)) as geometry
        FROM sigef_confrontantes c
        JOIN sigef_parcelas sp ON c.parcela_vizinha_id = sp.id
        WHERE c.parcela_id = $1
        ORDER BY c.distancia_m
    `;

    const result = await pool.query(query, [propriedadeId]);
    return result.rows;
}

/**
 * Buscar sobreposições de uma propriedade
 */
async function buscarSobreposicoes(propriedadeId) {
    const query = `
        SELECT * FROM analisar_sobreposicao($1)
    `;

    const result = await pool.query(query, [propriedadeId]);
    return result.rows;
}

/**
 * Converter para GeoJSON
 */
function converterParaGeoJSON(dados, tipo) {
    const features = dados.map(item => {
        let geometry;

        if (tipo === 'sobreposicao') {
            // Para sobreposições, usar geometria da interseção
            geometry = JSON.parse(item.geometria_intersecao);
        } else {
            // Para confrontantes, usar geometria completa
            geometry = JSON.parse(item.geometry);
        }

        const properties = {};
        for (const key in item) {
            if (key !== 'geometry' && key !== 'geometria_intersecao' && key !== 'geometria_parcela_completa') {
                properties[key] = item[key];
            }
        }

        return {
            type: 'Feature',
            properties: properties,
            geometry: geometry
        };
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
}

/**
 * Converter GeoJSON para KML
 */
function converterParaKML(geojson, nome) {
    return tokml(geojson, {
        name: 'nome',
        description: 'proprietario'
    });
}

/**
 * Converter GeoJSON para DXF (simplificado)
 */
function converterParaDXF(geojson) {
    let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1014
0
ENDSEC
0
SECTION
2
ENTITIES
`;

    geojson.features.forEach((feature, index) => {
        if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];

            dxf += `0
LWPOLYLINE
5
${index.toString(16).toUpperCase()}
8
0
90
${coords.length}
70
1
`;

            coords.forEach(coord => {
                dxf += `10
${coord[0]}
20
${coord[1]}
`;
            });
        }
    });

    dxf += `0
ENDSEC
0
EOF
`;

    return dxf;
}

// ============================================
// ROTAS DE EXPORTAÇÃO
// ============================================

/**
 * Exportar confrontantes em GeoJSON
 */
router.get('/confrontantes/:propriedadeId/geojson', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const confrontantes = await buscarConfrontantes(propriedadeId);

        if (confrontantes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum confrontante encontrado'
            });
        }

        const geojson = converterParaGeoJSON(confrontantes, 'confrontante');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="confrontantes_${propriedadeId}.geojson"`);
        res.json(geojson);

    } catch (error) {
        console.error('Erro ao exportar GeoJSON:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar GeoJSON',
            error: error.message
        });
    }
});

/**
 * Exportar confrontantes em KML
 */
router.get('/confrontantes/:propriedadeId/kml', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const confrontantes = await buscarConfrontantes(propriedadeId);

        if (confrontantes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum confrontante encontrado'
            });
        }

        const geojson = converterParaGeoJSON(confrontantes, 'confrontante');
        const kml = converterParaKML(geojson, `Confrontantes - Propriedade ${propriedadeId}`);

        res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.setHeader('Content-Disposition', `attachment; filename="confrontantes_${propriedadeId}.kml"`);
        res.send(kml);

    } catch (error) {
        console.error('Erro ao exportar KML:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar KML',
            error: error.message
        });
    }
});

/**
 * Exportar confrontantes em DXF
 */
router.get('/confrontantes/:propriedadeId/dxf', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const confrontantes = await buscarConfrontantes(propriedadeId);

        if (confrontantes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum confrontante encontrado'
            });
        }

        const geojson = converterParaGeoJSON(confrontantes, 'confrontante');
        const dxf = converterParaDXF(geojson);

        res.setHeader('Content-Type', 'application/dxf');
        res.setHeader('Content-Disposition', `attachment; filename="confrontantes_${propriedadeId}.dxf"`);
        res.send(dxf);

    } catch (error) {
        console.error('Erro ao exportar DXF:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar DXF',
            error: error.message
        });
    }
});

/**
 * Exportar confrontantes em Shapefile
 */
router.get('/confrontantes/:propriedadeId/shapefile', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const confrontantes = await buscarConfrontantes(propriedadeId);

        if (confrontantes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum confrontante encontrado'
            });
        }

        const geojson = converterParaGeoJSON(confrontantes, 'confrontante');

        // Criar shapefile usando shp-write
        const options = {
            folder: `confrontantes_${propriedadeId}`,
            types: {
                polygon: `confrontantes_${propriedadeId}`
            }
        };

        const zipBuffer = await shpwrite.zip(geojson, options);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="confrontantes_${propriedadeId}.zip"`);
        res.send(zipBuffer);

    } catch (error) {
        console.error('Erro ao exportar Shapefile:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar Shapefile',
            error: error.message
        });
    }
});

/**
 * Exportar sobreposições em GeoJSON
 */
router.get('/sobreposicoes/:propriedadeId/geojson', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const sobreposicoes = await buscarSobreposicoes(propriedadeId);

        if (sobreposicoes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhuma sobreposição encontrada'
            });
        }

        const geojson = converterParaGeoJSON(sobreposicoes, 'sobreposicao');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="sobreposicoes_${propriedadeId}.geojson"`);
        res.json(geojson);

    } catch (error) {
        console.error('Erro ao exportar GeoJSON:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar GeoJSON',
            error: error.message
        });
    }
});

/**
 * Exportar sobreposições em KML
 */
router.get('/sobreposicoes/:propriedadeId/kml', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const sobreposicoes = await buscarSobreposicoes(propriedadeId);

        if (sobreposicoes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhuma sobreposição encontrada'
            });
        }

        const geojson = converterParaGeoJSON(sobreposicoes, 'sobreposicao');
        const kml = converterParaKML(geojson, `Sobreposições - Propriedade ${propriedadeId}`);

        res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.setHeader('Content-Disposition', `attachment; filename="sobreposicoes_${propriedadeId}.kml"`);
        res.send(kml);

    } catch (error) {
        console.error('Erro ao exportar KML:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar KML',
            error: error.message
        });
    }
});

/**
 * Exportar sobreposições em DXF
 */
router.get('/sobreposicoes/:propriedadeId/dxf', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const sobreposicoes = await buscarSobreposicoes(propriedadeId);

        if (sobreposicoes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhuma sobreposição encontrada'
            });
        }

        const geojson = converterParaGeoJSON(sobreposicoes, 'sobreposicao');
        const dxf = converterParaDXF(geojson);

        res.setHeader('Content-Type', 'application/dxf');
        res.setHeader('Content-Disposition', `attachment; filename="sobreposicoes_${propriedadeId}.dxf"`);
        res.send(dxf);

    } catch (error) {
        console.error('Erro ao exportar DXF:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar DXF',
            error: error.message
        });
    }
});

/**
 * Exportar sobreposições em Shapefile
 */
router.get('/sobreposicoes/:propriedadeId/shapefile', async (req, res) => {
    try {
        const { propriedadeId } = req.params;

        const sobreposicoes = await buscarSobreposicoes(propriedadeId);

        if (sobreposicoes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhuma sobreposição encontrada'
            });
        }

        const geojson = converterParaGeoJSON(sobreposicoes, 'sobreposicao');

        const options = {
            folder: `sobreposicoes_${propriedadeId}`,
            types: {
                polygon: `sobreposicoes_${propriedadeId}`
            }
        };

        const zipBuffer = await shpwrite.zip(geojson, options);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="sobreposicoes_${propriedadeId}.zip"`);
        res.send(zipBuffer);

    } catch (error) {
        console.error('Erro ao exportar Shapefile:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar Shapefile',
            error: error.message
        });
    }
});

module.exports = router;
