const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/marcos.db');
const db = new Database(dbPath);

console.log('🔧 Reduzindo precisão de coordenadas...');
console.log('   coordenada_e: 2 casas decimais (~1cm em UTM)');
console.log('   coordenada_n: 2 casas decimais (~1cm em UTM)');
console.log('   altitude_h: 2 casas decimais (1cm)');

try {
  // Contar registros antes
  const countBefore = db.prepare('SELECT COUNT(*) as total FROM marcos').get();
  console.log(`\n📊 Total de marcos: ${countBefore.total}`);

  // Atualizar precisão - as coordenadas são strings com vírgula, então vamos arredondar os valores
  // Mantendo 2 casas decimais para coordenadas UTM (precisão de ~1cm)
  const updateStmt = db.prepare(`
    UPDATE marcos
    SET
      coordenada_e = CASE
        WHEN coordenada_e IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(coordenada_e, ',', '.') AS REAL), 2) AS TEXT)
        ELSE coordenada_e
      END,
      coordenada_n = CASE
        WHEN coordenada_n IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(coordenada_n, ',', '.') AS REAL), 2) AS TEXT)
        ELSE coordenada_n
      END,
      altitude_h = CASE
        WHEN altitude_h IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(altitude_h, ',', '.') AS REAL), 2) AS TEXT)
        ELSE altitude_h
      END,
      desvio_e = CASE
        WHEN desvio_e IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(desvio_e, ',', '.') AS REAL), 2) AS TEXT)
        ELSE desvio_e
      END,
      desvio_n = CASE
        WHEN desvio_n IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(desvio_n, ',', '.') AS REAL), 2) AS TEXT)
        ELSE desvio_n
      END,
      desvio_h = CASE
        WHEN desvio_h IS NOT NULL THEN
          CAST(ROUND(CAST(REPLACE(desvio_h, ',', '.') AS REAL), 2) AS TEXT)
        ELSE desvio_h
      END
    WHERE 1=1
  `);

  db.transaction(() => {
    const info = updateStmt.run();
    console.log(`\n✅ Atualizados ${info.changes} registros`);
  })();

  // Verificar tamanho do banco antes e depois do VACUUM
  const statsBefore = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  console.log(`\n📦 Tamanho do banco antes do VACUUM: ${(statsBefore.size / 1024 / 1024).toFixed(2)} MB`);

  // Vacuum para recuperar espaço
  console.log('🗜️  Executando VACUUM...');
  db.exec('VACUUM');

  const statsAfter = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  console.log(`📦 Tamanho do banco após VACUUM: ${(statsAfter.size / 1024 / 1024).toFixed(2)} MB`);

  const reduction = ((statsBefore.size - statsAfter.size) / statsBefore.size * 100).toFixed(1);
  console.log(`💾 Redução: ${reduction}%`);

  console.log('\n✅ Otimização de precisão concluída!');

  // Mostrar exemplo de registro atualizado
  console.log('\n📍 Exemplo de registro atualizado:');
  const sample = db.prepare('SELECT codigo, coordenada_e, coordenada_n, altitude_h FROM marcos LIMIT 1').get();
  console.log(`   Código: ${sample.codigo}`);
  console.log(`   Coordenada E: ${sample.coordenada_e}`);
  console.log(`   Coordenada N: ${sample.coordenada_n}`);
  console.log(`   Altitude: ${sample.altitude_h}`);

} catch (error) {
  console.error('❌ Erro:', error);
  process.exit(1);
} finally {
  db.close();
}
