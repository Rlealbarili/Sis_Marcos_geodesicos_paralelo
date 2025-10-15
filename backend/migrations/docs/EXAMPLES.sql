-- ==========================================
-- EXEMPLOS DE USO DO SCHEMA INTEGRADO
-- ==========================================

-- ==========================================
-- 1. INSERIR NOVO CLIENTE
-- ==========================================

INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado)
VALUES (
    'João Silva',
    '123.456.789-00',
    '(41) 98765-4321',
    'joao.silva@email.com',
    'Curitiba',
    'PR'
);

-- ==========================================
-- 2. INSERIR NOVA PROPRIEDADE
-- ==========================================

INSERT INTO propriedades (
    cliente_id,
    nome_propriedade,
    matricula,
    tipo,
    municipio,
    comarca,
    uf,
    area_m2,
    perimetro_m,
    status
) VALUES (
    1,                          -- cliente_id (pegar do cliente inserido acima)
    'Fazenda Santa Maria',
    'MAT-12345-2025',
    'RURAL',
    'Campo Largo',
    'Campo Largo',
    'PR',
    150000.50,                  -- 15 hectares
    1800.00,
    'ATIVO'
);

-- A área em hectares será calculada automaticamente pelo trigger!

-- ==========================================
-- 3. INSERIR VÉRTICES DA PROPRIEDADE
-- ==========================================

-- Vértice 1
INSERT INTO vertices (
    propriedade_id,
    nome,
    ordem,
    latitude,
    longitude,
    utm_e,
    utm_n,
    utm_zona,
    datum,
    confrontante,
    tipo
) VALUES (
    1,                          -- propriedade_id
    'V01',
    1,
    -25.450000,
    -49.280000,
    670500.00,
    7185000.00,
    '22S',
    'SIRGAS2000',
    'Rio Iguaçu ao Norte',
    'VERTICE'
);

-- Vértice 2
INSERT INTO vertices (
    propriedade_id,
    nome,
    ordem,
    latitude,
    longitude,
    utm_e,
    utm_n,
    utm_zona,
    datum,
    azimute,
    distancia_m,
    confrontante
) VALUES (
    1,
    'V02',
    2,
    -25.450000,
    -49.275000,
    670950.00,
    7185000.00,
    '22S',
    'SIRGAS2000',
    '90°00\'00"',
    450.00,
    'Rodovia BR-277 ao Leste',
    'VERTICE'
);

-- Repetir para V03, V04, etc...

-- ==========================================
-- 4. REGISTRAR IMPORTAÇÃO DE MEMORIAL
-- ==========================================

INSERT INTO memoriais_importados (
    propriedade_id,
    arquivo_nome,
    arquivo_tamanho,
    arquivo_hash,
    vertices_extraidos,
    metadados_extraidos,
    taxa_sucesso,
    status,
    resultado_json,
    usuario
) VALUES (
    1,
    'memorial_fazenda_santa_maria.docx',
    45000,
    'a1b2c3d4e5f6...',
    12,
    8,
    100.0,
    'PROCESSADO',
    '{"metadata": {"matricula": "MAT-12345-2025", "area": "15 ha"}, "vertices": [...]}',
    'admin'
);

-- ==========================================
-- 5. CONSULTAS ÚTEIS
-- ==========================================

-- 5.1. Buscar todas as propriedades de um cliente
SELECT
    p.*,
    (SELECT COUNT(*) FROM vertices WHERE propriedade_id = p.id) as total_vertices
FROM propriedades p
WHERE p.cliente_id = 1;

-- 5.2. Buscar propriedades em um município específico
SELECT
    p.nome_propriedade,
    p.matricula,
    p.area_hectares,
    c.nome as proprietario
FROM propriedades p
INNER JOIN clientes c ON p.cliente_id = c.id
WHERE p.municipio = 'Campo Largo'
  AND p.status = 'ATIVO'
ORDER BY p.area_hectares DESC;

-- 5.3. Listar vértices de uma propriedade em ordem
SELECT
    nome,
    ordem,
    latitude,
    longitude,
    utm_e,
    utm_n,
    confrontante
FROM vertices
WHERE propriedade_id = 1
ORDER BY ordem;

-- 5.4. Buscar histórico de importações de um cliente
SELECT
    m.arquivo_nome,
    m.data_importacao,
    m.vertices_extraidos,
    m.status,
    p.nome_propriedade,
    c.nome as cliente_nome
FROM memoriais_importados m
LEFT JOIN propriedades p ON m.propriedade_id = p.id
LEFT JOIN clientes c ON p.cliente_id = c.id
WHERE c.id = 1
ORDER BY m.data_importacao DESC;

-- 5.5. Estatísticas gerais
SELECT
    COUNT(DISTINCT c.id) as total_clientes,
    COUNT(p.id) as total_propriedades,
    SUM(p.area_hectares) as area_total_hectares,
    COUNT(v.id) as total_vertices
