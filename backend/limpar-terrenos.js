const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/marcos.db');
const db = new Database(dbPath);

// Deletar terrenos importados de memoriais
const result = db.prepare("DELETE FROM poligonos WHERE codigo LIKE 'MAT-%' OR codigo LIKE 'MEM-%'").run();

console.log(`${result.changes} terrenos deletados.`);
db.close();