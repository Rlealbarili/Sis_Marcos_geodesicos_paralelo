const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const mammoth = require('mammoth');
const axios = require('axios');
const FormData = require('form-data');
const UnstructuredProcessor = require('./unstructured-processor.js');
const proj4 = require('proj4');
const compression = require('compression');
const { executarMigracaoValidacao } = require('./utils/migracao-validacao');
const validador = require('./utils/validador-coordenadas');

// ==========================================
// CONFIGURAR TIMEZONE PARA O BRASIL
// ==========================================
process.env.TZ = 'America/Sao_Paulo';

// Função para obter data/hora no timezone do Brasil
function getDataHoraBrasil() {
    const agora = new Date();
    const offsetBrasil = -3 * 60; // UTC-3
    const offsetLocal = agora.getTimezoneOffset();
    const diff = offsetBrasil - offsetLocal;

    const dataBrasil = new Date(agora.getTime() + diff * 60000);
    return dataBrasil.toISOString();
}

console.log('[Server] Timezone configurada:', process.env.TZ);
console.log('[Server] Data/hora atual:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

const app = express();
const PORT = 3000;

app.use(cors());

// Habilitar compressão gzip para todas as respostas
app.use(compression({
  level: 6, // balanço entre speed e compression
  threshold: 1024 // só comprimir responses > 1KB
}));

app.use(express.json());

// Cache headers para assets estáticos
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Configuração do multer para salvar em disco (usado pelos endpoints antigos)
const upload = multer({ dest: 'uploads/' });

// Configuração do multer para manter em memória (usado pelo endpoint v2 que envia para Unstructured API)
const uploadMemory = multer({ storage: multer.memoryStorage() });

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const dbPath = path.join(__dirname, '../database/marcos.db');
const db = new Database(dbPath);

// ============== EXECUTAR MIGRATIONS AUTOMATICAMENTE ==============
const migrationPath = path.join(__dirname, 'migrations/002_add_status_campo.sql');
if (fs.existsSync(migrationPath)) {
    try {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Verificar se migration já foi executada
        const checkColumn = db.prepare("PRAGMA table_info(marcos)").all();
        const hasStatusCampo = checkColumn.some(col => col.name === 'status_campo');

        if (!hasStatusCampo) {
            console.log('🔄 Executando migration 002_add_status_campo.sql...');
            db.exec(migrationSQL);
            console.log('✅ Migration 002 concluída com sucesso!');
        } else {
            console.log('✅ Migration 002 já executada anteriormente.');
        }
    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        console.error('⚠️ Sistema pode estar instável. Verifique o banco de dados.');
    }
}
// ============== FIM DAS MIGRATIONS ==============

db.exec(`
    CREATE TABLE IF NOT EXISTS marcos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        tipo TEXT NOT NULL,
        localizacao TEXT,
        metodo TEXT,
        limites TEXT,
        coordenada_e REAL,
        desvio_e REAL,
        coordenada_n REAL,
        desvio_n REAL,
        altitude_h REAL,
        desvio_h REAL,
        lote TEXT,
        data_levantamento TEXT,
        observacoes TEXT,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_cadastro TEXT,
        ativo INTEGER DEFAULT 1
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS poligonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        cliente_id INTEGER,
        cliente_nome TEXT,
        cliente_cpf_cnpj TEXT,
        area_m2 REAL,
        perimetro_m REAL,
        geometria TEXT NOT NULL,
        memorial_descritivo TEXT,
        observacoes TEXT,
        status TEXT DEFAULT 'Em Andamento',
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_finalizacao DATETIME,
        usuario_criacao TEXT,
        ativo INTEGER DEFAULT 1
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS poligono_marcos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poligono_id INTEGER NOT NULL,
        marco_id INTEGER NOT NULL,
        ordem INTEGER NOT NULL,
        FOREIGN KEY (poligono_id) REFERENCES poligonos(id),
        FOREIGN KEY (marco_id) REFERENCES marcos(id),
        UNIQUE(poligono_id, marco_id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf_cnpj TEXT UNIQUE NOT NULL,
        email TEXT,
        telefone TEXT,
        endereco TEXT,
        tipo_acesso TEXT DEFAULT 'visualizacao',
        usuario TEXT,
        senha TEXT,
        ativo INTEGER DEFAULT 1,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_poligono_cliente ON poligonos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_poligono_codigo ON poligonos(codigo);
    CREATE INDEX IF NOT EXISTS idx_poligono_marco_poligono ON poligono_marcos(poligono_id);
    CREATE INDEX IF NOT EXISTS idx_poligono_marco_marco ON poligono_marcos(marco_id);
    CREATE INDEX IF NOT EXISTS idx_cliente_cpf ON clientes(cpf_cnpj);
    CREATE INDEX IF NOT EXISTS idx_codigo ON marcos(codigo);
    CREATE INDEX IF NOT EXISTS idx_tipo ON marcos(tipo);
    CREATE INDEX IF NOT EXISTS idx_localizacao ON marcos(localizacao);
    CREATE INDEX IF NOT EXISTS idx_lote ON marcos(lote);
    CREATE INDEX IF NOT EXISTS idx_ativo ON marcos(ativo);
`);

console.log('Banco de dados inicializado com sucesso!');

// Executar migração para validação de coordenadas
executarMigracaoValidacao(db);

// Logs de endpoints disponíveis
console.log('[Server] Endpoints de marcos configurados:');
console.log('[Server]   GET    /api/marcos                - Lista marcos com filtros');
console.log('[Server]   GET    /api/buscar-marcos         - Busca marcos');
console.log('[Server] Endpoints de clientes configurados:');
console.log('[Server]   GET    /api/clientes              - Lista clientes com estatísticas');
console.log('[Server]   GET    /api/clientes/:id          - Busca cliente por ID');
console.log('[Server]   POST   /api/clientes              - Cria novo cliente');
console.log('[Server]   PUT    /api/clientes/:id          - Atualiza cliente');
console.log('[Server]   DELETE /api/clientes/:id          - Remove cliente');
console.log('[Server] Endpoints de propriedades configurados:');
console.log('[Server]   GET    /api/propriedades          - Lista propriedades');
console.log('[Server]   GET    /api/propriedades/:id      - Busca propriedade por ID');
console.log('[Server]   POST   /api/propriedades          - Cria propriedade');
console.log('[Server]   PUT    /api/propriedades/:id      - Atualiza propriedade');
console.log('[Server]   DELETE /api/propriedades/:id      - Remove propriedade');
console.log('[Server]   GET    /api/propriedades/:id/vertices - Lista vértices');
console.log('[Server] Endpoint integrado configurado:');
console.log('[Server]   POST   /api/salvar-memorial-completo  - Salva memorial completo');
console.log('[Server]   GET    /api/memoriais-importados      - Lista histórico');
console.log('[Server] Endpoint de mapa configurado:');
console.log('[Server]   GET    /api/propriedades-mapa         - Propriedades em GeoJSON');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/marcos', (req, res) => {
    try {
        let { bbox, tipo, codigo, localizacao, lote, metodo, limites, uf, status_campo, ativo = '1', limite = 2000, offset = 0, format = 'json' } = req.query;

        // IMPORTANTE: Respeitar o limite (máximo de 5000 marcos)
        limite = Math.min(parseInt(limite) || 2000, 5000);
        offset = parseInt(offset) || 0;

        console.log(`[Server] Buscando marcos - limite: ${limite}, offset: ${offset}, format: ${format}`);

        // Query otimizada - selecionar apenas campos necessários
        let query = `
            SELECT
                id,
                codigo as nome,
                tipo,
                localizacao as municipio,
                '' as uf,
                ROUND(CAST(REPLACE(coordenada_n, ',', '.') AS REAL) / 1000000, 6) as latitude,
                ROUND(CAST(REPLACE(coordenada_e, ',', '.') AS REAL) / 1000000, 6) as longitude,
                ROUND(CAST(REPLACE(altitude_h, ',', '.') AS REAL), 2) as altitude,
                status_campo as status
            FROM marcos
            WHERE ativo = ?
        `;
        const params = [ativo];

        // Filtro por bbox (viewport do mapa)
        if (bbox) {
            const [west, south, east, north] = bbox.split(',').map(Number);
            query += ` AND CAST(REPLACE(coordenada_e, ',', '.') AS REAL) / 1000000 BETWEEN ? AND ?`;
            query += ` AND CAST(REPLACE(coordenada_n, ',', '.') AS REAL) / 1000000 BETWEEN ? AND ?`;
            params.push(west, east, south, north);
        }

        // Filtro por tipo
        if (tipo) {
            query += ` AND tipo LIKE ?`;
            params.push(`%${tipo}%`);
        }

        // Filtro por código
        if (codigo) {
            query += ` AND codigo LIKE ?`;
            params.push(`%${codigo}%`);
        }

        // Filtro por localização
        if (localizacao) {
            query += ` AND localizacao LIKE ?`;
            params.push(`%${localizacao}%`);
        }

        // Filtro por lote
        if (lote) {
            query += ` AND lote LIKE ?`;
            params.push(`%${lote}%`);
        }

        // Filtro por método
        if (metodo) {
            query += ` AND metodo LIKE ?`;
            params.push(`%${metodo}%`);
        }

        // Filtro por limites
        if (limites) {
            query += ` AND limites LIKE ?`;
            params.push(`%${limites}%`);
        }

        // Filtro por UF
        if (uf) {
            query += ` AND uf = ?`;
            params.push(uf);
        }

        // Filtro por status
        if (status_campo) {
            query += ` AND status_campo = ?`;
            params.push(status_campo);
        }

        query += ` ORDER BY codigo LIMIT ? OFFSET ?`;
        params.push(limite, offset);

        const stmt = db.prepare(query);
        const marcos = stmt.all(...params);

        // Contar total de registros (sem limite)
        let countQuery = 'SELECT COUNT(*) as total FROM marcos WHERE ativo = ?';
        const countParams = [ativo];
        const countStmt = db.prepare(countQuery);
        const totalResult = countStmt.get(...countParams);

        // Retornar em formato GeoJSON (otimizado para mapas)
        if (format === 'geojson') {
            const geojson = {
                type: 'FeatureCollection',
                features: marcos
                    .filter(m => m.latitude && m.longitude && !isNaN(m.latitude) && !isNaN(m.longitude))
                    .map(m => ({
                        type: 'Feature',
                        id: m.id,
                        geometry: {
                            type: 'Point',
                            coordinates: [m.longitude, m.latitude]
                        },
                        properties: {
                            id: m.id,
                            nome: m.nome,
                            tipo: m.tipo,
                            municipio: m.municipio,
                            uf: m.uf,
                            altitude: m.altitude,
                            status: m.status
                        }
                    }))
            };

            return res.json({
                success: true,
                data: geojson,
                count: geojson.features.length,
                total: totalResult.total
            });
        }

        // Retornar em formato JSON padrão
        res.json({
            success: true,
            data: marcos,
            count: marcos.length,
            total: totalResult.total,
            limite: limite,
            offset: offset
        });
    } catch (error) {
        console.error('Erro ao buscar marcos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/buscar-marcos
 * Busca marcos por nome, município ou código
 */
app.get('/api/buscar-marcos', (req, res) => {
    try {
        const { busca, limite = 50 } = req.query;

        if (!busca || busca.trim().length < 2) {
            return res.json({
                success: true,
                data: [],
                message: 'Digite pelo menos 2 caracteres para buscar'
            });
        }

        console.log(`[Server] Buscando marcos: "${busca}"`);

        const query = `
            SELECT * FROM marcos
            WHERE (codigo LIKE ?
               OR localizacao LIKE ?
               OR lote LIKE ?)
               AND ativo = 1
            LIMIT ?
        `;

        const searchTerm = `%${busca}%`;
        const marcos = db.prepare(query).all(searchTerm, searchTerm, searchTerm, parseInt(limite));

        console.log(`[Server] ${marcos.length} marcos encontrados`);

        res.json({
            success: true,
            data: marcos,
            total: marcos.length
        });

    } catch (error) {
        console.error('[Server] Erro ao buscar marcos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar marcos',
            error: error.message
        });
    }
});

app.get('/api/marcos/:id', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM marcos WHERE id = ?');
        const marco = stmt.get(req.params.id);
        
        if (marco) {
            res.json({ success: true, data: marco });
        } else {
            res.status(404).json({ success: false, message: 'Marco não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar marco:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/marcos', (req, res) => {
    try {
        const {
            codigo, tipo, localizacao, metodo, limites,
            coordenada_e, desvio_e, coordenada_n, desvio_n,
            altitude_h, desvio_h, lote, data_levantamento,
            observacoes, usuario_cadastro
        } = req.body;
        
        if (!codigo || !tipo) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código e tipo são obrigatórios' 
            });
        }
        
        // Determinar status: se tem coordenadas = LEVANTADO, senão = PENDENTE
        const status_campo = (coordenada_e && coordenada_n && coordenada_e > 0 && coordenada_n > 0)
            ? 'LEVANTADO'
            : 'PENDENTE';

        const stmt = db.prepare(`
            INSERT INTO marcos (
                codigo, tipo, localizacao, metodo, limites,
                coordenada_e, desvio_e, coordenada_n, desvio_n,
                altitude_h, desvio_h, lote, data_levantamento,
                observacoes, usuario_cadastro, status_campo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            codigo, tipo, localizacao || null, metodo || null, limites || null,
            coordenada_e || null, desvio_e || null, coordenada_n || null, desvio_n || null,
            altitude_h || null, desvio_h || null, lote || null, data_levantamento || null,
            observacoes || null, usuario_cadastro || 'Sistema', status_campo
        );
        
        res.json({ 
            success: true, 
            message: 'Marco cadastrado com sucesso!', 
            id: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Erro ao criar marco:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ 
                success: false, 
                message: 'Já existe um marco com este código' 
            });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

app.put('/api/marcos/:id', (req, res) => {
    try {
        const {
            codigo, tipo, localizacao, metodo, limites,
            coordenada_e, desvio_e, coordenada_n, desvio_n,
            altitude_h, desvio_h, lote, data_levantamento,
            observacoes
        } = req.body;
        
        const stmt = db.prepare(`
            UPDATE marcos SET
                codigo = ?, tipo = ?, localizacao = ?, metodo = ?, limites = ?,
                coordenada_e = ?, desvio_e = ?, coordenada_n = ?, desvio_n = ?,
                altitude_h = ?, desvio_h = ?, lote = ?, data_levantamento = ?,
                observacoes = ?
            WHERE id = ?
        `);
        
        const result = stmt.run(
            codigo, tipo, localizacao, metodo, limites,
            coordenada_e, desvio_e, coordenada_n, desvio_n,
            altitude_h, desvio_h, lote, data_levantamento,
            observacoes, req.params.id
        );
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Marco atualizado com sucesso!' });
        } else {
            res.status(404).json({ success: false, message: 'Marco não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao atualizar marco:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/marcos/:id', (req, res) => {
    try {
        const stmt = db.prepare('UPDATE marcos SET ativo = 0 WHERE id = ?');
        const result = stmt.run(req.params.id);
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Marco removido com sucesso!' });
        } else {
            res.status(404).json({ success: false, message: 'Marco não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao excluir marco:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/estatisticas', (req, res) => {
    try {
        const stats = {
            total: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
            tipoV: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'V' AND ativo = 1").get().count,
            tipoM: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'M' AND ativo = 1").get().count,
            tipoP: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'P' AND ativo = 1").get().count,
            ultimoCadastro: db.prepare('SELECT data_cadastro FROM marcos WHERE ativo = 1 ORDER BY data_cadastro DESC LIMIT 1').get(),
            levantados: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'LEVANTADO' AND ativo = 1").get().count,
            pendentes: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1").get().count
        };
        
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/importar', upload.single('file'), (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        let importados = 0;
        let erros = 0;
        
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            
            const tipo = sheetName.trim().split(' ').pop();
            
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO marcos (
                    codigo, tipo, localizacao, metodo, limites,
                    coordenada_e, desvio_e, coordenada_n, desvio_n,
                    altitude_h, desvio_h, lote, data_levantamento,
                    usuario_cadastro
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row[0]) {
                    try {
                        stmt.run(
                            row[0], tipo, row[1], row[2], row[3],
                            row[4], row[5], row[6], row[7],
                            row[8], row[9], row[10], row[11],
                            'Importação Excel'
                        );
                        importados++;
                    } catch (err) {
                        erros++;
                    }
                }
            }
        });
        
        fs.unlinkSync(req.file.path);
        
        res.json({ 
            success: true, 
            message: `Importação concluída! ${importados} marcos importados, ${erros} erros.`,
            importados,
            erros
        });
    } catch (error) {
        console.error('Erro ao importar:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// API: IMPORTAR MARCOS VIA PLANILHA
// ==========================================
app.post('/api/importar-marcos-planilha', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo enviado'
            });
        }

        console.log('[Server] Importando planilha de marcos:', req.file.originalname);

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const dados = xlsx.utils.sheet_to_json(worksheet);

        let inseridos = 0;
        let atualizados = 0;
        let erros = [];
        const marcos_validos = [];

        // Processar cada linha da planilha
        dados.forEach((row, index) => {
            try {
                const linha = index + 2; // +2 porque index é 0-based e primeira linha é cabeçalho

                // Validar campos obrigatórios
                if (!row.Nome || !row.Tipo) {
                    erros.push({
                        linha,
                        erro: 'Nome e Tipo são obrigatórios',
                        dados: row
                    });
                    return;
                }

                // Validar coordenadas se fornecidas
                if (row.Latitude || row.Longitude) {
                    const lat = parseFloat(row.Latitude);
                    const lng = parseFloat(row.Longitude);

                    if (isNaN(lat) || lat < -90 || lat > 90) {
                        erros.push({
                            linha,
                            erro: 'Latitude inválida (deve estar entre -90 e 90)',
                            dados: row
                        });
                        return;
                    }

                    if (isNaN(lng) || lng < -180 || lng > 180) {
                        erros.push({
                            linha,
                            erro: 'Longitude inválida (deve estar entre -180 e 180)',
                            dados: row
                        });
                        return;
                    }
                }

                // Validar tipo de marco (deve ser um dos 6 tipos aceitos)
                const tiposValidos = ['FHV-M', 'FHV-P', 'FHV-O', 'SAT', 'RN', 'RV'];
                if (!tiposValidos.includes(row.Tipo)) {
                    erros.push({
                        linha,
                        erro: `Tipo inválido. Deve ser um dos seguintes: ${tiposValidos.join(', ')}`,
                        dados: row
                    });
                    return;
                }

                marcos_validos.push({
                    ...row,
                    linha
                });

            } catch (error) {
                erros.push({
                    linha: index + 2,
                    erro: error.message,
                    dados: row
                });
            }
        });

        // Inserir marcos válidos no banco
        const stmt = db.prepare(`
            INSERT INTO marcos (
                codigo, tipo, localizacao, municipio,
                latitude, longitude, altitude_h,
                ano_implantacao, ativo, usuario_cadastro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'Importação Planilha')
            ON CONFLICT(codigo) DO UPDATE SET
                tipo = excluded.tipo,
                localizacao = excluded.localizacao,
                municipio = excluded.municipio,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                altitude_h = excluded.altitude_h,
                ano_implantacao = excluded.ano_implantacao
        `);

        // Verificar se cada marco já existe para contabilizar inserções vs atualizações
        const checkStmt = db.prepare('SELECT id FROM marcos WHERE codigo = ?');

        marcos_validos.forEach(marco => {
            try {
                const existe = checkStmt.get(marco.Nome);

                stmt.run(
                    marco.Nome,
                    marco.Tipo,
                    marco.Municipio || null,
                    marco.Municipio || null, // usar municipio como localizacao também
                    parseFloat(marco.Latitude) || null,
                    parseFloat(marco.Longitude) || null,
                    parseFloat(marco.Altitude) || null,
                    marco.Ano_Implantacao || null
                );

                if (existe) {
                    atualizados++;
                } else {
                    inseridos++;
                }
            } catch (error) {
                erros.push({
                    linha: marco.linha,
                    erro: error.message,
                    dados: marco
                });
            }
        });

        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);

        console.log(`[Server] Importação concluída: ${inseridos} inseridos, ${atualizados} atualizados, ${erros.length} erros`);

        res.json({
            success: true,
            message: `Importação concluída! ${inseridos} marcos inseridos, ${atualizados} atualizados.`,
            estatisticas: {
                total_linhas: dados.length,
                marcos_validos: marcos_validos.length,
                inseridos,
                atualizados,
                erros: erros.length,
                lista_erros: erros.slice(0, 5) // Limitar a 5 primeiros erros
            }
        });

    } catch (error) {
        console.error('[Server] Erro ao importar planilha:', error);

        // Limpar arquivo temporário em caso de erro
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao importar planilha',
            error: error.message
        });
    }
});

app.get('/api/exportar', (req, res) => {
    try {
        const marcos = db.prepare('SELECT * FROM marcos WHERE ativo = 1 ORDER BY tipo, codigo').all();
        
        const tipoV = marcos.filter(m => m.tipo === 'V');
        const tipoM = marcos.filter(m => m.tipo === 'M');
        const tipoP = marcos.filter(m => m.tipo === 'P');
        
        const workbook = xlsx.utils.book_new();
        
        if (tipoV.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoV);
            xlsx.utils.book_append_sheet(workbook, ws, 'BD Código V');
        }
        if (tipoM.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoM);
            xlsx.utils.book_append_sheet(workbook, ws, 'BD Código M');
        }
        if (tipoP.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoP);
            xlsx.utils.book_append_sheet(workbook, ws, 'BD Código P');
        }
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=marcos_geodesicos.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao exportar:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.get('/api/poligonos', (req, res) => {
    try {
        const { cliente_id, status, ativo = '1' } = req.query;
        
        let query = 'SELECT * FROM poligonos WHERE ativo = ?';
        const params = [ativo];
        
        if (cliente_id) {
            query += ' AND cliente_id = ?';
            params.push(cliente_id);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY data_criacao DESC';
        
        const stmt = db.prepare(query);
        const poligonos = stmt.all(...params);
        
        res.json({ success: true, data: poligonos, total: poligonos.length });
    } catch (error) {
        console.error('Erro ao buscar polígonos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/poligonos/:id', (req, res) => {
    try {
        const poligono = db.prepare('SELECT * FROM poligonos WHERE id = ?').get(req.params.id);
        
        if (!poligono) {
            return res.status(404).json({ success: false, message: 'Polígono não encontrado' });
        }
        
        const marcos = db.prepare(`
            SELECT m.*, pm.ordem 
            FROM marcos m
            INNER JOIN poligono_marcos pm ON m.id = pm.marco_id
            WHERE pm.poligono_id = ?
            ORDER BY pm.ordem
        `).all(req.params.id);
        
        poligono.marcos = marcos;
        
        res.json({ success: true, data: poligono });
    } catch (error) {
        console.error('Erro ao buscar polígono:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/poligonos', (req, res) => {
    try {
        const {
            codigo, nome, cliente_id, cliente_nome, cliente_cpf_cnpj,
            area_m2, perimetro_m, geometria, memorial_descritivo,
            observacoes, status, marcos_ids, usuario_criacao
        } = req.body;
        
        if (!codigo || !nome || !geometria) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código, nome e geometria são obrigatórios' 
            });
        }
        
        const stmt = db.prepare(`
            INSERT INTO poligonos (
                codigo, nome, cliente_id, cliente_nome, cliente_cpf_cnpj,
                area_m2, perimetro_m, geometria, memorial_descritivo,
                observacoes, status, usuario_criacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            codigo, nome, cliente_id || null, cliente_nome || null, 
            cliente_cpf_cnpj || null, area_m2 || null, perimetro_m || null,
            geometria, memorial_descritivo || null, observacoes || null,
            status || 'Em Andamento', usuario_criacao || 'Sistema'
        );
        
        const poligonoId = result.lastInsertRowid;
        
        if (marcos_ids && Array.isArray(marcos_ids)) {
            const stmtMarco = db.prepare(`
                INSERT INTO poligono_marcos (poligono_id, marco_id, ordem)
                VALUES (?, ?, ?)
            `);
            
            marcos_ids.forEach((marcoId, index) => {
                stmtMarco.run(poligonoId, marcoId, index + 1);
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Polígono cadastrado com sucesso!', 
            id: poligonoId 
        });
    } catch (error) {
        console.error('Erro ao criar polígono:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ 
                success: false, 
                message: 'Já existe um polígono com este código' 
            });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

app.put('/api/poligonos/:id', (req, res) => {
    try {
        const {
            codigo, nome, cliente_id, cliente_nome, cliente_cpf_cnpj,
            area_m2, perimetro_m, geometria, memorial_descritivo,
            observacoes, status
        } = req.body;
        
        const stmt = db.prepare(`
            UPDATE poligonos SET
                codigo = ?, nome = ?, cliente_id = ?, cliente_nome = ?,
                cliente_cpf_cnpj = ?, area_m2 = ?, perimetro_m = ?,
                geometria = ?, memorial_descritivo = ?, observacoes = ?,
                status = ?
            WHERE id = ?
        `);
        
        const result = stmt.run(
            codigo, nome, cliente_id, cliente_nome, cliente_cpf_cnpj,
            area_m2, perimetro_m, geometria, memorial_descritivo,
            observacoes, status, req.params.id
        );
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Polígono atualizado com sucesso!' });
        } else {
            res.status(404).json({ success: false, message: 'Polígono não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao atualizar polígono:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/poligonos/:id', (req, res) => {
    try {
        const stmt = db.prepare('UPDATE poligonos SET ativo = 0 WHERE id = ?');
        const result = stmt.run(req.params.id);
        
        if (result.changes > 0) {
            res.json({ success: true, message: 'Polígono removido com sucesso!' });
        } else {
            res.status(404).json({ success: false, message: 'Polígono não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao excluir polígono:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// API: CLIENTES (GESTÃO COMPLETA)
// ==========================================

/**
 * GET /api/clientes
 * Lista todos os clientes com estatísticas
 */
app.get('/api/clientes', (req, res) => {
    try {
        const { busca, limite = 50, offset = 0 } = req.query;

        let query = `
            SELECT
                c.*,
                (SELECT COUNT(*) FROM propriedades WHERE cliente_id = c.id) as total_propriedades,
                (SELECT SUM(area_m2) FROM propriedades WHERE cliente_id = c.id) as area_total_m2,
                (SELECT SUM(area_hectares) FROM propriedades WHERE cliente_id = c.id) as area_total_hectares
            FROM clientes c
        `;

        const params = [];

        if (busca) {
            query += ` WHERE c.nome LIKE ? OR c.cpf_cnpj LIKE ? OR c.email LIKE ?`;
            const searchTerm = `%${busca}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY c.nome ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limite), parseInt(offset));

        const clientes = db.prepare(query).all(...params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM clientes c';
        if (busca) {
            countQuery += ' WHERE c.nome LIKE ? OR c.cpf_cnpj LIKE ? OR c.email LIKE ?';
            const searchTerm = `%${busca}%`;
            const total = db.prepare(countQuery).get(searchTerm, searchTerm, searchTerm).total;

            res.json({
                success: true,
                data: clientes,
                total,
                limite: parseInt(limite),
                offset: parseInt(offset)
            });
        } else {
            const total = db.prepare(countQuery).get().total;

            res.json({
                success: true,
                data: clientes,
                total,
                limite: parseInt(limite),
                offset: parseInt(offset)
            });
        }
    } catch (error) {
        console.error('[Server] Erro ao listar clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar clientes',
            error: error.message
        });
    }
});

/**
 * GET /api/clientes/:id
 * Busca cliente por ID com suas propriedades
 */
app.get('/api/clientes/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Buscar cliente
        const cliente = db.prepare(`
            SELECT
                c.*,
                (SELECT COUNT(*) FROM propriedades WHERE cliente_id = c.id) as total_propriedades,
                (SELECT SUM(area_m2) FROM propriedades WHERE cliente_id = c.id) as area_total_m2,
                (SELECT SUM(area_hectares) FROM propriedades WHERE cliente_id = c.id) as area_total_hectares
            FROM clientes c
            WHERE c.id = ?
        `).get(id);

        if (!cliente) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        // Buscar propriedades do cliente
        const propriedades = db.prepare(`
            SELECT
                p.*,
                (SELECT COUNT(*) FROM vertices WHERE propriedade_id = p.id) as total_vertices
            FROM propriedades p
            WHERE p.cliente_id = ?
            ORDER BY p.nome_propriedade
        `).all(id);

        res.json({
            success: true,
            data: {
                ...cliente,
                propriedades
            }
        });
    } catch (error) {
        console.error('[Server] Erro ao buscar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar cliente',
            error: error.message
        });
    }
});

/**
 * POST /api/clientes
 * Cria novo cliente
 */
app.post('/api/clientes', (req, res) => {
    try {
        const { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes } = req.body;

        // Validação básica
        if (!nome) {
            return res.status(400).json({
                success: false,
                message: 'Nome é obrigatório'
            });
        }

        // Verificar se CPF/CNPJ já existe
        if (cpf_cnpj) {
            const existente = db.prepare('SELECT id FROM clientes WHERE cpf_cnpj = ?').get(cpf_cnpj);
            if (existente) {
                return res.status(400).json({
                    success: false,
                    message: 'CPF/CNPJ já cadastrado'
                });
            }
        }

        // Inserir cliente
        const insert = db.prepare(`
            INSERT INTO clientes (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insert.run(nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes);

        // Buscar cliente criado
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'Cliente criado com sucesso',
            data: cliente
        });
    } catch (error) {
        console.error('[Server] Erro ao criar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar cliente',
            error: error.message
        });
    }
});

/**
 * PUT /api/clientes/:id
 * Atualiza cliente existente
 */
app.put('/api/clientes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes } = req.body;

        // Verificar se cliente existe
        const clienteExistente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(id);
        if (!clienteExistente) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        // Verificar se CPF/CNPJ já existe em outro cliente
        if (cpf_cnpj) {
            const duplicado = db.prepare('SELECT id FROM clientes WHERE cpf_cnpj = ? AND id != ?').get(cpf_cnpj, id);
            if (duplicado) {
                return res.status(400).json({
                    success: false,
                    message: 'CPF/CNPJ já cadastrado para outro cliente'
                });
            }
        }

        // Atualizar cliente
        const update = db.prepare(`
            UPDATE clientes
            SET nome = ?, cpf_cnpj = ?, email = ?, telefone = ?,
                endereco = ?, cidade = ?, estado = ?, observacoes = ?
            WHERE id = ?
        `);

        update.run(nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes, id);

        // Buscar cliente atualizado
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);

        res.json({
            success: true,
            message: 'Cliente atualizado com sucesso',
            data: cliente
        });
    } catch (error) {
        console.error('[Server] Erro ao atualizar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar cliente',
            error: error.message
        });
    }
});

/**
 * DELETE /api/clientes/:id
 * Remove cliente (soft delete se tiver propriedades, hard delete se não tiver)
 */
app.delete('/api/clientes/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se cliente existe
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
        if (!cliente) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        // Verificar se tem propriedades
        const propriedades = db.prepare('SELECT COUNT(*) as total FROM propriedades WHERE cliente_id = ?').get(id);

        if (propriedades.total > 0) {
            return res.status(400).json({
                success: false,
                message: `Não é possível excluir cliente com ${propriedades.total} propriedade(s) cadastrada(s)`,
                propriedades: propriedades.total
            });
        }

        // Deletar cliente
        db.prepare('DELETE FROM clientes WHERE id = ?').run(id);

        res.json({
            success: true,
            message: 'Cliente excluído com sucesso'
        });
    } catch (error) {
        console.error('[Server] Erro ao excluir cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir cliente',
            error: error.message
        });
    }
});

// ==========================================
// API: PROPRIEDADES
// ==========================================

/**
 * GET /api/propriedades
 * Lista todas as propriedades com dados do cliente
 */
app.get('/api/propriedades', (req, res) => {
    try {
        const { busca, tipo, municipio, cliente_id, limite = 50, offset = 0 } = req.query;

        let query = `
            SELECT
                p.*,
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj,
                c.telefone as cliente_telefone,
                (SELECT COUNT(*) FROM vertices WHERE propriedade_id = p.id) as total_vertices
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE 1=1
        `;

        const params = [];

        // Filtro por busca textual
        if (busca) {
            query += ` AND (
                p.nome_propriedade LIKE ? OR
                p.matricula LIKE ? OR
                p.municipio LIKE ? OR
                c.nome LIKE ?
            )`;
            const searchTerm = `%${busca}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Filtro por tipo
        if (tipo) {
            query += ` AND p.tipo = ?`;
            params.push(tipo);
        }

        // Filtro por município
        if (municipio) {
            query += ` AND p.municipio LIKE ?`;
            params.push(`%${municipio}%`);
        }

        // Filtro por cliente
        if (cliente_id) {
            query += ` AND p.cliente_id = ?`;
            params.push(cliente_id);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limite), parseInt(offset));

        const propriedades = db.prepare(query).all(...params);

        // Contar total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE 1=1
        `;
        const countParams = [];

        if (busca) {
            countQuery += ` AND (
                p.nome_propriedade LIKE ? OR
                p.matricula LIKE ? OR
                p.municipio LIKE ? OR
                c.nome LIKE ?
            )`;
            const searchTerm = `%${busca}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (tipo) {
            countQuery += ` AND p.tipo = ?`;
            countParams.push(tipo);
        }

        if (municipio) {
            countQuery += ` AND p.municipio LIKE ?`;
            countParams.push(`%${municipio}%`);
        }

        if (cliente_id) {
            countQuery += ` AND p.cliente_id = ?`;
            countParams.push(cliente_id);
        }

        const total = db.prepare(countQuery).get(...countParams).total;

        res.json({
            success: true,
            data: propriedades,
            total,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('[Server] Erro ao listar propriedades:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar propriedades',
            error: error.message
        });
    }
});

/**
 * GET /api/propriedades/:id
 * Busca propriedade por ID com vértices e dados do cliente
 */
app.get('/api/propriedades/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Buscar propriedade com dados do cliente
        const propriedade = db.prepare(`
            SELECT
                p.*,
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj,
                c.telefone as cliente_telefone,
                c.email as cliente_email,
                c.endereco as cliente_endereco,
                c.cidade as cliente_cidade,
                c.estado as cliente_estado
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `).get(id);

        if (!propriedade) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        // Buscar vértices da propriedade (ordenados)
        const vertices = db.prepare(`
            SELECT *
            FROM vertices
            WHERE propriedade_id = ?
            ORDER BY ordem ASC
        `).all(id);

        res.json({
            success: true,
            data: {
                ...propriedade,
                vertices
            }
        });
    } catch (error) {
        console.error('[Server] Erro ao buscar propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar propriedade',
            error: error.message
        });
    }
});

/**
 * POST /api/propriedades
 * Cria nova propriedade (sem vértices - use endpoint integrado para criar com vértices)
 */
app.post('/api/propriedades', (req, res) => {
    try {
        const {
            cliente_id,
            nome_propriedade,
            matricula,
            tipo,
            municipio,
            comarca,
            distrito,
            bairro,
            uf,
            area_m2,
            perimetro_m,
            memorial_arquivo,
            observacoes
        } = req.body;

        // Validação básica
        if (!cliente_id) {
            return res.status(400).json({
                success: false,
                message: 'Cliente é obrigatório'
            });
        }

        // Matrícula é opcional - pode ficar null para propriedades não regularizadas

        // Verificar se cliente existe
        const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
        if (!clienteExiste) {
            return res.status(400).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        // Verificar se matrícula já existe (somente se matrícula foi fornecida)
        if (matricula) {
            const matriculaExiste = db.prepare('SELECT id FROM propriedades WHERE matricula = ?').get(matricula);
            if (matriculaExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'Matrícula já cadastrada'
                });
            }
        }

        // Inserir propriedade
        const insert = db.prepare(`
            INSERT INTO propriedades (
                cliente_id, nome_propriedade, matricula, tipo,
                municipio, comarca, distrito, bairro, uf,
                area_m2, perimetro_m, memorial_arquivo, observacoes, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO')
        `);

        const result = insert.run(
            cliente_id, nome_propriedade, matricula, tipo || 'RURAL',
            municipio, comarca, distrito, bairro, uf,
            area_m2, perimetro_m, memorial_arquivo, observacoes
        );

        // Buscar propriedade criada com dados do cliente
        const propriedade = db.prepare(`
            SELECT
                p.*,
                c.nome as cliente_nome
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'Propriedade criada com sucesso',
            data: propriedade
        });
    } catch (error) {
        console.error('[Server] Erro ao criar propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar propriedade',
            error: error.message
        });
    }
});

/**
 * PUT /api/propriedades/:id
 * Atualiza propriedade existente (não modifica vértices)
 */
app.put('/api/propriedades/:id', (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome_propriedade,
            matricula,
            tipo,
            municipio,
            comarca,
            distrito,
            bairro,
            uf,
            area_m2,
            perimetro_m,
            status,
            observacoes
        } = req.body;

        // Verificar se propriedade existe
        const propriedadeExiste = db.prepare('SELECT id FROM propriedades WHERE id = ?').get(id);
        if (!propriedadeExiste) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        // Verificar se matrícula já existe em outra propriedade
        if (matricula) {
            const matriculaDuplicada = db.prepare(
                'SELECT id FROM propriedades WHERE matricula = ? AND id != ?'
            ).get(matricula, id);

            if (matriculaDuplicada) {
                return res.status(400).json({
                    success: false,
                    message: 'Matrícula já cadastrada em outra propriedade'
                });
            }
        }

        // Atualizar propriedade
        const update = db.prepare(`
            UPDATE propriedades
            SET nome_propriedade = ?, matricula = ?, tipo = ?,
                municipio = ?, comarca = ?, distrito = ?, bairro = ?, uf = ?,
                area_m2 = ?, perimetro_m = ?, status = ?, observacoes = ?
            WHERE id = ?
        `);

        update.run(
            nome_propriedade, matricula, tipo,
            municipio, comarca, distrito, bairro, uf,
            area_m2, perimetro_m, status || 'ATIVO', observacoes,
            id
        );

        // Buscar propriedade atualizada
        const propriedade = db.prepare(`
            SELECT
                p.*,
                c.nome as cliente_nome
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `).get(id);

        res.json({
            success: true,
            message: 'Propriedade atualizada com sucesso',
            data: propriedade
        });
    } catch (error) {
        console.error('[Server] Erro ao atualizar propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar propriedade',
            error: error.message
        });
    }
});

/**
 * DELETE /api/propriedades/:id
 * Remove propriedade e seus vértices (cascade)
 */
app.delete('/api/propriedades/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se propriedade existe
        const propriedade = db.prepare('SELECT * FROM propriedades WHERE id = ?').get(id);
        if (!propriedade) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        // Contar vértices
        const vertices = db.prepare('SELECT COUNT(*) as total FROM vertices WHERE propriedade_id = ?').get(id);

        // Deletar em transação (vértices serão deletados automaticamente pelo CASCADE)
        db.transaction(() => {
            // Vértices são deletados automaticamente pelo ON DELETE CASCADE
            db.prepare('DELETE FROM propriedades WHERE id = ?').run(id);
        })();

        res.json({
            success: true,
            message: 'Propriedade excluída com sucesso',
            vertices_removidos: vertices.total
        });
    } catch (error) {
        console.error('[Server] Erro ao excluir propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir propriedade',
            error: error.message
        });
    }
});

/**
 * GET /api/propriedades/:id/vertices
 * Lista vértices de uma propriedade específica
 */
app.get('/api/propriedades/:id/vertices', (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se propriedade existe
        const propriedade = db.prepare('SELECT id FROM propriedades WHERE id = ?').get(id);
        if (!propriedade) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        // Buscar vértices
        const vertices = db.prepare(`
            SELECT *
            FROM vertices
            WHERE propriedade_id = ?
            ORDER BY ordem ASC
        `).all(id);

        res.json({
            success: true,
            data: vertices,
            total: vertices.length
        });
    } catch (error) {
        console.error('[Server] Erro ao listar vértices:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar vértices',
            error: error.message
        });
    }
});

