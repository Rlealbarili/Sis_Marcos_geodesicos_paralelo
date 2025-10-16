const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ==========================================
// Migration: Otimização de Performance
// ==========================================

const dbPath = path.join(__dirname, '../../database/marcos.db');
const migrationFile = path.join(__dirname, '../migrations/005_optimize_performance.sql');

console.log('==========================================');
console.log('🚀 OTIMIZAÇÃO DE PERFORMANCE - SQLite');
console.log('==========================================\n');

try {
    // Abrir conexão com o banco
    console.log('1️⃣  Conectando ao banco de dados...');
    const db = new Database(dbPath);
    console.log('✅ Conectado com sucesso!\n');

    // Verificar tamanho atual
    const statsBefore = fs.statSync(dbPath);
    console.log(`📦 Tamanho atual: ${(statsBefore.size / 1024 / 1024).toFixed(2)} MB\n`);

    // Verificar configurações ANTES
    console.log('2️⃣  Configurações ANTES da otimização:');
    const configs = ['journal_mode', 'synchronous', 'cache_size', 'temp_store'];
    configs.forEach(config => {
        const result = db.prepare(`PRAGMA ${config}`).get();
        console.log(`   ${config}: ${Object.values(result)[0]}`);
    });
    console.log('');

    // Contar índices ANTES
    console.log('3️⃣  Índices ANTES:');
    const indexesBefore = db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index' AND tbl_name='marcos' AND sql IS NOT NULL
    `).get();
    console.log(`   Total: ${indexesBefore.count} índices\n`);

    // Ler arquivo SQL
    console.log('4️⃣  Lendo arquivo de migração...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`✅ Arquivo lido: 005_optimize_performance.sql\n`);

    // Executar migração
    console.log('5️⃣  Executando otimizações...');
    console.log('   ⚙️  Configurando WAL mode...');
    console.log('   ⚙️  Aumentando cache...');
    console.log('   ⚙️  Criando índices...');
    console.log('   ⚙️  Executando ANALYZE...');
    console.log('   ⚙️  Executando VACUUM...\n');

    db.exec(sql);
    console.log('✅ Migração executada com sucesso!\n');

    // Verificar configurações DEPOIS
    console.log('6️⃣  Configurações DEPOIS da otimização:');
    configs.forEach(config => {
        const result = db.prepare(`PRAGMA ${config}`).get();
        const value = Object.values(result)[0];
        console.log(`   ${config}: ${value}`);
    });
    console.log('');

    // Listar índices criados
    console.log('7️⃣  Índices criados:');
    const indexes = db.prepare(`
        SELECT name, sql FROM sqlite_master
        WHERE type='index' AND tbl_name='marcos' AND sql IS NOT NULL
        ORDER BY name
    `).all();

    indexes.forEach(idx => {
        console.log(`   ✓ ${idx.name}`);
    });
    console.log(`\n   Total: ${indexes.length} índices (+${indexes.length - indexesBefore.count} novos)\n`);

    // Verificar tamanho após VACUUM
    const statsAfter = fs.statSync(dbPath);
    console.log(`📦 Tamanho final: ${(statsAfter.size / 1024 / 1024).toFixed(2)} MB`);

    if (statsAfter.size < statsBefore.size) {
        const reduction = ((statsBefore.size - statsAfter.size) / statsBefore.size * 100).toFixed(1);
        console.log(`💾 Redução: ${reduction}%\n`);
    } else {
        console.log(`📈 Aumento devido aos índices (normal)\n`);
    }

    // Benchmark simples
    console.log('8️⃣  Testando performance...');
    const start = Date.now();
    const testQuery = db.prepare(`
        SELECT COUNT(*) as count
        FROM marcos
        WHERE ativo = 1 AND tipo = 'M'
    `).get();
    const elapsed = Date.now() - start;

    console.log(`   Query test: ${testQuery.count} marcos em ${elapsed}ms`);
    console.log(`   Performance: ${elapsed < 50 ? '✅ EXCELENTE' : elapsed < 200 ? '⚠️ ACEITÁVEL' : '❌ RUIM'}\n`);

    // Fechar conexão
    db.close();

    console.log('==========================================');
    console.log('✅ OTIMIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('==========================================\n');
    console.log('📊 Próximo passo: Execute analyze-performance.js para análise detalhada\n');

} catch (error) {
    console.error('\n==========================================');
    console.error('❌ ERRO NA OTIMIZAÇÃO!');
    console.error('==========================================\n');
    console.error('Erro:', error.message);
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    process.exit(1);
}
