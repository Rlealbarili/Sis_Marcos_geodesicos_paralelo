-- ====================================================================
-- MIGRATION 017: RETORNAR GEOMETRIA DA ÁREA DE INTERSEÇÃO
-- Modificação da função analisar_sobreposicao para retornar:
-- 1. Geometria da área sobreposta (apenas a interseção)
-- 2. Todos os dados da parcela SIGEF
-- ====================================================================

-- Dropar função antiga (necessário pois estamos mudando o tipo de retorno)
DROP FUNCTION IF EXISTS analisar_sobreposicao(INTEGER);

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
    municipio_sigef VARCHAR,
    area_parcela_ha DECIMAL,
    situacao_parcela VARCHAR,
    data_certificacao DATE,
    geometria_intersecao TEXT,  -- GeoJSON da área de interseção em EPSG:4326
    geometria_parcela_completa TEXT  -- GeoJSON da parcela SIGEF completa em EPSG:4326 (para referência)
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
        sp.municipio,
        sp.area_hectares,
        sp.situacao_parcela,
        sp.data_certificacao,
        -- Geometria da interseção transformada para EPSG:4326 (lat/lng)
        ST_AsGeoJSON(ST_Transform(ST_Intersection(p.geometry, sp.geometry), 4326))::TEXT as geometria_intersecao,
        -- Geometria completa da parcela SIGEF para referência
        ST_AsGeoJSON(ST_Transform(sp.geometry, 4326))::TEXT as geometria_parcela_completa
    FROM propriedades p
    JOIN sigef_parcelas sp ON ST_Intersects(p.geometry, sp.geometry)
    WHERE p.id = propriedade_id
    AND p.geometry IS NOT NULL
    AND sp.geometry IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION analisar_sobreposicao IS 'Detecta sobreposições entre propriedade local e parcelas SIGEF certificadas - RETORNA GEOMETRIA DA INTERSEÇÃO';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 017: Função analisar_sobreposicao atualizada';
    RAISE NOTICE '   - Retorna geometria_intersecao (apenas área sobreposta)';
    RAISE NOTICE '   - Retorna geometria_parcela_completa (parcela SIGEF inteira)';
    RAISE NOTICE '   - Adiciona area_parcela_ha, situacao_parcela, data_certificacao';
    RAISE NOTICE '   - Geometrias em EPSG:4326 (lat/lng) para Leaflet';
END $$;
