const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');

class CARDownloader {
    constructor(pool) {
        this.pool = pool;
        this.downloadDir = path.join(__dirname, '../data/car');
        this.estados = ['PR', 'SC', 'RS', 'SP', 'MG', 'MS', 'GO', 'MT', 'DF'];

        // URLs base do CAR (público)
        // NOTA: URLs podem mudar, verificar em https://www.car.gov.br/
        this.urlBase = 'https://www.car.gov.br/publico/imoveis/shapefile';

        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }

        this.estados.forEach(estado => {
            const estadoDir = path.join(this.downloadDir, estado);
            if (!fs.existsSync(estadoDir)) {
                fs.mkdirSync(estadoDir, { recursive: true });
            }
        });
    }

    async downloadEstado(estado, tipo = 'imovel') {
        try {
            console.log(`📥 Iniciando download CAR: ${estado} - ${tipo}`);

            // Registrar download
            const downloadResult = await this.pool.query(`
                INSERT INTO car_downloads (estado, tipo, status)
                VALUES ($1, $2, 'processando')
                RETURNING id
            `, [estado, tipo]);

            const downloadId = downloadResult.rows[0].id;

            // IMPORTANTE: CAR requer autenticação gov.br
            // Para download automatizado, seria necessário:
            // 1. Certificado digital ou login gov.br
            // 2. Token de acesso à API
            // 3. Ou download manual dos shapefiles

            console.log(`⚠️  ATENÇÃO: Download CAR requer autenticação gov.br`);
            console.log(`📌 Para continuar:`);
            console.log(`   1. Acesse: https://www.car.gov.br/publico/imoveis/index`);
            console.log(`   2. Faça login com certificado digital`);
            console.log(`   3. Baixe shapefile do estado ${estado}`);
            console.log(`   4. Coloque em: ${this.downloadDir}/${estado}/`);
            console.log(`   5. Execute: importarShapefileManual('${estado}', 'caminho/arquivo.shp')`);

            // Marcar como pendente de download manual
            await this.pool.query(`
                UPDATE car_downloads
                SET status = 'pendente_manual',
                    erro_mensagem = 'Requer download manual via gov.br'
                WHERE id = $1
            `, [downloadId]);

            return {
                sucesso: false,
                download_id: downloadId,
                mensagem: 'Download CAR requer autenticação gov.br. Veja instruções no console.'
            };

        } catch (error) {
            console.error(`❌ Erro no download ${estado}:`, error.message);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async importarShapefileManual(estado, shapefilePath) {
        try {
            console.log(`📊 Importando shapefile CAR: ${shapefilePath}`);

            // Verificar se arquivo existe
            if (!fs.existsSync(shapefilePath)) {
                throw new Error('Arquivo shapefile não encontrado');
            }

            // Buscar ou criar download
            let downloadResult = await this.pool.query(`
                SELECT id FROM car_downloads
                WHERE estado = $1 AND tipo = 'imovel' AND status = 'pendente_manual'
                ORDER BY data_download DESC
                LIMIT 1
            `, [estado]);

            let downloadId;
            if (downloadResult.rows.length === 0) {
                const insert = await this.pool.query(`
                    INSERT INTO car_downloads (estado, tipo, status)
                    VALUES ($1, 'imovel', 'processando')
                    RETURNING id
                `, [estado]);
                downloadId = insert.rows[0].id;
            } else {
                downloadId = downloadResult.rows[0].id;
                await this.pool.query(`
                    UPDATE car_downloads SET status = 'processando' WHERE id = $1
                `, [downloadId]);
            }

            let count = 0;

            // Abrir shapefile
            const source = await shapefile.open(shapefilePath);

            // Processar features
            let result = await source.read();

            while (!result.done) {
                const feature = result.value;

                if (feature && feature.geometry && feature.properties) {
                    await this.inserirImovelCAR(feature, downloadId, estado);
                    count++;

                    if (count % 100 === 0) {
                        console.log(`   ⏳ Processados: ${count} registros`);
                    }
                }

                result = await source.read();
            }

            // Atualizar status
            await this.pool.query(`
                UPDATE car_downloads
                SET status = 'concluido',
                    total_registros = $1,
                    arquivo_nome = $2
                WHERE id = $3
            `, [count, path.basename(shapefilePath), downloadId]);

            console.log(`✅ Importação concluída: ${count} imóveis CAR`);

            return {
                sucesso: true,
                downloadId,
                totalRegistros: count
            };

        } catch (error) {
            console.error('Erro ao importar shapefile CAR:', error);
            throw error;
        }
    }

    async inserirImovelCAR(feature, downloadId, estado) {
        const props = feature.properties;
        const geom = feature.geometry;

        // Converter GeoJSON para WKT
        const wkt = this.geojsonToWKT(geom);

        try {
            await this.pool.query(`
                INSERT INTO car_imoveis (
                    download_id, codigo_imovel, numero_car, cpf_cnpj,
                    nome_proprietario, estado, municipio,
                    area_imovel, area_vegetacao_nativa, area_app,
                    area_reserva_legal, area_uso_consolidado,
                    status_car, tipo_imovel, geometry
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    ST_GeomFromText($15, 31982)
                )
                ON CONFLICT (codigo_imovel) DO UPDATE SET
                    updated_at = CURRENT_TIMESTAMP
            `, [
                downloadId,
                props.cod_imovel || props.codigo || null,
                props.num_car || props.numero_car || null,
                props.cpf_cnpj || null,
                props.nome_prop || props.proprietario || null,
                estado,
                props.municipio || props.nom_munic || null,
                props.area_ha || props.area_imovel || null,
                props.area_vn || props.vegetacao_nativa || null,
                props.area_app || null,
                props.area_rl || props.reserva_legal || null,
                props.area_uc || props.uso_consolidado || null,
                props.status || 'ativo',
                props.tipo || this.classificarTipoImovel(props.area_ha),
                wkt
            ]);

        } catch (error) {
            console.error('Erro ao inserir imóvel CAR:', error.message);
            // Continuar processamento
        }
    }

    classificarTipoImovel(areaHa) {
        if (!areaHa) return 'nao_classificado';
        if (areaHa <= 4) return 'pequena_propriedade';
        if (areaHa <= 15) return 'media_propriedade';
        return 'grande_propriedade';
    }

    geojsonToWKT(geometry) {
        if (geometry.type === 'Polygon') {
            const coords = geometry.coordinates[0];
            const points = coords.map(c => `${c[0]} ${c[1]}`).join(',');
            return `POLYGON((${points}))`;
        } else if (geometry.type === 'MultiPolygon') {
            const polygons = geometry.coordinates.map(poly => {
                const coords = poly[0];
                const points = coords.map(c => `${c[0]} ${c[1]}`).join(',');
                return `((${points}))`;
            }).join(',');
            return `MULTIPOLYGON(${polygons})`;
        }
        throw new Error('Tipo de geometria não suportado: ' + geometry.type);
    }
}

module.exports = CARDownloader;
