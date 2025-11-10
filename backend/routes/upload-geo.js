/**
 * Rotas para upload e processamento de arquivos georeferenciados
 * Suporta: KML, KMZ, SHP (Shapefile), GeoJSON, DXF
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { DOMParser } = require('@xmldom/xmldom');
const toGeoJSON = require('@tmcw/togeojson');
const shapefile = require('shapefile');
const DxfParser = require('dxf-parser');
const JSZip = require('jszip');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5434,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'marcos123',
    database: process.env.DB_NAME || 'marcos_geodesicos'
});

// Configurar multer para upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'geo');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'geo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.kml', '.kmz', '.shp', '.zip', '.geojson', '.json', '.dxf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Formato não suportado: ${ext}. Use: ${allowedExtensions.join(', ')}`));
        }
    }
});

/**
 * Processa arquivo KML
 */
async function processarKML(filePath) {
    const kmlContent = await fs.readFile(filePath, 'utf8');
    const kml = new DOMParser().parseFromString(kmlContent, 'text/xml');
    const geojson = toGeoJSON.kml(kml);
    return geojson;
}

/**
 * Processa arquivo KMZ (KML compactado)
 */
async function processarKMZ(filePath) {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);

    // Procurar arquivo .kml dentro do zip
    let kmlFile = null;
    for (const [filename, file] of Object.entries(zip.files)) {
        if (filename.toLowerCase().endsWith('.kml')) {
            kmlFile = file;
            break;
        }
    }

    if (!kmlFile) {
        throw new Error('Arquivo KML não encontrado dentro do KMZ');
    }

    const kmlContent = await kmlFile.async('string');
    const kml = new DOMParser().parseFromString(kmlContent, 'text/xml');
    const geojson = toGeoJSON.kml(kml);
    return geojson;
}

/**
 * Processa Shapefile (.shp + .dbf + .shx)
 */
async function processarShapefile(filePath) {
    // Se for um ZIP, extrair arquivos
    if (filePath.toLowerCase().endsWith('.zip')) {
        const data = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(data);

        // Extrair .shp e .dbf
        const files = {};
        for (const [filename, file] of Object.entries(zip.files)) {
            const ext = path.extname(filename).toLowerCase();
            if (['.shp', '.dbf', '.shx', '.prj'].includes(ext)) {
                files[ext] = await file.async('nodebuffer');
            }
        }

        if (!files['.shp'] || !files['.dbf']) {
            throw new Error('Shapefile incompleto. Necessário .shp e .dbf');
        }

        // Processar shapefile da memória
        const features = [];
        await shapefile.open(files['.shp'], files['.dbf'])
            .then(source => source.read()
                .then(function log(result) {
                    if (result.done) return features;
                    features.push(result.value);
                    return source.read().then(log);
                })
            );

        return {
            type: 'FeatureCollection',
            features: features
        };
    } else {
        // Processar shapefile diretamente
        const features = [];
        const dbfPath = filePath.replace('.shp', '.dbf');

        await shapefile.open(filePath, dbfPath)
            .then(source => source.read()
                .then(function log(result) {
                    if (result.done) return features;
                    features.push(result.value);
                    return source.read().then(log);
                })
            );

        return {
            type: 'FeatureCollection',
            features: features
        };
    }
}

/**
 * Processa arquivo DXF
 */
async function processarDXF(filePath) {
    const dxfContent = await fs.readFile(filePath, 'utf8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfContent);

    if (!dxf || !dxf.entities) {
        throw new Error('Arquivo DXF inválido ou sem entidades');
    }

    // Converter entidades DXF para GeoJSON
    const features = [];

    for (const entity of dxf.entities) {
        if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            const coordinates = entity.vertices.map(v => [v.x, v.y]);

            // Fechar polígono se necessário
            if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
                coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
                coordinates.push([...coordinates[0]]);
            }

            features.push({
                type: 'Feature',
                properties: {
                    layer: entity.layer,
                    handle: entity.handle
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                }
            });
        }
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
}

/**
 * Processa GeoJSON
 */
async function processarGeoJSON(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
}

/**
 * Calcular área e perímetro usando PostGIS
 */
