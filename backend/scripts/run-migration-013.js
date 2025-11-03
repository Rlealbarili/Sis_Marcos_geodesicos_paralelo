const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    database: 'marcos_geodesicos',
    user: 'postgres',
    password: 'marcos123'
});

async function runMigration() {
    try {
        console.log('🔄 Executando Migration 013: Corrigir Tipos de Marcos...\n');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/013_corrigir_tipos_marcos.sql'),
            'utf8'
        );

        await pool.query(migrationSQL);

        console.log('\n✅ Migration 013 executada com sucesso!');
        console.log('✅ Tipos de marcos atualizados para padrão COGEP (V, M, P)\n');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro ao executar migration 013:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
