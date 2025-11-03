-- =====================================================
-- MIGRATION 013: CORRIGIR TIPOS DE MARCOS PARA PADRÃO COGEP
-- =====================================================
-- Data: 2025-11-03
-- Descrição: Atualizar tipos de marcos para padrão COGEP (FHV-V, FHV-M, FHV-P)
--
-- TIPOS CORRETOS COGEP:
-- - FHV-V = Vértice (marco de divisa)
-- - FHV-M = Marco de referência
-- - FHV-P = Ponto auxiliar
-- =====================================================

BEGIN;

-- 1. Atualizar tipos existentes para padrão COGEP
UPDATE marcos_levantados SET tipo = 'V' WHERE tipo IN ('RN', 'Vértice', 'VERTICE', 'vertice', 'Vértice de Divisa', 'VÉRTICE');
UPDATE marcos_levantados SET tipo = 'M' WHERE tipo IN ('Marco', 'MARCO', 'marco', 'Marco de Referência', 'Referência');
UPDATE marcos_levantados SET tipo = 'P' WHERE tipo IN ('Auxiliar', 'AUXILIAR', 'auxiliar', 'Ponto', 'PONTO', 'ponto', 'Ponto Auxiliar');

-- 2. Alterar constraint para aceitar apenas os tipos COGEP
ALTER TABLE marcos_levantados DROP CONSTRAINT IF EXISTS marcos_levantados_tipo_check;

ALTER TABLE marcos_levantados ADD CONSTRAINT marcos_levantados_tipo_check
CHECK (tipo IN ('V', 'M', 'P'));

-- 3. Adicionar comentários explicativos
COMMENT ON COLUMN marcos_levantados.tipo IS 'Tipo do marco COGEP: V (Vértice/Divisa), M (Marco de Referência), P (Ponto Auxiliar)';

-- 4. Verificar resultado
DO $$
DECLARE
    count_v INTEGER;
    count_m INTEGER;
    count_p INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_v FROM marcos_levantados WHERE tipo = 'V';
    SELECT COUNT(*) INTO count_m FROM marcos_levantados WHERE tipo = 'M';
    SELECT COUNT(*) INTO count_p FROM marcos_levantados WHERE tipo = 'P';

    RAISE NOTICE '================================================';
    RAISE NOTICE 'MIGRAÇÃO 013 - TIPOS DE MARCOS ATUALIZADOS';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Tipo V (Vértice):          % marcos', count_v;
    RAISE NOTICE 'Tipo M (Marco Referência): % marcos', count_m;
    RAISE NOTICE 'Tipo P (Ponto Auxiliar):   % marcos', count_p;
    RAISE NOTICE 'TOTAL:                     % marcos', count_v + count_m + count_p;
    RAISE NOTICE '================================================';
END $$;

COMMIT;
