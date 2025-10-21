/**
 * Script de Importação da PLANILHA_MESTRE_CONSOLIDADA.csv
 *
 * Importa dados limpos e consolidados da planilha mestre,
 * converte UTM → Lat/Lng e valida integridade dos dados
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const proj4 = require('proj4');

console.log('\n🔧 IMPORTAÇÃO DA PLANILHA MESTRE CONSOLIDADA\n');

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const CSV_PATH = 'C:\\CONTROLE MARCOS COGEP\\PLANILHA_MESTRE_CONSOLIDADA.csv';
const DB_PATH = path.join(__dirname, '../../database/marcos.db');
const BACKUP_DIR = path.join(__dirname, '../backups');
const RELATORIOS_DIR = path.join(__dirname, '../relatorios');

// ==========================================
// CONFIGURAÇÃO PROJ4
// ==========================================

// EPSG:31982 - SIRGAS 2000 / UTM Zone 22S
proj4.defs(
  'EPSG:31982',
  '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
);

console.log('✅ Sistema de coordenadas EPSG:31982 configurado\n');

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Gera timestamp formatado
 */
function getTimestamp() {
  const agora = new Date();
  return agora.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
}

/**
 * Converte UTM para Lat/Lng com validação permissiva
 */
function converterUTMparaLatLng(coordenada_e, coordenada_n) {
  try {
    const e = parseFloat(coordenada_e);
    const n = parseFloat(coordenada_n);

    if (isNaN(e) || isNaN(n)) {
      return { latitude: null, longitude: null, valido: false };
    }

    // Converter usando proj4
    const [longitude, latitude] = proj4('EPSG:31982', 'EPSG:4326', [e, n]);

    // Validar resultado (Paraná com margem de 2° para cobrir bordas)
    const latValida = latitude >= -29 && latitude <= -20;
    const lngValida = longitude >= -57 && longitude <= -46;

    if (latValida && lngValida && !isNaN(latitude) && !isNaN(longitude) && isFinite(latitude) && isFinite(longitude)) {
      return { latitude, longitude, valido: true };
    }

    return { latitude, longitude, valido: false };
  } catch (error) {
    return { latitude: null, longitude: null, valido: false, erro: error.message };
  }
}

/**
 * Extrai tipo (V, M, P) do código do marco
 */
function extrairTipo(codigo) {
  if (!codigo) return null;

  // Padrão: XXX-T-XXXX onde T é o tipo (V, M ou P)
  const match = codigo.match(/-([VMP])-/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Padrão alternativo: XXX- T XXXX (com espaços)
  const matchEspaco = codigo.match(/- ?([VMP]) ?/i);
  if (matchEspaco) {
    return matchEspaco[1].toUpperCase();
  }

  return null;
}

/**
 * Parse CSV line (manual para lidar com ponto-e-vírgula e vírgulas decimais)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Converte string com vírgula decimal para float
 */
function parseFloatBR(valor) {
  if (!valor || valor === '') return null;
  const valorStr = String(valor).replace(',', '.');
  const numero = parseFloat(valorStr);
  return isNaN(numero) ? null : numero;
}

// ==========================================
// ETAPA 1: BACKUP
// ==========================================

console.log('📦 Etapa 1/7: Criando backup...');

const timestamp = getTimestamp();

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const backupPath = path.join(BACKUP_DIR, `marcos_PRE_REIMPORT_${timestamp}.db`);

if (fs.existsSync(DB_PATH)) {
  fs.copyFileSync(DB_PATH, backupPath);
  const sizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Backup criado: ${path.basename(backupPath)} (${sizeMB} MB)\n`);
} else {
  console.log('⚠️  Banco não existe. Será criado durante a importação.\n');
}

// ==========================================
// ETAPA 2: VERIFICAR CSV
// ==========================================

console.log('📄 Etapa 2/7: Verificando arquivo CSV...');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ ERRO: Arquivo CSV não encontrado em:`);
  console.error(`   ${CSV_PATH}`);
  console.error('\nVerifique se:');
  console.error('   1. O arquivo existe nesse caminho');
  console.error('   2. O nome está correto: PLANILHA_MESTRE_CONSOLIDADA.csv');
  console.error('   3. Você tem permissão para acessar o arquivo');
  process.exit(1);
}

const csvSizeMB = (fs.statSync(CSV_PATH).size / (1024 * 1024)).toFixed(2);
console.log(`✅ CSV encontrado: ${csvSizeMB} MB`);
console.log(`   Localização: ${CSV_PATH}\n`);

// ==========================================
// ETAPA 3: CONECTAR E LIMPAR BANCO
// ==========================================

