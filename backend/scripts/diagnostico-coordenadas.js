const Database = require('better-sqlite3');
const path = require('path');

// Configuração
const DB_PATH = path.join(__dirname, '../../database/marcos.db');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  DIAGNÓSTICO DE COORDENADAS - SISTEMA COGEP               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const db = new Database(DB_PATH, { readonly: true });

// Função para detectar se coordenadas estão em formato geográfico (Lat/Long)
function isFormatoGeografico(e, n) {
    if (Math.abs(e) < 1000 && Math.abs(n) < 1000) {
        return true;
    }
    if (e >= -75 && e <= -30 && n >= -35 && n <= 6) {
        return true;
    }
    return false;
}

// Função para classificar coordenadas
function classificarCoordenada(e, n) {
    // Range UTM Zone 22S válido
    const utmValido = e >= 166000 && e <= 834000 && n >= 0 && n <= 10000000;

    if (e === null || n === null) {
        return { tipo: 'NULO', valido: false, descricao: 'Coordenadas ausentes' };
    }

    if (isFormatoGeografico(e, n)) {
        return { tipo: 'LAT/LONG', valido: false, descricao: 'Formato geográfico (graus decimais)' };
    }

    if (utmValido) {
        return { tipo: 'UTM', valido: true, descricao: 'UTM válido Zone 22S' };
    }

    return { tipo: 'INVÁLIDO', valido: false, descricao: 'Fora do range esperado' };
}

// Buscar todos os marcos
const marcos = db.prepare(`
    SELECT
        id, codigo, tipo, status_campo,
        coordenada_e, coordenada_n,
        coordenadas_validadas, erro_validacao
    FROM marcos
    WHERE ativo = 1
    ORDER BY status_campo, codigo
`).all();

console.log(`📊 Total de marcos no sistema: ${marcos.length}\n`);

// Estatísticas
const stats = {
    total: marcos.length,
    levantados: 0,
    pendentes: 0,
    utm_valido: 0,
    lat_long: 0,
    nulo: 0,
    invalido: 0
};

const problemas = {
    lat_long: [],
    invalido: [],
    nulo: []
};

marcos.forEach(marco => {
    const e = parseFloat(marco.coordenada_e);
    const n = parseFloat(marco.coordenada_n);

    if (marco.status_campo === 'LEVANTADO') stats.levantados++;
    if (marco.status_campo === 'PENDENTE') stats.pendentes++;

    const classif = classificarCoordenada(e, n);

    switch (classif.tipo) {
        case 'UTM':
            stats.utm_valido++;
            break;
        case 'LAT/LONG':
            stats.lat_long++;
            problemas.lat_long.push({ ...marco, e, n });
            break;
        case 'NULO':
            stats.nulo++;
            problemas.nulo.push(marco);
            break;
        case 'INVÁLIDO':
            stats.invalido++;
            problemas.invalido.push({ ...marco, e, n });
            break;
    }
});

// Relatório
console.log('📋 ESTATÍSTICAS GERAIS:\n');
console.log(`   Total de marcos: ${stats.total}`);
console.log(`   ├─ Levantados: ${stats.levantados}`);
console.log(`   └─ Pendentes: ${stats.pendentes}\n`);

console.log('🗺️  ANÁLISE DE COORDENADAS:\n');
console.log(`   ✅ UTM válido: ${stats.utm_valido} (${((stats.utm_valido/stats.total)*100).toFixed(1)}%)`);
console.log(`   ❌ Lat/Long: ${stats.lat_long} (${((stats.lat_long/stats.total)*100).toFixed(1)}%)`);
console.log(`   ⚠️  Inválido: ${stats.invalido} (${((stats.invalido/stats.total)*100).toFixed(1)}%)`);
console.log(`   ⏳ Nulo: ${stats.nulo} (${((stats.nulo/stats.total)*100).toFixed(1)}%)\n`);

