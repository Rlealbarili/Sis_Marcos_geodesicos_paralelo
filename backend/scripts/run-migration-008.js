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
        console.log('\n🚀 Executando Migration 008: Adicionar coluna geometry PostGIS\n');

        const migrationPath = path.join(__dirname, '../migrations/008_add_geometry_to_propriedades.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        await client.query(sql);

        console.log('\n✅ Migration 008 executada com sucesso!\n');

        // Verificar colunas adicionadas
        const columns = await client.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'propriedades'
            AND column_name IN ('geometry', 'area_calculada', 'perimetro_calculado')
            ORDER BY ordinal_position
        `);

        console.log('📋 Colunas adicionadas à tabela propriedades:');
        columns.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type || row.udt_name})`);
        });

        // Verificar informações de geometria
        const geomInfo = await client.query(`
            SELECT f_geometry_column, type, srid
            FROM geometry_columns
            WHERE f_table_name = 'propriedades'
        `);

        if (geomInfo.rows.length > 0) {
            console.log('\n🌐 Informações da geometria:');
            geomInfo.rows.forEach(row => {
                console.log(`   - Coluna: ${row.f_geometry_column}`);
                console.log(`   - Tipo: ${row.type}`);
                console.log(`   - SRID: ${row.srid} (SIRGAS 2000 / UTM Zone 22S)`);
            });
        }

        // Verificar índice espacial
        const indices = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'propriedades'
            AND indexname = 'idx_propriedades_geometry'
        `);

        console.log('\n📑 Índice espacial:');
        indices.rows.forEach(row => {
            console.log(`   - ${row.indexname}`);
        });

        // Verificar PostGIS versão
        const postgisVersion = await client.query(`SELECT PostGIS_Version()`);
        console.log(`\n✅ PostGIS: ${postgisVersion.rows[0].postgis_version}\n`);

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