console.log('🗑️  Etapa 3/7: Limpando banco de dados atual...');

const db = new Database(DB_PATH);

try {
  const antes = db.prepare('SELECT COUNT(*) as total FROM marcos_levantados').get();
  console.log(`   Registros atuais em marcos_levantados: ${antes.total}`);
} catch (e) {
  console.log('   Tabela marcos_levantados não existe ou está vazia');
}

try {
  db.exec('DELETE FROM marcos_levantados');
  db.exec('DELETE FROM marcos_pendentes');
  console.log('✅ Tabelas limpas\n');
} catch (error) {
  console.log('⚠️  Tabelas não existem. Serão criadas durante a importação.\n');
}

// ==========================================
// ETAPA 4: LER CSV
// ==========================================

console.log('📄 Etapa 4/7: Lendo CSV...');

async function lerCSV() {
  return new Promise((resolve, reject) => {
    const registros = [];
    const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let headers = [];
    let linhaAtual = 0;

    rl.on('line', (line) => {
      linhaAtual++;

      if (linhaAtual === 1) {
        // Primeira linha = cabeçalho
        headers = parseCSVLine(line);
        console.log(`   Colunas encontradas: ${headers.length}`);
        return;
      }

      // Parse da linha
      const valores = parseCSVLine(line);

      // Criar objeto com base nos headers
      const registro = {};
      headers.forEach((header, index) => {
        registro[header] = valores[index] || null;
      });

      // Mapear colunas do CSV para nomes esperados
      const registroMapeado = {
        codigo: registro['Código'] || registro['codigo'],
        tipo: extrairTipo(registro['Código'] || registro['codigo']),
        municipio: registro['Localização'] || registro['municipio'],
        estado: 'PR',
        coordenada_e: registro['E'] || registro['coordenada_e'],
        coordenada_n: registro['N'] || registro['coordenada_n'],
        altitude: registro['H'] || registro['altitude'],
        metodo: registro['Método'] || registro['metodo'],
        precisao_horizontal: registro['dE'] || registro['precisao_horizontal'],
        precisao_vertical: registro['dN'] || registro['precisao_vertical'],
        data_levantamento: registro['Data'] || registro['data_levantamento'],
        status: registro['status_mapeamento'] || registro['status'] || 'LEVANTADO',
        observacoes: registro['observacoes'] || null
      };

      registros.push(registroMapeado);
    });

    rl.on('close', () => {
      console.log(`✅ CSV lido: ${registros.length} registros\n`);
      resolve(registros);
    });

    rl.on('error', (error) => {
      reject(error);
    });
  });
}

// ==========================================
// ETAPA 5: PROCESSAR E INSERIR
// ==========================================

