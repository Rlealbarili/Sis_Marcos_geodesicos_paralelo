const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/marcos.db');
const db = new Database(dbPath);

console.log('==========================================');
console.log('📊 ANÁLISE DE PERFORMANCE DO BANCO');
console.log('==========================================\n');

// ==========================================
// 1. VERIFICAR CONFIGURAÇÕES
// ==========================================
console.log('⚙️  Configurações do SQLite:');
const configs = [
  'journal_mode',
  'synchronous',
  'cache_size',
  'temp_store'
];

configs.forEach(config => {
  const result = db.prepare(`PRAGMA ${config}`).get();
  const value = Object.values(result)[0];
  let status = '';

  // Validar configurações ideais
  if (config === 'journal_mode' && value === 'wal') status = '✅';
  else if (config === 'synchronous' && value === 1) status = '✅'; // NORMAL
  else if (config === 'cache_size' && value <= -64000) status = '✅';
  else if (config === 'temp_store' && value === 2) status = '✅'; // MEMORY
  else status = '⚠️';

  console.log(`   ${status} ${config}: ${value}`);
});
console.log('');

// ==========================================
// 2. VERIFICAR ÍNDICES
// ==========================================
console.log('📇 Índices da tabela marcos:');
const indexes = db.prepare(`
  SELECT name, tbl_name
  FROM sqlite_master
  WHERE type = 'index' AND tbl_name = 'marcos' AND sql IS NOT NULL
  ORDER BY name
`).all();

if (indexes.length === 0) {
  console.log('   ❌ NENHUM ÍNDICE ENCONTRADO!\n');
} else {
  indexes.forEach(idx => {
    console.log(`   ✓ ${idx.name}`);
  });
  console.log(`\n   Total: ${indexes.length} índices\n`);
}

// ==========================================
// 3. ESTATÍSTICAS DA TABELA
// ==========================================
console.log('📈 Estatísticas da tabela:');
const stats = db.prepare(`
  SELECT
    COUNT(*) as total_marcos,
    COUNT(DISTINCT tipo) as tipos_diferentes,
    COUNT(DISTINCT localizacao) as localizacoes,
    COUNT(CASE WHEN coordenada_e IS NOT NULL AND coordenada_n IS NOT NULL THEN 1 END) as com_coordenadas
  FROM marcos
  WHERE ativo = 1
`).get();

console.log(`   Total de marcos: ${stats.total_marcos.toLocaleString()}`);
console.log(`   Com coordenadas: ${stats.com_coordenadas.toLocaleString()} (${((stats.com_coordenadas / stats.total_marcos) * 100).toFixed(1)}%)`);
console.log(`   Tipos diferentes: ${stats.tipos_diferentes}`);
console.log(`   Localizações diferentes: ${stats.localizacoes}\n`);

// ==========================================
// 4. QUERY PLAN ANALYSIS
// ==========================================
console.log('🔍 Análise do Query Plan (Bounding Box):');
const planBbox = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, codigo, tipo, coordenada_e, coordenada_n
  FROM marcos
  WHERE coordenada_e BETWEEN 630000 AND 650000
    AND coordenada_n BETWEEN 7180000 AND 7190000
    AND ativo = 1
  LIMIT 1000
`).all();

planBbox.forEach(step => {
  const detail = step.detail || '';
  if (detail.includes('USING INDEX')) {
    console.log(`   ✅ ${detail}`);
  } else if (detail.includes('SCAN')) {
    console.log(`   ❌ ${detail}`);
  } else {
    console.log(`   ℹ️  ${detail}`);
  }
});
console.log('');

// ==========================================
// 5. QUERY PLAN - TIPO + STATUS
// ==========================================
console.log('🔍 Análise do Query Plan (Tipo + Status):');
const planTipoStatus = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT id, codigo, tipo
  FROM marcos
  WHERE ativo = 1 AND tipo = 'M' AND status_campo = 'LEVANTADO'
  LIMIT 1000
`).all();

planTipoStatus.forEach(step => {
  const detail = step.detail || '';
  if (detail.includes('USING INDEX')) {
    console.log(`   ✅ ${detail}`);
  } else if (detail.includes('SCAN')) {
    console.log(`   ❌ ${detail}`);
  } else {
    console.log(`   ℹ️  ${detail}`);
  }
});
console.log('');

