const { Pool } = require('pg');
const SpatialAnalyzer = require('../spatial-analyzer');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

const analyzer = new SpatialAnalyzer(pool);

async function testarSobreposicoes() {
    try {
        console.log('🧪 Testando detecção de sobreposições\n');

        // Usar a propriedade de teste ID=19 (do relatório)
        const propriedadeId = 19;

        console.log(`📍 Propriedade: #${propriedadeId}`);

        // 1. Testar função SQL diretamente
        console.log('\n1️⃣ Testando função SQL analisar_sobreposicao()...');
        const sqlResult = await pool.query(`
            SELECT * FROM analisar_sobreposicao($1)
        `, [propriedadeId]);

        console.log(`   Resultado SQL: ${sqlResult.rows.length} sobreposições`);

        if (sqlResult.rows.length > 0) {
            console.log('   Primeira sobreposição:', JSON.stringify(sqlResult.rows[0], null, 2));
        }

        // 2. Testar método do SpatialAnalyzer
        console.log('\n2️⃣ Testando método analisarSobreposicao()...');
        const analyzerResult = await analyzer.analisarSobreposicao(propriedadeId);

        console.log('   Resultado Analyzer:', JSON.stringify(analyzerResult, null, 2));

        // 3. Testar análise completa
        console.log('\n3️⃣ Testando analiseCompleta()...');
        const completeResult = await analyzer.analiseCompleta(propriedadeId);

        console.log('   Resultado Completo:');
        console.log(`   - Sobreposições: ${completeResult.sobreposicoes.total_sobreposicoes}`);
        console.log(`   - Confrontantes: ${completeResult.confrontantes.total_confrontantes}`);
        console.log(`   - Score: ${completeResult.score.score_total}/100`);

        if (completeResult.sobreposicoes.sobreposicoes) {
            console.log('\n   Detalhes das sobreposições:');
            completeResult.sobreposicoes.sobreposicoes.forEach((s, idx) => {
                console.log(`   ${idx + 1}. Código: ${s.codigo_parcela}, Tipo: ${s.tipo_sobreposicao}, Área: ${s.area_sobreposicao_m2}m²`);
            });
        }

        console.log('\n✅ Teste concluído!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

testarSobreposicoes();
