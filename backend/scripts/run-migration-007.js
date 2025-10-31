const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true });

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5434,
    database: process.env.POSTGRES_DB || 'marcos_geodesicos',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'marcos123',
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('\n🚀 Executando Migration 007: Criar tabela vertices\n');

        const migrationPath = path.join(__dirname, '../migrations/007_create_vertices.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        await client.query(sql);

        console.log('\n✅ Migration 007 executada com sucesso!\n');

        // Verificar se tabela foi criada
        const result = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'vertices'
            ORDER BY ordinal_position
        `);

        console.log('📋 Colunas da tabela vertices:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });

        // Verificar índices
        const indices = await client.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'vertices'
        `);

        console.log('\n📑 Índices criados:');
        indices.rows.forEach(row => {
            console.log(`   - ${row.indexname}`);
        });

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
