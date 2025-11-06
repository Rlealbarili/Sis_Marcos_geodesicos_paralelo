-- Drop existing functions
DROP FUNCTION IF EXISTS analisar_sobreposicao CASCADE;
DROP FUNCTION IF EXISTS identificar_confrontantes CASCADE;

-- Recreate with VARCHAR cast
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
