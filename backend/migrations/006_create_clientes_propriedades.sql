-- ========================================
-- MIGRATION 006: CLIENTES E PROPRIEDADES
-- Criado em: 2025-10-28
-- Objetivo: Sistema de gestão de clientes e propriedades
-- ========================================

-- ========================================
-- TABELA: CLIENTES
-- ========================================

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo_pessoa VARCHAR(20) NOT NULL CHECK (tipo_pessoa IN ('fisica', 'juridica')),
    cpf_cnpj VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Comentários das colunas
COMMENT ON TABLE clientes IS 'Tabela de clientes do sistema (pessoas físicas e jurídicas)';
COMMENT ON COLUMN clientes.tipo_pessoa IS 'Tipo: fisica ou juridica';
COMMENT ON COLUMN clientes.cpf_cnpj IS 'CPF (pessoa física) ou CNPJ (pessoa jurídica)';
COMMENT ON COLUMN clientes.ativo IS 'Status do cliente (true = ativo, false = inativo)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_pessoa ON clientes(tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

-- ========================================
-- TABELA: PROPRIEDADES
-- ========================================

CREATE TABLE IF NOT EXISTS propriedades (
    id SERIAL PRIMARY KEY,
    nome_propriedade VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('RURAL', 'URBANA', 'INDUSTRIAL', 'COMERCIAL')),
    matricula VARCHAR(100),
    municipio VARCHAR(100) NOT NULL,
    comarca VARCHAR(100),
    uf VARCHAR(2) DEFAULT 'PR',
    area_m2 DECIMAL(15, 2), -- em m²
    perimetro_m DECIMAL(15, 2), -- em metros
    endereco TEXT,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Comentários das colunas
COMMENT ON TABLE propriedades IS 'Tabela de propriedades (rural, urbana, industrial, comercial)';
COMMENT ON COLUMN propriedades.tipo IS 'Tipo da propriedade: RURAL, URBANA, INDUSTRIAL, COMERCIAL';
COMMENT ON COLUMN propriedades.matricula IS 'Número da matrícula do imóvel';
COMMENT ON COLUMN propriedades.area_m2 IS 'Área da propriedade em metros quadrados';
COMMENT ON COLUMN propriedades.perimetro_m IS 'Perímetro da propriedade em metros';
COMMENT ON COLUMN propriedades.cliente_id IS 'Referência ao cliente proprietário';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_propriedades_cliente ON propriedades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_propriedades_municipio ON propriedades(municipio);
CREATE INDEX IF NOT EXISTS idx_propriedades_tipo ON propriedades(tipo);
CREATE INDEX IF NOT EXISTS idx_propriedades_ativo ON propriedades(ativo);
CREATE INDEX IF NOT EXISTS idx_propriedades_nome ON propriedades(nome_propriedade);

-- ========================================
-- TRIGGER: UPDATED_AT
-- ========================================

-- Função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para clientes
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para propriedades
DROP TRIGGER IF EXISTS update_propriedades_updated_at ON propriedades;
CREATE TRIGGER update_propriedades_updated_at
    BEFORE UPDATE ON propriedades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ADICIONAR CAMPO propriedade_id NA TABELA MARCOS
-- ========================================

-- Verificar se a tabela marcos_geodesicos existe antes de adicionar coluna
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'marcos_geodesicos'
    ) THEN
        -- Verificar se a coluna já existe antes de adicionar
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'marcos_geodesicos'
            AND column_name = 'propriedade_id'
        ) THEN
            ALTER TABLE marcos_geodesicos
            ADD COLUMN propriedade_id INTEGER REFERENCES propriedades(id) ON DELETE SET NULL;

            CREATE INDEX idx_marcos_propriedade ON marcos_geodesicos(propriedade_id);

            COMMENT ON COLUMN marcos_geodesicos.propriedade_id IS 'Referência à propriedade onde o marco está localizado';

            RAISE NOTICE 'Coluna propriedade_id adicionada à tabela marcos_geodesicos';
        ELSE
            RAISE NOTICE 'Coluna propriedade_id já existe em marcos_geodesicos';
        END IF;
    ELSE
        RAISE NOTICE 'Tabela marcos_geodesicos não encontrada. Coluna será adicionada posteriormente.';
    END IF;
END $$;

-- ========================================
-- VIEW: PROPRIEDADES COM CONTADOR DE MARCOS
-- ========================================

