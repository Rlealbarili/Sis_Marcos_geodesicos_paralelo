/**
 * CAR-PR Downloader - Download completo da base CAR do Paraná
 * Fonte: GeoPR (IAT-PR) via WFS
 * Similar ao sigef-downloader.js
 */

class CARPRDownloader {
    constructor(pool) {
        this.pool = pool;
        this.wfsUrl = 'https://geoserver.pr.gov.br/geoserver/wfs';
        this.layerName = 'base_geo:area_imovel_car';
        this.srsName = 'EPSG:31982'; // SIRGAS 2000 UTM 22S
    }

    /**
     * Download completo de todos os imóveis CAR do Paraná
     */
    async downloadCompleto() {
        console.log('\n🌾 Iniciando download completo CAR-PR via GeoPR...');

        const client = await this.pool.connect();

        try {
            const dataInicio = new Date();

            // 1. Registrar início do download
            await client.query(`
                INSERT INTO car_downloads (estado, tipo, status, data_download, data_inicio, fonte)
                VALUES ('PR', 'area_imovel', 'processando', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'GeoPR')
                ON CONFLICT (estado, tipo) DO UPDATE SET
                    status = 'processando',
                    data_download = CURRENT_TIMESTAMP,
                    data_inicio = CURRENT_TIMESTAMP,
                    data_fim = NULL,
                    total_registros = NULL,
                    registros_inseridos = NULL,
                    registros_atualizados = NULL,
                    erro_mensagem = NULL,
                    fonte = 'GeoPR'
            `);

            // 2. Construir requisição WFS GetFeature
            const wfsRequest = `${this.wfsUrl}?` +
                `service=WFS&` +
                `version=2.0.0&` +
                `request=GetFeature&` +
                `typeName=${this.layerName}&` +
                `outputFormat=application/json&` +
                `srsName=${this.srsName}`;

            console.log('📥 Baixando dados do GeoPR (IAT-PR)...');
            console.log(`   URL: ${this.wfsUrl}`);
            console.log(`   Camada: ${this.layerName}`);

            // 3. Download via fetch (dynamic import para compatibilidade)
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(wfsRequest, {
                timeout: 600000  // 10 minutos (pode ser uma base grande)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const geojson = await response.json();
            const features = geojson.features || [];

            console.log(`✅ ${features.length} imóveis CAR baixados do GeoPR`);

            if (features.length === 0) {
                throw new Error('Nenhum imóvel CAR retornado pelo GeoPR');
            }

            // 4. Inserir/atualizar no banco (em lote com transação)
            let inseridos = 0;
            let atualizados = 0;
            let erros = 0;

            await client.query('BEGIN');

            for (const feature of features) {
                try {
                    const props = feature.properties;
                    const geom = feature.geometry;

                    // Normalizar propriedades (campos podem variar)
                    const codigoCAR = props.codigo_car || props.cod_imovel || props.car || null;
                    const municipio = props.municipio || props.nome_municipio || props.nom_munici || null;
                    const areaHa = props.area_ha || (props.area_m2 ? props.area_m2 / 10000 : null) || (props.num_area ? parseFloat(props.num_area) : null);
                    const areaM2 = props.area_m2 || (props.area_ha ? props.area_ha * 10000 : null) || (areaHa ? areaHa * 10000 : null);
                    const situacao = props.situacao || props.ind_status || props.status || 'Ativo';
                    const dataCadastro = props.data_cadastro || props.dat_cadast || props.dt_cadastr || null;

                    if (!codigoCAR) {
                        console.warn(`   ⚠️  Imóvel sem código CAR, pulando...`);
                        erros++;
                        continue;
                    }

                    // Calcular perímetro se tiver geometria
                    let perimetroM = null;
                    if (geom) {
                        try {
                            const perimResult = await client.query(`
                                SELECT ST_Perimeter(ST_GeomFromGeoJSON($1)::geography) as perimetro
                            `, [JSON.stringify(geom)]);
                            perimetroM = parseFloat(perimResult.rows[0].perimetro);
                        } catch (perimError) {
                            console.warn(`   ⚠️  Erro ao calcular perímetro: ${perimError.message}`);
                        }
                    }

                    // Inserir/atualizar
                    const result = await client.query(`
                        INSERT INTO car_imoveis (
                            codigo_car, municipio, uf, area_ha, area_m2, perimetro_m,
                            situacao, data_cadastro, geometry
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8,
                            ST_GeomFromGeoJSON($9)
                        )
                        ON CONFLICT (codigo_car) DO UPDATE SET
                            municipio = EXCLUDED.municipio,
                            area_ha = EXCLUDED.area_ha,
                            area_m2 = EXCLUDED.area_m2,
                            perimetro_m = EXCLUDED.perimetro_m,
                            situacao = EXCLUDED.situacao,
                            data_cadastro = EXCLUDED.data_cadastro,
                            geometry = EXCLUDED.geometry,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING (xmax = 0) AS inserted
                    `, [
                        codigoCAR,
                        municipio,
                        'PR',
                        areaHa,
                        areaM2,
                        perimetroM,
                        situacao,
                        dataCadastro,
                        JSON.stringify(geom)
                    ]);

                    if (result.rows[0].inserted) {
                        inseridos++;
                    } else {
                        atualizados++;
                    }

                    // Log a cada 1000 registros
                    if ((inseridos + atualizados) % 1000 === 0) {
                        console.log(`   📊 Processados: ${inseridos + atualizados}/${features.length}`);
                    }

                } catch (insertError) {
                    console.error(`   ❌ Erro ao inserir imóvel:`, insertError.message);
                    erros++;
                    // Continuar processando outros registros
                }
            }

            await client.query('COMMIT');

            const dataFim = new Date();
            const tempoTotal = ((dataFim - dataInicio) / 1000).toFixed(2);

            // 5. Atualizar status do download
            await client.query(`
                UPDATE car_downloads
                SET status = 'concluido',
                    data_fim = $1,
                    total_registros = $2,
                    registros_inseridos = $3,
                    registros_atualizados = $4
                WHERE estado = 'PR' AND tipo = 'area_imovel'
            `, [dataFim, features.length, inseridos, atualizados]);

            console.log(`\n✅ Download CAR-PR concluído!`);
            console.log(`   ⏱️  Tempo total: ${tempoTotal}s`);
            console.log(`   📊 Total de imóveis: ${features.length}`);
            console.log(`   ➕ Inseridos: ${inseridos}`);
            console.log(`   🔄 Atualizados: ${atualizados}`);
            if (erros > 0) {
                console.log(`   ⚠️  Erros: ${erros}`);
            }

            return {
                sucesso: true,
                total: features.length,
                inseridos,
                atualizados,
                erros,
                tempo_segundos: parseFloat(tempoTotal)
            };

        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});

            // Registrar erro
            await client.query(`
                UPDATE car_downloads
                SET status = 'erro',
                    data_fim = CURRENT_TIMESTAMP,
                    erro_mensagem = $1
                WHERE estado = 'PR' AND tipo = 'area_imovel'
            `, [error.message]).catch(() => {});

            console.error('❌ Erro ao baixar CAR-PR:', error);
            throw error;

        } finally {
            client.release();
        }
    }