// Detalhes dos problemas
if (stats.lat_long > 0) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARCOS COM LAT/LONG (DEVEM SER UTM)                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Total: ${stats.lat_long} marcos\n`);
    console.log('Primeiros 20:');
    console.table(problemas.lat_long.slice(0, 20).map(m => ({
        codigo: m.codigo,
        tipo: m.tipo,
        status: m.status_campo,
        E: m.e,
        N: m.n,
        problema: 'Lat/Long ao invés de UTM'
    })));

    // Range de valores
    const eValues = problemas.lat_long.map(m => m.e);
    const nValues = problemas.lat_long.map(m => m.n);

    console.log('\n📊 Range de valores Lat/Long encontrados:');
    console.log(`   E (Longitude): ${Math.min(...eValues).toFixed(4)} a ${Math.max(...eValues).toFixed(4)}`);
    console.log(`   N (Latitude): ${Math.min(...nValues).toFixed(4)} a ${Math.max(...nValues).toFixed(4)}\n`);
}

if (stats.invalido > 0) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARCOS COM COORDENADAS INVÁLIDAS                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Total: ${stats.invalido} marcos\n`);
    console.log('Primeiros 10:');
    console.table(problemas.invalido.slice(0, 10).map(m => ({
        codigo: m.codigo,
        tipo: m.tipo,
        status: m.status_campo,
        E: m.e,
        N: m.n,
        problema: 'Fora do range UTM válido'
    })));
}

if (stats.nulo > 0 && stats.pendentes < stats.nulo) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARCOS SEM COORDENADAS (NÃO PENDENTES)                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const nulosNaoPendentes = problemas.nulo.filter(m => m.status_campo !== 'PENDENTE');
    console.log(`Total: ${nulosNaoPendentes.length} marcos\n`);

    if (nulosNaoPendentes.length > 0) {
        console.table(nulosNaoPendentes.slice(0, 10).map(m => ({
            codigo: m.codigo,
            tipo: m.tipo,
            status: m.status_campo,
            problema: 'Sem coordenadas mas não é PENDENTE'
        })));
    }
}

// Recomendações
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  RECOMENDAÇÕES                                             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (stats.lat_long > 0) {
    console.log(`❌ CRÍTICO: ${stats.lat_long} marcos com Lat/Long ao invés de UTM`);
    console.log('   Ação: Execute o script de correção');
    console.log('   Comando: node corrigir-coordenadas-geograficas.js\n');
}

if (stats.invalido > 0) {
    console.log(`⚠️  ATENÇÃO: ${stats.invalido} marcos com coordenadas inválidas`);
    console.log('   Ação: Revisar manualmente ou revalidar\n');
}

if (stats.utm_valido === stats.levantados) {
    console.log('✅ PERFEITO: Todos os marcos LEVANTADOS têm coordenadas UTM válidas');
} else {
    console.log(`⚠️  ${stats.levantados - stats.utm_valido} marcos LEVANTADOS com problemas de coordenadas`);
}

// Distribuição por tipo
console.log('\n📊 DISTRIBUIÇÃO POR TIPO DE MARCO:\n');

const tipoV = marcos.filter(m => m.tipo === 'V');
const tipoM = marcos.filter(m => m.tipo === 'M');
const tipoP = marcos.filter(m => m.tipo === 'P');

console.log(`   Tipo V: ${tipoV.length} marcos`);
console.log(`   ├─ UTM válido: ${tipoV.filter(m => classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}`);
console.log(`   └─ Problemas: ${tipoV.filter(m => !classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}\n`);

console.log(`   Tipo M: ${tipoM.length} marcos`);
console.log(`   ├─ UTM válido: ${tipoM.filter(m => classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}`);
console.log(`   └─ Problemas: ${tipoM.filter(m => !classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}\n`);

console.log(`   Tipo P: ${tipoP.length} marcos`);
console.log(`   ├─ UTM válido: ${tipoP.filter(m => classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}`);
console.log(`   └─ Problemas: ${tipoP.filter(m => !classificarCoordenada(parseFloat(m.coordenada_e), parseFloat(m.coordenada_n)).valido).length}\n`);

console.log('─'.repeat(60));
console.log('✅ Diagnóstico concluído!\n');

db.close();