-- View simples sem marcos (para funcionar antes de ter tabela marcos_geodesicos)
CREATE OR REPLACE VIEW vw_propriedades_completa AS
SELECT
    p.id,
    p.nome_propriedade,
    p.tipo,
    p.matricula,
    p.municipio,
    p.comarca,
    p.uf,
    p.area_m2,
    p.perimetro_m,
    p.endereco,
    p.cliente_id,
    p.observacoes,
    p.ativo,
    p.created_at,
    p.updated_at,
    c.nome AS cliente_nome,
    c.tipo_pessoa AS cliente_tipo_pessoa,
    0 AS total_marcos  -- Será atualizado quando tabela marcos_geodesicos existir
FROM propriedades p
LEFT JOIN clientes c ON p.cliente_id = c.id;

COMMENT ON VIEW vw_propriedades_completa IS 'View de propriedades com informações do cliente e contador de marcos';

-- ========================================
-- VIEW: CLIENTES COM CONTADOR DE PROPRIEDADES
-- ========================================

-- View simples sem marcos (para funcionar antes de ter tabela marcos_geodesicos)
CREATE OR REPLACE VIEW vw_clientes_completa AS
SELECT
    c.id,
    c.nome,
    c.tipo_pessoa,
    c.cpf_cnpj,
    c.email,
    c.telefone,
    c.endereco,
    c.observacoes,
    c.ativo,
    c.created_at,
    c.updated_at,
    COUNT(DISTINCT p.id) AS total_propriedades,
    0 AS total_marcos  -- Será atualizado quando tabela marcos_geodesicos existir
FROM clientes c
LEFT JOIN propriedades p ON p.cliente_id = c.id
GROUP BY c.id;

COMMENT ON VIEW vw_clientes_completa IS 'View de clientes com contadores de propriedades e marcos';

-- ========================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- ========================================

-- Cliente exemplo 1 - Pessoa Física
INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco)
VALUES
    ('João da Silva', 'fisica', '123.456.789-00', 'joao.silva@email.com', '(41) 99999-9999', 'Rua das Flores, 123 - Campo Largo/PR')
ON CONFLICT (cpf_cnpj) DO NOTHING;

-- Cliente exemplo 2 - Pessoa Jurídica
INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco)
VALUES
    ('Empresa XYZ Ltda', 'juridica', '12.345.678/0001-90', 'contato@empresaxyz.com', '(41) 3333-4444', 'Av. Principal, 1000 - Curitiba/PR')
ON CONFLICT (cpf_cnpj) DO NOTHING;

-- Propriedade exemplo 1
INSERT INTO propriedades (nome_propriedade, tipo, matricula, municipio, comarca, uf, area_m2, perimetro_m, cliente_id, observacoes)
SELECT
    'Fazenda Santa Rita',
    'RURAL',
    'MAT-12345',
    'Campo Largo',
    'Campo Largo',
    'PR',
    50000.00,
    900.50,
    c.id,
    'Propriedade rural com marcos geodésicos instalados'
FROM clientes c
WHERE c.cpf_cnpj = '123.456.789-00'
ON CONFLICT DO NOTHING;

-- Propriedade exemplo 2
INSERT INTO propriedades (nome_propriedade, tipo, matricula, municipio, comarca, uf, area_m2, perimetro_m, cliente_id, observacoes)
SELECT
    'Lote Comercial Centro',
    'COMERCIAL',
    'MAT-67890',
    'Curitiba',
    'Curitiba',
    'PR',
    1500.00,
    160.00,
    c.id,
    'Lote comercial no centro da cidade'
FROM clientes c
WHERE c.cpf_cnpj = '12.345.678/0001-90'
ON CONFLICT DO NOTHING;

-- ========================================
-- GRANTS (OPCIONAL - SE USAR USUÁRIOS ESPECÍFICOS)
-- ========================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON clientes TO seu_usuario;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON propriedades TO seu_usuario;
-- GRANT SELECT ON vw_clientes_completa TO seu_usuario;
-- GRANT SELECT ON vw_propriedades_completa TO seu_usuario;

-- ========================================
-- FIM DA MIGRATION 006
-- ========================================

-- Verificar criação
SELECT 'Migration 006 executada com sucesso!' AS status;
SELECT
    'Tabelas criadas: clientes (' || COUNT(*) || ' registros)' AS info
FROM clientes
UNION ALL
SELECT
    'Tabelas criadas: propriedades (' || COUNT(*) || ' registros)' AS info
FROM propriedades;
