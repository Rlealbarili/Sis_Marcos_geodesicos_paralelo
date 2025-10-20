/**
 * Script de Correção de Coordenadas UTM
 *
 * Problema: Coordenadas UTM foram salvas sem ponto decimal
 * Exemplo: 650706.4918 → 6507064918
 *
 * Solução: Inserir ponto decimal na posição correta
 */

const Database = require('better-sqlite3');
const proj4 = require('proj4');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURAÇÃO PROJ4 - EPSG:31982
// ==========================================
proj4.defs(
  'EPSG:31982',
  '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
);

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const DB_PATH = path.join(__dirname, '../../database/marcos.db');
const BACKUP_DIR = path.join(__dirname, '../backups');
const RELATORIOS_DIR = path.join(__dirname, '../relatorios/correcao-coordenadas');

// Ranges válidos para UTM Zone 22S (Paraná)
const RANGES = {
  X: { min: 200000, max: 800000 },     // Easting
  Y: { min: 7000000, max: 7500000 }    // Northing (Paraná)
};

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Cria timestamp formatado
 */
function getTimestamp() {
  const agora = new Date();
  return agora.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
}

/**
 * Cria diretórios necessários
 */
function criarDiretorios() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  if (!fs.existsSync(RELATORIOS_DIR)) {
    fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
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
    console.log(`✅ Backup criado: ${path.basename(backupPath)}`);
    console.log(`   Localização: ${backupPath}\n`);
    return backupPath;
  } catch (erro) {
    console.error('❌ Erro ao criar backup:', erro.message);
    throw erro;
  }
}

/**
 * Valida se coordenadas estão no range UTM válido
 */
