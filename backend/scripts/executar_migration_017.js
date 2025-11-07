/**
 * Script para executar migration 017
 * Atualiza função analisar_sobreposicao para retornar geometria da interseção
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    user: 'postgres',
    password: 'marcos123',
    database: 'marcos_geodesicos'
});

async function executarMigration() {
    try {
        console.log('🔧 Executando Migration 017...');

        const migrationPath = path.join(__dirname, '..', 'migrations', '017_update_sobreposicao_with_geometry.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Migration 017 executada com sucesso!');
        console.log('   - Função analisar_sobreposicao atualizada');
        console.log('   - Agora retorna geometria da interseção');

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

executarMigration();
