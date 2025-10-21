const { Client } = require('pg');

async function criarFuncoes() {
    const client = new Client({
        host: 'localhost',
        port: 5433,
        database: 'marcos_geodesicos',
        user: 'postgres',
        password: 'marcos123'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');

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
