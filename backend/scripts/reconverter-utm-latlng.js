/**
 * Script de Reconversão UTM → Lat/Lng
 *
 * Converte marcos com coordenadas UTM mas sem lat/lng usando validação PERMISSIVA
 */

const Database = require('better-sqlite3');
const proj4 = require('proj4');
const fs = require('fs');
const path = require('path');

console.log('\n🔄 RECONVERSÃO UTM → LAT/LNG\n');

// ============================================
// 1. CONFIGURAR PROJ4
// ============================================

proj4.defs('EPSG:31982', '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

console.log('✅ Sistemas de coordenadas configurados\n');

// ============================================
// 2. CONECTAR AO BANCO
// ============================================

const dbPath = path.join(__dirname, '../../database/marcos.db');
const db = new Database(dbPath);

console.log('📊 Analisando marcos sem conversão...\n');

// ============================================
// 3. BUSCAR MARCOS SEM LAT/LNG
// ============================================

const marcosSemConversao = db.prepare(`
    SELECT
        id,
        codigo,
        coordenada_e,
        coordenada_n,
        latitude,
        longitude
    FROM marcos_levantados
    WHERE coordenada_e IS NOT NULL
      AND coordenada_n IS NOT NULL
      AND (latitude IS NULL OR longitude IS NULL)
    ORDER BY id
`).all();

console.log(`Encontrados: ${marcosSemConversao.length} marcos para reconverter\n`);

if (marcosSemConversao.length === 0) {
    console.log('✅ Nenhum marco precisa de reconversão!');
    db.close();
    process.exit(0);
}

// Mostrar alguns exemplos
console.log('📋 Primeiros 5 marcos a processar:');
console.table(marcosSemConversao.slice(0, 5).map(m => ({
    codigo: m.codigo,
    utm_e: m.coordenada_e,
    utm_n: m.coordenada_n,
    lat_atual: m.latitude,
    lng_atual: m.longitude
})));
console.log('');

// ============================================
// 4. FUNÇÃO DE CONVERSÃO COM VALIDAÇÃO PERMISSIVA
// ============================================

function converterComValidacaoPermissiva(coordenada_e, coordenada_n) {
    try {
        // Converter
        const [longitude, latitude] = proj4('EPSG:31982', 'EPSG:4326',
            [parseFloat(coordenada_e), parseFloat(coordenada_n)]
        );

        // Validação MUITO PERMISSIVA (todo o Sul do Brasil + margens)
        const latValida = latitude >= -35 && latitude <= -18;  // Ampliado!
        const lngValida = longitude >= -60 && longitude <= -44; // Ampliado!

        if (!latValida || !lngValida || isNaN(latitude) || isNaN(longitude)) {
            return {
                latitude: null,
                longitude: null,
                valido: false,
                motivo: `Coordenadas fora do range: lat=${latitude.toFixed(4)}, lng=${longitude.toFixed(4)}`
            };
        }

        // Verificar se está especificamente no Paraná (apenas para estatística)
        const noParana = (
            latitude >= -27 && latitude <= -22 &&
            longitude >= -55 && longitude <= -48
        );

        return {
            latitude,
            longitude,
            valido: true,
            noParana,
            motivo: noParana ? 'Paraná' : 'Fora do PR mas válido'
        };

    } catch (error) {
        return {
            latitude: null,
            longitude: null,
            valido: false,
            motivo: `Erro: ${error.message}`
        };
    }
}

// ============================================
// 5. PROCESSAR CONVERSÕES
// ============================================

console.log('⚙️  Iniciando reconversão...\n');

let sucessos = 0;
let falhas = 0;
let noParana = 0;
let foraPR = 0;
const erros = [];

const stmtUpdate = db.prepare(`
    UPDATE marcos_levantados
    SET latitude = ?, longitude = ?
    WHERE id = ?
`);

marcosSemConversao.forEach((marco, index) => {
    const resultado = converterComValidacaoPermissiva(marco.coordenada_e, marco.coordenada_n);

    if (resultado.valido) {
        // Atualizar banco
        stmtUpdate.run(resultado.latitude, resultado.longitude, marco.id);
        sucessos++;

        if (resultado.noParana) {
            noParana++;
        } else {
            foraPR++;
        }

    } else {
        falhas++;
        erros.push({
            codigo: marco.codigo,
            utm_e: marco.coordenada_e,
            utm_n: marco.coordenada_n,
            motivo: resultado.motivo
        });
    }

    // Log de progresso
    if ((index + 1) % 50 === 0) {
        console.log(`   Processados: ${index + 1}/${marcosSemConversao.length}`);
    }
});

console.log(`\n✅ Reconversão concluída!\n`);

// ============================================
// 6. ESTATÍSTICAS FINAIS
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('RELATÓRIO DE RECONVERSÃO');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Data: ${new Date().toLocaleString('pt-BR')}\n`);

console.log('📊 RESULTADO:');
console.log(`   ✅ Sucessos: ${sucessos} (${((sucessos/marcosSemConversao.length)*100).toFixed(1)}%)`);
console.log(`   ❌ Falhas: ${falhas} (${((falhas/marcosSemConversao.length)*100).toFixed(1)}%)\n`);

console.log('📍 LOCALIZAÇÃO:');
console.log(`   🗺️  No Paraná: ${noParana}`);
console.log(`   🌎 Fora do PR (mas válido): ${foraPR}\n`);

// Verificação final no banco
const statsFinais = db.prepare(`
    SELECT
        COUNT(*) as total,
        COUNT(latitude) as com_latlng,
        COUNT(CASE WHEN latitude BETWEEN -27 AND -22 AND longitude BETWEEN -55 AND -48 THEN 1 END) as no_parana
    FROM marcos_levantados
`).get();

console.log('💾 BANCO DE DADOS ATUALIZADO:');
console.log(`   Total de marcos: ${statsFinais.total}`);
console.log(`   Com Lat/Lng: ${statsFinais.com_latlng} (${((statsFinais.com_latlng/statsFinais.total)*100).toFixed(1)}%)`);
console.log(`   No Paraná: ${statsFinais.no_parana}\n`);

console.log('═══════════════════════════════════════════════════════════\n');

// ============================================
// 7. SALVAR RELATÓRIOS
// ============================================

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const relatorioDir = path.join(__dirname, '../relatorios');

if (!fs.existsSync(relatorioDir)) {
    fs.mkdirSync(relatorioDir, { recursive: true });
}

// Relatório TXT
const relatorioTXT = `
RELATÓRIO DE RECONVERSÃO UTM → LAT/LNG
Data: ${new Date().toLocaleString('pt-BR')}

PROCESSAMENTO:
- Marcos processados: ${marcosSemConversao.length}
- Sucessos: ${sucessos} (${((sucessos/marcosSemConversao.length)*100).toFixed(1)}%)
- Falhas: ${falhas} (${((falhas/marcosSemConversao.length)*100).toFixed(1)}%)

LOCALIZAÇÃO:
- No Paraná: ${noParana}
- Fora do PR (válido): ${foraPR}
- Inválidos: ${falhas}

BANCO DE DADOS FINAL:
- Total de marcos: ${statsFinais.total}
- Com Lat/Lng: ${statsFinais.com_latlng} (${((statsFinais.com_latlng/statsFinais.total)*100).toFixed(1)}%)
- No Paraná: ${statsFinais.no_parana}

VALIDAÇÃO APLICADA:
- Latitude: -35° a -18° (todo Sul do Brasil + margens)
- Longitude: -60° a -44° (todo Sul do Brasil + margens)
`;

fs.writeFileSync(
    path.join(relatorioDir, `reconversao_${timestamp}.txt`),
    relatorioTXT.trim()
);

console.log(`📄 Relatório TXT salvo: reconversao_${timestamp}.txt`);

// Relatório CSV de erros
if (erros.length > 0) {
    const csvContent = [
        'codigo,utm_e,utm_n,motivo',
        ...erros.map(e => `"${e.codigo}",${e.utm_e},${e.utm_n},"${e.motivo}"`)
    ].join('\n');

    fs.writeFileSync(
        path.join(relatorioDir, `erros_reconversao_${timestamp}.csv`),
        csvContent
    );

    console.log(`📄 Relatório de erros salvo: erros_reconversao_${timestamp}.csv`);

    // Mostrar primeiros 5 erros
    if (erros.length > 0) {
        console.log('\n⚠️  PRIMEIROS 5 ERROS:');
        console.table(erros.slice(0, 5));
    }
}

console.log('\n✅ RECONVERSÃO CONCLUÍDA!\n');

// ============================================
// 8. INSTRUÇÕES FINAIS
// ============================================

console.log('🎯 PRÓXIMOS PASSOS:');
console.log('   1. Recarregar frontend: http://localhost:3000');
console.log('   2. Ir para aba "Mapa"');
console.log('   3. Recarregar com Ctrl+Shift+R');
console.log(`   4. Verificar se ~${statsFinais.com_latlng} marcos aparecem no mapa\n`);

if (foraPR > 0) {
    console.log(`⚠️  ATENÇÃO: ${foraPR} marcos estão FORA do Paraná mas foram convertidos.`);
    console.log('   Eles aparecem como válidos mas podem estar em SC, SP ou MS.');
    console.log('   Revise esses casos se necessário.\n');
}

db.close();
