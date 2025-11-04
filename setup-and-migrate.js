/**
 * Script completo: Verifica banco, cria se necessário, e executa migration 014
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function setupAndMigrate() {
    console.log('🚀 Setup e Migration 014 - Sistema WFS CAR\n');

    // Conectar ao banco 'postgres' padrão
    const poolDefault = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5434,
        database: 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'marcos123',
    });

    try {
        // 1. Verificar se banco marcos_geodesicos existe
        console.log('🔍 Passo 1: Verificando banco de dados...');

        const checkDb = await poolDefault.query(`
            SELECT 1 FROM pg_database WHERE datname = 'marcos_geodesicos'
        `);

        if (checkDb.rows.length === 0) {
            console.log('   ❌ Banco "marcos_geodesicos" não encontrado');
            console.log('   🔧 Criando banco de dados...');

            await poolDefault.query('CREATE DATABASE marcos_geodesicos');

            console.log('   ✅ Banco "marcos_geodesicos" criado com sucesso!');
        } else {
            console.log('   ✅ Banco "marcos_geodesicos" já existe');
        }

        await poolDefault.end();

        // 2. Conectar ao banco marcos_geodesicos
        console.log('\n🔌 Passo 2: Conectando ao banco marcos_geodesicos...');

        const pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5434,
            database: 'marcos_geodesicos',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'marcos123',
        });

        // 3. Verificar se PostGIS está instalado
        console.log('   🗺️  Verificando PostGIS...');

        const checkPostGIS = await pool.query(`
            SELECT 1 FROM pg_extension WHERE extname = 'postgis'
        `);

        if (checkPostGIS.rows.length === 0) {
            console.log('   🔧 Instalando extensão PostGIS...');
            await pool.query('CREATE EXTENSION postgis');
            console.log('   ✅ PostGIS instalado!');
        } else {
            console.log('   ✅ PostGIS já está instalado');
        }

        // 4. Verificar se tabela car_downloads existe
        console.log('\n📋 Passo 3: Verificando tabela car_downloads...');

        const checkTable = await pool.query(`
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'car_downloads'
        `);

        if (checkTable.rows.length === 0) {
            console.log('   ⚠️  Tabela car_downloads não existe!');
            console.log('   💡 Você precisa executar migration 012 primeiro:');
            console.log('      psql -h localhost -p 5434 -U postgres -d marcos_geodesicos -f backend/migrations/012_create_car_tables.sql');
            console.log('\n   Ou execute todas as migrations pendentes.');
            await pool.end();
            process.exit(1);
        }

        console.log('   ✅ Tabela car_downloads existe');

        // 5. Verificar se migration 014 já foi aplicada
        console.log('\n🔍 Passo 4: Verificando se migration já foi aplicada...');

        const checkColumns = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'car_downloads'
            AND column_name IN ('created_at', 'updated_at')
        `);

        if (checkColumns.rows.length === 2) {
            console.log('   ✅ Migration 014 já foi aplicada anteriormente!');
            console.log('   ℹ️  Colunas created_at e updated_at já existem.');

            // Mostrar estrutura atual
            const structure = await pool.query(`
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'car_downloads'
                ORDER BY ordinal_position
            `);

            console.log('\n📊 Estrutura atual da tabela car_downloads:');
            console.table(structure.rows);

            await pool.end();
            return;
        }

        // 6. Executar migration 014
        console.log('\n⚡ Passo 5: Executando Migration 014...');

        const migrationPath = path.join(__dirname, 'backend', 'migrations', '014_fix_car_downloads_timestamps.sql');

        if (!fs.existsSync(migrationPath)) {
            console.error('   ❌ Arquivo de migration não encontrado:', migrationPath);
            process.exit(1);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('   📄 Arquivo SQL lido');
        console.log('   ⏳ Executando...');

        await pool.query(sql);

        console.log('   ✅ Migration executada com sucesso!');

        // 7. Verificar resultado
        console.log('\n✔️  Passo 6: Verificando resultado...');

        const finalStructure = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'car_downloads'
            ORDER BY ordinal_position
        `);

        console.log('\n📊 Estrutura final da tabela car_downloads:');
        console.table(finalStructure.rows);

        const hasCreatedAt = finalStructure.rows.find(col => col.column_name === 'created_at');
        const hasUpdatedAt = finalStructure.rows.find(col => col.column_name === 'updated_at');

        if (hasCreatedAt && hasUpdatedAt) {
            console.log('\n🎉 SUCESSO COMPLETO!');
            console.log('   ✅ Banco de dados configurado');
            console.log('   ✅ PostGIS instalado');
            console.log('   ✅ Migration 014 aplicada');
            console.log('   ✅ Colunas created_at e updated_at adicionadas');
            console.log('\n📝 Próximos passos:');
            console.log('   1. Reiniciar o servidor: node backend/server-postgres.js');
            console.log('   2. Testar WFS: http://localhost:3001/car-download-auto.html');
        } else {
            console.log('\n⚠️  Algo deu errado. Verifique os logs acima.');
        }

        await pool.end();

    } catch (error) {
        console.error('\n❌ Erro durante setup/migration:');
        console.error(`   ${error.message}`);
        console.error('\nStack:', error.stack);
        process.exit(1);
    }
}

// Executar
setupAndMigrate().catch(error => {
    console.error('💥 Erro crítico:', error);
    process.exit(1);
});
