/**
 * Script de Conversão UTM → Lat/Lng
 *
 * Converte coordenadas UTM (EPSG:31982) para Latitude/Longitude (EPSG:4326)
 * e preenche os campos latitude e longitude na tabela marcos_levantados
 */

const Database = require('better-sqlite3');
const proj4 = require('proj4');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURAÇÃO PROJ4 - SISTEMAS DE COORDENADAS
// ==========================================

// EPSG:31982 - SIRGAS 2000 / UTM Zone 22S (origem)
proj4.defs(
  'EPSG:31982',
  '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
);

// EPSG:4326 - WGS84 Geographic (destino) - já definido por padrão no proj4
// proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

console.log('✅ Sistemas de coordenadas configurados:');
console.log('   ORIGEM: EPSG:31982 (SIRGAS 2000 / UTM Zone 22S)');
console.log('   DESTINO: EPSG:4326 (WGS84 Geographic)\n');

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const DB_PATH = path.join(__dirname, '../../database/marcos.db');
const BACKUP_DIR = path.join(__dirname, '../backups');
const RELATORIOS_DIR = path.join(__dirname, '../relatorios');

// Limites geográficos do Paraná para validação
const PARANA_BOUNDS = {
  lat: { min: -27, max: -22 },  // Latitude
  lng: { min: -55, max: -48 }   // Longitude
};

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Cria timestamp formatado para nomes de arquivo
 */
function getTimestamp() {
  const agora = new Date();
  return agora.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
}

/**
 * Formata data/hora para exibição
 */
function getDataHoraFormatada() {
  const agora = new Date();
  return agora.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Cria diretórios necessários se não existirem
 */
function criarDiretorios() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('📁 Criado diretório: backend/backups/');
  }
  if (!fs.existsSync(RELATORIOS_DIR)) {
    fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
    console.log('📁 Criado diretório: backend/relatorios/');
  }
}

/**
 * Cria backup do banco de dados
 */
