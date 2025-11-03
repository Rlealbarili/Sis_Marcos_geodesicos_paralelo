const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5434,
    database: 'marcos_geodesicos',
    user: 'postgres',
    password: 'marcos123'
});

async function verificar() {
    try {
        console.log('🔍 Verificando estrutura do banco...\n');

        // 1. Verificar tabela vertices
        const vertices = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'vertices'
            );
        `);
        console.log('✅ Tabela vertices existe:', vertices.rows[0].exists);

        if (vertices.rows[0].exists) {
            const colunas = await pool.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'vertices'
                ORDER BY ordinal_position;
            `);
            console.log('\n📋 Colunas da tabela vertices:');
            colunas.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        }

        // 2. Verificar coluna geometry em propriedades
        const geometry = await pool.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'propriedades'
            AND column_name = 'geometry';
        `);

        console.log('\n✅ Coluna geometry existe:', geometry.rows.length > 0);

        if (geometry.rows.length > 0) {
            console.log('📍 Tipo:', geometry.rows[0].udt_name || geometry.rows[0].data_type);
        }

        // 3. Listar todas as colunas de propriedades
        const propCols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'propriedades'
            ORDER BY ordinal_position;
        `);
        console.log('\n📋 Colunas da tabela propriedades:');
        propCols.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

verificar();
