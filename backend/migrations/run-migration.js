const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ==========================================
// Script de Migração Automatizado
// ==========================================

const dbPath = path.join(__dirname, '../../database/marcos.db');
const migrationFile = path.join(__dirname, '001_create_integrated_schema.sql');

console.log('==========================================');
console.log('EXECUTANDO MIGRAÇÃO 001');
console.log('==========================================\n');

try {
    // Abrir conexão com o banco
    console.log('1️⃣ Conectando ao banco de dados...');
    const db = new Database(dbPath);
    console.log('✅ Conectado com sucesso!\n');

    // Ler arquivo SQL
    console.log('2️⃣ Lendo arquivo de migração...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`✅ Arquivo lido: ${migrationFile}\n`);

    // Fazer backup antes da migração
    console.log('3️⃣ Criando backup do banco de dados...');
    const backupPath = dbPath.replace('.db', `_backup_${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup criado: ${backupPath}\n`);

    // Verificar tabelas existentes ANTES
    console.log('4️⃣ Tabelas existentes ANTES da migração:');
    const tabelasAntes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
    `).all();
    tabelasAntes.forEach(t => console.log(`   - ${t.name}`));
    console.log('');

    // Executar migração
    console.log('5️⃣ Executando migração...');
    db.exec(sql);
    console.log('✅ Migração executada com sucesso!\n');

    // Verificar tabelas DEPOIS
    console.log('6️⃣ Tabelas existentes DEPOIS da migração:');
    const tabelasDepois = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
    `).all();
    tabelasDepois.forEach(t => console.log(`   - ${t.name}`));
    console.log('');

    // Verificar views criadas
    console.log('7️⃣ Views criadas:');
    const views = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='view'
        ORDER BY name
    `).all();
    views.forEach(v => console.log(`   - ${v.name}`));
    console.log('');

    // Verificar triggers criados
    console.log('8️⃣ Triggers criados:');
    const triggers = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='trigger'
        ORDER BY name
    `).all();
    triggers.forEach(t => console.log(`   - ${t.name}`));
    console.log('');

    // Verificar dados de teste
    console.log('9️⃣ Verificando dados de teste:');
    const clientesTeste = db.prepare('SELECT COUNT(*) as count FROM clientes').get();
    const propriedadesTeste = db.prepare('SELECT COUNT(*) as count FROM propriedades').get();
    const verticesTeste = db.prepare('SELECT COUNT(*) as count FROM vertices').get();
    const memoriaisTeste = db.prepare('SELECT COUNT(*) as count FROM memoriais_importados').get();

    console.log(`   - Clientes: ${clientesTeste.count}`);
    console.log(`   - Propriedades: ${propriedadesTeste.count}`);
    console.log(`   - Vértices: ${verticesTeste.count}`);
    console.log(`   - Memoriais: ${memoriaisTeste.count}`);
    console.log('');

    // Testar views
    console.log('🔟 Testando views criadas:');
    try {
        const viewTest = db.prepare('SELECT COUNT(*) as count FROM vw_propriedades_completas').get();
        console.log(`   ✅ vw_propriedades_completas: ${viewTest.count} registros`);
    } catch (err) {
        console.log(`   ❌ Erro ao testar view: ${err.message}`);
    }
    console.log('');

    // Fechar conexão
    db.close();

    console.log('==========================================');
    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('==========================================\n');
    console.log(`📁 Backup disponível em: ${backupPath}\n`);

} catch (error) {
    console.error('\n==========================================');
    console.error('❌ ERRO NA MIGRAÇÃO!');
    console.error('==========================================\n');
    console.error('Erro:', error.message);
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    console.error('\n⚠️ O banco de dados NÃO foi modificado.');
    console.error('⚠️ Se houver backup, você pode restaurá-lo.\n');
    process.exit(1);
}
