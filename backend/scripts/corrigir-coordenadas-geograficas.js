const Database = require('better-sqlite3');
const path = require('path');
const proj4 = require('proj4');

// Configuração
const DB_PATH = path.join(__dirname, '../../database/marcos.db');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  CORREÇÃO URGENTE: LAT/LONG → UTM                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Conectar ao banco
const db = new Database(DB_PATH);

// Definir projeção
proj4.defs("EPSG:31982", "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

function isFormatoGeografico(e, n) {
    // Coordenadas UTM válidas: E > 100.000, N > 1.000.000
    // Coordenadas Lat/Long: -90 < valor < 90 ou -180 < valor < 180

    if (Math.abs(e) < 1000 && Math.abs(n) < 1000) {
        return true; // Claramente graus decimais
    }

    // Range Brasil: Lat -35 a 6, Lng -75 a -30
    if (e >= -75 && e <= -30 && n >= -35 && n <= 6) {
        return true;
    }

    return false;
}

function convertLatLngToUTM(lng, lat) {
    try {
        const utm = proj4('EPSG:4326', 'EPSG:31982', [lng, lat]);
        return { e: utm[0], n: utm[1] };
    } catch (error) {
        console.error(`Erro na conversão (${lng}, ${lat}):`, error.message);
        return null;
    }
}

// Buscar marcos com coordenadas suspeitas
const stmt = db.prepare(`
    SELECT id, codigo, coordenada_e, coordenada_n, status_campo
    FROM marcos
    WHERE status_campo = 'LEVANTADO'
      AND coordenada_e IS NOT NULL
      AND coordenada_n IS NOT NULL
      AND ativo = 1
`);

const marcos = stmt.all();

console.log(`📊 Total de marcos LEVANTADOS: ${marcos.length}\n`);

const problematicos = [];
const corretos = [];

marcos.forEach(marco => {
    const e = parseFloat(marco.coordenada_e);
    const n = parseFloat(marco.coordenada_n);

    if (isFormatoGeografico(e, n)) {
        problematicos.push({ ...marco, e, n });
    } else {
        corretos.push(marco);
    }
});

console.log(`✅ Marcos com UTM correto: ${corretos.length}`);
console.log(`❌ Marcos com Lat/Long errôneo: ${problematicos.length}\n`);

if (problematicos.length === 0) {
    console.log('🎉 Nenhuma correção necessária!\n');
    db.close();
    process.exit(0);
}

// Mostrar amostra
console.log('📋 AMOSTRA DOS PROBLEMÁTICOS (primeiros 10):');
console.table(problematicos.slice(0, 10).map(m => ({
    codigo: m.codigo,
    e_errado: m.e,
    n_errado: m.n,
    tipo: 'Lat/Long (graus)'
})));

console.log(`\n⚠️  ${problematicos.length} marcos serão corrigidos em 3 segundos...`);
console.log('Pressione Ctrl+C para CANCELAR\n');

setTimeout(() => {
    console.log('🔄 Iniciando correções...\n');

    const updateStmt = db.prepare(`
        UPDATE marcos
        SET coordenada_e = ?,
            coordenada_n = ?
        WHERE id = ?
    `);

    const logStmt = db.prepare(`
        INSERT INTO log_correcoes (
            marco_id, coordenada_e_antiga, coordenada_n_antiga,
            coordenada_e_nova, coordenada_n_nova, motivo, usuario
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Marcar marcos com conversão falhada como PENDENTE
    const toPendente = db.prepare(`
        UPDATE marcos
        SET status_campo = 'PENDENTE'
        WHERE id = ?
    `);

    let corrigidos = 0;
    let falhas = 0;

    const transaction = db.transaction(() => {
        problematicos.forEach((marco, index) => {
            const lng = marco.e; // longitude
            const lat = marco.n; // latitude

            const utm = convertLatLngToUTM(lng, lat);

            if (utm && utm.e > 166000 && utm.e < 834000 && utm.n > 0 && utm.n < 10000000) {
                // Registrar log
                logStmt.run(
                    marco.id,
                    lng,
                    lat,
                    utm.e,
                    utm.n,
                    'Conversão automática Lat/Long→UTM (correção emergencial)',
                    'SISTEMA-AUTO'
                );

                // Atualizar coordenadas
                updateStmt.run(utm.e, utm.n, marco.id);

                corrigidos++;

                if (corrigidos <= 5) {
                    console.log(`✅ ${marco.codigo}:`);
                    console.log(`   Lat/Long: (${lng}, ${lat})`);
                    console.log(`   UTM: (${utm.e.toFixed(2)}, ${utm.n.toFixed(2)})\n`);
                }
            } else {
                // Conversão falhou - marcar como PENDENTE
                toPendente.run(marco.id);
                falhas++;

                if (falhas <= 3) {
                    console.log(`❌ ${marco.codigo}: Conversão falhou, marcado como PENDENTE\n`);
                }
            }
        });
    });

    transaction();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  CORREÇÃO CONCLUÍDA                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n✅ Corrigidos: ${corrigidos}`);
    console.log(`❌ Falhas (marcados como PENDENTE): ${falhas}\n`);

    // Estatísticas finais
    const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
        levantados: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'LEVANTADO' AND ativo = 1").get().count,
        pendentes: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1").get().count
    };

    console.log('📊 ESTATÍSTICAS ATUALIZADAS:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Levantados: ${stats.levantados}`);
    console.log(`   Pendentes: ${stats.pendentes}\n`);

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Reiniciar o servidor Node.js');
    console.log('   2. Limpar cache do navegador (Ctrl+Shift+Del)');
    console.log('   3. Acessar o mapa novamente\n');

    db.close();
}, 3000);
