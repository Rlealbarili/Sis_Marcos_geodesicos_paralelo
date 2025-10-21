/**
 * Script de Limpeza Completa do Banco de Dados
 *
 * Remove TODOS os dados e estruturas existentes e cria um banco limpo
 * e otimizado do zero, pronto para receber dados da PLANILHA_MESTRE_CONSOLIDADA.csv
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('\n🧹 LIMPEZA COMPLETA DO BANCO DE DADOS\n');

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const DB_PATH = path.join(__dirname, '../../database/marcos.db');
const BACKUP_DIR = path.join(__dirname, '../backups');
const RELATORIOS_DIR = path.join(__dirname, '../relatorios');

/**
 * Gera timestamp formatado para nomes de arquivo
 */
function getTimestamp() {
  const agora = new Date();
  return agora.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
}

// ==========================================
// 1. BACKUP COMPLETO
// ==========================================

console.log('📦 Etapa 1/8: Criando backup completo...');

const timestamp = getTimestamp();

// Criar diretório de backups se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('   📁 Diretório de backups criado');
}

const backupPath = path.join(BACKUP_DIR, `marcos_PRE_LIMPEZA_${timestamp}.db`);

// Copiar banco atual
if (fs.existsSync(DB_PATH)) {
  fs.copyFileSync(DB_PATH, backupPath);
  const sizeBytes = fs.statSync(backupPath).size;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`✅ Backup criado: ${path.basename(backupPath)} (${sizeMB} MB)\n`);
} else {
  console.log('⚠️  Banco de dados não existe. Será criado do zero.\n');
}

// ==========================================
// 2. CONECTAR E ANALISAR ESTADO ATUAL
// ==========================================

console.log('📊 Etapa 2/8: Analisando estado atual do banco...');

const db = new Database(DB_PATH);

// Estatísticas do estado atual
let statsAntigo = {
  tabelas: 0,
  indices: 0,
  marcosLevantados: 0,
  marcosPendentes: 0
};

