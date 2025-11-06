const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

async function fixFunctions() {
    try {
        console.log('🔧 Forçando recriação das funções SQL...\n');

        // 1. Drop existing
        console.log('1. Dropando funções antigas...');
        await pool.query('DROP FUNCTION IF EXISTS analisar_sobreposicao CASCADE');
        await pool.query('DROP FUNCTION IF EXISTS identificar_confrontantes CASCADE');
        console.log('   ✅ Funções antigas removidas');

        // 2. Read SQL file
        console.log('\n2. Lendo arquivo SQL...');
        const sql = fs.readFileSync('backend/scripts/fix_functions.sql', 'utf8');
        console.log(`   ✅ ${sql.length} bytes lidos`);

        // 3. Execute
        console.log('\n3. Executando SQL...');
        await pool.query(sql);
        console.log('   ✅ SQL executado');

        // 4. Verify
        console.log('\n4. Verificando criação...');
        const result = await pool.query(`
            SELECT proname, prosrc
            FROM pg_proc
            WHERE proname IN ('analisar_sobreposicao', 'identificar_confrontantes')
        `);

        console.log(`   ✅ ${result.rows.length} funções encontradas`);

        result.rows.forEach(r => {
            console.log(`   - ${r.proname}`);
            const hasVarcharCast = r.prosrc.includes('::character varying') || r.prosrc.includes('::VARCHAR');
            console.log(`     Cast VARCHAR: ${hasVarcharCast ? '✅ SIM' : '❌ NÃO'}`);
        });

        console.log('\n✅ Correção concluída!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

fixFunctions();
