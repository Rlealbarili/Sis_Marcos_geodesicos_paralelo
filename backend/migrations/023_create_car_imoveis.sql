-- ============================================================
-- MIGRATION 023: Criar tabelas para base completa CAR-PR
-- ============================================================
-- Descrição: Cria estrutura para armazenar todos os imóveis CAR
--            do Paraná, similar ao que já temos para SIGEF
-- Data: 2025-01-12
-- ============================================================

-- Tabela principal: imóveis CAR
CREATE TABLE IF NOT EXISTS car_imoveis (
    id SERIAL PRIMARY KEY,
    codigo_car VARCHAR(50) UNIQUE NOT NULL,
    municipio VARCHAR(100),
    uf CHAR(2) DEFAULT 'PR',
    area_ha NUMERIC(12, 4),
    area_m2 NUMERIC(12, 2),
    perimetro_m NUMERIC(12, 2),
    situacao VARCHAR(50),  -- Ativo, Pendente, Cancelado
    data_cadastro DATE,
    data_atualizacao DATE,
    proprietario VARCHAR(200),  -- Disponível em alguns casos
    cpf_cnpj VARCHAR(20),       -- Pode ser NULL (dado restrito)
    geometry GEOMETRY(Polygon, 31982),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentários
COMMENT ON TABLE car_imoveis IS 'Imóveis cadastrados no CAR (Cadastro Ambiental Rural) - Paraná';
COMMENT ON COLUMN car_imoveis.codigo_car IS 'Código único do imóvel no CAR (formato: PR-XXXXXXX-XXXX...)';
COMMENT ON COLUMN car_imoveis.situacao IS 'Status do cadastro: Ativo, Pendente, Cancelado';
COMMENT ON COLUMN car_imoveis.geometry IS 'Geometria do perímetro do imóvel em EPSG:31982 (SIRGAS 2000 UTM 22S)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_car_codigo ON car_imoveis(codigo_car);
CREATE INDEX IF NOT EXISTS idx_car_municipio ON car_imoveis(municipio);
CREATE INDEX IF NOT EXISTS idx_car_uf ON car_imoveis(uf);
CREATE INDEX IF NOT EXISTS idx_car_situacao ON car_imoveis(situacao);
CREATE INDEX IF NOT EXISTS idx_car_geom ON car_imoveis USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_car_created_at ON car_imoveis(created_at);

-- Índice composto para buscas espaciais por município
CREATE INDEX IF NOT EXISTS idx_car_municipio_geom ON car_imoveis(municipio, geometry) WHERE situacao = 'Ativo';

-- Tabela de controle de downloads CAR
CREATE TABLE IF NOT EXISTS car_downloads (
    id SERIAL PRIMARY KEY,
    estado CHAR(2) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'area_imovel',  -- area_imovel, reserva_legal, app, etc
    status VARCHAR(50) DEFAULT 'pendente',   -- pendente, processando, concluido, erro
    data_download TIMESTAMP,
    data_inicio TIMESTAMP,
    data_fim TIMESTAMP,
    total_registros INTEGER,
    registros_inseridos INTEGER,
    registros_atualizados INTEGER,
    arquivo_nome VARCHAR(255),
    arquivo_tamanho BIGINT,
    erro_mensagem TEXT,
    fonte VARCHAR(100) DEFAULT 'GeoPR',      -- GeoPR, SICAR, Manual, etc
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estado, tipo)
);

COMMENT ON TABLE car_downloads IS 'Controle de downloads e sincronizações da base CAR';
COMMENT ON COLUMN car_downloads.tipo IS 'Tipo de camada: area_imovel, reserva_legal, app, uso_solo, etc';
COMMENT ON COLUMN car_downloads.fonte IS 'Fonte dos dados: GeoPR (WFS), SICAR (Python), Manual, etc';

