const fetch = require('node-fetch');

/**
 * SIGEF GeoPR REST API Downloader
 *
 * Baixa dados SIGEF diretamente do portal GeoPR-IAT (Governo do Paraná)
 * usando a API REST do ArcGIS FeatureServer.
 *
 * Fonte: https://geopr.iat.pr.gov.br/portal/home/item.html?id=2d9b72716c894e04b8bbb05abd1b3837
 *
 * DESCOBERTA: 134.213 parcelas certificadas SIGEF disponíveis para PR!
 * (vs. 2.094 importadas atualmente = 86% faltando!)
 */
class SIGEFGeoPRDownloader {
    constructor(pool) {
        this.pool = pool;

        // URL base da API REST do FeatureServer
        this.baseUrl = 'https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/imoveis_certificados_sigef_incra/FeatureServer/0';

        // Configurações de paginação
        this.maxRecordCount = 2000; // Máximo por requisição
        this.totalRecords = 0;
        this.recordsProcessed = 0;
    }

    /**
     * Conta total de parcelas disponíveis na API
     */
    async contarParcelas() {
        try {
            const url = `${this.baseUrl}/query?where=1%3D1&returnCountOnly=true&f=json`;

            console.log('🔍 Consultando total de parcelas...');

            const response = await fetch(url);
            const data = await response.json();

            if (data.count) {
                this.totalRecords = data.count;
                console.log(`📊 Total de parcelas disponíveis: ${this.totalRecords.toLocaleString('pt-BR')}`);
                return this.totalRecords;
            } else {
                throw new Error('Não foi possível obter contagem de registros');
            }

        } catch (error) {
            console.error('❌ Erro ao contar parcelas:', error.message);
            throw error;
        }
    }

