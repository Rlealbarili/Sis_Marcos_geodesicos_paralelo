const fs = require('fs');
const path = require('path');

// Configuração
const ARQUIVO_CONSOLIDADOS = path.join(__dirname, '../../marcos_consolidados.csv');
const ARQUIVO_INVALIDOS = path.join(__dirname, '../../marcos_invalidos.csv');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  VALIDADOR DE ARQUIVOS CSV - COGEP STABILIZER             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Função para parsear linha CSV
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

// Função para validar arquivo
function validarArquivo(arquivo, nomeArquivo) {
    console.log(`\n📂 Validando: ${nomeArquivo}`);
    console.log('━'.repeat(60));

    // Verificar se existe
    if (!fs.existsSync(arquivo)) {
        console.log(`❌ ERRO: Arquivo não encontrado!`);
        console.log(`   Caminho: ${arquivo}`);
        console.log(`   Solução: Colocar o arquivo na raiz do projeto\n`);
        return false;
    }

    console.log(`✅ Arquivo encontrado`);

    // Ler arquivo
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    const linhas = conteudo.split('\n').filter(l => l.trim());

    console.log(`📊 Total de linhas: ${linhas.length}`);

    // Validar cabeçalho
    const cabecalho = parseCSVLine(linhas[0]);
    console.log(`📋 Colunas no cabeçalho: ${cabecalho.length}`);

    if (cabecalho.length < 15) {
        console.log(`❌ ERRO: Cabeçalho deve ter pelo menos 15 colunas`);
        console.log(`   Encontradas: ${cabecalho.length}`);
        console.log(`   Esperadas: 15 (codigo, tipo, localizacao, metodo, limites, coordenada_e, desvio_e, coordenada_n, desvio_n, altitude_h, desvio_h, lote, data_levantamento, observacoes, origem)`);
        return false;
    }

    console.log(`✅ Cabeçalho válido`);
    console.log(`   Colunas: ${cabecalho.slice(0, 5).join(', ')}...`);

    // Validar primeiras 10 linhas
    console.log(`\n🔍 Validando primeiras 10 linhas de dados...`);

    let linhasValidas = 0;
    let linhasInvalidas = 0;
    const erros = [];

    for (let i = 1; i <= Math.min(10, linhas.length - 1); i++) {
        const campos = parseCSVLine(linhas[i]);

        if (campos.length < 15) {
            linhasInvalidas++;
            erros.push(`   Linha ${i}: ${campos.length} campos (esperado: 15)`);
        } else {
            linhasValidas++;
        }
    }

    if (linhasInvalidas > 0) {
        console.log(`⚠️  ${linhasInvalidas} linhas inválidas encontradas:`);
        erros.forEach(e => console.log(e));
    } else {
        console.log(`✅ Todas as linhas válidas (${linhasValidas} testadas)`);
    }

    // Validar distribuição de tipos
    console.log(`\n📈 Analisando distribuição de tipos...`);

    const tipos = { V: 0, M: 0, P: 0, outros: 0 };

    for (let i = 1; i < linhas.length; i++) {
        const campos = parseCSVLine(linhas[i]);
        if (campos.length >= 2) {
            const tipo = campos[1].toUpperCase();
            if (tipos.hasOwnProperty(tipo)) {
                tipos[tipo]++;
            } else {
                tipos.outros++;
            }
        }
    }

    console.log(`   Tipo V: ${tipos.V}`);
    console.log(`   Tipo M: ${tipos.M}`);
    console.log(`   Tipo P: ${tipos.P}`);
    if (tipos.outros > 0) {
        console.log(`   ⚠️  Outros: ${tipos.outros} (tipos não reconhecidos)`);
    }

    // Validar coordenadas (para consolidados)
    if (nomeArquivo.includes('consolidados')) {
        console.log(`\n🗺️  Validando coordenadas (arquivo LEVANTADOS)...`);

        let comCoordenadas = 0;
        let semCoordenadas = 0;

        for (let i = 1; i < Math.min(100, linhas.length); i++) {
            const campos = parseCSVLine(linhas[i]);
            if (campos.length >= 8) {
                const e = parseFloat(campos[5]);
                const n = parseFloat(campos[7]);

                if (!isNaN(e) && !isNaN(n) && e > 0 && n > 0) {
                    comCoordenadas++;
                } else {
                    semCoordenadas++;
                }
            }
        }

        const total = comCoordenadas + semCoordenadas;
        console.log(`   ✅ Com coordenadas: ${comCoordenadas}/${total} (${((comCoordenadas/total)*100).toFixed(1)}%)`);

        if (semCoordenadas > 0) {
            console.log(`   ⚠️  Sem coordenadas: ${semCoordenadas}/${total} (${((semCoordenadas/total)*100).toFixed(1)}%)`);
            console.log(`   Nota: Arquivo LEVANTADOS deve ter coordenadas em todos os registros`);
        }
    }

    // Resumo
    console.log(`\n📋 RESUMO:`);
    console.log(`   Total de registros: ${linhas.length - 1}`);
    console.log(`   Status: ${linhasInvalidas === 0 ? '✅ PRONTO PARA IMPORTAÇÃO' : '⚠️  VERIFICAR ERROS ACIMA'}`);

    return linhasInvalidas === 0;
}

// Executar validação
console.log('📁 Localizando arquivos CSV...\n');

const consolidadosOk = validarArquivo(ARQUIVO_CONSOLIDADOS, 'marcos_consolidados.csv');
const invalidosOk = validarArquivo(ARQUIVO_INVALIDOS, 'marcos_invalidos.csv');

// Resultado final
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  RESULTADO DA VALIDAÇÃO                                    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (consolidadosOk && invalidosOk) {
    console.log('✅ TODOS OS ARQUIVOS ESTÃO VÁLIDOS!');
    console.log('\n📌 Próximo passo:');
    console.log('   node importar-dados-consolidados.js');
    console.log('\n⚠️  ATENÇÃO: A importação irá DELETAR todos os marcos existentes!\n');
} else {
    console.log('❌ ERROS ENCONTRADOS!');
    console.log('\n📌 Ações necessárias:');
    if (!consolidadosOk) {
        console.log('   1. Corrigir: marcos_consolidados.csv');
    }
    if (!invalidosOk) {
        console.log('   2. Corrigir: marcos_invalidos.csv');
    }
    console.log('\n   Execute novamente este validador após as correções.\n');
    process.exit(1);
}
