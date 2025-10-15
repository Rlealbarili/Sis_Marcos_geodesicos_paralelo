const fs = require('fs');
const path = require('path');

console.log('====================================');
console.log('🧹 LIMPEZA DE MIGRAÇÕES EXTRAS');
console.log('====================================\n');

const migrationsPath = path.join(__dirname, 'migrations');
const docsPath = path.join(migrationsPath, 'docs');

// 1. Criar pasta docs se não existir
if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
    console.log('✅ Pasta migrations/docs/ criada');
} else {
    console.log('📁 Pasta migrations/docs/ já existe');
}

// 2. Mover EXAMPLES.sql para docs
const examplesFile = path.join(migrationsPath, 'EXAMPLES.sql');
const examplesTarget = path.join(docsPath, 'EXAMPLES.sql');

if (fs.existsSync(examplesFile)) {
    fs.renameSync(examplesFile, examplesTarget);
    console.log('✅ EXAMPLES.sql movido para migrations/docs/');
} else {
    console.log('⚠️  EXAMPLES.sql não encontrado (já foi movido?)');
}

// 3. Remover 002_add_status_campo.sql (duplicada)
const migration002 = path.join(migrationsPath, '002_add_status_campo.sql');

if (fs.existsSync(migration002)) {
    fs.unlinkSync(migration002);
    console.log('✅ 002_add_status_campo.sql removido (migração duplicada)');
} else {
    console.log('⚠️  002_add_status_campo.sql não encontrado (já foi removido?)');
}

// 4. Listar arquivos SQL restantes
console.log('\n📋 Migrações SQL restantes em migrations/:');
const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

if (files.length === 0) {
    console.log('   (nenhum arquivo SQL na raiz - correto!)');
} else {
    files.forEach(f => console.log(`   - ${f}`));
}

// 5. Listar arquivos em docs/
console.log('\n📚 Arquivos de documentação em migrations/docs/:');
if (fs.existsSync(docsPath)) {
    const docsFiles = fs.readdirSync(docsPath);
    if (docsFiles.length === 0) {
        console.log('   (nenhum arquivo)');
    } else {
        docsFiles.forEach(f => console.log(`   - ${f}`));
    }
}

// 6. Verificar estrutura final
console.log('\n📂 Estrutura final de migrations/:');
const allFiles = fs.readdirSync(migrationsPath);
allFiles.forEach(item => {
    const itemPath = path.join(migrationsPath, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    console.log(`   ${isDir ? '📁' : '📄'} ${item}`);
});

console.log('\n====================================');
console.log('✅ LIMPEZA CONCLUÍDA!');
console.log('====================================\n');

console.log('📌 Próximos passos:');
console.log('   1. npm run db:reset');
console.log('   2. npm run migrate');
console.log('   3. npm run migrate:verify\n');
