-- ==========================================
-- MIGRAÇÃO 001: Schema Integrado
-- Data: 2025-10-13
-- Descrição: Adiciona tabelas de clientes, propriedades, vértices e histórico
-- ==========================================

-- ==========================================
-- 1. TABELA: clientes
-- ==========================================
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf_cnpj TEXT UNIQUE,
    email TEXT,
    telefone TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);

-- ==========================================
-- 2. TABELA: propriedades
-- ==========================================
CREATE TABLE IF NOT EXISTS propriedades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,

    -- Identificação
    nome_propriedade TEXT,
    matricula TEXT UNIQUE NOT NULL,
    tipo TEXT CHECK(tipo IN ('RURAL', 'URBANO', 'LOTEAMENTO')),

    -- Localização
    municipio TEXT,
    comarca TEXT,
    distrito TEXT,
    bairro TEXT,
    uf TEXT,

    -- Medidas
    area_m2 REAL,
    area_hectares REAL,
    perimetro_m REAL,

    -- Memorial
    memorial_arquivo TEXT,
    memorial_data_importacao DATETIME,
    memorial_json TEXT,

    -- Status
    status TEXT DEFAULT 'ATIVO' CHECK(status IN ('ATIVO', 'INATIVO', 'PENDENTE')),

    -- Observações
    observacoes TEXT,

    -- Controle
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_propriedades_cliente ON propriedades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_propriedades_matricula ON propriedades(matricula);
CREATE INDEX IF NOT EXISTS idx_propriedades_municipio ON propriedades(municipio);
CREATE INDEX IF NOT EXISTS idx_propriedades_tipo ON propriedades(tipo);
CREATE INDEX IF NOT EXISTS idx_propriedades_status ON propriedades(status);

