const { query, healthCheck, pool } = require('../database/postgres-connection');

async function validar() {
    console.log('🔍 VALIDAÇÃO DA MIGRAÇÃO\n');

    try {
        // 1. Health Check
        console.log('1️⃣  Testando conexão...');
        const health = await healthCheck();
        console.log(`   ${health.status === 'OK' ? '✅' : '❌'} ${health.status}`);
        if (health.status === 'OK') {
            console.log(`   📅 ${health.timestamp}`);
            console.log(`   🐘 ${health.version}\n`);
        }

        // 2. Contar registros
        console.log('2️⃣  Contando registros...');
        const counts = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(geom) as com_geometria,
                COUNT(CASE WHEN geom IS NULL THEN 1 END) as sem_geometria
            FROM marcos_levantados
        `);
        const c = counts.rows[0];
        console.log(`   📊 Total: ${c.total}`);
        console.log(`   🌍 Com geometria: ${c.com_geometria}`);
        console.log(`   ⚠️  Sem geometria: ${c.sem_geometria}\n`);

        // 3. Validar geometrias
        console.log('3️⃣  Validando geometrias...');
        const invalidas = await query(`
            SELECT COUNT(*) as invalidas
            FROM marcos_levantados
            WHERE geom IS NOT NULL AND NOT ST_IsValid(geom)
        `);
        console.log(`   ${invalidas.rows[0].invalidas === '0' ? '✅' : '⚠️'} Geometrias inválidas: ${invalidas.rows[0].invalidas}\n`);

        // 4. Testar funções
        console.log('4️⃣  Testando funções PostGIS...');
        const utm = await query("SELECT ST_AsText(utm_para_latlng(650589.8882, 7192069.4339)) as ponto");
        console.log(`   ✅ utm_para_latlng: ${utm.rows[0].ponto}\n`);

        // 5. Verificar índices
        console.log('5️⃣  Verificando índices...');
        const indices = await query(`
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'marcos_levantados'
        `);
        console.log(`   ✅ ${indices.rowCount} índices criados`);
        indices.rows.forEach(idx => {
            console.log(`      - ${idx.indexname}`);
        });
        console.log();

        console.log('🎉 VALIDAÇÃO CONCLUÍDA COM SUCESSO!\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

validar();
