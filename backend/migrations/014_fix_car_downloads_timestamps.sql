-- =====================================================
-- FIX: Adicionar colunas de timestamp na tabela car_downloads
-- =====================================================
-- Problema: car_downloads tinha apenas 'data_download', mas o código WFS
-- espera 'created_at' e 'updated_at' para manter consistência

-- Adicionar coluna created_at (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'car_downloads'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE car_downloads
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        -- Copiar valores de data_download para created_at nos registros existentes
        UPDATE car_downloads SET created_at = data_download WHERE created_at IS NULL;

        RAISE NOTICE 'Coluna created_at adicionada à tabela car_downloads';
    END IF;
END $$;

-- Adicionar coluna updated_at (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'car_downloads'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE car_downloads
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        -- Copiar valores de data_download para updated_at nos registros existentes
        UPDATE car_downloads SET updated_at = data_download WHERE updated_at IS NULL;

        RAISE NOTICE 'Coluna updated_at adicionada à tabela car_downloads';
    END IF;
END $$;

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_car_downloads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_car_downloads_timestamp ON car_downloads;
CREATE TRIGGER trigger_update_car_downloads_timestamp
    BEFORE UPDATE ON car_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_car_downloads_timestamp();

-- Verificação
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'car_downloads'
AND column_name IN ('data_download', 'created_at', 'updated_at')
ORDER BY column_name;

SELECT 'Migration 014 executada com sucesso! Colunas de timestamp corrigidas.' AS status;
