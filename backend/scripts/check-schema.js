const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/marcos.db');
const db = new Database(dbPath);

console.log('📊 Verificando estrutura da tabela marcos...\n');

// Obter schema da tabela
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='marcos'").get();
console.log('Schema da tabela:');
console.log(schema.sql);
console.log('\n');

// Obter colunas
const columns = db.pragma('table_info(marcos)');
console.log('Colunas da tabela:');
columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Verificar alguns dados
console.log('\n📍 Amostra de 3 registros:');
const sample = db.prepare('SELECT * FROM marcos LIMIT 3').all();
sample.forEach((row, i) => {
    console.log(`\nRegistro ${i + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
        if (value !== null && value !== '') {
            console.log(`  ${key}: ${value}`);
        }
    });
});

db.close();
