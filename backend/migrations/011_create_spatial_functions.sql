-- ====================================================================
-- MIGRATION 011: FUNÇÕES POSTGIS DE ANÁLISE GEOESPACIAL
-- Sistema de Análise Fundiária - Detecção de Sobreposições e Confrontantes
-- ====================================================================

-- =====================================================
-- FUNÇÃO 1: DETECTAR SOBREPOSIÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION analisar_sobreposicao(
    propriedade_id INTEGER
)
RETURNS TABLE (
    parcela_sigef_id INTEGER,
    codigo_parcela VARCHAR,
    tipo_sobreposicao VARCHAR,
    area_sobreposicao_m2 DECIMAL,
    percentual_propriedade DECIMAL,
    percentual_parcela DECIMAL,
    proprietario_sigef VARCHAR,
    matricula_sigef VARCHAR,
    municipio_sigef VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id,
        sp.codigo_parcela,
        CASE
            WHEN ST_Contains(sp.geometry, p.geometry) THEN 'total_propriedade_dentro'::VARCHAR
            WHEN ST_Contains(p.geometry, sp.geometry) THEN 'total_parcela_dentro'::VARCHAR
            WHEN ST_Overlaps(p.geometry, sp.geometry) THEN 'parcial'::VARCHAR
            WHEN ST_Touches(p.geometry, sp.geometry) THEN 'adjacente'::VARCHAR
            ELSE 'desconhecido'::VARCHAR
        END as tipo_sobreposicao,
        ST_Area(ST_Intersection(p.geometry, sp.geometry))::DECIMAL as area_sobreposicao_m2,
        (ST_Area(ST_Intersection(p.geometry, sp.geometry)) / NULLIF(ST_Area(p.geometry), 0) * 100)::DECIMAL(5,2) as percentual_propriedade,
        (ST_Area(ST_Intersection(p.geometry, sp.geometry)) / NULLIF(ST_Area(sp.geometry), 0) * 100)::DECIMAL(5,2) as percentual_parcela,
        sp.proprietario,
        sp.matricula,
        sp.municipio
    FROM propriedades p
    JOIN sigef_parcelas sp ON ST_Intersects(p.geometry, sp.geometry)
    WHERE p.id = propriedade_id
    AND p.geometry IS NOT NULL
    AND sp.geometry IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION analisar_sobreposicao IS 'Detecta sobreposições entre propriedade local e parcelas SIGEF certificadas';

-- =====================================================
-- FUNÇÃO 2: IDENTIFICAR CONFRONTANTES
-- =====================================================

CREATE OR REPLACE FUNCTION identificar_confrontantes(
    propriedade_id INTEGER,
    raio_metros DECIMAL DEFAULT 500
)
RETURNS TABLE (
    parcela_sigef_id INTEGER,
    codigo_parcela VARCHAR,
    tipo_contato VARCHAR,
    distancia_m DECIMAL,
    comprimento_contato_m DECIMAL,
    azimute DECIMAL,
    proprietario VARCHAR,
    area_ha DECIMAL,
    municipio VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id,
        sp.codigo_parcela,
        CASE
            WHEN ST_Touches(p.geometry, sp.geometry) THEN 'limite_comum'::VARCHAR
            WHEN ST_Distance(p.geometry, sp.geometry) <= raio_metros THEN 'proximo'::VARCHAR
            ELSE 'distante'::VARCHAR
        END as tipo_contato,
        ST_Distance(p.geometry, sp.geometry)::DECIMAL(10,2) as distancia_m,
        CASE
            WHEN ST_Touches(p.geometry, sp.geometry) THEN
                ST_Length(ST_Intersection(ST_Boundary(p.geometry), ST_Boundary(sp.geometry)))::DECIMAL(10,2)
            ELSE 0
        END as comprimento_contato_m,
        degrees(ST_Azimuth(
            ST_Centroid(p.geometry),
            ST_Centroid(sp.geometry)
        ))::DECIMAL(10,6) as azimute,
        sp.proprietario,
        sp.area_hectares,
        sp.municipio
    FROM propriedades p
    CROSS JOIN sigef_parcelas sp
    WHERE p.id = propriedade_id
    AND p.geometry IS NOT NULL
    AND sp.geometry IS NOT NULL
    AND (
        ST_Touches(p.geometry, sp.geometry)
        OR ST_Distance(p.geometry, sp.geometry) <= raio_metros
    )
    ORDER BY distancia_m ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION identificar_confrontantes IS 'Identifica parcelas SIGEF que fazem limite ou estão próximas da propriedade';

-- =====================================================
-- FUNÇÃO 3: CALCULAR SCORE DE VIABILIDADE
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_score_viabilidade(
    propriedade_id INTEGER
)
RETURNS TABLE (
    score_total INTEGER,
    nivel_risco VARCHAR,
    tem_sobreposicao BOOLEAN,
    qtd_sobreposicoes INTEGER,
    area_sobreposta_m2 DECIMAL,
    qtd_confrontantes INTEGER,
    tem_parcela_certificada_proxima BOOLEAN,
    distancia_mais_proxima_m DECIMAL,
    recomendacao TEXT
) AS $$
DECLARE
    v_score INTEGER := 100;
    v_tem_sobreposicao BOOLEAN;
    v_qtd_sobreposicoes INTEGER;
    v_area_sobreposta DECIMAL;
    v_qtd_confrontantes INTEGER;
    v_dist_proxima DECIMAL;
    v_nivel VARCHAR;
    v_recomendacao TEXT;
BEGIN
    -- Verificar sobreposições
    SELECT
        COUNT(*) > 0,
        COUNT(*),
        COALESCE(SUM(ST_Area(ST_Intersection(p.geometry, sp.geometry))), 0)
    INTO v_tem_sobreposicao, v_qtd_sobreposicoes, v_area_sobreposta
    FROM propriedades p
    JOIN sigef_parcelas sp ON ST_Overlaps(p.geometry, sp.geometry)
    WHERE p.id = propriedade_id;

    -- Penalizar por sobreposições
    IF v_tem_sobreposicao THEN
        v_score := v_score - (v_qtd_sobreposicoes * 30);
        IF v_qtd_sobreposicoes > 2 THEN
            v_score := v_score - 20; -- Penalidade extra para múltiplas sobreposições
        END IF;
    END IF;

    -- Contar confrontantes
    SELECT COUNT(*)
    INTO v_qtd_confrontantes
    FROM propriedades p
    JOIN sigef_parcelas sp ON ST_Touches(p.geometry, sp.geometry)
    WHERE p.id = propriedade_id;

    -- Penalizar por muitos confrontantes (complexidade)
    IF v_qtd_confrontantes > 10 THEN
        v_score := v_score - 15;
    ELSIF v_qtd_confrontantes > 5 THEN
        v_score := v_score - 5;
    END IF;

    -- Verificar distância da parcela mais próxima
    SELECT MIN(ST_Distance(p.geometry, sp.geometry))
    INTO v_dist_proxima
    FROM propriedades p
    CROSS JOIN sigef_parcelas sp
    WHERE p.id = propriedade_id
    AND NOT ST_Touches(p.geometry, sp.geometry);

    -- Garantir score mínimo
    IF v_score < 0 THEN
        v_score := 0;
    END IF;

    -- Determinar nível de risco
    IF v_score >= 80 THEN
        v_nivel := 'BAIXO';
        v_recomendacao := 'Trabalho viável. Poucas ou nenhuma complicação esperada.';
    ELSIF v_score >= 50 THEN
        v_nivel := 'MÉDIO';
        v_recomendacao := 'Requer atenção. Verificar sobreposições e confrontantes detalhadamente.';
    ELSIF v_score >= 30 THEN
        v_nivel := 'ALTO';
        v_recomendacao := 'Trabalho complexo. Sobreposições detectadas. Análise jurídica recomendada.';
    ELSE
        v_nivel := 'CRÍTICO';
        v_recomendacao := 'Múltiplas sobreposições. Avaliar viabilidade antes de aceitar o trabalho.';
    END IF;

    RETURN QUERY SELECT
        v_score,
        v_nivel,
        COALESCE(v_tem_sobreposicao, false),
        COALESCE(v_qtd_sobreposicoes, 0),
        COALESCE(v_area_sobreposta, 0),
        COALESCE(v_qtd_confrontantes, 0),
        COALESCE(v_dist_proxima <= 100, false),
        COALESCE(v_dist_proxima, 999999),
        v_recomendacao;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_score_viabilidade IS 'Calcula score de viabilidade (0-100) baseado em sobreposições e complexidade';

-- =====================================================
-- FUNÇÃO 4: ANALISAR ÁREA PRÉ-CADASTRO (DESENHO NO MAPA)
-- =====================================================

CREATE OR REPLACE FUNCTION analisar_area_pre_cadastro(
    geometry_wkt TEXT,
    srid INTEGER DEFAULT 31982
)
RETURNS TABLE (
    score_viabilidade INTEGER,
    nivel_risco VARCHAR,
    tem_sobreposicao BOOLEAN,
    qtd_sobreposicoes INTEGER,
    parcelas_conflitantes JSONB,
    recomendacao TEXT
) AS $$
DECLARE
    v_geometry GEOMETRY;
    v_score INTEGER := 100;
    v_tem_sobreposicao BOOLEAN;
    v_qtd_sobreposicoes INTEGER;
    v_nivel VARCHAR;
    v_recomendacao TEXT;
    v_conflitos JSONB;
BEGIN
    -- Converter WKT para geometria
    v_geometry := ST_GeomFromText(geometry_wkt, srid);

    -- Analisar sobreposições
    SELECT
        COUNT(*) > 0,
        COUNT(*),
        jsonb_agg(
            jsonb_build_object(
                'codigo', sp.codigo_parcela,
                'proprietario', sp.proprietario,
                'area_ha', sp.area_hectares,
                'municipio', sp.municipio,
                'percentual_sobreposicao',
                    ROUND((ST_Area(ST_Intersection(v_geometry, sp.geometry)) / NULLIF(ST_Area(v_geometry), 0) * 100)::numeric, 2)
            )
        )
    INTO v_tem_sobreposicao, v_qtd_sobreposicoes, v_conflitos
    FROM sigef_parcelas sp
    WHERE ST_Intersects(v_geometry, sp.geometry)
    AND sp.geometry IS NOT NULL;

    -- Calcular score
    IF v_tem_sobreposicao THEN
        v_score := v_score - (v_qtd_sobreposicoes * 30);
    END IF;

    IF v_score < 0 THEN v_score := 0; END IF;

    -- Determinar nível
    IF v_score >= 80 THEN
        v_nivel := 'BAIXO';
        v_recomendacao := 'Área viável para regularização.';
    ELSIF v_score >= 50 THEN
        v_nivel := 'MÉDIO';
        v_recomendacao := 'Verificar detalhes das sobreposições.';
    ELSE
        v_nivel := 'ALTO';
        v_recomendacao := 'Múltiplas sobreposições. Avaliar cuidadosamente.';
    END IF;

    RETURN QUERY SELECT
        v_score,
        v_nivel,
        COALESCE(v_tem_sobreposicao, false),
        COALESCE(v_qtd_sobreposicoes, 0),
        COALESCE(v_conflitos, '[]'::jsonb),
        v_recomendacao;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION analisar_area_pre_cadastro IS 'Analisa área desenhada no mapa ANTES de cadastrar propriedade';

-- =====================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================

-- Melhorar queries espaciais
CREATE INDEX IF NOT EXISTS idx_sigef_parcelas_geometry_buffer
ON sigef_parcelas USING GIST(ST_Buffer(geometry, 100));

CREATE INDEX IF NOT EXISTS idx_propriedades_geometry_buffer
ON propriedades USING GIST(ST_Buffer(geometry, 100));

-- Mensagens de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 011: Funções de análise espacial criadas';
    RAISE NOTICE '   - analisar_sobreposicao(): Detecta conflitos com SIGEF';
    RAISE NOTICE '   - identificar_confrontantes(): Identifica vizinhos';
    RAISE NOTICE '   - calcular_score_viabilidade(): Score 0-100 de risco';
    RAISE NOTICE '   - analisar_area_pre_cadastro(): Análise prévia';
    RAISE NOTICE '   - Índices GIST otimizados criados';
END $$;
