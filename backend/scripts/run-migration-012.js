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
        console.log('🔄 Executando migration 012: Tabelas CAR...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/012_create_car_tables.sql'),
            'utf8'
        );

        await pool.query(migrationSQL);

        console.log('✅ Migration 012 executada com sucesso!');
        console.log('📊 Tabelas CAR criadas:');
        console.log('   - car_downloads');
        console.log('   - car_imoveis');
        console.log('   - car_vegetacao_nativa');
        console.log('   - car_app');
        console.log('   - car_reserva_legal');
        console.log('   - comparacao_sigef_car');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro na migration:', error);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
