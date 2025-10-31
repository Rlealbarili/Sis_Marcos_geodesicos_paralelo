const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'marcos_geodesicos',
    password: 'marcos123',
    port: 5434,
});

async function executarMigration() {
    try {
        console.log('🚀 Executando Migration 011: Funções de Análise Espacial...\n');

        const migrationPath = path.join(__dirname, '../migrations/011_create_spatial_functions.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('\n✅ Migration 011 executada com sucesso!');
        console.log('\nFunções PostGIS criadas:');
        console.log('   ✓ analisar_sobreposicao()');
        console.log('   ✓ identificar_confrontantes()');
        console.log('   ✓ calcular_score_viabilidade()');
        console.log('   ✓ analisar_area_pre_cadastro()');

        // Verificar funções
        const result = await pool.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND (routine_name LIKE 'analisar%' OR routine_name LIKE 'identificar%' OR routine_name LIKE 'calcular%')
            ORDER BY routine_name
        `);

        console.log('\nFunções de análise no banco:');
        result.rows.forEach(row => {
            console.log(`   🔧 ${row.routine_name}()`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        process.exit(1);
    }
}

executarMigration();
