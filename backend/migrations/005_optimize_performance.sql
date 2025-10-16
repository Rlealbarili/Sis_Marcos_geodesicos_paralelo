-- ============================================
-- MIGRATION: Otimização de Performance
-- Objetivo: Melhorar queries em 5-10x
-- ============================================

-- Habilitar WAL mode para leituras concorrentes
-- Permite múltiplos leitores simultâneos sem bloquear
PRAGMA journal_mode = WAL;

-- Aumentar cache size para 64MB
-- Cache maior = menos I/O = queries mais rápidas
PRAGMA cache_size = -64000;

-- Reduzir durability para velocidade
-- NORMAL é seguro e mais rápido que FULL
PRAGMA synchronous = NORMAL;

-- Usar memória para operações temporárias
-- Evita I/O desnecessário em sorts/joins temporários
PRAGMA temp_store = MEMORY;

-- ============================================
-- ÍNDICES PARA QUERIES GEOESPACIAIS
-- ============================================

-- Índice composto para queries de coordenadas (bounding box)
-- Essencial para filtros WHERE coordenada_e BETWEEN ... AND coordenada_n BETWEEN ...
CREATE INDEX IF NOT EXISTS idx_marcos_coords_utm
  ON marcos(coordenada_e, coordenada_n);

-- Índices individuais para range queries
-- Usado quando filtramos por apenas uma dimensão
CREATE INDEX IF NOT EXISTS idx_marcos_coord_e
  ON marcos(coordenada_e);

CREATE INDEX IF NOT EXISTS idx_marcos_coord_n
  ON marcos(coordenada_n);

-- ============================================
-- ÍNDICES PARA FILTROS COMUNS
-- ============================================

-- Índice composto tipo + localização
-- Otimiza queries: WHERE tipo = 'M' AND localizacao LIKE '%CURITIBA%'
CREATE INDEX IF NOT EXISTS idx_marcos_tipo_localizacao
  ON marcos(tipo, localizacao);

-- Índice para status (usado em filtros de mapa)
CREATE INDEX IF NOT EXISTS idx_marcos_status
  ON marcos(status_campo);

-- Índice para ativo (sempre usado em WHERE)
CREATE INDEX IF NOT EXISTS idx_marcos_ativo
  ON marcos(ativo);

-- Índice composto para filtros múltiplos
-- Otimiza: WHERE ativo = 1 AND tipo = 'M' AND status_campo = 'LEVANTADO'
CREATE INDEX IF NOT EXISTS idx_marcos_ativo_tipo_status
  ON marcos(ativo, tipo, status_campo);

-- ============================================
-- ÍNDICES PARA BUSCA TEXTUAL
-- ============================================

-- Índice para busca por código (frequente)
CREATE INDEX IF NOT EXISTS idx_marcos_codigo
  ON marcos(codigo);

-- Índice para busca por localização
CREATE INDEX IF NOT EXISTS idx_marcos_localizacao
  ON marcos(localizacao);

-- Índice para busca por lote
CREATE INDEX IF NOT EXISTS idx_marcos_lote
  ON marcos(lote) WHERE lote IS NOT NULL;

-- ============================================
-- OTIMIZAÇÃO DO QUERY PLANNER
-- ============================================

-- Atualizar estatísticas para o query planner fazer escolhas melhores
ANALYZE;

-- ============================================
-- COMPACTAÇÃO DO BANCO
-- ============================================

-- VACUUM para recuperar espaço e reorganizar dados
-- Melhora performance ao reduzir fragmentação
VACUUM;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Mostrar configurações aplicadas
SELECT 'WAL Mode: ' || (SELECT * FROM pragma_journal_mode()) as config
UNION ALL
SELECT 'Cache Size: ' || (SELECT * FROM pragma_cache_size()) as config
UNION ALL
SELECT 'Synchronous: ' || (SELECT * FROM pragma_synchronous()) as config
UNION ALL
SELECT 'Temp Store: ' || (SELECT * FROM pragma_temp_store()) as config;