    /**
     * Baixa uma página de dados (até 2000 registros)
     *
     * @param {number} offset - Deslocamento inicial
     * @returns {Promise<Array>} Array de features GeoJSON
     */
    async baixarPagina(offset = 0) {
        try {
            // Parâmetros da query
            const params = new URLSearchParams({
                where: '1=1',                    // Todos os registros
                outFields: '*',                  // Todos os campos
                returnGeometry: 'true',          // Incluir geometria
                f: 'geojson',                    // Formato GeoJSON
                resultOffset: offset.toString(), // Paginação
                resultRecordCount: this.maxRecordCount.toString(),
                outSR: '31982'                   // SIRGAS2000 UTM 22S
            });

            const url = `${this.baseUrl}/query?${params.toString()}`;

            console.log(`📥 Baixando registros ${offset + 1} a ${Math.min(offset + this.maxRecordCount, this.totalRecords)}...`);

            const response = await fetch(url, {
                timeout: 60000, // 60 segundos
                headers: {
                    'User-Agent': 'COGEP-SIGEF-Downloader/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const geojson = await response.json();

            if (!geojson.features || !Array.isArray(geojson.features)) {
                throw new Error('Resposta inválida da API');
            }

            console.log(`   ✅ ${geojson.features.length} registros baixados`);

            return geojson.features;

        } catch (error) {
            console.error(`❌ Erro ao baixar página (offset ${offset}):`, error.message);
            throw error;
        }
    }

    /**
     * Importa um feature GeoJSON para o banco de dados
     *
     * Mapeamento de campos GeoPR → Database:
     * - parcela_co → codigo_parcela
     * - codigo_imo → cod_imovel
     * - nome_area → proprietario
     * - municipio_ → municipio (via lookup)
     * - Shape__Area → area_hectares (converter de m² para ha)
     */
    async importarFeature(feature, downloadId) {
        try {
            const props = feature.properties;
            const geom = feature.geometry;

            // NOTA: Shape__Area vem em graus², não é utilizável
            // A área será calculada pelo PostGIS após importação
            const areaHectares = null; // Será calculado por trigger/update

            // Converter geometria GeoJSON para WKT
            const wkt = this.geojsonToWKT(geom);

            // Inferir município do ID (municipio_)
            // TODO: Implementar lookup de município por ID
            const municipio = await this.getMunicipioNome(props.municipio_) || null;

            await this.pool.query(`
                INSERT INTO sigef_parcelas (
                    download_id,
                    codigo_parcela,
                    cod_imovel,
                    numero_certificacao,
                    situacao_parcela,
                    tipo_parcela,
                    estado,
                    municipio,
                    area_hectares,
                    matricula,
                    proprietario,
                    rt_nome,
                    rt_registro,
                    codigo_credenciado,
                    geometry
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    ST_GeomFromText($15, 31982)
                )
                ON CONFLICT (codigo_parcela) DO UPDATE SET
                    cod_imovel = EXCLUDED.cod_imovel,
                    municipio = EXCLUDED.municipio,
                    area_hectares = EXCLUDED.area_hectares,
                    matricula = EXCLUDED.matricula,
                    geometry = EXCLUDED.geometry,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                downloadId,
                props.parcela_co || null,
                props.codigo_imo || null,
                props.parcela_co || null,  // Usar parcela_co como certificação
                props.situacao_i || null,
                'particular', // Assumir particular (ajustar se necessário)
                'PR',
                municipio,
                areaHectares,
                props.registro_m || null,
                props.nome_area || null,
                props.rt || null,
                props.art || null,
                null, // codigo_credenciado não disponível
                wkt
            ]);

            this.recordsProcessed++;

            if (this.recordsProcessed % 500 === 0) {
                const percentual = ((this.recordsProcessed / this.totalRecords) * 100).toFixed(1);
                console.log(`   ⏳ Progresso: ${this.recordsProcessed.toLocaleString('pt-BR')} / ${this.totalRecords.toLocaleString('pt-BR')} (${percentual}%)`);
            }

        } catch (error) {
            // Log erro mas continua processamento
            if (this.recordsProcessed % 100 === 0) {
                console.error('   ⚠️  Erro ao inserir feature:', error.message);
            }
        }
    }

    /**
     * Converte geometria GeoJSON para WKT (Well-Known Text)
     */
    geojsonToWKT(geometry) {
        if (geometry.type === 'Polygon') {
            const rings = geometry.coordinates.map(ring => {
                const points = ring.map(coord => `${coord[0]} ${coord[1]}`).join(',');
                return `(${points})`;
            });
            return `POLYGON(${rings.join(',')})`;
        }

        if (geometry.type === 'MultiPolygon') {
            const polygons = geometry.coordinates.map(polygon => {
                const rings = polygon.map(ring => {
                    const points = ring.map(coord => `${coord[0]} ${coord[1]}`).join(',');
                    return `(${points})`;
                });
                return `(${rings.join(',')})`;
            });
            return `MULTIPOLYGON(${polygons.join(',')})`;
        }

        throw new Error('Tipo de geometria não suportado: ' + geometry.type);
    }

    /**
     * Cache de municípios para evitar múltiplas consultas
     */
    municipiosCache = {};

    /**
     * Obtém nome do município pelo código IBGE
     * Usa API do IBGE: https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{id}
     */
    async getMunicipioNome(municipioId) {
        if (!municipioId) return null;

        // Verificar cache
        if (this.municipiosCache[municipioId]) {
            return this.municipiosCache[municipioId];
        }

        try {
            // Consultar API IBGE
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipioId}`, {
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                const nome = data.nome;

                // Armazenar em cache
                this.municipiosCache[municipioId] = nome;

                return nome;
            }
        } catch (error) {
            // Silenciosamente falhar e retornar null
        }

        return null;
    }

    /**
     * Executa download completo e importação
     */
    async executarDownloadCompleto() {
        const startTime = Date.now();

        try {
            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            console.log('🚀 SIGEF GeoPR - Download Completo');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');

            // 1. Contar total de registros
            await this.contarParcelas();

            // 2. Registrar download no banco
            const downloadResult = await this.pool.query(`
                INSERT INTO sigef_downloads (estado, tipo, status, data_download)
                VALUES ('PR', 'geopr_api', 'processando', CURRENT_TIMESTAMP)
                RETURNING id
            `);

            const downloadId = downloadResult.rows[0].id;

            console.log(`📝 Download ID: ${downloadId}`);
            console.log('');

            // 3. Calcular número de páginas necessárias
            const totalPaginas = Math.ceil(this.totalRecords / this.maxRecordCount);

            console.log(`📄 Total de páginas: ${totalPaginas}`);
            console.log(`📊 Registros por página: ${this.maxRecordCount}`);
            console.log('');
            console.log('⏳ Iniciando download e importação...');
            console.log('');

            // 4. Download e importação paginada
            for (let pagina = 0; pagina < totalPaginas; pagina++) {
                const offset = pagina * this.maxRecordCount;

                console.log(`📄 Página ${pagina + 1} / ${totalPaginas}`);

                // Baixar página
                const features = await this.baixarPagina(offset);

                // Importar features
                for (const feature of features) {
                    await this.importarFeature(feature, downloadId);
                }

                // Aguardar 1 segundo entre páginas para não sobrecarregar API
                if (pagina < totalPaginas - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 5. Atualizar status de conclusão
            await this.pool.query(`
                UPDATE sigef_downloads
                SET status = 'concluido',
                    total_registros = $1,
                    arquivo_nome = 'geopr_api_rest'
                WHERE id = $2
            `, [this.recordsProcessed, downloadId]);

            const duracao = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            console.log('🎉 DOWNLOAD CONCLUÍDO COM SUCESSO!');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`✅ Registros importados: ${this.recordsProcessed.toLocaleString('pt-BR')}`);
            console.log(`⏱️  Tempo total: ${duracao} minutos`);
            console.log(`📊 Velocidade média: ${(this.recordsProcessed / (duracao || 1)).toFixed(0)} registros/min`);
            console.log('');

            return {
                sucesso: true,
                downloadId,
                totalRegistros: this.recordsProcessed,
                duracaoMinutos: duracao
            };

        } catch (error) {
            console.error('');
            console.error('═══════════════════════════════════════════════════════');
            console.error('❌ ERRO NO DOWNLOAD');
            console.error('═══════════════════════════════════════════════════════');
            console.error(error);
            console.error('');

            // Atualizar status de erro
            if (downloadId) {
                await this.pool.query(`
                    UPDATE sigef_downloads
                    SET status = 'erro',
                        erro_mensagem = $1,
                        total_registros = $2
                    WHERE id = $3
                `, [error.message, this.recordsProcessed, downloadId]);
            }

            return {
                sucesso: false,
                erro: error.message,
                registrosImportados: this.recordsProcessed
            };
        }
    }
}

module.exports = SIGEFGeoPRDownloader;
