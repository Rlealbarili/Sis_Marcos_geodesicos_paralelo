const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

async function diagnosticoSIGEF() {
    try {
        console.log('🔍 DIAGNÓSTICO COMPLETO SIGEF-PR\n');
        console.log('═══════════════════════════════════════════════════════\n');

        // 1. Total de parcelas por estado
        const porEstado = await pool.query(`
            SELECT
                estado,
                COUNT(*) as total_parcelas,
                COUNT(DISTINCT municipio) as municipios,
                MIN(created_at) as primeira_importacao,
                MAX(created_at) as ultima_importacao
            FROM sigef_parcelas
            GROUP BY estado
            ORDER BY estado
        `);

        console.log('📊 PARCELAS POR ESTADO:');
        console.table(porEstado.rows);

        // 2. Detalhes PR
        const detalhesPR = await pool.query(`
            SELECT
                COUNT(*) as total_parcelas,
                COUNT(DISTINCT municipio) as municipios,
                COUNT(DISTINCT codigo_parcela) as codigos_unicos,
                COUNT(DISTINCT proprietario) as proprietarios,
                COUNT(*) FILTER (WHERE tipo_parcela = 'particular') as particulares,
                COUNT(*) FILTER (WHERE tipo_parcela = 'publico') as publicas,
                MIN(created_at) as primeira_importacao,
                MAX(created_at) as ultima_importacao,
                ROUND(AVG(area_hectares), 2) as area_media_ha
            FROM sigef_parcelas
            WHERE estado = 'PR'
        `);

        console.log('\n🎯 DETALHES PARANÁ:');
        console.table(detalhesPR.rows);

        // 3. Top 10 municípios PR
        const top10PR = await pool.query(`
            SELECT
                municipio,
                COUNT(*) as parcelas,
                ROUND(SUM(area_hectares), 2) as area_total_ha
            FROM sigef_parcelas
            WHERE estado = 'PR'
            GROUP BY municipio
            ORDER BY COUNT(*) DESC
            LIMIT 10
        `);

        console.log('\n🏘️  TOP 10 MUNICÍPIOS (PR):');
        console.table(top10PR.rows);

        // 4. Downloads registrados
        const downloads = await pool.query(`
            SELECT
                id,
                estado,
                tipo,
                data_download,
                status,
                total_registros,
                arquivo_nome
            FROM sigef_downloads
            WHERE estado = 'PR'
            ORDER BY data_download DESC
        `);

        console.log('\n📥 DOWNLOADS REGISTRADOS (PR):');
        console.table(downloads.rows);

        // 5. Campo Largo específico
        const campoLargo = await pool.query(`
            SELECT
                COUNT(*) as total_parcelas,
                COUNT(DISTINCT proprietario) as proprietarios,
                ROUND(SUM(area_hectares), 2) as area_total_ha,
                ROUND(AVG(area_hectares), 2) as area_media_ha
            FROM sigef_parcelas
            WHERE municipio ILIKE '%Campo Largo%'
               OR municipio ILIKE '%CAMPO LARGO%'
        `);

        console.log('\n🎯 CAMPO LARGO ESPECÍFICO:');
        console.table(campoLargo.rows);

        // 6. Verificar geometrias
        const geometrias = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE geometry IS NOT NULL) as com_geometria,
                COUNT(*) FILTER (WHERE geometry IS NULL) as sem_geometria,
                COUNT(*) FILTER (WHERE ST_IsValid(geometry)) as geometrias_validas,
                COUNT(*) FILTER (WHERE NOT ST_IsValid(geometry) AND geometry IS NOT NULL) as geometrias_invalidas
            FROM sigef_parcelas
            WHERE estado = 'PR'
        `);

        console.log('\n🗺️  QUALIDADE DE GEOMETRIAS (PR):');
        console.table(geometrias.rows);

        // 7. Resumo final
        const totalPR = porEstado.rows.find(r => r.estado === 'PR');

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📋 RESUMO FINAL:');
        console.log('═══════════════════════════════════════════════════════\n');

        if (totalPR) {
            const atual = parseInt(totalPR.total_parcelas);
            const esperado = 15000;
            const percentual = ((atual / esperado) * 100).toFixed(1);

            console.log(`Parcelas PR Atual:    ${atual}`);
            console.log(`Parcelas PR Esperado: ${esperado}`);
            console.log(`Percentual:           ${percentual}%`);
            console.log(`Faltando:             ${esperado - atual} parcelas`);

            if (atual < 5000) {
                console.log('\n🔴 CRÍTICO: Base de dados MUITO incompleta!');
                console.log('   Recomendação: Resolver URGENTEMENTE');
            } else if (atual < 10000) {
                console.log('\n🟡 ATENÇÃO: Base de dados incompleta');
                console.log('   Recomendação: Atualizar em breve');
            } else {
                console.log('\n🟢 OK: Base de dados razoável');
                console.log('   Recomendação: Manter atualizado');
            }
        } else {
            console.log('⚠️  Nenhuma parcela PR encontrada!');
        }

        console.log('\n═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

diagnosticoSIGEF();