function criarBackup() {
  console.log('📦 Criando backup do banco de dados...');

  const timestamp = getTimestamp();
  const backupPath = path.join(BACKUP_DIR, `marcos_backup_${timestamp}.db`);

  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Backup criado: ${path.basename(backupPath)}\n`);
    return backupPath;
  } catch (erro) {
    console.error('❌ Erro ao criar backup:', erro.message);
    throw erro;
  }
}

/**
 * Converte coordenadas UTM para Lat/Lng
 * @param {number} e - Coordenada East (X) em metros
 * @param {number} n - Coordenada North (Y) em metros
 * @returns {Object|null} - {latitude, longitude} ou null se erro
 */
function converterUTMparaLatLng(e, n) {
  try {
    // Validar entrada
    if (!e || !n || isNaN(e) || isNaN(n)) {
      return { erro: 'Coordenadas inválidas (NaN ou null)' };
    }

    // Converter usando proj4
    // ATENÇÃO: proj4 retorna [longitude, latitude] nessa ordem!
    const [longitude, latitude] = proj4('EPSG:31982', 'EPSG:4326', [e, n]);

    // Validar resultado
    if (isNaN(latitude) || isNaN(longitude)) {
      return { erro: 'Resultado da conversão é NaN' };
    }

    if (!isFinite(latitude) || !isFinite(longitude)) {
      return { erro: 'Resultado da conversão é Infinity' };
    }

    // Validar se está dentro do Paraná
    if (latitude < PARANA_BOUNDS.lat.min || latitude > PARANA_BOUNDS.lat.max) {
      return {
        erro: 'Latitude fora do range do Paraná',
        latitude,
        longitude,
        esperado: `${PARANA_BOUNDS.lat.min}° a ${PARANA_BOUNDS.lat.max}°`
      };
    }

    if (longitude < PARANA_BOUNDS.lng.min || longitude > PARANA_BOUNDS.lng.max) {
      return {
        erro: 'Longitude fora do range do Paraná',
        latitude,
        longitude,
        esperado: `${PARANA_BOUNDS.lng.min}° a ${PARANA_BOUNDS.lng.max}°`
      };
    }

    // Sucesso!
    return { latitude, longitude };

  } catch (erro) {
    return { erro: `Exceção na conversão: ${erro.message}` };
  }
}

/**
 * Processa conversão de todos os marcos
 */
function processarConversao(db) {
  console.log('🔍 Buscando marcos para converter...\n');

  // Buscar marcos com coordenadas UTM
  const marcos = db.prepare(`
    SELECT id, codigo, coordenada_e, coordenada_n, latitude, longitude
    FROM marcos
    WHERE coordenada_e IS NOT NULL
      AND coordenada_n IS NOT NULL
      AND coordenada_e != 0
      AND coordenada_n != 0
    ORDER BY id
  `).all();

  console.log(`📊 Encontrados: ${marcos.length} marcos\n`);

  if (marcos.length === 0) {
    console.log('⚠️  Nenhum marco com coordenadas UTM encontrado!');
    return null;
  }

  // Preparar statement de update
  const updateStmt = db.prepare(`
    UPDATE marcos
    SET latitude = ?, longitude = ?
    WHERE id = ?
  `);

  // Estatísticas
  const stats = {
    total: marcos.length,
    sucessos: 0,
    falhas: 0,
    jaConvertidos: 0,
    erros: []
  };

  console.log('⚙️  Iniciando conversão...\n');

  // Processar cada marco
  marcos.forEach((marco, index) => {
    // Mostrar progresso a cada 100 marcos
    if ((index + 1) % 100 === 0 || index + 1 === marcos.length) {
      console.log(`   Processados: ${index + 1}/${marcos.length}`);
    }

    // Verificar se já tem lat/lng
    if (marco.latitude != null && marco.longitude != null) {
      // Validar se está no Paraná
      if (marco.latitude >= PARANA_BOUNDS.lat.min &&
          marco.latitude <= PARANA_BOUNDS.lat.max &&
          marco.longitude >= PARANA_BOUNDS.lng.min &&
          marco.longitude <= PARANA_BOUNDS.lng.max) {
        stats.jaConvertidos++;
        return; // Pular, já está correto
      }
    }

    // Converter
    const resultado = converterUTMparaLatLng(marco.coordenada_e, marco.coordenada_n);

    if (resultado.erro) {
      // Falha na conversão
      stats.falhas++;
      stats.erros.push({
        codigo: marco.codigo,
        utm_e: marco.coordenada_e,
        utm_n: marco.coordenada_n,
        lat_calculada: resultado.latitude || 'N/A',
        lng_calculada: resultado.longitude || 'N/A',
        motivo: resultado.erro
      });
    } else {
      // Sucesso - atualizar banco
      try {
        updateStmt.run(resultado.latitude, resultado.longitude, marco.id);
        stats.sucessos++;
      } catch (erro) {
        stats.falhas++;
        stats.erros.push({
          codigo: marco.codigo,
          utm_e: marco.coordenada_e,
          utm_n: marco.coordenada_n,
          lat_calculada: resultado.latitude,
          lng_calculada: resultado.longitude,
          motivo: `Erro ao atualizar banco: ${erro.message}`
        });
      }
    }
  });

  console.log('\n✅ CONVERSÃO CONCLUÍDA!\n');

  return stats;
}

/**
 * Gera relatórios em TXT e CSV
 */
function gerarRelatorios(stats, backupPath) {
  const timestamp = getTimestamp();

  // ==========================================
  // RELATÓRIO PRINCIPAL (TXT)
  // ==========================================
  const txtPath = path.join(RELATORIOS_DIR, `conversao_${timestamp}.txt`);

  const percentualSucesso = stats.total > 0
    ? ((stats.sucessos / stats.total) * 100).toFixed(1)
    : 0;

  const percentualFalha = stats.total > 0
    ? ((stats.falhas / stats.total) * 100).toFixed(1)
    : 0;

  const relatorioTxt = `
═══════════════════════════════════════════════════════════
RELATÓRIO DE CONVERSÃO UTM → LAT/LNG
═══════════════════════════════════════════════════════════
Data: ${getDataHoraFormatada()}

RESULTADO:
  ✅ Sucessos: ${stats.sucessos} (${percentualSucesso}%)
  ♻️  Já convertidos: ${stats.jaConvertidos}
  ❌ Falhas: ${stats.falhas} (${percentualFalha}%)
  📊 Total processado: ${stats.total}

VALIDAÇÃO:
  - Região: Paraná
  - Latitude: ${PARANA_BOUNDS.lat.min}° a ${PARANA_BOUNDS.lat.max}°
  - Longitude: ${PARANA_BOUNDS.lng.min}° a ${PARANA_BOUNDS.lng.max}°

ARQUIVOS:
  📁 Backup: ${backupPath}
  📁 Banco atualizado: ${DB_PATH}
═══════════════════════════════════════════════════════════
`;

  fs.writeFileSync(txtPath, relatorioTxt, 'utf8');
  console.log(`📄 Relatório TXT: ${path.basename(txtPath)}`);

  // ==========================================
  // RELATÓRIO DE ERROS (CSV)
  // ==========================================
  if (stats.erros.length > 0) {
    const csvPath = path.join(RELATORIOS_DIR, `erros_conversao_${timestamp}.csv`);

    const linhas = ['codigo,utm_e,utm_n,lat_calculada,lng_calculada,motivo'];

    stats.erros.forEach(erro => {
      linhas.push(
        `${erro.codigo},${erro.utm_e},${erro.utm_n},${erro.lat_calculada},${erro.lng_calculada},"${erro.motivo}"`
      );
    });

    fs.writeFileSync(csvPath, linhas.join('\n'), 'utf8');
    console.log(`📄 Relatório ERROS CSV: ${path.basename(csvPath)}`);
  }

  console.log('');
}

/**
 * Verificação final das estatísticas do banco
 */
function verificacaoFinal(db) {
  console.log('🔍 Verificação final...\n');

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(latitude) as com_latlng,
      COUNT(coordenada_e) as com_utm
    FROM marcos
  `).get();

  const percentualLatLng = stats.total > 0
    ? ((stats.com_latlng / stats.total) * 100).toFixed(1)
    : 0;

  const percentualUTM = stats.total > 0
    ? ((stats.com_utm / stats.total) * 100).toFixed(1)
    : 0;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('RELATÓRIO DE CONVERSÃO UTM → LAT/LNG');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Data: ${getDataHoraFormatada()}\n`);
  console.log('📊 ESTATÍSTICAS FINAIS:');
  console.log(`   Total de marcos: ${stats.total}`);
  console.log(`   Com Lat/Lng: ${stats.com_latlng} (${percentualLatLng}%)`);
  console.log(`   Com UTM: ${stats.com_utm} (${percentualUTM}%)`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Função principal
 */
async function executarConversao() {
  console.log('\n🔧 CONVERSÃO UTM → LAT/LNG\n');

  try {
    // 1. Criar diretórios
    criarDiretorios();

    // 2. Verificar se banco existe
    if (!fs.existsSync(DB_PATH)) {
      console.error(`❌ Banco de dados não encontrado em: ${DB_PATH}`);
      console.error('   Verifique se o caminho está correto.');
      process.exit(1);
    }

    // 3. Backup
    const backupPath = criarBackup();

    // 4. Conectar ao banco
    console.log('📂 Conectando ao banco de dados...');
    const db = new Database(DB_PATH);
    console.log('✅ Conectado ao banco\n');

    // 5. Processar conversão
    const stats = processarConversao(db);

    if (!stats) {
      db.close();
      console.log('⚠️  Nenhum marco processado. Encerrando.');
      process.exit(0);
    }

    // 6. Gerar relatórios
    console.log('📊 Gerando relatórios...\n');
    gerarRelatorios(stats, backupPath);

    // 7. Verificação final
    verificacaoFinal(db);

    // 8. Fechar banco
    db.close();

    // 9. Mensagem final
    console.log('✅ PROCESSO CONCLUÍDO COM SUCESSO!\n');

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Recarregar frontend: http://localhost:3000');
    console.log('   2. Ir para aba "Mapa"');
    console.log('   3. Recarregar com Ctrl+Shift+R');
    console.log('   4. Verificar se marcos aparecem no Paraná');
    console.log(`   5. Confirmar ~${stats.sucessos + stats.jaConvertidos} marcos visíveis no mapa\n`);

    // Exit code baseado nos resultados
    if (stats.falhas > 0) {
      console.log(`⚠️  ATENÇÃO: ${stats.falhas} marcos não foram convertidos`);
      console.log('   Verifique o relatório de erros para detalhes.\n');
      process.exit(1);
    }

  } catch (erro) {
    console.error('\n❌ ERRO DURANTE EXECUÇÃO:', erro.message);
    console.error(erro.stack);
    process.exit(1);
  }
}

// Executar
executarConversao();