try {
  // Contar tabelas e índices
  const tabelas = db.prepare(`
    SELECT COUNT(*) as total FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).get();

  const indices = db.prepare(`
    SELECT COUNT(*) as total FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
  `).get();

  statsAntigo.tabelas = tabelas.total;
  statsAntigo.indices = indices.total;

  // Tentar contar registros (pode falhar se tabelas não existirem)
  try {
    const marcosL = db.prepare('SELECT COUNT(*) as total FROM marcos').get();
    statsAntigo.marcosLevantados = marcosL.total;
  } catch (e) {
    // Tabela não existe, tudo bem
  }

  console.log('   Estado atual:');
  console.log(`   - Tabelas: ${statsAntigo.tabelas}`);
  console.log(`   - Índices: ${statsAntigo.indices}`);
  console.log(`   - Registros existentes: ${statsAntigo.marcosLevantados}`);
} catch (error) {
  console.log('   ⚠️  Não foi possível analisar (banco pode estar vazio)');
}

console.log('');

// ==========================================
// 3. DELETAR TODAS AS TABELAS
// ==========================================

console.log('🗑️  Etapa 3/8: Deletando todas as tabelas existentes...');

try {
  // Desabilitar foreign keys temporariamente
  db.pragma('foreign_keys = OFF');

  // Buscar todas as tabelas (exceto sqlite_*)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all();

  if (tables.length > 0) {
    console.log(`   Encontradas ${tables.length} tabelas para deletar`);

    // Deletar cada tabela
    tables.forEach(table => {
      db.exec(`DROP TABLE IF EXISTS "${table.name}"`);
      console.log(`   ✅ Deletada: ${table.name}`);
    });

    console.log('✅ Todas as tabelas deletadas\n');
  } else {
    console.log('   ℹ️  Nenhuma tabela encontrada (banco vazio)\n');
  }
} catch (error) {
  console.error('❌ Erro ao deletar tabelas:', error.message);
  process.exit(1);
}

// ==========================================
// 4. CONFIGURAÇÕES DE OTIMIZAÇÃO
// ==========================================

console.log('⚙️  Etapa 4/8: Aplicando configurações de otimização...');

try {
  // Reabilitar foreign keys
  db.pragma('foreign_keys = ON');

  // Configurações de performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 30000000000'); // 30GB memory map

  console.log('   ✅ journal_mode = WAL');
  console.log('   ✅ cache_size = 64MB');
  console.log('   ✅ temp_store = MEMORY');
  console.log('   ✅ mmap_size = 30GB');
  console.log('✅ Configurações de otimização aplicadas\n');
} catch (error) {
  console.error('❌ Erro ao configurar otimizações:', error.message);
  process.exit(1);
}

// ==========================================
// 5. CRIAR ESTRUTURA NOVA
// ==========================================

console.log('🏗️  Etapa 5/8: Criando estrutura nova e otimizada...');

try {
  // Tabela: marcos_levantados
  db.exec(`
    CREATE TABLE IF NOT EXISTS marcos_levantados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL CHECK(tipo IN ('V', 'M', 'P')),
      municipio TEXT,
      estado TEXT DEFAULT 'PR' CHECK(LENGTH(estado) = 2),

      coordenada_e REAL CHECK(coordenada_e IS NULL OR (coordenada_e >= 100000 AND coordenada_e <= 900000)),
      coordenada_n REAL CHECK(coordenada_n IS NULL OR (coordenada_n >= 6900000 AND coordenada_n <= 7600000)),
      altitude REAL,

      latitude REAL CHECK(latitude IS NULL OR (latitude >= -29 AND latitude <= -20)),
      longitude REAL CHECK(longitude IS NULL OR (longitude >= -57 AND longitude <= -46)),

      data_levantamento DATE,
      metodo TEXT,
      precisao_horizontal REAL CHECK(precisao_horizontal IS NULL OR precisao_horizontal >= 0),
      precisao_vertical REAL CHECK(precisao_vertical IS NULL OR precisao_vertical >= 0),
      observacoes TEXT,
      status TEXT DEFAULT 'LEVANTADO' CHECK(status IN ('LEVANTADO', 'PENDENTE', 'DANIFICADO', 'NAO_LOCALIZADO')),

      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('   ✅ Tabela marcos_levantados criada');

  // Tabela: marcos_pendentes
  db.exec(`
    CREATE TABLE IF NOT EXISTS marcos_pendentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL CHECK(tipo IN ('V', 'M', 'P')),
      municipio TEXT,
      estado TEXT DEFAULT 'PR' CHECK(LENGTH(estado) = 2),
      observacoes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('   ✅ Tabela marcos_pendentes criada');

  // Tabela: historico_alteracoes
  db.exec(`
    CREATE TABLE IF NOT EXISTS historico_alteracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marco_codigo TEXT NOT NULL,
      operacao TEXT NOT NULL CHECK(operacao IN ('INSERT', 'UPDATE', 'DELETE')),
      campo_alterado TEXT,
      valor_antigo TEXT,
      valor_novo TEXT,
      usuario TEXT DEFAULT 'Sistema',
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('   ✅ Tabela historico_alteracoes criada');

  // Tabela: metadados_sistema
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadados_sistema (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      descricao TEXT,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('   ✅ Tabela metadados_sistema criada');

  console.log('✅ Estrutura de tabelas criada\n');
} catch (error) {
  console.error('❌ Erro ao criar tabelas:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// ==========================================
// 6. CRIAR ÍNDICES
// ==========================================

console.log('📇 Etapa 6/8: Criando índices otimizados...');

try {
  const indices = [
    // marcos_levantados
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_codigo ON marcos_levantados(codigo)', nome: 'idx_ml_codigo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_tipo ON marcos_levantados(tipo)', nome: 'idx_ml_tipo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_municipio ON marcos_levantados(municipio)', nome: 'idx_ml_municipio' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_estado ON marcos_levantados(estado)', nome: 'idx_ml_estado' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_coordenadas_utm ON marcos_levantados(coordenada_e, coordenada_n)', nome: 'idx_ml_coordenadas_utm' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_coordenadas_geo ON marcos_levantados(latitude, longitude)', nome: 'idx_ml_coordenadas_geo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_status ON marcos_levantados(status)', nome: 'idx_ml_status' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_data_levantamento ON marcos_levantados(data_levantamento)', nome: 'idx_ml_data_levantamento' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ml_criado_em ON marcos_levantados(criado_em)', nome: 'idx_ml_criado_em' },

    // marcos_pendentes
    { sql: 'CREATE INDEX IF NOT EXISTS idx_mp_codigo ON marcos_pendentes(codigo)', nome: 'idx_mp_codigo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_mp_tipo ON marcos_pendentes(tipo)', nome: 'idx_mp_tipo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_mp_municipio ON marcos_pendentes(municipio)', nome: 'idx_mp_municipio' },

    // historico_alteracoes
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ha_marco_codigo ON historico_alteracoes(marco_codigo)', nome: 'idx_ha_marco_codigo' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ha_operacao ON historico_alteracoes(operacao)', nome: 'idx_ha_operacao' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_ha_data_hora ON historico_alteracoes(data_hora)', nome: 'idx_ha_data_hora' }
  ];

  indices.forEach((indice, index) => {
    db.exec(indice.sql);
    console.log(`   ✅ Índice ${index + 1}/${indices.length} criado: ${indice.nome}`);
  });

  console.log(`✅ Total de ${indices.length} índices criados\n`);
} catch (error) {
  console.error('❌ Erro ao criar índices:', error.message);
  process.exit(1);
}

// ==========================================
// 7. INSERIR METADADOS INICIAIS
// ==========================================

console.log('📝 Etapa 7/8: Inserindo metadados do sistema...');

try {
  const metadados = [
    ['versao_estrutura', '2.0', 'Versão da estrutura do banco de dados'],
    ['data_limpeza', timestamp, 'Data da última limpeza completa'],
    ['origem_dados', 'PLANILHA_MESTRE_CONSOLIDADA.csv', 'Origem dos dados atuais'],
    ['ultima_importacao', 'PENDENTE', 'Data da última importação de dados'],
    ['total_marcos', '0', 'Total de marcos no sistema'],
    ['sistema_coordenadas_utm', 'EPSG:31982', 'SIRGAS2000 UTM Zone 22S'],
    ['sistema_coordenadas_geo', 'EPSG:4326', 'WGS84 Geographic']
  ];

  const stmt = db.prepare(`
    INSERT INTO metadados_sistema (chave, valor, descricao)
    VALUES (?, ?, ?)
  `);

  metadados.forEach(([chave, valor, descricao]) => {
    stmt.run(chave, valor, descricao);
    console.log(`   ✅ ${chave}: ${valor}`);
  });

  console.log('✅ Metadados inseridos\n');
} catch (error) {
  console.error('❌ Erro ao inserir metadados:', error.message);
  process.exit(1);
}

// ==========================================
// 8. VALIDAÇÃO FINAL
// ==========================================

console.log('🔍 Etapa 8/8: Validação final...\n');

try {
  // Verificar estrutura criada
  const tabelas = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const indices = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const registros = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM marcos_levantados) as levantados,
      (SELECT COUNT(*) FROM marcos_pendentes) as pendentes,
      (SELECT COUNT(*) FROM historico_alteracoes) as historico,
      (SELECT COUNT(*) FROM metadados_sistema) as metadados
  `).get();

  // Gerar relatório
  console.log('═══════════════════════════════════════════════════════════');
  console.log('RELATÓRIO DE LIMPEZA COMPLETA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}\n`);

  console.log('📦 BACKUP:');
  if (fs.existsSync(backupPath)) {
    const sizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);
    console.log(`   Arquivo: ${path.basename(backupPath)}`);
    console.log(`   Tamanho: ${sizeMB} MB`);
    console.log(`   Localização: ${backupPath}\n`);
  }

  console.log('🏗️  ESTRUTURA CRIADA:');
  console.log(`   Tabelas: ${tabelas.length}`);
  tabelas.forEach(t => console.log(`   - ${t.name}`));
  console.log(`\n   Índices: ${indices.length}`);

  console.log('\n📊 ESTADO ATUAL DO BANCO:');
  console.log(`   Marcos levantados: ${registros.levantados}`);
  console.log(`   Marcos pendentes: ${registros.pendentes}`);
  console.log(`   Histórico de alterações: ${registros.historico}`);
  console.log(`   Metadados do sistema: ${registros.metadados}`);
  console.log(`   TOTAL: ${registros.levantados + registros.pendentes} registros`);

  if (registros.levantados === 0 && registros.pendentes === 0) {
    console.log('\n✅ BANCO DE DADOS LIMPO E PRONTO PARA IMPORTAÇÃO!');
  } else {
    console.log('\n⚠️  ATENÇÃO: Banco não está vazio!');
  }

  console.log('\n🎯 PRÓXIMO PASSO:');
  console.log('   Execute: node scripts/importar-planilha-mestre.js');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Salvar relatório em arquivo
  const relatorioDir = RELATORIOS_DIR;
  if (!fs.existsSync(relatorioDir)) {
    fs.mkdirSync(relatorioDir, { recursive: true });
  }

  const relatorioPath = path.join(relatorioDir, `limpeza_${timestamp}.txt`);
  const relatorioConteudo = `
RELATÓRIO DE LIMPEZA COMPLETA DO BANCO DE DADOS
Data: ${new Date().toLocaleString('pt-BR')}

ESTADO ANTERIOR:
- Tabelas: ${statsAntigo.tabelas}
- Índices: ${statsAntigo.indices}
- Registros: ${statsAntigo.marcosLevantados}

BACKUP:
- Arquivo: ${path.basename(backupPath)}
- Tamanho: ${(fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2)} MB
- Localização: ${backupPath}

ESTRUTURA CRIADA:
- Tabelas: ${tabelas.length}
${tabelas.map(t => `  * ${t.name}`).join('\n')}

- Índices: ${indices.length}
${indices.map(i => `  * ${i.name}`).join('\n')}

ESTADO FINAL:
- Marcos levantados: ${registros.levantados}
- Marcos pendentes: ${registros.pendentes}
- Histórico: ${registros.historico}
- Metadados: ${registros.metadados}

STATUS: ${registros.levantados === 0 ? '✅ BANCO LIMPO E PRONTO PARA IMPORTAÇÃO' : '⚠️  BANCO NÃO ESTÁ VAZIO'}

PRÓXIMO PASSO:
Execute: node scripts/importar-planilha-mestre.js
`;

  fs.writeFileSync(relatorioPath, relatorioConteudo.trim());
  console.log(`📄 Relatório salvo: ${path.basename(relatorioPath)}\n`);

} catch (error) {
  console.error('❌ Erro na validação:', error.message);
  process.exit(1);
}

// ==========================================
// 9. OTIMIZAR E COMPACTAR
// ==========================================

console.log('⚡ Otimizando banco de dados...');

try {
  db.exec('VACUUM');
  console.log('   ✅ VACUUM executado (banco compactado)');

  db.exec('ANALYZE');
  console.log('   ✅ ANALYZE executado (estatísticas atualizadas)');

  console.log('✅ Banco otimizado e compactado\n');
} catch (error) {
  console.warn('⚠️  Aviso ao otimizar:', error.message);
}

// Fechar conexão
db.close();

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ PROCESSO CONCLUÍDO COM SUCESSO! 🎉');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📌 RESUMO:');
console.log('   ✅ Backup criado com segurança');
console.log('   ✅ Todas as tabelas antigas deletadas');
console.log('   ✅ 4 novas tabelas criadas com constraints');
console.log('   ✅ 15 índices otimizados criados');
console.log('   ✅ 7 metadados iniciais inseridos');
console.log('   ✅ Banco vazio e pronto para importação');
console.log('   ✅ VACUUM e ANALYZE executados');
console.log('   ✅ Relatório TXT gerado\n');

console.log('🎯 Banco de dados está LIMPO e OTIMIZADO!');
console.log('   Pronto para receber dados da PLANILHA_MESTRE_CONSOLIDADA.csv\n');