function validarUTM22S(x, y) {
  const erros = [];

  if (x < RANGES.X.min || x > RANGES.X.max) {
    erros.push(`X fora do range (${RANGES.X.min}-${RANGES.X.max}): ${x}`);
  }

  if (y < RANGES.Y.min || y > RANGES.Y.max) {
    erros.push(`Y fora do range (${RANGES.Y.min}-${RANGES.Y.max}): ${y}`);
  }

  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Corrige uma coordenada inserindo ponto decimal
 * NOVA LÓGICA: Verifica número de dígitos ANTES de validar range
 */
function corrigirCoordenada(valor, tipo) {
  const ranges = tipo === 'X' ? RANGES.X : RANGES.Y;

  // Converter para string e remover pontos existentes para contar dígitos
  const valorStr = String(valor).replace(/\./g, '');

  // PASSO 1: Verificar se coordenada precisa de correção baseado no número de dígitos
  // X deve ter 6-7 dígitos (ex: 650706 ou 6507064 com decimais)
  // Y deve ter 7-8 dígitos (ex: 7192063 ou 71920637 com decimais)
  // Se tem 10+ (X) ou 11+ (Y), falta ponto decimal
  const precisaCorrecaoPorDigitos = tipo === 'X' ? valorStr.length >= 10 : valorStr.length >= 11;

  if (!precisaCorrecaoPorDigitos) {
    // Número de dígitos é normal, verificar se está no range válido
    if (valor >= ranges.min && valor <= ranges.max) {
      return {
        corrigido: valor,
        valido: true,
        precisouCorrecao: false,
        motivo: 'Coordenada já válida'
      };
    } else {
      // Fora do range e não tem dígitos extras para corrigir
      return {
        corrigido: valor,
        valido: false,
        precisouCorrecao: false,
        motivo: `Fora do range válido (${ranges.min}-${ranges.max}) e sem dígitos extras para corrigir`
      };
    }
  }

  // PASSO 2: Coordenada tem dígitos demais - inserir ponto decimal
  let corrigido;
  let posicaoPonto;

  if (tipo === 'X') {
    // X (Easting): 6 dígitos antes do ponto
    // Exemplo: 6507064918 → 650706.4918
    posicaoPonto = 6;
    corrigido = parseFloat(
      valorStr.substring(0, posicaoPonto) + '.' + valorStr.substring(posicaoPonto)
    );
  } else {
    // Y (Northing): 7 dígitos antes do ponto
    // Exemplo: 71920637139 → 7192063.7139
    posicaoPonto = 7;
    corrigido = parseFloat(
      valorStr.substring(0, posicaoPonto) + '.' + valorStr.substring(posicaoPonto)
    );
  }

  // PASSO 3: Validar se resultado está no range esperado
  const validoRange = corrigido >= ranges.min && corrigido <= ranges.max;

  return {
    corrigido,
    valido: validoRange,
    precisouCorrecao: true,
    motivo: validoRange
      ? `Correção bem-sucedida: ${valor} → ${corrigido}`
      : `Resultado ${corrigido} ainda fora do range (${ranges.min}-${ranges.max})`
  };
}

/**
 * Converte UTM para Lat/Lng
 */
function utmParaLatLng(x, y) {
  try {
    const [longitude, latitude] = proj4('EPSG:31982', 'EPSG:4326', [x, y]);

    if (isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180) {
      return null;
    }

    return { latitude, longitude };
  } catch (erro) {
    console.error(`Erro ao converter (${x}, ${y}):`, erro.message);
    return null;
  }
}

/**
 * Analisa coordenadas problemáticas
 */
function analisarCoordenadas(db) {
  console.log('🔍 Analisando coordenadas problemáticas...\n');

  // Buscar todos os marcos da tabela marcos
  const marcos = db.prepare(`
    SELECT
      id, codigo, coordenada_e, coordenada_n, status_campo
    FROM marcos
    WHERE ativo = 1 AND status_campo = 'LEVANTADO'
  `).all();

  console.log(`📊 Total de marcos levantados: ${marcos.length}`);

  const stats = {
    total: marcos.length,
    coordenadasValidas: 0,
    xProblematico: 0,
    yProblematico: 0,
    ambosProblematicos: 0,
    problemasEncontrados: []
  };

  marcos.forEach(marco => {
    // Verificar X (coordenada_e)
    const xValido = marco.coordenada_e >= RANGES.X.min && marco.coordenada_e <= RANGES.X.max;
    if (!xValido) {
      stats.xProblematico++;
    }

    // Verificar Y (coordenada_n)
    const yValido = marco.coordenada_n >= RANGES.Y.min && marco.coordenada_n <= RANGES.Y.max;
    if (!yValido) {
      stats.yProblematico++;
    }

    if (xValido && yValido) {
      stats.coordenadasValidas++;
    }

    if (!xValido && !yValido) {
      stats.ambosProblematicos++;
      if (stats.problemasEncontrados.length < 10) {
        stats.problemasEncontrados.push({
          codigo: marco.codigo,
          x: marco.coordenada_e,
          y: marco.coordenada_n
        });
      }
    }
  });

  console.log('\n📈 ESTATÍSTICAS INICIAIS:');
  console.log(`   ✅ Coordenadas válidas: ${stats.coordenadasValidas}`);
  console.log(`   ❌ X fora do range: ${stats.xProblematico}`);
  console.log(`   ❌ Y fora do range: ${stats.yProblematico}`);
  console.log(`   ❌ Ambos problemáticos: ${stats.ambosProblematicos}\n`);

  if (stats.problemasEncontrados.length > 0) {
    console.log('🔎 Exemplos de coordenadas problemáticas:');
    stats.problemasEncontrados.forEach(p => {
      console.log(`   ${p.codigo}: X=${p.x}, Y=${p.y}`);
    });
    console.log('');
  }

  return stats;
}

/**
 * Processa correção de todos os marcos
 */
function corrigirTodosMarcas(db) {
  console.log('⚙️  Iniciando correção automática...\n');

  const marcos = db.prepare(`
    SELECT id, codigo, coordenada_e, coordenada_n, status_campo
    FROM marcos
    WHERE ativo = 1 AND status_campo = 'LEVANTADO'
  `).all();

  const resultados = {
    processados: 0,
    corrigidos: [],
    naoCorrigidos: [],
    jaValidos: 0
  };

  const updateStmt = db.prepare(`
    UPDATE marcos
    SET coordenada_e = ?, coordenada_n = ?
    WHERE id = ?
  `);

  marcos.forEach((marco, index) => {
    // Progresso
    if ((index + 1) % 100 === 0) {
      console.log(`   Processando... ${index + 1}/${marcos.length}`);
    }

    const xAtual = marco.coordenada_e;
    const yAtual = marco.coordenada_n;

    // Verificar se já está válido
    const validacaoAtual = validarUTM22S(xAtual, yAtual);
    if (validacaoAtual.valido) {
      resultados.jaValidos++;
      return;
    }

    // Tentar corrigir X
    const correcaoX = corrigirCoordenada(xAtual, 'X');

    // Tentar corrigir Y
    const correcaoY = corrigirCoordenada(yAtual, 'Y');

    const xFinal = correcaoX.valido ? correcaoX.corrigido : xAtual;
    const yFinal = correcaoY.valido ? correcaoY.corrigido : yAtual;

    // Validar resultado final
    const validacaoFinal = validarUTM22S(xFinal, yFinal);

    if (validacaoFinal.valido && (correcaoX.precisouCorrecao || correcaoY.precisouCorrecao)) {
      // Sucesso na correção
      updateStmt.run(xFinal, yFinal, marco.id);

      resultados.corrigidos.push({
        id: marco.id,
        codigo: marco.codigo,
        x_antigo: xAtual,
        y_antigo: yAtual,
        x_corrigido: xFinal,
        y_corrigido: yFinal,
        x_alterado: correcaoX.precisouCorrecao,
        y_alterado: correcaoY.precisouCorrecao
      });
    } else {
      // Falha na correção
      resultados.naoCorrigidos.push({
        id: marco.id,
        codigo: marco.codigo,
        coordenada_e: xAtual,
        coordenada_n: yAtual,
        motivo: validacaoFinal.erros.join('; ') || 'Não foi possível corrigir'
      });
    }

    resultados.processados++;
  });

  console.log(`\n✅ Processamento concluído!`);
  console.log(`   📊 Total processado: ${resultados.processados}`);
  console.log(`   ✅ Corrigidos: ${resultados.corrigidos.length}`);
  console.log(`   ⚠️  Não corrigidos: ${resultados.naoCorrigidos.length}`);
  console.log(`   ℹ️  Já válidos: ${resultados.jaValidos}\n`);

  return resultados;
}

/**
 * Valida conversão Lat/Lng para marcos corrigidos
 * (Não atualiza banco - backend faz conversão automaticamente ao retornar dados)
 */
function validarConversaoLatLng(marcosCorrigidos) {
  console.log('🌍 Validando conversão Lat/Lng para coordenadas corrigidas...\n');

  let convertidos = 0;
  let falhas = 0;

  marcosCorrigidos.forEach((marco, index) => {
    if ((index + 1) % 100 === 0) {
      console.log(`   Validando... ${index + 1}/${marcosCorrigidos.length}`);
    }

    const coords = utmParaLatLng(marco.x_corrigido, marco.y_corrigido);

    if (coords) {
      marco.latitude = coords.latitude;
      marco.longitude = coords.longitude;
      convertidos++;
    } else {
      marco.latitude = null;
      marco.longitude = null;
      falhas++;
    }
  });

  console.log(`\n✅ Validação concluída!`);
  console.log(`   ✅ Conversíveis: ${convertidos}`);
  console.log(`   ❌ Não conversíveis: ${falhas}`);
  console.log(`   💡 Backend converterá automaticamente ao retornar dados\n`);

  return { convertidos, falhas };
}

/**
 * Gera relatórios CSV e TXT
 */
function gerarRelatorios(statsIniciais, resultados, statsConversao) {
  console.log('📊 Gerando relatórios...\n');

  const timestamp = getTimestamp();

  // 1. CSV - Marcos corrigidos
  if (resultados.corrigidos.length > 0) {
    const csvCorrigidos = path.join(RELATORIOS_DIR, `marcos_corrigidos_${timestamp}.csv`);
    const linhas = [
      'codigo,x_antigo,y_antigo,x_corrigido,y_corrigido,latitude,longitude,x_alterado,y_alterado'
    ];

    resultados.corrigidos.forEach(m => {
      linhas.push(
        `${m.codigo},${m.x_antigo},${m.y_antigo},${m.x_corrigido},${m.y_corrigido},` +
        `${m.latitude || ''},${m.longitude || ''},${m.x_alterado ? 'Sim' : 'Não'},${m.y_alterado ? 'Sim' : 'Não'}`
      );
    });

    fs.writeFileSync(csvCorrigidos, linhas.join('\n'), 'utf8');
    console.log(`✅ Gerado: marcos_corrigidos_${timestamp}.csv`);
  }

  // 2. CSV - Marcos não corrigidos
  if (resultados.naoCorrigidos.length > 0) {
    const csvNaoCorrigidos = path.join(RELATORIOS_DIR, `marcos_nao_corrigidos_${timestamp}.csv`);
    const linhas = [
      'codigo,coordenada_e,coordenada_n,motivo'
    ];

    resultados.naoCorrigidos.forEach(m => {
      linhas.push(`${m.codigo},${m.coordenada_e},${m.coordenada_n},"${m.motivo}"`);
    });

    fs.writeFileSync(csvNaoCorrigidos, linhas.join('\n'), 'utf8');
    console.log(`✅ Gerado: marcos_nao_corrigidos_${timestamp}.csv`);
  }

  // 3. TXT - Relatório geral
  const txtRelatorio = path.join(RELATORIOS_DIR, `relatorio_geral_${timestamp}.txt`);

  const percentualCorrecao = resultados.processados > 0
    ? ((resultados.corrigidos.length / resultados.processados) * 100).toFixed(1)
    : 0;

  const relatorio = `
===========================================
RELATÓRIO DE CORREÇÃO DE COORDENADAS UTM
===========================================
Data: ${new Date().toLocaleString('pt-BR')}

ESTATÍSTICAS INICIAIS:
- Total de marcos levantados: ${statsIniciais.total}
- Coordenadas válidas: ${statsIniciais.coordenadasValidas}
- X fora do range: ${statsIniciais.xProblematico}
- Y fora do range: ${statsIniciais.yProblematico}
- Ambos problemáticos: ${statsIniciais.ambosProblematicos}

PROCESSAMENTO:
- Marcos analisados: ${resultados.processados}
- Marcos já válidos: ${resultados.jaValidos}
- Correções aplicadas: ${resultados.corrigidos.length} (${percentualCorrecao}%)
- Falhas na correção: ${resultados.naoCorrigidos.length}

VALIDAÇÃO CONVERSÃO LAT/LNG:
- Conversíveis: ${statsConversao.convertidos}
- Não conversíveis: ${statsConversao.falhas}
- Nota: Backend converte automaticamente ao retornar dados da API

RANGES UTILIZADOS:
- X (Easting): ${RANGES.X.min} - ${RANGES.X.max} metros
- Y (Northing): ${RANGES.Y.min} - ${RANGES.Y.max} metros

RESULTADO FINAL:
- Total de marcos válidos após correção: ${statsIniciais.coordenadasValidas + resultados.corrigidos.length}
- Marcos ainda com problemas: ${resultados.naoCorrigidos.length}

PRÓXIMAS AÇÕES:
${resultados.naoCorrigidos.length > 0
  ? `- Revisar manualmente os ${resultados.naoCorrigidos.length} casos pendentes
- Verificar origem dos dados com engenharia
- Atualizar sistema de importação para prevenir problema`
  : '- Nenhuma ação necessária - todos os marcos foram corrigidos!'
}

ARQUIVOS GERADOS:
${resultados.corrigidos.length > 0
  ? `✅ marcos_corrigidos_${timestamp}.csv (${resultados.corrigidos.length} registros)`
  : ''}
${resultados.naoCorrigidos.length > 0
  ? `✅ marcos_nao_corrigidos_${timestamp}.csv (${resultados.naoCorrigidos.length} registros)`
  : ''}
✅ relatorio_geral_${timestamp}.txt

BACKUP:
✅ Backup do banco criado antes da correção
   Localização: ${BACKUP_DIR}

===========================================
`;

  fs.writeFileSync(txtRelatorio, relatorio, 'utf8');
  console.log(`✅ Gerado: relatorio_geral_${timestamp}.txt\n`);

  console.log('📁 Relatórios salvos em:');
  console.log(`   ${RELATORIOS_DIR}\n`);
}

/**
 * Função principal
 */
async function executarCorrecao() {
  console.log('\n===========================================');
  console.log('🔧 CORREÇÃO DE COORDENADAS UTM');
  console.log('===========================================\n');

  try {
    // 1. Criar diretórios
    criarDiretorios();

    // 2. Backup
    const backupPath = criarBackup();

    // 3. Conectar ao banco
    console.log('📂 Conectando ao banco de dados...');
    const db = new Database(DB_PATH);
    console.log('✅ Conectado ao banco\n');

    // 4. Análise inicial
    const statsIniciais = analisarCoordenadas(db);

    // Confirmar execução se houver muitos problemas
    if (statsIniciais.ambosProblematicos > statsIniciais.total * 0.1) {
      console.log('⚠️  ATENÇÃO: Mais de 10% dos marcos têm problemas!');
      console.log('⚠️  Backup criado em:', backupPath);
      console.log('');
    }

    // 5. Correção
    const resultados = corrigirTodosMarcas(db);

    // 6. Validação Conversão Lat/Lng (para relatórios)
    const statsConversao = validarConversaoLatLng(resultados.corrigidos);

    // 7. Relatórios
    gerarRelatorios(statsIniciais, resultados, statsConversao);

    // 8. Fechar banco
    db.close();

    // 9. Resumo final
    console.log('===========================================');
    console.log('✅ PROCESSO CONCLUÍDO COM SUCESSO!');
    console.log('===========================================\n');

    console.log('📊 RESUMO:');
    console.log(`   ✅ ${resultados.corrigidos.length} marcos corrigidos`);
    console.log(`   ✅ ${statsConversao.convertidos} conversíveis para lat/lng`);

    if (resultados.naoCorrigidos.length > 0) {
      console.log(`   ⚠️  ${resultados.naoCorrigidos.length} marcos precisam revisão manual`);
    }

    const totalValidos = statsIniciais.coordenadasValidas + resultados.corrigidos.length;
    console.log(`\n🎯 RESULTADO FINAL:`);
    console.log(`   📍 ${totalValidos} marcos com coordenadas válidas no sistema`);
    console.log(`   🗺️  Esses marcos devem aparecer no mapa ao recarregar`);
    console.log(`   💡 Backend converterá para lat/lng automaticamente\n`);

    console.log('📁 Para visualizar os resultados:');
    console.log(`   1. Abrir: http://localhost:3000`);
    console.log(`   2. Ir para aba "Mapa"`);
    console.log(`   3. Recarregar: Ctrl+Shift+R\n`);

  } catch (erro) {
    console.error('\n❌ ERRO DURANTE EXECUÇÃO:', erro.message);
    console.error(erro.stack);
    process.exit(1);
  }
}

// Executar
executarCorrecao();
