const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/marcos.db');
const backupPath = path.join(__dirname, `../database/marcos_backup_${Date.now()}.db`);

console.log('====================================');
console.log('RESET DO BANCO DE DADOS');
console.log('====================================');

// 1. Fazer backup
console.log(`\n📦 Criando backup: ${path.basename(backupPath)}`);
fs.copyFileSync(dbPath, backupPath);
console.log('✅ Backup criado com sucesso!');

// 2. Conectar ao banco
const db = new Database(dbPath);

// 3. Verificar tabelas existentes
console.log('\n📊 Tabelas antes do reset:');
const tablesBeforeReset = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
`).all();
tablesBeforeReset.forEach(t => console.log(`   - ${t.name}`));

// 4. Listar apenas as tabelas que vamos remover (não mexer em 'marcos')
const tabelasParaRemover = [
    'clientes',
    'propriedades',
    'vertices',
    'memoriais_importados',
    'schema_migrations',
    'poligonos',
    'poligono_marcos',
    'log_correcoes'
];

console.log('\n🗑️  Removendo tabelas conflitantes...');

try {
    db.transaction(() => {
        // Remover triggers primeiro
        console.log('\n🔧 Removendo triggers...');
        const triggers = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='trigger'
        `).all();

        triggers.forEach(t => {
            console.log(`   Removendo trigger: ${t.name}`);
            db.exec(`DROP TRIGGER IF EXISTS ${t.name}`);
        });

        // Remover views
        console.log('\n👁️  Removendo views...');
        const views = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='view'
        `).all();

        views.forEach(v => {
            console.log(`   Removendo view: ${v.name}`);
            db.exec(`DROP VIEW IF EXISTS ${v.name}`);
        });

        // Remover tabelas (exceto 'marcos')
        console.log('\n📋 Removendo tabelas...');
        tabelasParaRemover.forEach(tabela => {
            const exists = db.prepare(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name=?
            `).get(tabela);

            if (exists) {
                console.log(`   Removendo tabela: ${tabela}`);
                db.exec(`DROP TABLE IF EXISTS ${tabela}`);
            }
        });
    })();

    console.log('\n✅ Limpeza concluída com sucesso!');
} catch (error) {
    console.error('\n❌ Erro durante a limpeza:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}

// 5. Verificar tabelas após reset
console.log('\n📊 Tabelas após reset:');
const tablesAfter = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
`).all();
tablesAfter.forEach(t => console.log(`   - ${t.name}`));

// 6. Verificar views após reset
const viewsAfter = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='view'
    ORDER BY name
`).all();
if (viewsAfter.length > 0) {
    console.log('\n👁️  Views remanescentes:');
    viewsAfter.forEach(v => console.log(`   - ${v.name}`));
} else {
    console.log('\n✅ Todas as views foram removidas');
}

// 7. Contar registros na tabela marcos
try {
    const marcosCount = db.prepare('SELECT COUNT(*) as total FROM marcos').get();
    console.log(`\n✅ Tabela 'marcos' preservada: ${marcosCount.total} registros`);
} catch (error) {
    console.log('\n⚠️  Tabela marcos não encontrada ou vazia');
}

db.close();

console.log('\n====================================');
console.log('✅ RESET CONCLUÍDO COM SUCESSO!');
console.log('====================================');
console.log('\n📌 Próximo passo:');
console.log('   npm run migrate');
console.log('\n📦 Backup salvo em:');
console.log(`   ${path.basename(backupPath)}`);
console.log('\n🔄 Para restaurar backup (se necessário):');
console.log(`   copy "${path.basename(backupPath)}" "marcos.db"`);
console.log('====================================\n');
