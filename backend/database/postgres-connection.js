const { Pool } = require('pg');
require('dotenv').config({ override: true });

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5434,
    database: process.env.POSTGRES_DB || 'marcos_geodesicos',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'marcos123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
    console.log('🐘 PostgreSQL: Nova conexão estabelecida (porta 5434)');
});

pool.on('error', (err) => {
    console.error('❌ Erro no pool PostgreSQL:', err);
});

async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log(`Query: ${duration}ms | Rows: ${res.rowCount}`);
        }
        return res;
    } catch (error) {
        console.error('❌ Query error:', error.message);
        throw error;
    }
}

async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction rollback:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function healthCheck() {
    try {
        const result = await query('SELECT NOW() as time, version() as version');
        return {
            status: 'OK',
            timestamp: result.rows[0].time,
            version: result.rows[0].version.split(',')[0],
            port: process.env.POSTGRES_PORT || 5434
        };
    } catch (error) {
        return {
            status: 'ERROR',
            error: error.message
        };
    }
}

process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando pool PostgreSQL...');
    await pool.end();
    process.exit(0);
});

module.exports = {
    pool,
    query,
    transaction,
    healthCheck
};