// ==========================================
// API: SALVAR MEMORIAL COMPLETO (INTEGRADO)
// ==========================================

/**
 * POST /api/salvar-memorial-completo
 * Salva cliente + propriedade + vértices + histórico de importação em uma transação
 * Usado após importar memorial descritivo
 */
app.post('/api/salvar-memorial-completo', (req, res) => {
    try {
        const {
            cliente,
            propriedade,
            vertices,
            memorial
        } = req.body;

        console.log('[Server] Salvando memorial completo...');
        console.log(`[Server]   Cliente: ${cliente.novo ? 'NOVO' : 'EXISTENTE (ID: ' + cliente.id + ')'}`);
        console.log(`[Server]   Propriedade: ${propriedade.nome_propriedade}`);
        console.log(`[Server]   Vértices: ${vertices.length}`);

        // Validações básicas
        if (!cliente) {
            return res.status(400).json({
                success: false,
                message: 'Dados do cliente são obrigatórios'
            });
        }

        if (!propriedade) {
            return res.status(400).json({
                success: false,
                message: 'Dados da propriedade são obrigatórios'
            });
        }

        if (!vertices || vertices.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Ao menos um vértice é obrigatório'
            });
        }

        // Matrícula é opcional - propriedades em regularização podem não ter
        // Se não tiver matrícula, gerar um identificador temporário
        if (!propriedade.matricula) {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000);
            propriedade.matricula = `TEMP-${timestamp}-${random}`;
            console.log('[Server] Propriedade sem matrícula - gerando temporária:', propriedade.matricula);
        }

        // Executar tudo em uma transação
        const resultado = db.transaction(() => {
            let cliente_id;

            // 1. CLIENTE: Criar novo ou usar existente
            if (cliente.novo) {
                console.log('[Server] Criando novo cliente...');

                // Validar nome obrigatório
                if (!cliente.nome) {
                    throw new Error('Nome do cliente é obrigatório');
                }

                // Verificar se CPF/CNPJ já existe
                if (cliente.cpf_cnpj) {
                    const existente = db.prepare('SELECT id FROM clientes WHERE cpf_cnpj = ?').get(cliente.cpf_cnpj);
                    if (existente) {
                        throw new Error('CPF/CNPJ já cadastrado');
                    }
                }

                // Inserir cliente
                const insertCliente = db.prepare(`
                    INSERT INTO clientes (nome, cpf_cnpj, email, telefone, endereco, cidade, estado, observacoes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const resultCliente = insertCliente.run(
                    cliente.nome,
                    cliente.cpf_cnpj || null,
                    cliente.email || null,
                    cliente.telefone || null,
                    cliente.endereco || null,
                    cliente.cidade || null,
                    cliente.estado || null,
                    cliente.observacoes || null
                );

                cliente_id = resultCliente.lastInsertRowid;
                console.log(`[Server] ✅ Cliente criado (ID: ${cliente_id})`);
            } else {
                // Usar cliente existente
                cliente_id = cliente.id;

                // Validar que o cliente existe
                const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
                if (!clienteExiste) {
                    throw new Error('Cliente não encontrado');
                }

                console.log(`[Server] ✅ Usando cliente existente (ID: ${cliente_id})`);
            }

            // 2. PROPRIEDADE: Criar
            console.log('[Server] Criando propriedade...');

            // Verificar se matrícula já existe
            const matriculaExiste = db.prepare('SELECT id FROM propriedades WHERE matricula = ?').get(propriedade.matricula);
            if (matriculaExiste) {
                throw new Error('Matrícula já cadastrada');
            }

            // Inserir propriedade
            const insertPropriedade = db.prepare(`
                INSERT INTO propriedades (
                    cliente_id, nome_propriedade, matricula, tipo,
                    municipio, comarca, distrito, bairro, uf,
                    area_m2, perimetro_m, memorial_arquivo,
                    memorial_data_importacao, memorial_json, status, observacoes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?)
            `);

            const resultPropriedade = insertPropriedade.run(
                cliente_id,
                propriedade.nome_propriedade || 'Sem nome',
                propriedade.matricula,
                propriedade.tipo || 'RURAL',
                propriedade.municipio || null,
                propriedade.comarca || null,
                propriedade.distrito || null,
                propriedade.bairro || null,
                propriedade.uf || null,
                propriedade.area_m2 || null,
                propriedade.perimetro_m || null,
                memorial?.arquivo_nome || null,
                new Date().toISOString(),
                memorial ? JSON.stringify(memorial) : null,
                propriedade.observacoes || null
            );

            const propriedade_id = resultPropriedade.lastInsertRowid;
            console.log(`[Server] ✅ Propriedade criada (ID: ${propriedade_id})`);

            // 3. VÉRTICES: Criar todos
            console.log(`[Server] Criando ${vertices.length} vértices...`);

            const insertVertice = db.prepare(`
                INSERT INTO vertices (
                    propriedade_id, nome, ordem,
                    latitude, longitude, altitude,
                    utm_e, utm_n, utm_zona, datum,
                    azimute, distancia_m, confrontante, tipo
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            vertices.forEach((vertice, index) => {
                insertVertice.run(
                    propriedade_id,
                    vertice.nome,
                    vertice.ordem || (index + 1),
                    vertice.coordenadas?.lat_original || null,
                    vertice.coordenadas?.lon_original || null,
                    vertice.coordenadas?.altitude || null,
                    vertice.coordenadas?.e || null,
                    vertice.coordenadas?.n || null,
                    vertice.coordenadas?.utm_zona || '22S',
                    vertice.coordenadas?.datum || 'SIRGAS2000',
                    vertice.azimute || null,
                    vertice.distancia_m || null,
                    vertice.confrontante || null,
                    vertice.tipo || 'VERTICE'
                );
            });

            console.log(`[Server] ✅ ${vertices.length} vértices criados`);

            // 4. HISTÓRICO: Registrar importação
            console.log('[Server] Registrando histórico...');

            const insertHistorico = db.prepare(`
                INSERT INTO memoriais_importados (
                    propriedade_id, arquivo_nome, arquivo_tamanho, arquivo_hash,
                    vertices_extraidos, metadados_extraidos, taxa_sucesso,
                    status, resultado_json, usuario
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSADO', ?, ?)
            `);

            const resultHistorico = insertHistorico.run(
                propriedade_id,
                memorial?.arquivo_nome || 'memorial.docx',
                memorial?.arquivo_tamanho || null,
                memorial?.arquivo_hash || null,
                memorial?.estatisticas?.vertices_unicos || vertices.length,
                memorial?.estatisticas?.metadados_extraidos || 0,
                100.0, // Taxa de sucesso (pode ser calculada)
                memorial ? JSON.stringify(memorial) : null,
                'sistema' // Pode ser substituído por autenticação no futuro
            );

            console.log(`[Server] ✅ Histórico registrado (ID: ${resultHistorico.lastInsertRowid})`);

            return {
                cliente_id,
                propriedade_id,
                historico_id: resultHistorico.lastInsertRowid,
                vertices_criados: vertices.length
            };
        })();

        // Buscar dados completos para retornar
        const dadosCompletos = db.prepare(`
            SELECT
                p.*,
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj,
                (SELECT COUNT(*) FROM vertices WHERE propriedade_id = p.id) as total_vertices
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `).get(resultado.propriedade_id);

        console.log('[Server] ====================================');
        console.log('[Server] ✅ MEMORIAL SALVO COM SUCESSO!');
        console.log('[Server] ====================================');

        res.status(201).json({
            success: true,
            message: `Memorial salvo com sucesso! ${resultado.vertices_criados} vértices criados.`,
            data: {
                cliente_id: resultado.cliente_id,
                propriedade_id: resultado.propriedade_id,
                historico_id: resultado.historico_id,
                vertices_criados: resultado.vertices_criados,
                propriedade: dadosCompletos
            }
        });

    } catch (error) {
        console.error('[Server] ❌ Erro ao salvar memorial completo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao salvar memorial completo',
            error: error.message
        });
    }
});

