const { Pool } = require('pg');
const SIGEFGeoPRDownloader = require('../sigef-geopr-downloader');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

async function testarDownload() {
    const downloader = new SIGEFGeoPRDownloader(pool);

    try {
        console.log('🧪 TESTE: Download primeira página GeoPR');
        console.log('═══════════════════════════════════════════════════════\n');

        // 1. Contar registros
        const total = await downloader.contarParcelas();
        console.log(`\n📊 Total disponível: ${total.toLocaleString('pt-BR')} parcelas`);

        // 2. Baixar primeira página
        console.log('\n📥 Baixando primeira página (2.000 registros)...\n');
        const features = await downloader.baixarPagina(0);

        console.log(`\n✅ ${features.length} features baixados`);

        // 3. Mostrar exemplo de dados
        if (features.length > 0) {
            const exemplo = features[0];
            console.log('\n📋 Exemplo de dados:');
            console.log('───────────────────────────────────────────────────────');
            console.log('Properties:');
            console.log(JSON.stringify(exemplo.properties, null, 2));
            console.log('\nGeometry type:', exemplo.geometry.type);
            console.log('Coordinates count:', exemplo.geometry.coordinates[0]?.length || 0);
        }

        // 4. Criar download_id de teste
        console.log('\n📝 Criando registro de teste no banco...');
        const downloadResult = await pool.query(`
            INSERT INTO sigef_downloads (estado, tipo, status, data_download)
            VALUES ('PR', 'geopr_api_teste', 'processando', CURRENT_TIMESTAMP)
            RETURNING id
        `);

        const downloadId = downloadResult.rows[0].id;
        console.log(`   Download ID: ${downloadId}`);

        // 5. Importar apenas os 10 primeiros registros (teste)
        console.log('\n📥 Importando 10 primeiros registros (teste)...\n');

        downloader.totalRecords = 10; // Override para teste
        let importados = 0;

        for (let i = 0; i < Math.min(10, features.length); i++) {
            try {
                await downloader.importarFeature(features[i], downloadId);
                importados++;
                console.log(`   ✅ Feature ${i + 1}/10 importado`);
            } catch (error) {
                console.error(`   ❌ Erro no feature ${i + 1}:`, error.message);
            }
        }

        // 6. Atualizar status
        await pool.query(`
            UPDATE sigef_downloads
            SET status = 'concluido',
                total_registros = $1
            WHERE id = $2
        `, [importados, downloadId]);

        // 7. Verificar importação
        console.log('\n🔍 Verificando dados importados...\n');

        const result = await pool.query(`
            SELECT
                codigo_parcela,
                municipio,
                area_hectares,
                proprietario,
                ST_AsText(ST_Centroid(geometry)) as centroid
            FROM sigef_parcelas
            WHERE download_id = $1
            ORDER BY codigo_parcela
            LIMIT 5
        `, [downloadId]);

        console.log('📊 Primeiras 5 parcelas importadas:');
        console.table(result.rows);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`✅ Total disponível: ${total.toLocaleString('pt-BR')}`);
        console.log(`✅ Features baixados: ${features.length}`);
        console.log(`✅ Registros importados: ${importados}`);
        console.log('\n💡 Para executar download completo, use:');
        console.log('   node backend/scripts/executar_geopr_download.js');
        console.log('');

    } catch (error) {
        console.error('\n❌ Erro no teste:', error);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testarDownload();
