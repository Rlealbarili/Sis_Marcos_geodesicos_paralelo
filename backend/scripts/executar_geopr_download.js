const { Pool } = require('pg');
const SIGEFGeoPRDownloader = require('../sigef-geopr-downloader');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

async function executarDownloadCompleto() {
    const downloader = new SIGEFGeoPRDownloader(pool);

    try {
        // Executar download completo
        const resultado = await downloader.executarDownloadCompleto();

        if (resultado.sucesso) {
            console.log('🔄 Atualizando áreas calculadas...');

            // Atualizar área_hectares usando ST_Area do PostGIS
            await pool.query(`
                UPDATE sigef_parcelas
                SET area_hectares = ST_Area(geometry) / 10000
                WHERE download_id = $1
                  AND geometry IS NOT NULL
                  AND (area_hectares IS NULL OR area_hectares = 0)
            `, [resultado.downloadId]);

            console.log('   ✅ Áreas atualizadas');

            // Estatísticas finais
            const stats = await pool.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(DISTINCT municipio) as municipios,
                    COUNT(*) FILTER (WHERE municipio IS NOT NULL) as com_municipio,
                    COUNT(*) FILTER (WHERE municipio IS NULL) as sem_municipio,
                    ROUND(AVG(area_hectares), 2) as area_media_ha,
                    ROUND(SUM(area_hectares), 2) as area_total_ha
                FROM sigef_parcelas
                WHERE download_id = $1
            `, [resultado.downloadId]);

            console.log('');
            console.log('📊 ESTATÍSTICAS FINAIS:');
            console.table(stats.rows);
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

executarDownloadCompleto();
