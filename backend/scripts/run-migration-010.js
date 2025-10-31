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
        console.log('🚀 Executando Migration 010: Tabelas SIGEF...\n');

        const migrationPath = path.join(__dirname, '../migrations/010_create_sigef_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('\n✅ Migration 010 executada com sucesso!');
        console.log('\nTabelas criadas:');
        console.log('   ✓ sigef_downloads');
        console.log('   ✓ sigef_parcelas');
        console.log('   ✓ sigef_confrontantes');
        console.log('   ✓ sigef_sobreposicoes');

        // Verificar tabelas
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE 'sigef_%'
            ORDER BY table_name
        `);

        console.log('\nTabelas SIGEF no banco:');
        result.rows.forEach(row => {
            console.log(`   📊 ${row.table_name}`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        process.exit(1);
    }
}

executarMigration();