    /**
     * Obter informações da última atualização
     */
    async getUltimaAtualizacao() {
        const result = await this.pool.query(`
            SELECT
                data_download,
                data_inicio,
                data_fim,
                total_registros,
                registros_inseridos,
                registros_atualizados,
                status,
                fonte,
                erro_mensagem
            FROM car_downloads
            WHERE estado = 'PR' AND tipo = 'area_imovel'
            ORDER BY data_download DESC
            LIMIT 1
        `);

        return result.rows[0] || null;
    }

    /**
     * Obter estatísticas gerais do CAR-PR
     */
    async getEstatisticas() {
        const result = await this.pool.query(`
            SELECT
                COUNT(*) as total_imoveis,
                COUNT(DISTINCT municipio) as total_municipios,
                SUM(area_ha) as area_total_ha,
                AVG(area_ha) as area_media_ha,
                MIN(area_ha) as area_minima_ha,
                MAX(area_ha) as area_maxima_ha,
                COUNT(CASE WHEN situacao = 'Ativo' THEN 1 END) as imoveis_ativos,
                COUNT(CASE WHEN situacao = 'Pendente' THEN 1 END) as imoveis_pendentes,
                COUNT(CASE WHEN situacao = 'Cancelado' THEN 1 END) as imoveis_cancelados,
                MAX(created_at) as ultima_importacao
            FROM car_imoveis
            WHERE uf = 'PR'
        `);

        return result.rows[0];
    }

    /**
     * Obter estatísticas por município
     */
    async getEstatisticasMunicipio(municipio) {
        const result = await this.pool.query(`
            SELECT
                municipio,
                COUNT(*) as total_imoveis,
                SUM(area_ha) as area_total_ha,
                AVG(area_ha) as area_media_ha,
                COUNT(CASE WHEN situacao = 'Ativo' THEN 1 END) as imoveis_ativos
            FROM car_imoveis
            WHERE uf = 'PR'
                AND ($1::VARCHAR IS NULL OR municipio ILIKE $1)
            GROUP BY municipio
            ORDER BY total_imoveis DESC
        `, [municipio || null]);

        return result.rows;
    }

    /**
     * Verificar se precisa sincronizar (baseado na última atualização)
     */
    async precisaSincronizar(diasParaRevalidar = 7) {
        const ultimaAtualizacao = await this.getUltimaAtualizacao();

        if (!ultimaAtualizacao) {
            return { precisa: true, motivo: 'Primeira sincronização' };
        }

        if (ultimaAtualizacao.status === 'erro') {
            return { precisa: true, motivo: 'Última sincronização falhou' };
        }

        const diasDesdeAtualizacao = Math.floor(
            (Date.now() - new Date(ultimaAtualizacao.data_download)) / (1000 * 60 * 60 * 24)
        );

        if (diasDesdeAtualizacao >= diasParaRevalidar) {
            return {
                precisa: true,
                motivo: `Última sincronização há ${diasDesdeAtualizacao} dias`
            };
        }

        return {
            precisa: false,
            motivo: `Sincronização recente (há ${diasDesdeAtualizacao} dias)`
        };
    }
}

module.exports = CARPRDownloader;
