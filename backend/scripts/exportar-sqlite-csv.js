const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('📤 EXPORTANDO SQLITE → CSV\n');

const dbPath = path.join(__dirname, '../../database/marcos.db');
const outputPath = path.join(__dirname, '../../database/export_marcos.csv');

try {
    const db = new Database(dbPath, { readonly: true });

    const levantados = db.prepare('SELECT * FROM marcos_levantados').all();

    console.log(`📊 Total de marcos no SQLite: ${levantados.length}\n`);

    if (levantados.length === 0) {
        console.log('⚠️  Nenhum marco encontrado no SQLite!\n');
        process.exit(0);
    }

    // Gerar CSV
    const headers = Object.keys(levantados[0]);
    const csvLines = [headers.join(',')];

    levantados.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            // Escapar aspas e envolver em aspas se tiver vírgula
            const str = String(value).replace(/"/g, '""');
            return str.includes(',') ? `"${str}"` : str;
        });
        csvLines.push(values.join(','));
    });

    fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');

    console.log(`✅ CSV criado: ${outputPath}`);
    console.log(`✅ Total exportado: ${levantados.length} marcos`);
    console.log(`✅ Tamanho: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB\n`);

    db.close();

} catch (error) {
    console.error('❌ Erro na exportação:', error.message);
    process.exit(1);
}
