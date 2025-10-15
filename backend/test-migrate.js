#!/usr/bin/env node

/**
 * Script de Teste do Sistema de Migrações
 * Execute: node backend/test-migrate.js
 */

const DatabaseMigrator = require('./migrate');
const path = require('path');
const fs = require('fs');

console.log('==========================================');
console.log('🧪 TESTE DO SISTEMA DE MIGRAÇÕES');
console.log('==========================================\n');

// Caminho do banco de teste
const testDbPath = path.join(__dirname, '../database/marcos_test.db');

// Limpar banco de teste se existir
if (fs.existsSync(testDbPath)) {
    console.log('🗑️  Removendo banco de teste anterior...');
    fs.unlinkSync(testDbPath);
}

try {
    console.log('1️⃣  Criando migrator de teste...');
    const migrator = new DatabaseMigrator(testDbPath);
    console.log('✅ Migrator criado!\n');

    console.log('2️⃣  Verificando tabela de controle...');
    const schemaTable = migrator.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_migrations'
    `).get();
    console.log(schemaTable ? '✅ Tabela schema_migrations existe!' : '❌ Tabela não encontrada!');
    console.log('');

    console.log('3️⃣  Verificando migrações pendentes...');
    const pending = migrator.getPendingMigrations();
    console.log(`📋 Encontradas ${pending.length} migração(ões) pendente(s):`);
    pending.forEach(file => console.log(`   - ${file}`));
    console.log('');

    console.log('4️⃣  Verificando migrações aplicadas...');
    const applied = migrator.getAppliedMigrations();
    console.log(`✅ Migrações aplicadas: ${applied.length}`);
    console.log('');

    console.log('5️⃣  Testando comando status...');
    migrator.status();
    console.log('');

    console.log('6️⃣  Testando comando verify (antes da migração)...');
    migrator.verify();
    console.log('');

    if (pending.length > 0) {
        console.log('7️⃣  Aplicando migrações pendentes...');
        migrator.migrate();
        console.log('');

        console.log('8️⃣  Verificando resultado...');
        migrator.verify();
        console.log('');

        console.log('9️⃣  Verificando se migração foi registrada...');
        const newApplied = migrator.getAppliedMigrations();
        console.log(`✅ Total de migrações aplicadas: ${newApplied.length}`);
        newApplied.forEach(m => console.log(`   - ${m.version}`));
        console.log('');

        console.log('🔟 Testando idempotência (aplicar novamente)...');
        migrator.migrate();
        console.log('');
    } else {
        console.log('⚠️  Nenhuma migração pendente para testar.');
        console.log('   Crie um arquivo em backend/migrations/ para testar.\n');
    }

    // Fechar conexão
    migrator.close();

    console.log('==========================================');
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('==========================================\n');

    console.log(`📁 Banco de teste criado em: ${testDbPath}`);
    console.log('💡 Para inspecionar: sqlite3 ' + testDbPath + '\n');

} catch (error) {
    console.error('\n==========================================');
    console.error('❌ TESTE FALHOU!');
    console.error('==========================================\n');
    console.error('Erro:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
}
