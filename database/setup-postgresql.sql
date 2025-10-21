-- ============================================
-- SISTEMA DE MARCOS GEODÉSICOS - POSTGRESQL
-- ============================================

CREATE TABLE marcos_levantados (
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
);

CREATE TABLE marcos_pendentes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    tipo VARCHAR(1) NOT NULL,
    municipio VARCHAR(100),
    estado VARCHAR(2) DEFAULT 'PR',
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historico_alteracoes (
    id SERIAL PRIMARY KEY,
    marco_codigo VARCHAR(50),
    operacao VARCHAR(10),
    campo_alterado VARCHAR(100),
    valor_antigo TEXT,
    valor_novo TEXT,
    usuario VARCHAR(100),
    data_hora TIMESTAMP DEFAULT NOW()
);

CREATE TABLE metadados_sistema (
    chave VARCHAR(100) PRIMARY KEY,
    valor TEXT,
    descricao TEXT,
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nivel_acesso VARCHAR(20) DEFAULT 'LEITURA',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ml_codigo ON marcos_levantados(codigo);
CREATE INDEX idx_ml_tipo ON marcos_levantados(tipo);
CREATE INDEX idx_ml_municipio ON marcos_levantados(municipio);
CREATE INDEX idx_ml_geom ON marcos_levantados USING GIST(geom);

CREATE INDEX idx_mp_codigo ON marcos_pendentes(codigo);
CREATE INDEX idx_ha_marco ON historico_alteracoes(marco_codigo);

CREATE OR REPLACE FUNCTION utm_para_latlng(utm_e NUMERIC, utm_n NUMERIC)
RETURNS GEOMETRY AS $$
BEGIN
    RETURN ST_Transform(ST_SetSRID(ST_MakePoint(utm_e, utm_n), 31982), 4326);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION marcos_no_raio(lat NUMERIC, lng NUMERIC, raio_metros NUMERIC)
RETURNS TABLE (codigo VARCHAR, tipo VARCHAR, municipio VARCHAR, distancia_metros NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT m.codigo, m.tipo, m.municipio,
           ROUND(ST_Distance(m.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography)::NUMERIC, 2)
    FROM marcos_levantados m
    WHERE ST_DWithin(m.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, raio_metros)
    ORDER BY ST_Distance(m.geom::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
END;
$$ LANGUAGE plpgsql;

SELECT 'Estrutura criada com sucesso!' as status;