-- ==========================================
-- 3. TABELA: vertices
-- ==========================================
CREATE TABLE IF NOT EXISTS vertices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    propriedade_id INTEGER NOT NULL,

    -- Identificação do vértice
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL,

    -- Coordenadas Geográficas
    latitude REAL,
    longitude REAL,
    altitude REAL,

    -- Coordenadas UTM
    utm_e REAL,
    utm_n REAL,
    utm_zona TEXT DEFAULT '22S',
    datum TEXT DEFAULT 'SIRGAS2000',

    -- Azimute e Distância
    azimute TEXT,
    distancia_m REAL,

    -- Confrontante
    confrontante TEXT,

    -- Tipo
    tipo TEXT DEFAULT 'VERTICE' CHECK(tipo IN ('VERTICE', 'MARCO_GEODESICO')),

    -- Controle
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (propriedade_id) REFERENCES propriedades(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vertices_propriedade ON vertices(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_vertices_ordem ON vertices(propriedade_id, ordem);
CREATE INDEX IF NOT EXISTS idx_vertices_coords ON vertices(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vertices_utm ON vertices(utm_e, utm_n);

-- ==========================================
-- 4. TABELA: memoriais_importados
-- ==========================================
CREATE TABLE IF NOT EXISTS memoriais_importados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    propriedade_id INTEGER,

    -- Arquivo
    arquivo_nome TEXT NOT NULL,
    arquivo_tamanho INTEGER,
    arquivo_hash TEXT,

    -- Extração
    vertices_extraidos INTEGER,
    metadados_extraidos INTEGER,
    taxa_sucesso REAL,

    -- Status
    status TEXT DEFAULT 'PROCESSADO' CHECK(status IN ('PROCESSADO', 'ERRO', 'PENDENTE')),
    mensagem_erro TEXT,

    -- JSON completo
    resultado_json TEXT,

    -- Controle
    usuario TEXT,
    data_importacao DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (propriedade_id) REFERENCES propriedades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memoriais_data ON memoriais_importados(data_importacao);
CREATE INDEX IF NOT EXISTS idx_memoriais_status ON memoriais_importados(status);
CREATE INDEX IF NOT EXISTS idx_memoriais_propriedade ON memoriais_importados(propriedade_id);

-- ==========================================
-- 5. ATUALIZAR TABELA: marcos (existente)
-- ==========================================
-- Adicionar novos campos à tabela existente

-- NOTA: SQLite não suporta ADD COLUMN IF NOT EXISTS diretamente
-- Esta seção deve ser executada com cautela para evitar erros se as colunas já existirem

-- Remover comentário abaixo para adicionar colunas (executar apenas uma vez)
-- ALTER TABLE marcos ADD COLUMN tipo_marco TEXT DEFAULT 'GEODESICO';
-- ALTER TABLE marcos ADD COLUMN origem TEXT DEFAULT 'SISTEMA';
-- ALTER TABLE marcos ADD COLUMN observacoes_adicionais TEXT;

-- Criar índices para campos existentes
CREATE INDEX IF NOT EXISTS idx_marcos_tipo ON marcos(tipo);
CREATE INDEX IF NOT EXISTS idx_marcos_ativo ON marcos(ativo);
CREATE INDEX IF NOT EXISTS idx_marcos_codigo ON marcos(codigo);
CREATE INDEX IF NOT EXISTS idx_marcos_localizacao ON marcos(localizacao);

-- ==========================================
-- 6. VIEWS ÚTEIS
-- ==========================================

-- View: Propriedades com dados do cliente
CREATE VIEW IF NOT EXISTS vw_propriedades_completas AS
SELECT
    p.*,
    c.nome as cliente_nome,
    c.cpf_cnpj as cliente_cpf_cnpj,
    c.telefone as cliente_telefone,
    c.email as cliente_email,
    (SELECT COUNT(*) FROM vertices WHERE propriedade_id = p.id) as total_vertices
FROM propriedades p
INNER JOIN clientes c ON p.cliente_id = c.id;

-- View: Estatísticas por cliente
CREATE VIEW IF NOT EXISTS vw_estatisticas_clientes AS
SELECT
    c.id,
    c.nome,
    COUNT(p.id) as total_propriedades,
    SUM(p.area_m2) as area_total_m2,
    SUM(p.area_hectares) as area_total_hectares,
    MIN(p.created_at) as primeira_propriedade,
    MAX(p.created_at) as ultima_propriedade
FROM clientes c
LEFT JOIN propriedades p ON c.id = p.cliente_id
GROUP BY c.id, c.nome;

-- View: Histórico de importações com resumo
CREATE VIEW IF NOT EXISTS vw_historico_importacoes AS
SELECT
    m.id,
    m.arquivo_nome,
    m.vertices_extraidos,
    m.metadados_extraidos,
    m.status,
    m.usuario,
    m.data_importacao,
    p.nome_propriedade,
    p.matricula,
    c.nome as cliente_nome
FROM memoriais_importados m
LEFT JOIN propriedades p ON m.propriedade_id = p.id
LEFT JOIN clientes c ON p.cliente_id = c.id
ORDER BY m.data_importacao DESC;

-- ==========================================
-- 7. TRIGGERS
-- ==========================================

-- Trigger: Atualizar updated_at em clientes
CREATE TRIGGER IF NOT EXISTS update_clientes_timestamp
AFTER UPDATE ON clientes
BEGIN
    UPDATE clientes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: Atualizar updated_at em propriedades
CREATE TRIGGER IF NOT EXISTS update_propriedades_timestamp
AFTER UPDATE ON propriedades
BEGIN
    UPDATE propriedades SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: Calcular área em hectares automaticamente ao inserir
CREATE TRIGGER IF NOT EXISTS calc_area_hectares_insert
AFTER INSERT ON propriedades
WHEN NEW.area_hectares IS NULL AND NEW.area_m2 IS NOT NULL
BEGIN
    UPDATE propriedades
    SET area_hectares = NEW.area_m2 / 10000
    WHERE id = NEW.id;
END;

-- Trigger: Calcular área em hectares automaticamente ao atualizar
CREATE TRIGGER IF NOT EXISTS calc_area_hectares_update
AFTER UPDATE OF area_m2 ON propriedades
WHEN NEW.area_hectares IS NULL AND NEW.area_m2 IS NOT NULL
BEGIN
    UPDATE propriedades
    SET area_hectares = NEW.area_m2 / 10000
    WHERE id = NEW.id;
END;

-- ==========================================
-- 8. DADOS DE TESTE (OPCIONAL)
-- ==========================================

-- Cliente de teste
INSERT OR IGNORE INTO clientes (id, nome, cpf_cnpj, telefone, email, cidade, estado)
VALUES (1, 'Cliente Teste', '000.000.000-00', '(41) 99999-9999', 'teste@email.com', 'Curitiba', 'PR');

-- Propriedade de teste
INSERT OR IGNORE INTO propriedades (
    id, cliente_id, nome_propriedade, matricula, tipo,
    municipio, comarca, uf, area_m2, perimetro_m, status
)
VALUES (
    1, 1, 'Propriedade Teste', 'MAT-TESTE-001', 'RURAL',
    'Campo Largo', 'Campo Largo', 'PR', 50000, 1000, 'ATIVO'
);

-- Vértices de teste (quadrado de 50.000 m² = ~224m x 224m)
-- Coordenadas aproximadas em Curitiba (UTM Zone 22S)
INSERT OR IGNORE INTO vertices (propriedade_id, nome, ordem, latitude, longitude, utm_e, utm_n, utm_zona, datum)
VALUES
    (1, 'V01', 1, -25.4284, -49.2733, 672500, 7187500, '22S', 'SIRGAS2000'),
    (1, 'V02', 2, -25.4284, -49.2703, 672724, 7187500, '22S', 'SIRGAS2000'),
    (1, 'V03', 3, -25.4304, -49.2703, 672724, 7187276, '22S', 'SIRGAS2000'),
    (1, 'V04', 4, -25.4304, -49.2733, 672500, 7187276, '22S', 'SIRGAS2000');

-- Memorial de teste
INSERT OR IGNORE INTO memoriais_importados (
    id, propriedade_id, arquivo_nome, arquivo_tamanho,
    vertices_extraidos, metadados_extraidos, taxa_sucesso,
    status, usuario
)
VALUES (
    1, 1, 'memorial_teste.docx', 25000,
    4, 8, 100.0,
    'PROCESSADO', 'Sistema'
);

-- ==========================================
-- 9. VERIFICAÇÃO FINAL
-- ==========================================

-- Contar tabelas criadas
SELECT 'Total de tabelas criadas:' as info, COUNT(*) as quantidade
FROM sqlite_master
WHERE type='table'
AND name IN ('clientes', 'propriedades', 'vertices', 'memoriais_importados');

-- Listar todas as tabelas
SELECT 'Tabelas disponíveis:' as info, name
FROM sqlite_master
WHERE type='table'
ORDER BY name;

-- Listar todas as views
SELECT 'Views disponíveis:' as info, name
FROM sqlite_master
WHERE type='view'
ORDER BY name;

-- Listar todos os triggers
SELECT 'Triggers disponíveis:' as info, name
FROM sqlite_master
WHERE type='trigger'
ORDER BY name;

-- ==========================================
-- FIM DA MIGRAÇÃO
-- ==========================================
