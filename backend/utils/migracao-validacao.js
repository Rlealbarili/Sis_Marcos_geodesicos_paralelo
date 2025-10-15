/**
 * Script de migração do banco de dados
 * Adiciona suporte para validação de coordenadas
 */

function executarMigracaoValidacao(db) {
    console.log('Executando migração: Validação de Coordenadas...');

    try {
        // 1. Adicionar colunas à tabela marcos
        const colunasExistentes = db.prepare("PRAGMA table_info(marcos)").all();
        const colunasCadastradas = colunasExistentes.map(col => col.name);

        if (!colunasCadastradas.includes('coordenadas_validadas')) {
            db.exec(`ALTER TABLE marcos ADD COLUMN coordenadas_validadas INTEGER DEFAULT NULL`);
            console.log('  ✓ Coluna coordenadas_validadas adicionada');
        }

        if (!colunasCadastradas.includes('erro_validacao')) {
            db.exec(`ALTER TABLE marcos ADD COLUMN erro_validacao TEXT DEFAULT NULL`);
            console.log('  ✓ Coluna erro_validacao adicionada');
        }

        if (!colunasCadastradas.includes('data_validacao')) {
            db.exec(`ALTER TABLE marcos ADD COLUMN data_validacao TEXT DEFAULT NULL`);
            console.log('  ✓ Coluna data_validacao adicionada');
        }

        // 2. Criar tabela log_correcoes
        db.exec(`
            CREATE TABLE IF NOT EXISTS log_correcoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                marco_id INTEGER NOT NULL,
                coordenada_e_antiga REAL,
                coordenada_n_antiga REAL,
                coordenada_e_nova REAL,
                coordenada_n_nova REAL,
                motivo TEXT,
                usuario TEXT,
                data_correcao TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (marco_id) REFERENCES marcos(id)
            )
        `);
        console.log('  ✓ Tabela log_correcoes criada');

        // 3. Criar índices
        db.exec(`CREATE INDEX IF NOT EXISTS idx_marcos_validadas ON marcos(coordenadas_validadas)`);
        console.log('  ✓ Índice idx_marcos_validadas criado');

        db.exec(`CREATE INDEX IF NOT EXISTS idx_log_marco ON log_correcoes(marco_id)`);
        console.log('  ✓ Índice idx_log_marco criado');

        // 4. Criar tabela de controle de migrações
        db.exec(`
            CREATE TABLE IF NOT EXISTS migracoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT UNIQUE NOT NULL,
                data_execucao TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Registrar migração
        const stmtMigracao = db.prepare(`
            INSERT OR IGNORE INTO migracoes (nome) VALUES (?)
        `);
        stmtMigracao.run('validacao-coordenadas-v1');

        console.log('✅ Migração concluída com sucesso!\n');
        return true;

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error.message);
        return false;
    }
}

module.exports = { executarMigracaoValidacao };
