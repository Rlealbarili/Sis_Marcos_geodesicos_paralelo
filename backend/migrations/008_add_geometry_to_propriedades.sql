-- =============================================================================
-- MIGRATION 008: ADICIONAR COLUNA GEOMETRY POSTGIS
-- =============================================================================
-- Data: 2025-10-29
-- Objetivo: Adicionar suporte a geometria PostGIS na tabela propriedades
--           para armazenar polígonos das propriedades importadas
-- =============================================================================

-- 1. Verificar e ativar extensão PostGIS
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
    RAISE NOTICE '✅ Extensão PostGIS ativada';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  Extensão PostGIS já estava ativada';
END $$;

-- 2. Adicionar coluna geometry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'propriedades'
        AND column_name = 'geometry'
    ) THEN
        ALTER TABLE propriedades
        ADD COLUMN geometry GEOMETRY(Polygon, 31982);

        RAISE NOTICE '✅ Coluna geometry adicionada à tabela propriedades';
    ELSE
        RAISE NOTICE '⚠️  Coluna geometry já existe';
    END IF;
END $$;

-- 3. Adicionar campos calculados
DO $$
BEGIN
    -- Área calculada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'propriedades'
        AND column_name = 'area_calculada'
    ) THEN
        ALTER TABLE propriedades
        ADD COLUMN area_calculada DECIMAL(15,2);

        RAISE NOTICE '✅ Coluna area_calculada adicionada';
    ELSE
        RAISE NOTICE '⚠️  Coluna area_calculada já existe';
    END IF;

    -- Perímetro calculado
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'propriedades'
        AND column_name = 'perimetro_calculado'
    ) THEN
        ALTER TABLE propriedades
        ADD COLUMN perimetro_calculado DECIMAL(15,2);

        RAISE NOTICE '✅ Coluna perimetro_calculado adicionada';
    ELSE
        RAISE NOTICE '⚠️  Coluna perimetro_calculado já existe';
    END IF;
END $$;

-- 4. Criar índice espacial GIST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'propriedades'
        AND indexname = 'idx_propriedades_geometry'
    ) THEN
        CREATE INDEX idx_propriedades_geometry
        ON propriedades USING GIST(geometry);

        RAISE NOTICE '✅ Índice espacial GIST criado';
    ELSE
        RAISE NOTICE '⚠️  Índice espacial já existe';
    END IF;
END $$;

-- 5. Adicionar comentários para documentação
DO $$
BEGIN
    COMMENT ON COLUMN propriedades.geometry IS 'Geometria do polígono da propriedade (SIRGAS 2000 / UTM Zone 22S - EPSG:31982)';
    COMMENT ON COLUMN propriedades.area_calculada IS 'Área calculada automaticamente via PostGIS (m²)';
    COMMENT ON COLUMN propriedades.perimetro_calculado IS 'Perímetro calculado automaticamente via PostGIS (m)';

    RAISE NOTICE '✅ Comentários adicionados';
END $$;

-- =============================================================================
-- VALIDAÇÕES
-- =============================================================================

-- Verificar se PostGIS está instalado
DO $$
DECLARE
    postgis_version TEXT;
BEGIN
    SELECT extversion INTO postgis_version
    FROM pg_extension
    WHERE extname = 'postgis';

    IF postgis_version IS NOT NULL THEN
        RAISE NOTICE '✅ VALIDAÇÃO: PostGIS versão % instalado', postgis_version;
    ELSE
        RAISE EXCEPTION '❌ VALIDAÇÃO FALHOU: PostGIS não está instalado';
    END IF;
END $$;

-- Verificar se coluna geometry foi criada com tipo correto
DO $$
DECLARE
    geom_type TEXT;
    geom_srid INTEGER;
BEGIN
    SELECT type, srid
    INTO geom_type, geom_srid
    FROM geometry_columns
    WHERE f_table_name = 'propriedades'
    AND f_geometry_column = 'geometry';

    IF geom_type = 'POLYGON' AND geom_srid = 31982 THEN
        RAISE NOTICE '✅ VALIDAÇÃO: Coluna geometry criada corretamente (POLYGON, SRID=31982)';
    ELSE
        RAISE EXCEPTION '❌ VALIDAÇÃO FALHOU: Tipo ou SRID incorreto (tipo=%, srid=%)', geom_type, geom_srid;
    END IF;
END $$;

-- Verificar se índice GIST foi criado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'propriedades'
        AND indexname = 'idx_propriedades_geometry'
    ) THEN
        RAISE NOTICE '✅ VALIDAÇÃO: Índice espacial GIST criado';
    ELSE
        RAISE EXCEPTION '❌ VALIDAÇÃO FALHOU: Índice espacial não foi criado';
    END IF;
END $$;

-- =============================================================================
-- FIM DA MIGRATION 008
-- =============================================================================
