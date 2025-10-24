const { Client } = require('pg');
require('dotenv').config();

async function criarFuncoes() {
    const client = new Client({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5434,
        database: process.env.POSTGRES_DB || 'marcos_geodesicos',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'marcos123'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL (porta 5434)\n');

        // Habilitar PostGIS
        console.log('Habilitando extensões PostGIS...');
        await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
        await client.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
        console.log('✅ PostGIS habilitado\n');

        // Criar tabelas
        console.log('Criando tabelas...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS marcos_levantados (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(50) NOT NULL UNIQUE,
                tipo VARCHAR(1) NOT NULL CHECK (tipo IN ('V', 'M', 'P')),
                municipio VARCHAR(100),
                estado VARCHAR(2) DEFAULT 'PR',
                coordenada_e NUMERIC(12, 4),
                coordenada_n NUMERIC(12, 4),
                altitude NUMERIC(10, 3),
                geom GEOMETRY(Point, 4326),
                latitude NUMERIC(10, 8),
                longitude NUMERIC(11, 8),
                data_levantamento DATE,
                metodo VARCHAR(50),
                precisao_horizontal NUMERIC(6, 3),
                precisao_vertical NUMERIC(6, 3),
                observacoes TEXT,
                status VARCHAR(20) DEFAULT 'LEVANTADO',
                criado_em TIMESTAMP DEFAULT NOW(),
                atualizado_em TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS marcos_pendentes (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(50) NOT NULL UNIQUE,
                tipo VARCHAR(1) NOT NULL,
                municipio VARCHAR(100),
                estado VARCHAR(2) DEFAULT 'PR',
                observacoes TEXT,
                criado_em TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS historico_alteracoes (
                id SERIAL PRIMARY KEY,
                marco_codigo VARCHAR(50),
                operacao VARCHAR(10),
                usuario VARCHAR(100),
                data_hora TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS metadados_sistema (
                chave VARCHAR(100) PRIMARY KEY,
                valor TEXT
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                nome VARCHAR(255),
                senha_hash VARCHAR(255),
                criado_em TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Tabelas criadas\n');

        // Criar índices
        console.log('Criando índices...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ml_codigo ON marcos_levantados(codigo)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ml_tipo ON marcos_levantados(tipo)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ml_municipio ON marcos_levantados(municipio)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ml_geom ON marcos_levantados USING GIST(geom)');
        console.log('✅ Índices criados\n');

        // Função 1: utm_para_latlng
        console.log('Criando função utm_para_latlng...');
        await client.query(`
            CREATE OR REPLACE FUNCTION utm_para_latlng(utm_e NUMERIC, utm_n NUMERIC)
            RETURNS GEOMETRY AS $$
            BEGIN
                RETURN ST_Transform(ST_SetSRID(ST_MakePoint(utm_e, utm_n), 31982), 4326);
            END;
            $$ LANGUAGE plpgsql IMMUTABLE;
        `);
        console.log('✅ Função utm_para_latlng criada\n');

        // Função 2: marcos_no_raio
        console.log('Criando função marcos_no_raio...');
        await client.query(`
            CREATE OR REPLACE FUNCTION marcos_no_raio(lat NUMERIC, lng NUMERIC, raio_metros NUMERIC)
            RETURNS TABLE (codigo VARCHAR, tipo VARCHAR, municipio VARCHAR, distancia_metros NUMERIC) AS $$
            BEGIN
                RETURN QUERY
                SELECT
                    m.codigo::VARCHAR,
                    m.tipo::VARCHAR,
                    m.municipio::VARCHAR,
                    ROUND(ST_Distance(
                        m.geom::geography,
                        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                    )::NUMERIC, 2) as distancia_metros
                FROM marcos_levantados m
                WHERE m.geom IS NOT NULL
                  AND ST_DWithin(
                      m.geom::geography,
                      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
                      raio_metros
                  )
                ORDER BY ST_Distance(
                    m.geom::geography,
                    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                );
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Função marcos_no_raio criada\n');

        // Testar função
        console.log('Testando função utm_para_latlng...');
        const result = await client.query(
            "SELECT ST_AsText(utm_para_latlng(650589.8882, 7192069.4339)) as ponto"
        );
        console.log(`✅ Teste: ${result.rows[0].ponto}\n`);

        console.log('🎉 FUNÇÕES POSTGIS CRIADAS COM SUCESSO!\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

criarFuncoes();
