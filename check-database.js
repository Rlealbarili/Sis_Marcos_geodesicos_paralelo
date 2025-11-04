/**
 * Script para verificar qual banco de dados PostgreSQL está disponível
 */

const { Pool } = require('pg');

async function checkDatabase() {
    console.log('🔍 Verificando bancos de dados PostgreSQL...\n');

    // Conectar ao banco 'postgres' padrão para listar outros bancos
    const pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5434,
        database: 'postgres', // Conectar ao banco padrão primeiro
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'marcos123',
    });

    try {
        console.log('📡 Conectando ao PostgreSQL...');
        console.log(`   Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
        console.log(`   Port: ${process.env.POSTGRES_PORT || 5434}`);
        console.log(`   User: ${process.env.POSTGRES_USER || 'postgres'}\n`);

        // Listar todos os bancos de dados
        const result = await pool.query(`
            SELECT datname, pg_size_pretty(pg_database_size(datname)) as size
            FROM pg_database
            WHERE datistemplate = false
            ORDER BY datname
        `);

        console.log('📊 Bancos de dados disponíveis:\n');
        console.table(result.rows);

        // Verificar se marcos_geodesicos existe
        const marcosDb = result.rows.find(db => db.datname === 'marcos_geodesicos');

        if (marcosDb) {
            console.log('\n✅ Banco "marcos_geodesicos" encontrado!');
            console.log(`   Tamanho: ${marcosDb.size}`);
        } else {
            console.log('\n❌ Banco "marcos_geodesicos" NÃO encontrado!');

            // Sugerir bancos com nome similar
            const similarDbs = result.rows.filter(db =>
                db.datname.toLowerCase().includes('marcos') ||
                db.datname.toLowerCase().includes('geodesic') ||
                db.datname.toLowerCase().includes('geo')
            );

            if (similarDbs.length > 0) {
                console.log('\n💡 Bancos com nome similar encontrados:');
                similarDbs.forEach(db => {
                    console.log(`   - ${db.datname} (${db.size})`);
                });
                console.log('\n📝 Você pode estar usando um destes bancos.');
            }

            console.log('\n🔧 Opções:');
            console.log('\n1. Criar o banco "marcos_geodesicos":');
            console.log('   psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE marcos_geodesicos;"');

            console.log('\n2. Ou ajustar o arquivo .env para apontar para o banco correto:');
            console.log('   POSTGRES_DB=nome_do_banco_correto');
        }

        // Verificar tabela car_downloads se o banco existir
        if (marcosDb) {
            const poolMarcosDb = new Pool({
                host: process.env.POSTGRES_HOST || 'localhost',
                port: process.env.POSTGRES_PORT || 5434,
                database: 'marcos_geodesicos',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'marcos123',
            });

            try {
                const tableCheck = await poolMarcosDb.query(`
                    SELECT column_name, data_type, column_default
                    FROM information_schema.columns
                    WHERE table_name = 'car_downloads'
                    ORDER BY ordinal_position
                `);

                if (tableCheck.rows.length > 0) {
                    console.log('\n📋 Estrutura da tabela car_downloads:');
                    console.table(tableCheck.rows);

                    const hasCreatedAt = tableCheck.rows.find(col => col.column_name === 'created_at');
                    const hasUpdatedAt = tableCheck.rows.find(col => col.column_name === 'updated_at');

                    if (hasCreatedAt && hasUpdatedAt) {
                        console.log('\n✅ Migration 014 já foi aplicada!');
                        console.log('   Colunas created_at e updated_at já existem.');
                    } else {
                        console.log('\n⚠️  Migration 014 ainda não foi aplicada.');
                        console.log('   Execute: node run-migration-014.js');
                    }
                } else {
                    console.log('\n⚠️  Tabela car_downloads não existe ainda.');
                    console.log('   Execute migration 012 primeiro.');
                }

                await poolMarcosDb.end();
            } catch (error) {
                console.log('\n⚠️  Erro ao verificar tabela:', error.message);
            }
        }

    } catch (error) {
        console.error('\n❌ Erro ao conectar ao PostgreSQL:');
        console.error(`   ${error.message}`);
        console.error('\n💡 Verifique se:');
        console.error('   1. PostgreSQL está rodando');
        console.error('   2. Porta 5434 está correta');
        console.error('   3. Senha "marcos123" está correta');
        console.error('   4. Arquivo .env está configurado corretamente');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar
checkDatabase().catch(error => {
    console.error('💥 Erro crítico:', error);
    process.exit(1);
});
