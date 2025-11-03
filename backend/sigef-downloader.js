const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');

class SIGEFDownloader {
    constructor(pool) {
        this.pool = pool;
        this.downloadDir = path.join(__dirname, '../data/sigef');
        this.estados = ['PR', 'SC', 'RS', 'SP', 'MG', 'MS', 'GO', 'MT', 'DF'];

        // URLs dos shapefiles SIGEF por tipo
        // NOTA: A partir de 2025, o INCRA mudou o formato da URL
        // Formato antigo: Imóvel certificado SNCI {ESTADO}_particular.zip
        // Formato novo: Imóvel certificado SNCI Brasil_{ESTADO}.zip
        this.urlTemplates = {
            certificada_particular: 'https://certificacao.incra.gov.br/csv_shp/zip/Imóvel certificado SNCI Brasil_{ESTADO}.zip',
            certificada_publico: 'https://certificacao.incra.gov.br/csv_shp/zip/Imóvel certificado SNCI Brasil_{ESTADO}.zip',
            // URL alternativa caso primeira falhe
            backup_url: 'http://acervofundiario.incra.gov.br/acervo/acv.php'
        };

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

    async downloadEstado(estado, tipo = 'certificada_particular') {
        try {
            console.log(`📥 Iniciando download SIGEF: ${estado} - ${tipo}`);

            // Registrar download
            const downloadResult = await this.pool.query(`
                INSERT INTO sigef_downloads (estado, tipo, status)
                VALUES ($1, $2, 'processando')
                RETURNING id
            `, [estado, tipo]);

            const downloadId = downloadResult.rows[0].id;

            // Construir URL
            const url = this.urlTemplates[tipo].replace('{ESTADO}', estado);

            console.log(`🌐 URL: ${url}`);

            // Configurar agent HTTPS para aceitar certificados do INCRA
            // NOTA: O servidor certificacao.incra.gov.br possui certificado SSL que
            // não é validado corretamente pelo Node.js. Esta configuração é necessária
            // para permitir o download dos arquivos SIGEF.
            const httpsAgent = new https.Agent({
                rejectUnauthorized: false, // Aceita certificados auto-assinados
                keepAlive: true
            });

            console.log(`🔒 SSL: Configurado para aceitar certificado do servidor INCRA`);

            // Download com timeout
            const response = await fetch(url, {
                timeout: 300000, // 5 minutos
                agent: httpsAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Salvar arquivo ZIP
            const fileName = `${estado}_${tipo}_${Date.now()}.zip`;
            const filePath = path.join(this.downloadDir, estado, fileName);

            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);

            const fileSize = fs.statSync(filePath).size;

            console.log(`✅ Download concluído: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

            // Extrair ZIP
            const extractPath = await this.extractZip(filePath, estado);

            // Importar shapefile
            const totalRegistros = await this.importarShapefile(extractPath, downloadId, estado, tipo);

            // Atualizar status
            await this.pool.query(`
                UPDATE sigef_downloads
                SET status = 'concluido',
                    arquivo_nome = $1,
                    arquivo_tamanho = $2,
                    total_registros = $3
                WHERE id = $4
            `, [fileName, fileSize, totalRegistros, downloadId]);

            console.log(`🎉 Importação concluída: ${totalRegistros} parcelas`);

            return {
                sucesso: true,
                downloadId,
                totalRegistros,
                arquivo: fileName
            };

        } catch (error) {
            console.error(`❌ Erro no download ${estado}:`, error.message);

            // Registrar erro
            await this.pool.query(`
                UPDATE sigef_downloads
                SET status = 'erro',
                    erro_mensagem = $1
                WHERE estado = $2 AND tipo = $3 AND status = 'processando'
            `, [error.message, estado, tipo]);

            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    extractZip(zipPath, estado) {
        return new Promise((resolve, reject) => {
            try {
                const zip = new AdmZip(zipPath);
                const extractPath = path.join(this.downloadDir, estado, 'extracted');

                if (!fs.existsSync(extractPath)) {
                    fs.mkdirSync(extractPath, { recursive: true });
                }

                zip.extractAllTo(extractPath, true);

                console.log(`📦 ZIP extraído: ${extractPath}`);
                resolve(extractPath);

            } catch (error) {
                reject(error);
            }
        });
    }

    async importarShapefile(extractPath, downloadId, estado, tipo) {
        try {
            // Encontrar arquivo .shp
            const files = fs.readdirSync(extractPath);
            const shpFile = files.find(f => f.endsWith('.shp'));

            if (!shpFile) {
                throw new Error('Arquivo .shp não encontrado no ZIP');
            }

            const shpPath = path.join(extractPath, shpFile);

            console.log(`📊 Importando shapefile: ${shpFile}`);

            let count = 0;

            // Abrir shapefile
            const source = await shapefile.open(shpPath);

            // Processar features
            let result = await source.read();

            while (!result.done) {
                const feature = result.value;

                if (feature && feature.geometry && feature.properties) {
                    await this.inserirParcela(feature, downloadId, estado, tipo);
                    count++;

                    if (count % 100 === 0) {
                        console.log(`   ⏳ Processados: ${count} registros`);
                    }
                }

                result = await source.read();
            }

            console.log(`✅ Shapefile importado: ${count} registros`);

            return count;

        } catch (error) {
            console.error('Erro ao importar shapefile:', error);
            throw error;
        }
    }

    async inserirParcela(feature, downloadId, estado, tipo) {
        const props = feature.properties;
        const geom = feature.geometry;

        // Converter GeoJSON para WKT (PostGIS)
        const wkt = this.geojsonToWKT(geom);

        try {
            await this.pool.query(`
                INSERT INTO sigef_parcelas (
                    download_id, codigo_parcela, cod_imovel, numero_certificacao,
                    situacao_parcela, tipo_parcela, estado, municipio,
                    area_hectares, matricula, proprietario, cpf_cnpj,
                    rt_nome, rt_registro, codigo_credenciado,
                    geometry
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                    ST_GeomFromText($16, 31982)
                )
                ON CONFLICT (codigo_parcela) DO UPDATE SET
                    updated_at = CURRENT_TIMESTAMP
            `, [
                downloadId,
                props.cod_parcela || props.codigo || props.COD_PARCEL || null,
                props.cod_imovel || props.COD_IMOVEL || null,
                props.num_certif || props.certificacao || props.NUM_CERTIF || null,
                props.situacao || props.SITUACAO || null,
                tipo.includes('particular') ? 'particular' : 'publico',
                estado,
                props.municipio || props.nome_munic || props.MUNICIPIO || null,
                props.area_ha || props.area || props.AREA_HA || null,
                props.matricula || props.MATRICULA || null,
                props.detentor || props.proprietario || props.DETENTOR || null,
                props.cpf_cnpj || props.CPF_CNPJ || null,
                props.rt_nome || props.RT_NOME || null,
                props.rt_regist || props.RT_REGIST || null,
                props.cod_cred || props.COD_CRED || null,
                wkt
            ]);

        } catch (error) {
            // Continuar processamento mesmo com erros individuais
            if (count % 100 === 0) {
                console.error('Erro ao inserir parcela:', error.message);
            }
        }
    }

    geojsonToWKT(geometry) {
        if (geometry.type === 'Polygon') {
            const coords = geometry.coordinates[0];
            const points = coords.map(c => `${c[0]} ${c[1]}`).join(',');
            return `POLYGON((${points}))`;
        }

        if (geometry.type === 'MultiPolygon') {
            // Pegar apenas o primeiro polígono
            const coords = geometry.coordinates[0][0];
            const points = coords.map(c => `${c[0]} ${c[1]}`).join(',');
            return `POLYGON((${points}))`;
        }

        throw new Error('Tipo de geometria não suportado: ' + geometry.type);
    }

    async downloadTodosEstados(tipo = 'certificada_particular') {
        console.log(`🚀 Iniciando download em lote: ${this.estados.length} estados`);

        const resultados = [];

        for (const estado of this.estados) {
            const resultado = await this.downloadEstado(estado, tipo);
            resultados.push({ estado, ...resultado });

            // Aguardar 5 segundos entre downloads para não sobrecarregar servidor
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        return resultados;
    }
}

module.exports = SIGEFDownloader;