async function processarRegistros(registros) {
  console.log('⚙️  Etapa 5/7: Processando e inserindo registros...\n');

  let sucessos = 0;
  let falhas = 0;
  let marcosLevantados = 0;
  let marcosPendentes = 0;
  let comLatLng = 0;
  let latLngValidos = 0;
  const erros = [];

  // Preparar statements SQL
  const stmtLevantado = db.prepare(`
    INSERT INTO marcos_levantados (
      codigo, tipo, municipio, estado,
      coordenada_e, coordenada_n, altitude,
      latitude, longitude,
      data_levantamento, metodo, precisao_horizontal, precisao_vertical,
      observacoes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stmtPendente = db.prepare(`
    INSERT INTO marcos_pendentes (
      codigo, tipo, municipio, estado, observacoes
    ) VALUES (?, ?, ?, ?, ?)
  `);

  // Processar em transação para performance
  const insertMany = db.transaction((registros) => {
    registros.forEach((registro, index) => {
      try {
        const codigo = registro.codigo?.trim();
        const tipo = registro.tipo?.trim();
        const status = registro.status?.trim() || 'LEVANTADO';

        // Validar campos obrigatórios
        if (!codigo || !tipo) {
          falhas++;
          erros.push({
            linha: index + 2,
            codigo: codigo || 'N/A',
            motivo: 'Código ou tipo ausente'
          });
          return;
        }

        // Determinar se tem coordenadas
        const temCoordenadas = registro.coordenada_e && registro.coordenada_n &&
                                registro.coordenada_e !== '' && registro.coordenada_n !== '';

        // Decidir tabela de destino
        if (status === 'PENDENTE' || !temCoordenadas) {
          // Inserir em marcos_pendentes
          stmtPendente.run(
            codigo,
            tipo,
            registro.municipio?.trim() || null,
            registro.estado?.trim() || 'PR',
            registro.observacoes?.trim() || null
          );
          marcosPendentes++;
          sucessos++;
        } else {
          // Inserir em marcos_levantados
          const coordenada_e = parseFloatBR(registro.coordenada_e);
          const coordenada_n = parseFloatBR(registro.coordenada_n);

          // Converter para lat/lng
          const { latitude, longitude, valido } = converterUTMparaLatLng(coordenada_e, coordenada_n);

          if (latitude !== null && longitude !== null) {
            comLatLng++;
            if (valido) {
              latLngValidos++;
            } else {
              erros.push({
                linha: index + 2,
                codigo,
                motivo: 'Lat/Lng fora do range do Paraná',
                detalhes: `lat=${latitude?.toFixed(6)}, lng=${longitude?.toFixed(6)}`
              });
            }
          } else {
            erros.push({
              linha: index + 2,
              codigo,
              motivo: 'Conversão lat/lng falhou',
              detalhes: `utm_e=${coordenada_e}, utm_n=${coordenada_n}`
            });
          }

          stmtLevantado.run(
            codigo,
            tipo,
            registro.municipio?.trim() || null,
            registro.estado?.trim() || 'PR',
            coordenada_e,
            coordenada_n,
            parseFloatBR(registro.altitude),
            latitude,
            longitude,
            registro.data_levantamento || null,
            registro.metodo?.trim() || null,
            parseFloatBR(registro.precisao_horizontal),
            parseFloatBR(registro.precisao_vertical),
            registro.observacoes?.trim() || null,
            status
          );
          marcosLevantados++;
          sucessos++;
        }

        // Log de progresso
        if ((index + 1) % 1000 === 0) {
          console.log(`   Processados: ${index + 1}/${registros.length}`);
        }

      } catch (error) {
        falhas++;
        erros.push({
          linha: index + 2,
          codigo: registro.codigo || 'N/A',
          motivo: error.message
        });
      }
    });
  });

  // Executar transação
  insertMany(registros);

  console.log(`\n✅ Sucessos: ${sucessos} (${((sucessos / registros.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Falhas: ${falhas} (${((falhas / registros.length) * 100).toFixed(1)}%)\n`);

  return {
    sucessos,
    falhas,
    erros,
    marcosLevantados,
    marcosPendentes,
    comLatLng,
    latLngValidos
  };
}

// ==========================================
// ETAPA 6: CRIAR ÍNDICES
// ==========================================

function criarIndices() {
  console.log('🔍 Etapa 6/7: Criando índices...');

  const indices = [
    'CREATE INDEX IF NOT EXISTS idx_codigo ON marcos_levantados(codigo)',
    'CREATE INDEX IF NOT EXISTS idx_tipo ON marcos_levantados(tipo)',
    'CREATE INDEX IF NOT EXISTS idx_municipio ON marcos_levantados(municipio)',
    'CREATE INDEX IF NOT EXISTS idx_coordenadas ON marcos_levantados(coordenada_e, coordenada_n)',
    'CREATE INDEX IF NOT EXISTS idx_latlng ON marcos_levantados(latitude, longitude)',
    'CREATE INDEX IF NOT EXISTS idx_status ON marcos_levantados(status)',
    'CREATE INDEX IF NOT EXISTS idx_codigo_pendente ON marcos_pendentes(codigo)',
    'CREATE INDEX IF NOT EXISTS idx_tipo_pendente ON marcos_pendentes(tipo)'
  ];

  indices.forEach(sql => db.exec(sql));

  console.log(`✅ ${indices.length} índices criados\n`);
  return indices.length;
}

// ==========================================
// ETAPA 7: VALIDAÇÃO FINAL
// ==========================================

function validarImportacao() {
  console.log('📊 Etapa 7/7: Validação final...\n');

  const statsLevantados = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(latitude) as com_latlng,
      COUNT(CASE WHEN latitude IS NOT NULL AND
                     latitude >= -29 AND latitude <= -20 AND
                     longitude >= -57 AND longitude <= -46
            THEN 1 END) as latlng_validos
    FROM marcos_levantados
  `).get();

  const statsPendentes = db.prepare(`
    SELECT COUNT(*) as total FROM marcos_pendentes
  `).get();

  const percentualLatLng = statsLevantados.total > 0
    ? ((statsLevantados.com_latlng / statsLevantados.total) * 100).toFixed(1)
    : 0;

  const percentualValidos = statsLevantados.com_latlng > 0
    ? ((statsLevantados.latlng_validos / statsLevantados.com_latlng) * 100).toFixed(1)
    : 0;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('VALIDAÇÃO DA IMPORTAÇÃO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📍 MARCOS LEVANTADOS:`);
  console.log(`   Total importados: ${statsLevantados.total}`);
  console.log(`   Com Lat/Lng: ${statsLevantados.com_latlng} (${percentualLatLng}%)`);
  console.log(`   Lat/Lng válidos: ${statsLevantados.latlng_validos} (${percentualValidos}%)`);

  console.log(`\n📋 MARCOS PENDENTES:`);
  console.log(`   Total: ${statsPendentes.total}`);

  console.log(`\n📊 TOTAL GERAL: ${statsLevantados.total + statsPendentes.total}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  return {
    ...statsLevantados,
    pendentes: statsPendentes.total
  };
}

// ==========================================
// RELATÓRIOS
// ==========================================

function gerarRelatorios(stats, resultado) {
  console.log('📄 Gerando relatórios...');

  if (!fs.existsSync(RELATORIOS_DIR)) {
    fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
  }

  // Relatório principal (TXT)
  const relatorioPath = path.join(RELATORIOS_DIR, `importacao_${timestamp}.txt`);
  const relatorio = `
═══════════════════════════════════════════════════════════
IMPORTAÇÃO DA PLANILHA MESTRE CONSOLIDADA
═══════════════════════════════════════════════════════════
Data: ${new Date().toLocaleString('pt-BR')}

📦 BACKUP:
   Arquivo: ${path.basename(backupPath)}
   Localização: ${backupPath}

📄 ORIGEM:
   Arquivo: ${CSV_PATH}
   Registros lidos: ${stats.sucessos + stats.falhas}

📊 PROCESSAMENTO:
   ✅ Sucessos: ${stats.sucessos} (${((stats.sucessos / (stats.sucessos + stats.falhas)) * 100).toFixed(1)}%)
   ❌ Falhas: ${stats.falhas} (${((stats.falhas / (stats.sucessos + stats.falhas)) * 100).toFixed(1)}%)

📍 DISTRIBUIÇÃO:
   Marcos Levantados: ${resultado.total}
   Marcos Pendentes: ${resultado.pendentes}

🌍 CONVERSÃO LAT/LNG:
   Com coordenadas: ${resultado.com_latlng} (${((resultado.com_latlng / resultado.total) * 100).toFixed(1)}%)
   Válidos no Paraná: ${resultado.latlng_validos} (${((resultado.latlng_validos / resultado.com_latlng) * 100).toFixed(1)}%)

💾 BANCO DE DADOS:
   Total de registros: ${resultado.total + resultado.pendentes}
   Índices criados: 8
   Status: ✅ OPERACIONAL

═══════════════════════════════════════════════════════════
`;

  fs.writeFileSync(relatorioPath, relatorio.trim());
  console.log(`✅ Relatório principal: ${path.basename(relatorioPath)}`);

  // Relatório de erros (CSV)
  if (stats.erros.length > 0) {
    const errosPath = path.join(RELATORIOS_DIR, `erros_importacao_${timestamp}.csv`);
    const linhas = ['linha,codigo,motivo,detalhes'];

    stats.erros.forEach(erro => {
      linhas.push(`${erro.linha},"${erro.codigo}","${erro.motivo}","${erro.detalhes || ''}"`);
    });

    fs.writeFileSync(errosPath, linhas.join('\n'));
    console.log(`✅ Relatório de erros: ${path.basename(errosPath)}`);
  }

  console.log('');
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

async function executarImportacao() {
  try {
    // Ler CSV
    const registros = await lerCSV();

    // Processar e inserir
    const stats = await processarRegistros(registros);

    // Criar índices
    criarIndices();

    // Validar
    const resultado = validarImportacao();

    // Gerar relatórios
    gerarRelatorios(stats, resultado);

    // Otimizar banco
    console.log('⚡ Otimizando banco de dados...');
    db.exec('VACUUM');
    db.exec('ANALYZE');
    console.log('✅ Banco otimizado\n');

    // Fechar banco
    db.close();

    // Resumo final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO! 🎉');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 RESUMO:');
    console.log(`   ✅ ${stats.sucessos} registros importados`);
    console.log(`   📍 ${resultado.total} marcos levantados`);
    console.log(`   📋 ${resultado.pendentes} marcos pendentes`);
    console.log(`   🌍 ${resultado.latlng_validos} com lat/lng válidos\n`);

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Recarregar frontend: http://localhost:3000');
    console.log('   2. Ir para aba "Mapa"');
    console.log('   3. Recarregar com Ctrl+Shift+R');
    console.log(`   4. Verificar se ~${resultado.latlng_validos} marcos aparecem no Paraná\n`);

  } catch (error) {
    console.error('\n❌ ERRO DURANTE IMPORTAÇÃO:', error.message);
    console.error(error.stack);
    db.close();
    process.exit(1);
  }
}

// Executar
executarImportacao();
