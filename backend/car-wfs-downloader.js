const fetch = require('node-fetch');

class CARWFSDownloader {
    constructor(pool) {
        this.pool = pool;
        this.wfsBaseUrl = 'https://geoserver.car.gov.br/geoserver/wfs';
        this.maxFeaturesPerRequest = 10000;
    }

    /**
     * Construir URL WFS com filtros
     */
    buildWFSUrl(filters = {}) {
        const params = new URLSearchParams({
            service: 'WFS',
            version: '2.0.0',
            request: 'GetFeature',
            typeNames: 'sicar:imoveis',
            outputFormat: 'application/json',
            count: this.maxFeaturesPerRequest,
            startIndex: filters.startIndex || 0
        });

        // Adicionar filtros CQL
        const cqlFilters = [];

        if (filters.estado) {
            cqlFilters.push(`estado='${filters.estado}'`);
        }

        if (filters.municipio) {
            cqlFilters.push(`municipio='${filters.municipio}'`);
        }

        if (filters.bbox) {
            // bbox format: minx,miny,maxx,maxy,EPSG:4326
            params.set('bbox', filters.bbox);
        }

        if (cqlFilters.length > 0) {
            params.set('CQL_FILTER', cqlFilters.join(' AND '));
        }

        return `${this.wfsBaseUrl}?${params.toString()}`;
    }

    /**
     * Download automático de imóveis CAR via WFS
     */
    async downloadAutomatico(filters = {}, progressCallback = null) {
        console.log('🚀 Iniciando download automático via WFS...');
        console.log('📋 Filtros:', filters);

        // Registrar download
        const downloadResult = await this.pool.query(`
            INSERT INTO car_downloads (estado, tipo, status)
            VALUES ($1, 'wfs_auto', 'iniciado')
            RETURNING id
        `, [filters.estado || 'TODOS']);

        const downloadId = downloadResult.rows[0].id;
        let totalProcessados = 0;
        let startIndex = 0;
        let hasMore = true;

        try {
            while (hasMore) {
                // Construir URL com paginação
                const url = this.buildWFSUrl({ ...filters, startIndex });

                console.log(`📥 Buscando registros ${startIndex} - ${startIndex + this.maxFeaturesPerRequest}...`);

                // Fazer requisição WFS
                const response = await fetch(url, { timeout: 30000 });

                if (!response.ok) {
                    throw new Error(`Erro WFS: ${response.status} ${response.statusText}`);
                }

                const geojson = await response.json();
                const features = geojson.features || [];

                console.log(`   ✅ ${features.length} imóveis recebidos`);

                // Se não houver mais features, parar
                if (features.length === 0) {
                    hasMore = false;
                    break;
                }

                // Processar em lotes de 100
                for (let i = 0; i < features.length; i += 100) {
                    const batch = features.slice(i, i + 100);

                    for (const feature of batch) {
                        await this.inserirImovelCAR(feature, downloadId, filters.estado);
                        totalProcessados++;
                    }

                    // Callback de progresso
                    if (progressCallback) {
                        progressCallback({
                            totalProcessados,
                            loteAtual: startIndex + i + batch.length,
                            percentual: null // WFS não retorna total
                        });
                    }

                    console.log(`   ⏳ Processados: ${totalProcessados} imóveis`);
                }

                // Se recebeu menos que o máximo, não há mais páginas
                if (features.length < this.maxFeaturesPerRequest) {
                    hasMore = false;
                } else {
                    startIndex += this.maxFeaturesPerRequest;
                }
            }

            // Atualizar status
            await this.pool.query(`
                UPDATE car_downloads
                SET status = 'concluido',
                    total_registros = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [totalProcessados, downloadId]);

            console.log(`✅ Download automático concluído: ${totalProcessados} imóveis CAR`);

            return {
                sucesso: true,
                downloadId,
                totalProcessados,
                mensagem: `Download automático concluído com sucesso!`
            };

        } catch (error) {
            console.error('❌ Erro no download automático:', error);

            await this.pool.query(`
                UPDATE car_downloads
                SET status = 'erro',
                    erro_mensagem = $1
                WHERE id = $2
            `, [error.message, downloadId]);

            throw error;
        }
    }

    /**
     * Inserir imóvel CAR no banco (adaptado de GeoJSON)
     */
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
                    ST_GeomFromText($15, 4326)
                )
                ON CONFLICT (codigo_imovel) DO UPDATE SET
                    updated_at = CURRENT_TIMESTAMP
            `, [
                downloadId,
                props.cod_imovel || props.codigo || props.id || `CAR-${Date.now()}-${Math.random()}`,
                props.num_car || props.numero_car || null,
                props.cpf_cnpj || null,
                props.nome_prop || props.proprietario || props.nome || null,
                estado || props.estado || props.uf || null,
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
            console.error('⚠️  Erro ao inserir imóvel CAR:', error.message);
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
        } else if (geometry.type === 'Point') {
            return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
        }
        throw new Error('Tipo de geometria não suportado: ' + geometry.type);
    }

    /**
     * Buscar municípios disponíveis no WFS
     */
    async buscarMunicipios(estado) {
        console.log(`🔍 Buscando municípios de ${estado}...`);

        const url = `${this.wfsBaseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=sicar:imoveis&outputFormat=application/json&CQL_FILTER=estado='${estado}'&count=1000&propertyName=municipio`;

        try {
            const response = await fetch(url, { timeout: 15000 });

            if (!response.ok) {
                throw new Error(`Erro WFS: ${response.status}`);
            }

            const geojson = await response.json();

            const municipios = [...new Set(
                geojson.features.map(f => f.properties.municipio).filter(Boolean)
            )];

            console.log(`   ✅ ${municipios.length} municípios encontrados`);

            return municipios.sort();

        } catch (error) {
            console.error('❌ Erro ao buscar municípios:', error);
            return [];
        }
    }

    /**
     * Testar conexão WFS
     */
    async testarConexao() {
        console.log('🔌 Testando conexão WFS CAR...');

        try {
            const url = `${this.wfsBaseUrl}?service=WFS&version=2.0.0&request=GetCapabilities`;
            const response = await fetch(url, { timeout: 10000 });

            if (response.ok) {
                console.log('   ✅ Conexão WFS OK!');
                return { sucesso: true, mensagem: 'Conexão estabelecida com sucesso' };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error('   ❌ Erro na conexão WFS:', error.message);
            return { sucesso: false, erro: error.message };
        }
    }
}

module.exports = CARWFSDownloader;