async function calcularMedidas(geojson) {
    const query = `
        SELECT
            ST_Area(ST_Transform(ST_GeomFromGeoJSON($1), 31982)) as area_m2,
            ST_Perimeter(ST_Transform(ST_GeomFromGeoJSON($1), 31982)) as perimetro_m
    `;

    const result = await pool.query(query, [JSON.stringify(geojson)]);
    return {
        area_m2: parseFloat(result.rows[0].area_m2),
        area_ha: parseFloat(result.rows[0].area_m2) / 10000,
        perimetro_m: parseFloat(result.rows[0].perimetro_m)
    };
}

/**
 * Inserir propriedade no banco
 */
async function inserirPropriedade(dados) {
    const query = `
        INSERT INTO propriedades (
            cliente_id,
            nome_propriedade,
            matricula,
            tipo,
            municipio,
            comarca,
            uf,
            area_m2,
            perimetro_m,
            geometry,
            observacoes,
            exibir_no_mapa
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            ST_Transform(ST_GeomFromGeoJSON($10), 31982),
            $11,
            true
        )
        RETURNING id, nome_propriedade, area_m2, perimetro_m
    `;

    const values = [
        dados.cliente_id || 1,
        dados.nome_propriedade,
        dados.matricula || 'IMPORT-' + Date.now(),
        dados.tipo || 'RURAL',
        dados.municipio || 'A definir',
        dados.comarca || 'A definir',
        dados.uf || 'PR',
        dados.area_m2,
        dados.perimetro_m,
        dados.geojson,
        dados.observacoes || `Importado de arquivo ${dados.tipo_arquivo} em ${new Date().toLocaleString('pt-BR')}`
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}

// ============================================
// ROTA: Upload e importação de arquivo
// ============================================

router.post('/upload', upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo enviado'
            });
        }

        const { cliente_id, nome_propriedade, municipio, tipo } = req.body;
        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();

        console.log(`📥 Processando arquivo: ${req.file.originalname} (${ext})`);

        let geojson;

        // Processar arquivo baseado na extensão
        switch (ext) {
            case '.kml':
                geojson = await processarKML(filePath);
                break;
            case '.kmz':
                geojson = await processarKMZ(filePath);
                break;
            case '.shp':
            case '.zip':
                geojson = await processarShapefile(filePath);
                break;
            case '.dxf':
                geojson = await processarDXF(filePath);
                break;
            case '.geojson':
            case '.json':
                geojson = await processarGeoJSON(filePath);
                break;
            default:
                throw new Error(`Formato não suportado: ${ext}`);
        }

        console.log(`✅ Arquivo processado: ${geojson.features?.length || 1} feição(ões)`);

        // Se for FeatureCollection, pegar primeira feature
        let geometry;
        if (geojson.type === 'FeatureCollection') {
            if (geojson.features.length === 0) {
                throw new Error('Arquivo não contém nenhuma geometria');
            }
            geometry = geojson.features[0].geometry;
        } else if (geojson.type === 'Feature') {
            geometry = geojson.geometry;
        } else {
            geometry = geojson;
        }

        // Validar que é um polígono
        if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
            throw new Error(`Geometria deve ser Polygon ou MultiPolygon, recebido: ${geometry.type}`);
        }

        // Calcular medidas
        const medidas = await calcularMedidas(geometry);

        // Inserir propriedade
        const propriedade = await inserirPropriedade({
            cliente_id: cliente_id || 1,
            nome_propriedade: nome_propriedade || path.basename(req.file.originalname, ext),
            municipio: municipio,
            tipo: tipo || 'RURAL',
            area_m2: medidas.area_m2,
            perimetro_m: medidas.perimetro_m,
            geojson: JSON.stringify(geometry),
            tipo_arquivo: ext
        });

        // Limpar arquivo temporário
        await fs.unlink(filePath);

        console.log(`✅ Propriedade importada: ID ${propriedade.id}`);

        res.json({
            success: true,
            message: 'Propriedade importada com sucesso',
            propriedade: {
                ...propriedade,
                area_ha: medidas.area_ha
            },
            medidas: medidas
        });

    } catch (error) {
        console.error('❌ Erro ao processar arquivo:', error);

        // Limpar arquivo em caso de erro
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                // Ignorar erro de limpeza
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao processar arquivo',
            error: error.message
        });
    }
});

module.exports = router;
