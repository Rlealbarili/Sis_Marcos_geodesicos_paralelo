/**
 * Script para executar migration 014 - Fix car_downloads timestamps
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuração do banco
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5434,
    database: process.env.POSTGRES_DB || 'marcos_geodesicos',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'marcos123',
});

async function runMigration() {
    console.log('🔧 Executando Migration 014: Fix car_downloads timestamps\n');

    try {
        // Ler arquivo SQL
        const migrationPath = path.join(__dirname, 'backend', 'migrations', '014_fix_car_downloads_timestamps.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Arquivo SQL lido:', migrationPath);
        console.log('📊 Tamanho:', sql.length, 'bytes\n');

        // Executar migration
        console.log('⏳ Executando migration...');
        const result = await pool.query(sql);

        console.log('\n✅ Migration executada com sucesso!');

        // Mostrar resultados
        if (result.rows && result.rows.length > 0) {
            console.log('\n📊 Resultado:');
            console.table(result.rows);
        }

        // Verificar estrutura da tabela
        const checkResult = await pool.query(`
            SELECT
                column_name,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'car_downloads'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estrutura da tabela car_downloads após migration:');
        console.table(checkResult.rows);

        console.log('\n🎉 Tabela car_downloads atualizada com sucesso!');
        console.log('✅ Colunas created_at e updated_at adicionadas');

    } catch (error) {
        console.error('\n❌ Erro ao executar migration:');
        console.error(error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar
runMigration().catch(error => {
    console.error('💥 Erro crítico:', error);
    process.exit(1);
});
