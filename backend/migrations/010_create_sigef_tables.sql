-- ====================================================================
-- MIGRATION 010: TABELAS SIGEF/INCRA
-- Sistema de Análise Fundiária com Integração SIGEF
-- ====================================================================

-- Tabela para controle de downloads
CREATE TABLE IF NOT EXISTS sigef_downloads (
    id SERIAL PRIMARY KEY,
    estado VARCHAR(2) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'certificada_particular', 'certificada_publico', 'parcela_geo'
    data_download TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    arquivo_nome VARCHAR(255),
    arquivo_tamanho BIGINT,
    total_registros INTEGER,
    status VARCHAR(20) DEFAULT 'processando', -- 'processando', 'concluido', 'erro'
    erro_mensagem TEXT,
    UNIQUE(estado, tipo, data_download)
);

-- Tabela principal de parcelas SIGEF
CREATE TABLE IF NOT EXISTS sigef_parcelas (
    id SERIAL PRIMARY KEY,
    download_id INTEGER REFERENCES sigef_downloads(id) ON DELETE CASCADE,

    -- Identificação
    codigo_parcela VARCHAR(50) UNIQUE,
    cod_imovel VARCHAR(50),
    numero_certificacao VARCHAR(50),
    situacao_parcela VARCHAR(50),
    tipo_parcela VARCHAR(50), -- 'particular', 'publico'

    -- Localização
    estado VARCHAR(2),
    municipio VARCHAR(100),
    comarca VARCHAR(100),

    -- Área
    area_hectares DECIMAL(15,4),
    area_m2 DECIMAL(15,2),
    perimetro_m DECIMAL(15,2),

    -- Matrícula e Proprietário
    matricula VARCHAR(100),
    proprietario VARCHAR(500),
    cpf_cnpj VARCHAR(18),

    -- Datas
    data_certificacao DATE,
    data_aprovacao DATE,

    -- Responsável Técnico
    rt_nome VARCHAR(255),
    rt_registro VARCHAR(50),
    codigo_credenciado VARCHAR(50),

    -- Geometria
    geometry GEOMETRY(Polygon, 31982),

    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_codigo ON sigef_parcelas(codigo_parcela);
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_estado ON sigef_parcelas(estado);
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_municipio ON sigef_parcelas(municipio);
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_cpf_cnpj ON sigef_parcelas(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_proprietario ON sigef_parcelas(proprietario);
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_geometry ON sigef_parcelas USING GIST(geometry);

-- Tabela de confrontantes (calculada)
CREATE TABLE IF NOT EXISTS sigef_confrontantes (
    id SERIAL PRIMARY KEY,
    parcela_id INTEGER REFERENCES sigef_parcelas(id) ON DELETE CASCADE,
    parcela_vizinha_id INTEGER REFERENCES sigef_parcelas(id) ON DELETE CASCADE,
    tipo_contato VARCHAR(50), -- 'limite_comum', 'proximo'
    distancia_m DECIMAL(10,2),
    comprimento_contato_m DECIMAL(10,2),
    azimute DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parcela_id, parcela_vizinha_id)
);

CREATE INDEX IF NOT EXISTS idx_sigef_confrontantes_parcela ON sigef_confrontantes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_sigef_confrontantes_vizinha ON sigef_confrontantes(parcela_vizinha_id);

-- Tabela de análise de sobreposição
CREATE TABLE IF NOT EXISTS sigef_sobreposicoes (
    id SERIAL PRIMARY KEY,
    propriedade_local_id INTEGER REFERENCES propriedades(id) ON DELETE CASCADE,
    parcela_sigef_id INTEGER REFERENCES sigef_parcelas(id) ON DELETE CASCADE,
    tipo_sobreposicao VARCHAR(50), -- 'total', 'parcial', 'adjacente'
    area_sobreposicao_m2 DECIMAL(15,2),
    percentual_sobreposicao DECIMAL(5,2),
    geometry_intersecao GEOMETRY(Polygon, 31982),
    analisado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'resolvido', 'aceito'
    observacoes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sigef_sobreposicoes_propriedade ON sigef_sobreposicoes(propriedade_local_id);
CREATE INDEX IF NOT EXISTS idx_sigef_sobreposicoes_parcela ON sigef_sobreposicoes(parcela_sigef_id);

-- Comentários nas tabelas
COMMENT ON TABLE sigef_downloads IS 'Controle de downloads de shapefiles SIGEF/INCRA';
COMMENT ON TABLE sigef_parcelas IS 'Parcelas certificadas no SIGEF/INCRA importadas de shapefiles públicos';
COMMENT ON TABLE sigef_confrontantes IS 'Análise automática de confrontantes entre parcelas';
COMMENT ON TABLE sigef_sobreposicoes IS 'Detecção de sobreposições entre propriedades locais e parcelas SIGEF';

-- Mensagens de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 010: Tabelas SIGEF criadas com sucesso';
    RAISE NOTICE '   - sigef_downloads: Controle de downloads';
    RAISE NOTICE '   - sigef_parcelas: Parcelas certificadas';
    RAISE NOTICE '   - sigef_confrontantes: Análise de confrontantes';
    RAISE NOTICE '   - sigef_sobreposicoes: Detecção de sobreposições';
END $$;
