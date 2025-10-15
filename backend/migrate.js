const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseMigrator {
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.migrationsPath = path.join(__dirname, 'migrations');
        this.init();
    }

    init() {
        // Criar tabela de controle de migrações
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[Migrator] Tabela de controle de migrações inicializada.');
    }

    getAppliedMigrations() {
        return this.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    }

    getPendingMigrations() {
        if (!fs.existsSync(this.migrationsPath)) {
            console.log('[Migrator] ⚠️  Pasta migrations/ não encontrada. Criando...');
            fs.mkdirSync(this.migrationsPath, { recursive: true });
            return [];
        }

        const files = fs.readdirSync(this.migrationsPath)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const applied = this.getAppliedMigrations().map(m => m.version);

        return files.filter(file => {
            const version = file.split('_')[0];
            return !applied.includes(version);
        });
    }

    migrate() {
        console.log('[Migrator] ====================================');
        console.log('[Migrator] INICIANDO MIGRAÇÕES');
        console.log('[Migrator] ====================================');

        const pending = this.getPendingMigrations();

        if (pending.length === 0) {
            console.log('[Migrator] ✅ Nenhuma migração pendente. Banco está atualizado!');
            return;
        }

        console.log(`[Migrator] 📋 ${pending.length} migração(ões) pendente(s):`);
        pending.forEach(file => console.log(`[Migrator]    - ${file}`));

        pending.forEach(file => {
            console.log(`[Migrator] Aplicando: ${file}...`);

            const filePath = path.join(this.migrationsPath, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            const version = file.split('_')[0];
            const name = file.replace('.sql', '');

            try {
                // Executar migração em transação
                this.db.transaction(() => {
                    this.db.exec(sql);

                    // Registrar migração aplicada
                    this.db.prepare(`
                        INSERT INTO schema_migrations (version, name)
                        VALUES (?, ?)
                    `).run(version, name);
                })();

                console.log(`[Migrator] ✅ ${file} aplicado com sucesso!`);
            } catch (error) {
                console.error(`[Migrator] ❌ Erro ao aplicar ${file}:`, error.message);
                throw error;
            }
        });

        console.log('[Migrator] ====================================');
        console.log('[Migrator] ✅ MIGRAÇÕES CONCLUÍDAS');
        console.log('[Migrator] ====================================');
    }

    status() {
        console.log('[Migrator] ====================================');
        console.log('[Migrator] STATUS DAS MIGRAÇÕES');
        console.log('[Migrator] ====================================');

        const applied = this.getAppliedMigrations();
        const pending = this.getPendingMigrations();

        console.log(`[Migrator] ✅ Aplicadas: ${applied.length}`);
        applied.forEach(m => console.log(`[Migrator]    - ${m.version}`));

        console.log(`[Migrator] ⏳ Pendentes: ${pending.length}`);
        pending.forEach(m => console.log(`[Migrator]    - ${m}`));

        console.log('[Migrator] ====================================');
    }

    verify() {
        console.log('[Migrator] ====================================');
        console.log('[Migrator] VERIFICANDO ESTRUTURA DO BANCO');
        console.log('[Migrator] ====================================');

        // Listar tabelas
        const tables = this.db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            ORDER BY name
        `).all();

        console.log(`[Migrator] 📊 Tabelas encontradas: ${tables.length}`);
        tables.forEach(t => console.log(`[Migrator]    - ${t.name}`));

        // Verificar tabelas esperadas
        const expectedTables = [
            'marcos',
            'clientes',
            'propriedades',
            'vertices',
            'memoriais_importados',
            'schema_migrations'
        ];

        const missingTables = expectedTables.filter(
            t => !tables.find(tb => tb.name === t)
        );

        if (missingTables.length > 0) {
            console.log('[Migrator] ⚠️  Tabelas faltando:');
            missingTables.forEach(t => console.log(`[Migrator]    - ${t}`));
        } else {
            console.log('[Migrator] ✅ Todas as tabelas esperadas estão presentes!');
        }

        // Contar registros
        console.log('[Migrator] ====================================');
        console.log('[Migrator] CONTAGEM DE REGISTROS');
        console.log('[Migrator] ====================================');

        tables.forEach(t => {
            try {
                const count = this.db.prepare(`SELECT COUNT(*) as total FROM ${t.name}`).get();
                console.log(`[Migrator] ${t.name}: ${count.total} registro(s)`);
            } catch (error) {
                console.log(`[Migrator] ${t.name}: erro ao contar`);
            }
        });

        console.log('[Migrator] ====================================');
    }

    close() {
        this.db.close();
        console.log('[Migrator] Conexão com banco fechada.');
    }
}

// ==========================================
// EXECUÇÃO
// ==========================================

if (require.main === module) {
    const dbPath = path.join(__dirname, '../database/marcos.db');
    const migrator = new DatabaseMigrator(dbPath);

    const command = process.argv[2] || 'migrate';

    try {
        switch (command) {
            case 'migrate':
                migrator.migrate();
                migrator.verify();
                break;

            case 'status':
                migrator.status();
                break;

            case 'verify':
                migrator.verify();
                break;

            default:
                console.log('Uso: node migrate.js [migrate|status|verify]');
                console.log('  migrate - Aplica migrações pendentes (padrão)');
                console.log('  status  - Mostra status das migrações');
                console.log('  verify  - Verifica estrutura do banco');
        }
    } catch (error) {
        console.error('[Migrator] ❌ ERRO:', error.message);
        process.exit(1);
    } finally {
        migrator.close();
    }
}

module.exports = DatabaseMigrator;
