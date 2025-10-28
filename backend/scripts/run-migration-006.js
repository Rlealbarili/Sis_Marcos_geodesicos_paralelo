const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'marcos_geodesicos',
    password: 'marcos123',
    port: 5434,
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Iniciando Migration 006: Clientes e Propriedades');
        console.log('=' .repeat(60));

        // Ler arquivo SQL
        const migrationPath = path.join(__dirname, '..', 'migrations', '006_create_clientes_propriedades.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Arquivo lido:', migrationPath);
        console.log('💾 Executando migration...\n');

        // Executar migration
        await client.query(sql);

        console.log('✅ Migration 006 executada com sucesso!\n');

        // Verificar tabelas criadas
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('clientes', 'propriedades')
            ORDER BY table_name;
        `);

        console.log('📊 Tabelas criadas:');
        tablesResult.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // Contar registros
        const clientesCount = await client.query('SELECT COUNT(*) FROM clientes');
        const propriedadesCount = await client.query('SELECT COUNT(*) FROM propriedades');

        console.log('\n📈 Dados inseridos:');
        console.log(`   • Clientes: ${clientesCount.rows[0].count} registros`);
        console.log(`   • Propriedades: ${propriedadesCount.rows[0].count} registros`);

        // Verificar views
        const viewsResult = await client.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name LIKE 'vw_%completa'
            ORDER BY table_name;
        `);

        console.log('\n👁️  Views criadas:');
        viewsResult.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // Verificar se coluna propriedade_id foi adicionada em marcos_geodesicos
        const columnCheck = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'marcos_geodesicos'
            AND column_name = 'propriedade_id';
        `);

        if (columnCheck.rows.length > 0) {
            console.log('\n🔗 Coluna propriedade_id adicionada em marcos_geodesicos');
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Migration concluída com sucesso!');

    } catch (error) {
        console.error('\n❌ Erro ao executar migration:', error.message);
        console.error('\nDetalhes do erro:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Executar
runMigration();