-- Índices
CREATE INDEX IF NOT EXISTS idx_car_downloads_estado ON car_downloads(estado);
CREATE INDEX IF NOT EXISTS idx_car_downloads_status ON car_downloads(status);
CREATE INDEX IF NOT EXISTS idx_car_downloads_data ON car_downloads(data_download DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION atualizar_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_car_imoveis_updated_at
    BEFORE UPDATE ON car_imoveis
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_car_updated_at();

CREATE TRIGGER trigger_car_downloads_updated_at
    BEFORE UPDATE ON car_downloads
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_car_updated_at();

-- View para estatísticas gerais do CAR
CREATE OR REPLACE VIEW vw_car_estatisticas AS
SELECT
    uf,
    COUNT(*) as total_imoveis,
    COUNT(DISTINCT municipio) as total_municipios,
    SUM(area_ha) as area_total_ha,
    SUM(area_m2) as area_total_m2,
    AVG(area_ha) as area_media_ha,
    COUNT(CASE WHEN situacao = 'Ativo' THEN 1 END) as imoveis_ativos,
    COUNT(CASE WHEN situacao = 'Pendente' THEN 1 END) as imoveis_pendentes,
    COUNT(CASE WHEN situacao = 'Cancelado' THEN 1 END) as imoveis_cancelados,
    MAX(created_at) as ultima_importacao
FROM car_imoveis
GROUP BY uf;

COMMENT ON VIEW vw_car_estatisticas IS 'Estatísticas agregadas dos imóveis CAR por estado';

-- View para estatísticas por município
CREATE OR REPLACE VIEW vw_car_estatisticas_municipio AS
SELECT
    uf,
    municipio,
    COUNT(*) as total_imoveis,
    SUM(area_ha) as area_total_ha,
    AVG(area_ha) as area_media_ha,
    MIN(area_ha) as area_minima_ha,
    MAX(area_ha) as area_maxima_ha,
    COUNT(CASE WHEN situacao = 'Ativo' THEN 1 END) as imoveis_ativos
FROM car_imoveis
GROUP BY uf, municipio
ORDER BY uf, municipio;

COMMENT ON VIEW vw_car_estatisticas_municipio IS 'Estatísticas dos imóveis CAR agregadas por município';

-- Função para buscar imóveis CAR próximos a uma propriedade
CREATE OR REPLACE FUNCTION buscar_car_proximos(
    p_propriedade_id INTEGER,
    p_distancia_maxima NUMERIC DEFAULT 500
)
RETURNS TABLE (
    car_id INTEGER,
    codigo_car VARCHAR,
    municipio VARCHAR,
    area_ha NUMERIC,
    situacao VARCHAR,
    distancia_m NUMERIC,
    intersecta BOOLEAN,
    azimute NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.codigo_car,
        c.municipio,
        c.area_ha,
        c.situacao,
        ST_Distance(p.geometry, c.geometry)::NUMERIC(10,2) as distancia_m,
        ST_Intersects(p.geometry, c.geometry) as intersecta,
        DEGREES(ST_Azimuth(
            ST_Centroid(p.geometry),
            ST_Centroid(c.geometry)
        ))::NUMERIC(10,1) as azimute
    FROM propriedades p
    CROSS JOIN car_imoveis c
    WHERE p.id = p_propriedade_id
        AND c.situacao = 'Ativo'
        AND ST_DWithin(p.geometry, c.geometry, p_distancia_maxima)
    ORDER BY distancia_m;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION buscar_car_proximos IS 'Busca imóveis CAR próximos a uma propriedade dentro de um raio especificado';

-- ============================================================
-- FIM DA MIGRATION 023
-- ============================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 023 executada com sucesso!';
    RAISE NOTICE '   - Tabela car_imoveis criada';
    RAISE NOTICE '   - Tabela car_downloads criada';
    RAISE NOTICE '   - Índices espaciais criados';
    RAISE NOTICE '   - Views de estatísticas criadas';
    RAISE NOTICE '   - Função buscar_car_proximos criada';
END $$;