// ==========================================
// 6. BENCHMARKS
// ==========================================
console.log('⏱️  Benchmarks de Performance:\n');

// Benchmark 1: Busca por Bounding Box
console.log('   🗺️  Teste 1: Busca por Bounding Box (região)');
const start1 = Date.now();
const bbox = db.prepare(`
  SELECT id, codigo, tipo, coordenada_e, coordenada_n
  FROM marcos
  WHERE coordenada_e BETWEEN 630000 AND 650000
    AND coordenada_n BETWEEN 7180000 AND 7190000
    AND ativo = 1
  LIMIT 1000
`).all();
const elapsed1 = Date.now() - start1;
console.log(`      Resultados: ${bbox.length} marcos`);
console.log(`      Tempo: ${elapsed1}ms`);
console.log(`      Status: ${elapsed1 < 100 ? '✅ EXCELENTE (<100ms)' : elapsed1 < 500 ? '⚠️ ACEITÁVEL (<500ms)' : '❌ RUIM (>500ms)'}\n`);

// Benchmark 2: Busca por Tipo
console.log('   🏷️  Teste 2: Busca por Tipo');
const start2 = Date.now();
const porTipo = db.prepare(`
  SELECT id, codigo, tipo
  FROM marcos
  WHERE tipo = 'M' AND ativo = 1
  LIMIT 2000
`).all();
const elapsed2 = Date.now() - start2;
console.log(`      Resultados: ${porTipo.length} marcos`);
console.log(`      Tempo: ${elapsed2}ms`);
console.log(`      Status: ${elapsed2 < 50 ? '✅ EXCELENTE (<50ms)' : elapsed2 < 200 ? '⚠️ ACEITÁVEL (<200ms)' : '❌ RUIM (>200ms)'}\n`);

// Benchmark 3: Count com filtros
console.log('   🔢 Teste 3: Contagem com múltiplos filtros');
const start3 = Date.now();
const count = db.prepare(`
  SELECT COUNT(*) as total
  FROM marcos
  WHERE ativo = 1 AND tipo = 'M' AND status_campo = 'LEVANTADO'
`).get();
const elapsed3 = Date.now() - start3;
console.log(`      Resultados: ${count.total} marcos`);
console.log(`      Tempo: ${elapsed3}ms`);
console.log(`      Status: ${elapsed3 < 50 ? '✅ EXCELENTE (<50ms)' : elapsed3 < 200 ? '⚠️ ACEITÁVEL (<200ms)' : '❌ RUIM (>200ms)'}\n`);

// Benchmark 4: Busca textual
console.log('   🔤 Teste 4: Busca textual por localização');
const start4 = Date.now();
const textSearch = db.prepare(`
  SELECT id, codigo, localizacao
  FROM marcos
  WHERE localizacao LIKE '%CURITIBA%' AND ativo = 1
  LIMIT 1000
`).all();
const elapsed4 = Date.now() - start4;
console.log(`      Resultados: ${textSearch.length} marcos`);
console.log(`      Tempo: ${elapsed4}ms`);
console.log(`      Status: ${elapsed4 < 100 ? '✅ EXCELENTE (<100ms)' : elapsed4 < 500 ? '⚠️ ACEITÁVEL (<500ms)' : '❌ RUIM (>500ms)'}\n`);

// ==========================================
// 7. RESUMO GERAL
// ==========================================
console.log('==========================================');
console.log('📊 RESUMO GERAL');
console.log('==========================================\n');

const allTestsPassed = elapsed1 < 100 && elapsed2 < 50 && elapsed3 < 50 && elapsed4 < 100;

if (allTestsPassed) {
  console.log('✅ Todos os testes passaram com performance EXCELENTE!');
  console.log('✅ O banco está otimizado para 19.040+ marcos');
  console.log('✅ Pronto para implementar Supercluster no frontend\n');
} else {
  console.log('⚠️  Alguns testes não atingiram performance ideal');
  console.log('💡 Considere verificar:');
  console.log('   - Se o WAL mode está habilitado');
  console.log('   - Se todos os índices foram criados');
  console.log('   - Se o ANALYZE foi executado\n');
}

// Tamanho do banco
const fs = require('fs');
const dbStats = fs.statSync(dbPath);
console.log(`📦 Tamanho do banco: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB\n`);

db.close();