/**
 * GET /api/memoriais-importados
 * Lista histórico de importações de memoriais
 */
app.get('/api/memoriais-importados', (req, res) => {
    try {
        const { limite = 50, offset = 0 } = req.query;

        const historico = db.prepare(`
            SELECT
                m.*,
                p.nome_propriedade,
                p.matricula,
                c.nome as cliente_nome
            FROM memoriais_importados m
            LEFT JOIN propriedades p ON m.propriedade_id = p.id
            LEFT JOIN clientes c ON p.cliente_id = c.id
            ORDER BY m.data_importacao DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limite), parseInt(offset));

        const total = db.prepare('SELECT COUNT(*) as total FROM memoriais_importados').get().total;

        res.json({
            success: true,
            data: historico,
            total,
            limite: parseInt(limite),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('[Server] Erro ao listar histórico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar histórico de importações',
            error: error.message
        });
    }
});

// ==========================================
// API: PROPRIEDADES PARA MAPA
// ==========================================

/**
 * GET /api/propriedades-mapa
 * Retorna propriedades com vértices em formato GeoJSON para o mapa
 */
app.get('/api/propriedades-mapa', (req, res) => {
    try {
        const { tipo, municipio, cliente_id } = req.query;

        console.log('[Server] Carregando propriedades para o mapa...');

        // Buscar propriedades
        let query = `
            SELECT
                p.*,
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj,
                c.telefone as cliente_telefone
            FROM propriedades p
            INNER JOIN clientes c ON p.cliente_id = c.id
            WHERE p.status = 'ATIVO'
        `;

        const params = [];

        if (tipo) {
            query += ` AND p.tipo = ?`;
            params.push(tipo);
        }

        if (municipio) {
            query += ` AND p.municipio LIKE ?`;
            params.push(`%${municipio}%`);
        }

        if (cliente_id) {
            query += ` AND p.cliente_id = ?`;
            params.push(cliente_id);
        }

        query += ` ORDER BY p.created_at DESC`;

        const propriedades = db.prepare(query).all(...params);

        console.log(`[Server] ${propriedades.length} propriedades encontradas`);

        // Para cada propriedade, buscar vértices
        const propriedadesComVertices = propriedades.map(prop => {
            const vertices = db.prepare(`
                SELECT
                    nome, ordem,
                    latitude, longitude,
                    utm_e, utm_n
                FROM vertices
                WHERE propriedade_id = ?
                ORDER BY ordem ASC
            `).all(prop.id);

            // Criar coordenadas para o polígono (Leaflet usa [lat, lng])
            const coordinates = vertices
                .filter(v => v.latitude && v.longitude)
                .map(v => [v.latitude, v.longitude]);

            return {
                id: prop.id,
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates] // GeoJSON precisa de array duplo
                },
                properties: {
                    // Dados da propriedade
                    nome_propriedade: prop.nome_propriedade,
                    matricula: prop.matricula,
                    tipo: prop.tipo,
                    municipio: prop.municipio,
                    comarca: prop.comarca,
                    uf: prop.uf,
                    area_m2: prop.area_m2,
                    area_hectares: prop.area_hectares,
                    perimetro_m: prop.perimetro_m,

                    // Dados do cliente
                    cliente_nome: prop.cliente_nome,
                    cliente_cpf_cnpj: prop.cliente_cpf_cnpj,
                    cliente_telefone: prop.cliente_telefone,

                    // Metadados
                    total_vertices: vertices.length,
                    created_at: prop.created_at
                }
            };
        });

        // Filtrar apenas propriedades com coordenadas válidas
        const propriedadesValidas = propriedadesComVertices.filter(
            p => p.geometry.coordinates[0].length >= 3
        );

        console.log(`[Server] ${propriedadesValidas.length} propriedades com coordenadas válidas`);

        // Retornar em formato GeoJSON
        res.json({
            success: true,
            type: 'FeatureCollection',
            features: propriedadesValidas,
            total: propriedadesValidas.length
        });

    } catch (error) {
        console.error('[Server] Erro ao carregar propriedades para mapa:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar propriedades para o mapa',
            error: error.message
        });
    }
});

// ============== ENDPOINT ANTIGO - DESABILITADO ==============
// MOTIVO: MemorialParser foi substituído por UnstructuredProcessor + Unstructured API
// NOVO ENDPOINT: POST /api/importar-memorial-v2 (usa Unstructured API em Docker)
// Data de desativação: 2025-10-13
// ✅ Frontend atualizado para usar /api/importar-memorial-v2

/*
app.post('/api/memorial/importar', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Arquivo não enviado' });
        }

        const result = await mammoth.extractRawText({ path: req.file.path });
        const texto = result.value;

        const parser = new MemorialParser(texto);
        const memorial = parser.processar();

        if (memorial.tipo === 'rural') {
            memorial.vertices = memorial.vertices.map(v => {
                const utm = proj4('EPSG:4326', 'EPSG:31982', [v.longitude, v.latitude]);
                return {
                    ...v,
                    e: utm[0],
                    n: utm[1]
                };
            });
        }

        const coords = memorial.vertices.map(v => [v.e, v.n]);
        coords.push(coords[0]);

        const geometria = {
            type: 'Polygon',
            coordinates: [coords]
        };

        const clienteIds = [];
        if (memorial.dados.proprietarios) {
            for (const nome of memorial.dados.proprietarios) {
                try {
                    const stmtCliente = db.prepare(`
                        INSERT OR IGNORE INTO clientes (nome, cpf_cnpj)
                        VALUES (?, ?)
                    `);
                    const cpfTemp = `MEMORIAL-${Date.now()}-${Math.random()}`;
                    stmtCliente.run(nome, cpfTemp);

                    const cliente = db.prepare('SELECT id FROM clientes WHERE nome = ?').get(nome);
                    if (cliente) clienteIds.push(cliente.id);
                } catch (err) {
                    console.error('Erro ao cadastrar cliente:', err);
                }
            }
        }

        let codigo = memorial.dados.matricula
            ? `MAT-${memorial.dados.matricula}`
            : `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const codigoExistente = db.prepare('SELECT id FROM poligonos WHERE codigo = ?').get(codigo);
        if (codigoExistente) {
            codigo = `${codigo}-${Date.now()}`;
        }

        const stmtPoligono = db.prepare(`
            INSERT INTO poligonos (
                codigo, nome, cliente_id, area_m2, perimetro_m,
                geometria, memorial_descritivo, status, usuario_criacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resultPol = stmtPoligono.run(
            codigo,
            `Matrícula ${memorial.dados.matricula || 'S/N'}`,
            clienteIds[0] || null,
            memorial.dados.area_m2,
            memorial.dados.perimetro_m,
            JSON.stringify(geometria),
            texto,
            'Importado',
            req.body.usuario || 'Sistema'
        );

        const marcosAssociados = [];
        for (const vertice of memorial.vertices) {
            if (vertice.nome && vertice.nome.startsWith('FHV-')) {
                const marco = db.prepare('SELECT id FROM marcos WHERE codigo = ?').get(vertice.nome);
                if (marco) {
                    db.prepare(`
                        INSERT INTO poligono_marcos (poligono_id, marco_id, ordem)
                        VALUES (?, ?, ?)
                    `).run(resultPol.lastInsertRowid, marco.id, marcosAssociados.length + 1);
                    marcosAssociados.push(vertice.nome);
                }
            }
        }

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: 'Memorial importado com sucesso!',
            data: {
                terreno_id: resultPol.lastInsertRowid,
                clientes: clienteIds.length,
                vertices: memorial.vertices.length,
                marcos_associados: marcosAssociados.length,
                tipo: memorial.tipo
            }
        });

    } catch (error) {
        console.error('Erro ao importar memorial:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
*/

// ============== ENDPOINTS DE VALIDAÇÃO DE COORDENADAS ==============

// POST /api/validar-coordenadas - Executa validação completa de todos os marcos
app.post('/api/validar-coordenadas', (req, res) => {
    try {
        const { forcar = false } = req.body;

        const estatisticas = validador.validarTodosMarcos(db, forcar);

        res.json({
            success: true,
            message: `Validação concluída! ${estatisticas.validos} válidos, ${estatisticas.invalidos} inválidos`,
            estatisticas
        });
    } catch (error) {
        console.error('Erro ao validar coordenadas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/marcos/invalidos - Lista todos os marcos com coordenadas inválidas
app.get('/api/marcos/invalidos', (req, res) => {
    try {
        const { limit = 50, offset = 0, tipo } = req.query;

        let query = 'SELECT * FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1';
        const params = [];

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }

        query += ' ORDER BY codigo LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const marcosInvalidos = db.prepare(query).all(...params);

        const countQuery = tipo
            ? 'SELECT COUNT(*) as total FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1 AND tipo = ?'
            : 'SELECT COUNT(*) as total FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1';

        const countParams = tipo ? [tipo] : [];
        const total = db.prepare(countQuery).get(...countParams).total;

        res.json({
            success: true,
            data: marcosInvalidos,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Erro ao buscar marcos inválidos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/marcos/validacao-status - Retorna estatísticas gerais de validação
app.get('/api/marcos/validacao-status', (req, res) => {
    try {
        const stats = {
            total: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
            validados: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 1 AND ativo = 1').get().count,
            invalidos: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1').get().count,
            pendentes: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas IS NULL AND ativo = 1').get().count
        };

        const ultimaValidacao = db.prepare(
            'SELECT data_validacao FROM marcos WHERE data_validacao IS NOT NULL ORDER BY data_validacao DESC LIMIT 1'
        ).get();

        stats.ultima_validacao = ultimaValidacao ? ultimaValidacao.data_validacao : null;

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Erro ao buscar status de validação:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/marcos/:id/corrigir-coordenadas - Atualiza e valida coordenadas de um marco
app.put('/api/marcos/:id/corrigir-coordenadas', (req, res) => {
    try {
        const { coordenada_e, coordenada_n, motivo, usuario } = req.body;
        const marcoId = req.params.id;

        if (!coordenada_e || !coordenada_n) {
            return res.status(400).json({
                success: false,
                message: 'Coordenadas E e N são obrigatórias'
            });
        }

        // Buscar coordenadas antigas
        const marcoAntigo = db.prepare('SELECT coordenada_e, coordenada_n FROM marcos WHERE id = ?').get(marcoId);

        if (!marcoAntigo) {
            return res.status(404).json({ success: false, message: 'Marco não encontrado' });
        }

        // Registrar no log de correções
        const stmtLog = db.prepare(`
            INSERT INTO log_correcoes (
                marco_id, coordenada_e_antiga, coordenada_n_antiga,
                coordenada_e_nova, coordenada_n_nova, motivo, usuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmtLog.run(
            marcoId,
            marcoAntigo.coordenada_e,
            marcoAntigo.coordenada_n,
            coordenada_e,
            coordenada_n,
            motivo || 'Correção manual',
            usuario || 'Sistema'
        );

        // Atualizar coordenadas
        const stmtUpdate = db.prepare(`
            UPDATE marcos
            SET coordenada_e = ?, coordenada_n = ?
            WHERE id = ?
        `);

        stmtUpdate.run(coordenada_e, coordenada_n, marcoId);

        // Re-validar marco
        const marcoAtualizado = db.prepare('SELECT * FROM marcos WHERE id = ?').get(marcoId);
        const validacao = validador.validarMarco(marcoAtualizado);

        const stmtValidacao = db.prepare(`
            UPDATE marcos
            SET coordenadas_validadas = ?,
                erro_validacao = ?,
                data_validacao = ?
            WHERE id = ?
        `);

        const descricaoErro = validacao.valido ? null : validador.obterDescricaoErro(validacao.erro);
        stmtValidacao.run(
            validacao.valido ? 1 : 0,
            descricaoErro,
            new Date().toISOString(),
            marcoId
        );

        res.json({
            success: true,
            message: 'Coordenadas corrigidas com sucesso!',
            marco_atualizado: marcoAtualizado,
            validacao: {
                valido: validacao.valido,
                erro: validacao.erro,
                descricao: descricaoErro,
                detalhes: validacao.detalhes
            }
        });
    } catch (error) {
        console.error('Erro ao corrigir coordenadas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/relatorio-validacao - Gera relatório completo de validação
app.get('/api/relatorio-validacao', (req, res) => {
    try {
        const marcosInvalidos = db.prepare(`
            SELECT id, codigo, tipo, localizacao, lote,
                   coordenada_e, coordenada_n, erro_validacao, data_validacao
            FROM marcos
            WHERE coordenadas_validadas = 0 AND ativo = 1
            ORDER BY tipo, codigo
        `).all();

        const estatisticas = {
            total: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
            validados: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 1 AND ativo = 1').get().count,
            invalidos: marcosInvalidos.length,
            pendentes: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas IS NULL AND ativo = 1').get().count
        };

        const errosPorTipo = db.prepare(`
            SELECT erro_validacao, COUNT(*) as quantidade
            FROM marcos
            WHERE coordenadas_validadas = 0 AND ativo = 1
            GROUP BY erro_validacao
        `).all();

        res.json({
            success: true,
            data: {
                marcos_invalidos: marcosInvalidos,
                estatisticas,
                erros_por_tipo: errosPorTipo,
                data_relatorio: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/exportar-invalidos - Exporta marcos inválidos para Excel
app.get('/api/exportar-invalidos', (req, res) => {
    try {
        const marcosInvalidos = db.prepare(`
            SELECT codigo, tipo, localizacao, metodo, limites,
                   coordenada_e, coordenada_n, altitude_h,
                   lote, erro_validacao as 'Motivo Invalidação',
                   data_validacao as 'Data Validação'
            FROM marcos
            WHERE coordenadas_validadas = 0 AND ativo = 1
            ORDER BY tipo, codigo
        `).all();

        if (marcosInvalidos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum marco inválido encontrado'
            });
        }

        // Separar por tipo
        const tipoV = marcosInvalidos.filter(m => m.tipo === 'V');
        const tipoM = marcosInvalidos.filter(m => m.tipo === 'M');
        const tipoP = marcosInvalidos.filter(m => m.tipo === 'P');

        const workbook = xlsx.utils.book_new();

        if (tipoV.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoV);
            xlsx.utils.book_append_sheet(workbook, ws, 'Inválidos Tipo V');
        }
        if (tipoM.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoM);
            xlsx.utils.book_append_sheet(workbook, ws, 'Inválidos Tipo M');
        }
        if (tipoP.length > 0) {
            const ws = xlsx.utils.json_to_sheet(tipoP);
            xlsx.utils.book_append_sheet(workbook, ws, 'Inválidos Tipo P');
        }

        // Adicionar sheet de resumo
        const resumo = [{
            'Total Inválidos': marcosInvalidos.length,
            'Tipo V': tipoV.length,
            'Tipo M': tipoM.length,
            'Tipo P': tipoP.length,
            'Data Exportação': new Date().toISOString()
        }];
        const wsResumo = xlsx.utils.json_to_sheet(resumo);
        xlsx.utils.book_append_sheet(workbook, wsResumo, 'Resumo');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=marcos_invalidos.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao exportar inválidos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/log-correcoes/:marcoId - Busca histórico de correções de um marco
app.get('/api/log-correcoes/:marcoId', (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT * FROM log_correcoes
            WHERE marco_id = ?
            ORDER BY data_correcao DESC
        `).all(req.params.marcoId);

        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Erro ao buscar log de correções:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint para listar marcos pendentes de levantamento
app.get('/api/marcos/pendentes', (req, res) => {
    try {
        const { limit = 50, offset = 0, tipo } = req.query;

        let query = `SELECT * FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1`;
        const params = [];

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }

        query += ' ORDER BY codigo LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const stmt = db.prepare(query);
        const marcos = stmt.all(...params);

        // Contar total de pendentes
        let countQuery = `SELECT COUNT(*) as total FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1`;
        const countParams = [];
        if (tipo) {
            countQuery += ' AND tipo = ?';
            countParams.push(tipo);
        }
        const countStmt = db.prepare(countQuery);
        const { total } = countStmt.get(...countParams);

        res.json({ success: true, data: marcos, total });
    } catch (error) {
        console.error('Erro ao buscar marcos pendentes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint para registrar levantamento topográfico de um marco pendente
app.put('/api/marcos/:id/registrar-levantamento', (req, res) => {
    try {
        const { coordenada_e, coordenada_n, altitude_h, desvio_e, desvio_n, desvio_h, usuario } = req.body;

        if (!coordenada_e || !coordenada_n) {
            return res.status(400).json({
                success: false,
                message: 'Coordenadas E e N são obrigatórias para registrar levantamento'
            });
        }

        // Buscar marco atual
        const marco = db.prepare('SELECT * FROM marcos WHERE id = ?').get(req.params.id);
        if (!marco) {
            return res.status(404).json({ success: false, message: 'Marco não encontrado' });
        }

        // Registrar no log_correcoes (histórico)
        db.prepare(`
            INSERT INTO log_correcoes (
                marco_id, coordenada_e_antiga, coordenada_n_antiga,
                coordenada_e_nova, coordenada_n_nova, motivo, usuario
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            req.params.id,
            marco.coordenada_e || null,
            marco.coordenada_n || null,
            coordenada_e,
            coordenada_n,
            'Registro de levantamento topográfico em campo',
            usuario || 'Sistema'
        );

        // Atualizar marco para status LEVANTADO
        const stmt = db.prepare(`
            UPDATE marcos SET
                coordenada_e = ?,
                coordenada_n = ?,
                altitude_h = ?,
                desvio_e = ?,
                desvio_n = ?,
                desvio_h = ?,
                status_campo = 'LEVANTADO',
                data_cadastro = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            coordenada_e,
            coordenada_n,
            altitude_h || null,
            desvio_e || null,
            desvio_n || null,
            desvio_h || null,
            req.params.id
        );

        console.log(`✅ Marco ${marco.codigo} registrado como LEVANTADO`);

        res.json({
            success: true,
            message: 'Levantamento registrado com sucesso! Marco agora aparecerá no mapa.',
            marco: {
                id: marco.id,
                codigo: marco.codigo,
                status_anterior: marco.status_campo,
                status_novo: 'LEVANTADO'
            }
        });
    } catch (error) {
        console.error('Erro ao registrar levantamento:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/importar-memorial-v2', uploadMemory.single('files'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo enviado'
            });
        }

        console.log('[Server] Arquivo recebido:', req.file.originalname);
        console.log('[Server] Tamanho:', req.file.size, 'bytes');
        console.log('[Server] Enviando para API Unstructured...');

        // Criar FormData para enviar ao Unstructured
        const formData = new FormData();
        formData.append('files', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Enviar para API Unstructured
        const unstructuredResponse = await axios.post(
            'http://localhost:8000/general/v0/general',
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 30000 // 30 segundos
            }
        );

        console.log('[Server] Resposta recebida da Unstructured');
        console.log('[Server] Elementos retornados:', unstructuredResponse.data.length);

        // Processar com UnstructuredProcessor
        const processor = new UnstructuredProcessor();
        const parsedData = processor.processUnstructuredResponse(unstructuredResponse.data);

        console.log('[Server] Processamento concluído');
        console.log('[Server] Vértices extraídos:', parsedData.vertices.length);

        res.json({
            success: true,
            message: `Memorial processado com sucesso! ${parsedData.vertices.length} vértices extraídos.`,
            data: parsedData
        });

    } catch (error) {
        console.error('[Server] Erro no pipeline de importação:', error.message);

        if (error.response) {
            console.error('[Server] Erro da API Unstructured:');
            console.error('[Server] Status:', error.response.status);
            console.error('[Server] Data:', error.response.data);

            return res.status(500).json({
                success: false,
                message: 'Falha ao processar arquivo na API Unstructured',
                error: error.response.data
            });
        }

        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                message: 'API Unstructured não está acessível. Verifique se o container Docker está rodando.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro interno ao processar memorial',
            error: error.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n============================================');
    console.log('🚀 SISTEMA DE MARCOS GEODÉSICOS INICIADO!');
    console.log('============================================');
    console.log(`\n📍 Acesso Local: http://localhost:${PORT}`);
    console.log(`🌐 Acesso na Rede: http://${localIP}:${PORT}`);
    console.log('\n💡 Compartilhe o endereço da rede com seus colegas!');
    console.log('============================================\n');
});

process.on('SIGINT', () => {
    db.close();
    console.log('\n\n👋 Servidor encerrado. Banco de dados fechado com segurança.');
    process.exit(0);
});