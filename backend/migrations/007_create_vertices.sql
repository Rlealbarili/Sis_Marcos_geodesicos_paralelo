-- =============================================================================
-- MIGRATION 007: CRIAR TABELA VERTICES
-- =============================================================================
-- Data: 2025-10-29
-- Objetivo: Criar tabela para armazenar vértices das propriedades importadas
--           a partir de memoriais descritivos
-- =============================================================================

-- Verificar se tabela já existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'vertices'
    ) THEN
        -- Criar tabela vertices
        CREATE TABLE vertices (
            id SERIAL PRIMARY KEY,
            propriedade_id INTEGER NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
            nome VARCHAR(50),                    -- Nome do vértice (ex: "V01", "FHV-M-3403")
            ordem INTEGER NOT NULL,              -- Ordem do vértice no polígono (1, 2, 3...)
            utm_e DECIMAL(12,2) NOT NULL,       -- Coordenada UTM East
            utm_n DECIMAL(12,2) NOT NULL,       -- Coordenada UTM North
            latitude DECIMAL(10,8),              -- Coordenada geográfica (opcional)
            longitude DECIMAL(11,8),             -- Coordenada geográfica (opcional)
            utm_zona VARCHAR(10) DEFAULT '22S',  -- Zona UTM
            datum VARCHAR(20) DEFAULT 'SIRGAS2000',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Criar índices para performance
        CREATE INDEX idx_vertices_propriedade ON vertices(propriedade_id);
        CREATE INDEX idx_vertices_ordem ON vertices(propriedade_id, ordem);

        -- Adicionar comentários para documentação
        COMMENT ON TABLE vertices IS 'Vértices das propriedades importadas de memoriais descritivos';
        COMMENT ON COLUMN vertices.propriedade_id IS 'Referência à propriedade que este vértice pertence';
        COMMENT ON COLUMN vertices.nome IS 'Nome/código do vértice (ex: V01, FHV-M-3403, M-001)';
        COMMENT ON COLUMN vertices.ordem IS 'Ordem sequencial do vértice no polígono (1, 2, 3, ...)';
        COMMENT ON COLUMN vertices.utm_e IS 'Coordenada UTM East (metros)';
        COMMENT ON COLUMN vertices.utm_n IS 'Coordenada UTM North (metros)';
        COMMENT ON COLUMN vertices.latitude IS 'Latitude em graus decimais (SIRGAS2000)';
        COMMENT ON COLUMN vertices.longitude IS 'Longitude em graus decimais (SIRGAS2000)';
        COMMENT ON COLUMN vertices.utm_zona IS 'Zona UTM (ex: 22S, 23S)';
        COMMENT ON COLUMN vertices.datum IS 'Sistema geodésico de referência (padrão: SIRGAS2000)';

        RAISE NOTICE '✅ Tabela vertices criada com sucesso';
        RAISE NOTICE '✅ Índices criados: idx_vertices_propriedade, idx_vertices_ordem';
    ELSE
        RAISE NOTICE '⚠️  Tabela vertices já existe, pulando criação';
    END IF;
END $$;

-- =============================================================================
-- VALIDAÇÕES
-- =============================================================================

-- Verificar se tabela foi criada
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'vertices'
    ) THEN
        RAISE NOTICE '✅ VALIDAÇÃO: Tabela vertices existe';
    ELSE
        RAISE EXCEPTION '❌ VALIDAÇÃO FALHOU: Tabela vertices não foi criada';
    END IF;
END $$;

-- Verificar se índices foram criados
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'vertices'
        AND indexname = 'idx_vertices_propriedade'
    ) THEN
        RAISE NOTICE '✅ VALIDAÇÃO: Índice idx_vertices_propriedade existe';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'vertices'
        AND indexname = 'idx_vertices_ordem'
    ) THEN
        RAISE NOTICE '✅ VALIDAÇÃO: Índice idx_vertices_ordem existe';
    END IF;
END $$;

-- =============================================================================
-- FIM DA MIGRATION 007
-- =============================================================================
