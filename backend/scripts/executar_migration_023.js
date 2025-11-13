/**
 * Script para executar migration 023 - Criar tabelas CAR
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5434,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'marcos123',
    database: process.env.DB_NAME || 'marcos_geodesicos'
});

async function executarMigration() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 Executando Migration 023: Criar tabelas CAR\n');

        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, '../migrations/023_create_car_imoveis.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Executar migration
        await client.query(sql);

        console.log('\n✅ Migration 023 executada com sucesso!\n');

        // Verificar tabelas criadas
        const tabelas = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
                AND table_name IN ('car_imoveis', 'car_downloads')
            ORDER BY table_name
        `);

        console.log('📋 Tabelas criadas:');
        tabelas.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });

        // Verificar views criadas
        const views = await client.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
                AND table_name LIKE 'vw_car%'
            ORDER BY table_name
        `);

        console.log('\n📊 Views criadas:');
        views.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });

        // Verificar função criada
        const funcoes = await client.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
                AND routine_name = 'buscar_car_proximos'
        `);

        console.log('\n⚙️  Funções criadas:');
        funcoes.rows.forEach(row => {
            console.log(`   ✅ ${row.routine_name}`);
        });

        console.log('\n🎉 Sistema CAR pronto para uso!\n');

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

executarMigration().catch(error => {
    console.error('💥 Falha crítica:', error);
    process.exit(1);
});
