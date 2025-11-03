-- =====================================================
-- TABELAS DO CADASTRO AMBIENTAL RURAL (CAR)
-- =====================================================

-- Tabela de controle de downloads CAR
CREATE TABLE IF NOT EXISTS car_downloads (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(2) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'imovel', 'vegetacao_nativa', 'app', 'reserva_legal'
    data_download TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    arquivo_nome VARCHAR(255),
    arquivo_tamanho BIGINT,
    total_registros INTEGER,
    status VARCHAR(20) DEFAULT 'processando',
    erro_mensagem TEXT,
    UNIQUE(estado, tipo, data_download)
);

-- Tabela principal de imóveis CAR
CREATE TABLE IF NOT EXISTS car_imoveis (
    id SERIAL PRIMARY KEY,
    download_id INTEGER REFERENCES car_downloads(id) ON DELETE CASCADE,

    -- Identificação
    codigo_imovel VARCHAR(50) UNIQUE,
    numero_car VARCHAR(50),
    cpf_cnpj VARCHAR(18),
    nome_proprietario VARCHAR(500),

    -- Localização
    estado VARCHAR(2),
    municipio VARCHAR(100),

    -- Áreas (em hectares)
    area_imovel DECIMAL(15,4),
    area_vegetacao_nativa DECIMAL(15,4),
    area_app DECIMAL(15,4),
    area_reserva_legal DECIMAL(15,4),
    area_uso_consolidado DECIMAL(15,4),

    -- Status
    status_car VARCHAR(50), -- 'ativo', 'cancelado', 'pendente'
    data_cadastro DATE,
    data_atualizacao DATE,

    -- Tipo de imóvel
    tipo_imovel VARCHAR(50), -- 'pequena_propriedade', 'media_propriedade', 'grande_propriedade'
    modulos_fiscais DECIMAL(10,2),

    -- Geometria
    geometry GEOMETRY(MultiPolygon, 31982),

    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_car_imoveis_codigo ON car_imoveis(codigo_imovel);
CREATE INDEX idx_car_imoveis_numero_car ON car_imoveis(numero_car);
CREATE INDEX idx_car_imoveis_estado ON car_imoveis(estado);
CREATE INDEX idx_car_imoveis_municipio ON car_imoveis(municipio);
CREATE INDEX idx_car_imoveis_cpf_cnpj ON car_imoveis(cpf_cnpj);
CREATE INDEX idx_car_imoveis_geometry ON car_imoveis USING GIST(geometry);

-- Tabela de vegetação nativa
CREATE TABLE IF NOT EXISTS car_vegetacao_nativa (
    id SERIAL PRIMARY KEY,
    car_imovel_id INTEGER REFERENCES car_imoveis(id) ON DELETE CASCADE,
    codigo_area VARCHAR(50),
    tipo_vegetacao VARCHAR(100),
    estagio_sucessao VARCHAR(50),
    area_hectares DECIMAL(15,4),
    geometry GEOMETRY(MultiPolygon, 31982),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_vegetacao_imovel ON car_vegetacao_nativa(car_imovel_id);
CREATE INDEX idx_car_vegetacao_geometry ON car_vegetacao_nativa USING GIST(geometry);

-- Tabela de APP (Área de Preservação Permanente)
CREATE TABLE IF NOT EXISTS car_app (
    id SERIAL PRIMARY KEY,
    car_imovel_id INTEGER REFERENCES car_imoveis(id) ON DELETE CASCADE,
    codigo_area VARCHAR(50),
    tipo_app VARCHAR(100), -- 'rio', 'nascente', 'topo_morro', 'reservatorio'
    area_hectares DECIMAL(15,4),
    geometry GEOMETRY(MultiPolygon, 31982),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_app_imovel ON car_app(car_imovel_id);
CREATE INDEX idx_car_app_geometry ON car_app USING GIST(geometry);

-- Tabela de Reserva Legal
CREATE TABLE IF NOT EXISTS car_reserva_legal (
    id SERIAL PRIMARY KEY,
    car_imovel_id INTEGER REFERENCES car_imoveis(id) ON DELETE CASCADE,
    codigo_area VARCHAR(50),
    tipo_reserva VARCHAR(50), -- 'propria', 'compensacao'
    area_hectares DECIMAL(15,4),
    percentual_imovel DECIMAL(5,2),
    geometry GEOMETRY(MultiPolygon, 31982),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_reserva_imovel ON car_reserva_legal(car_imovel_id);
CREATE INDEX idx_car_reserva_geometry ON car_reserva_legal USING GIST(geometry);

-- Tabela de comparação SIGEF x CAR
CREATE TABLE IF NOT EXISTS comparacao_sigef_car (
    id SERIAL PRIMARY KEY,
    propriedade_local_id INTEGER REFERENCES propriedades(id) ON DELETE CASCADE,
    parcela_sigef_id INTEGER REFERENCES sigef_parcelas(id) ON DELETE SET NULL,
    car_imovel_id INTEGER REFERENCES car_imoveis(id) ON DELETE SET NULL,

    -- Análise
    tem_car BOOLEAN DEFAULT false,
    tem_sigef BOOLEAN DEFAULT false,
    areas_coincidem BOOLEAN DEFAULT false,
    diferenca_area_m2 DECIMAL(15,2),
    diferenca_percentual DECIMAL(5,2),

    -- Geometria da interseção
    geometry_intersecao GEOMETRY(Polygon, 31982),
    area_intersecao_m2 DECIMAL(15,2),

    -- Status
    status_analise VARCHAR(50), -- 'conforme', 'divergente', 'pendente'
    observacoes TEXT,
    analisado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comparacao_propriedade ON comparacao_sigef_car(propriedade_local_id);
CREATE INDEX idx_comparacao_sigef ON comparacao_sigef_car(parcela_sigef_id);
CREATE INDEX idx_comparacao_car ON comparacao_sigef_car(car_imovel_id);

-- Comentários
COMMENT ON TABLE car_imoveis IS 'Imóveis cadastrados no CAR (Cadastro Ambiental Rural)';
COMMENT ON TABLE car_vegetacao_nativa IS 'Áreas de vegetação nativa declaradas no CAR';
COMMENT ON TABLE car_app IS 'Áreas de Preservação Permanente declaradas no CAR';
COMMENT ON TABLE car_reserva_legal IS 'Áreas de Reserva Legal declaradas no CAR';
COMMENT ON TABLE comparacao_sigef_car IS 'Comparação entre SIGEF e CAR para identificar divergências';

-- Verificação final
SELECT 'Migration 012 executada com sucesso!' AS status;
SELECT
    'Tabelas CAR criadas: ' || COUNT(*) || ' tabelas' AS info
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'car_%';