FROM clientes c
LEFT JOIN propriedades p ON c.id = p.cliente_id
LEFT JOIN vertices v ON p.id = v.propriedade_id;

-- ==========================================
-- 6. USANDO AS VIEWS CRIADAS
-- ==========================================

-- 6.1. View de propriedades completas
SELECT
    cliente_nome,
    nome_propriedade,
    municipio,
    area_hectares,
    total_vertices
FROM vw_propriedades_completas
WHERE uf = 'PR';

-- 6.2. View de estatísticas de clientes
SELECT
    nome,
    total_propriedades,
    area_total_hectares,
    primeira_propriedade,
    ultima_propriedade
FROM vw_estatisticas_clientes
WHERE total_propriedades > 0
ORDER BY area_total_hectares DESC;

-- 6.3. View de histórico de importações
SELECT
    arquivo_nome,
    vertices_extraidos,
    cliente_nome,
    matricula,
    data_importacao
FROM vw_historico_importacoes
WHERE status = 'PROCESSADO'
ORDER BY data_importacao DESC
LIMIT 10;

-- ==========================================
-- 7. ATUALIZAÇÕES
-- ==========================================

-- 7.1. Atualizar telefone do cliente
UPDATE clientes
SET telefone = '(41) 98888-7777'
WHERE id = 1;
-- O trigger atualiza updated_at automaticamente!

-- 7.2. Atualizar área da propriedade
UPDATE propriedades
SET area_m2 = 200000
WHERE id = 1;
-- O trigger calcula area_hectares automaticamente!

-- 7.3. Inativar propriedade
UPDATE propriedades
SET status = 'INATIVO'
WHERE id = 1;

-- 7.4. Corrigir coordenada de vértice
UPDATE vertices
SET
    latitude = -25.451234,
    longitude = -49.281234,
    utm_e = 670510.50,
    utm_n = 7184990.30
WHERE id = 1;

-- ==========================================
-- 8. EXCLUSÕES (COM CASCATA)
-- ==========================================

-- 8.1. Excluir vértice específico
DELETE FROM vertices WHERE id = 1;

-- 8.2. Excluir propriedade (exclui vértices em cascata)
DELETE FROM propriedades WHERE id = 1;
-- Todos os vértices da propriedade são excluídos automaticamente!

-- 8.3. Excluir cliente (exclui propriedades e vértices em cascata)
DELETE FROM clientes WHERE id = 1;
-- Todas as propriedades e vértices do cliente são excluídos automaticamente!

-- ==========================================
-- 9. CONSULTAS AVANÇADAS
-- ==========================================

-- 9.1. Propriedades com mais de 10 vértices
SELECT
    p.nome_propriedade,
    p.matricula,
    COUNT(v.id) as qtd_vertices
FROM propriedades p
LEFT JOIN vertices v ON p.id = v.propriedade_id
GROUP BY p.id, p.nome_propriedade, p.matricula
HAVING COUNT(v.id) > 10
ORDER BY qtd_vertices DESC;

-- 9.2. Clientes com múltiplas propriedades
SELECT
    c.nome,
    COUNT(p.id) as qtd_propriedades,
    SUM(p.area_hectares) as area_total
FROM clientes c
INNER JOIN propriedades p ON c.id = p.cliente_id
GROUP BY c.id, c.nome
HAVING COUNT(p.id) > 1
ORDER BY qtd_propriedades DESC;

-- 9.3. Propriedades sem vértices cadastrados
SELECT
    p.nome_propriedade,
    p.matricula
FROM propriedades p
LEFT JOIN vertices v ON p.id = v.propriedade_id
WHERE v.id IS NULL;

-- 9.4. Taxa de sucesso de importações por usuário
SELECT
    usuario,
    COUNT(*) as total_importacoes,
    SUM(CASE WHEN status = 'PROCESSADO' THEN 1 ELSE 0 END) as sucesso,
    AVG(taxa_sucesso) as taxa_media
FROM memoriais_importados
GROUP BY usuario;

-- 9.5. Propriedades por tipo e município
SELECT
    tipo,
    municipio,
    COUNT(*) as quantidade,
    SUM(area_hectares) as area_total
FROM propriedades
WHERE status = 'ATIVO'
GROUP BY tipo, municipio
ORDER BY tipo, quantidade DESC;

-- ==========================================
-- 10. BACKUP E MANUTENÇÃO
-- ==========================================

-- 10.1. Verificar integridade
PRAGMA integrity_check;

-- 10.2. Otimizar banco
VACUUM;

-- 10.3. Analisar estatísticas
ANALYZE;

-- 10.4. Ver tamanho das tabelas
SELECT
    name,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as registros
FROM sqlite_master m
WHERE type='table'
ORDER BY name;

-- ==========================================
-- FIM DOS EXEMPLOS
-- ==========================================
