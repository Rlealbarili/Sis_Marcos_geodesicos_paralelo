const fs = require('fs');
const path = require('path');

console.log('====================================');
console.log('DIAGNÓSTICO DE EMERGÊNCIA');
console.log('====================================\n');

// Verificar arquivos críticos
const arquivosCriticos = [
    'frontend/script.js',
    'frontend/index.html',
    'frontend/styles.css',
    'backend/server.js'
];

arquivosCriticos.forEach(arquivo => {
    const caminho = path.join(process.cwd(), arquivo);

    if (fs.existsSync(caminho)) {
        const conteudo = fs.readFileSync(caminho, 'utf8');
        const linhas = conteudo.split('\n');
        const tamanhoKB = (conteudo.length / 1024).toFixed(2);

        console.log(`✅ ${arquivo}`);
        console.log(`   Linhas: ${linhas.length}`);
        console.log(`   Tamanho: ${tamanhoKB} KB`);

        // Verificar sintaxe JavaScript
        if (arquivo.endsWith('.js')) {
            try {
                // Verificar parênteses, chaves e colchetes balanceados
                let abreChaves = 0, fechaChaves = 0;
                let abreParenteses = 0, fechaParenteses = 0;
                let abreColchetes = 0, fechaColchetes = 0;

                for (const char of conteudo) {
                    if (char === '{') abreChaves++;
                    if (char === '}') fechaChaves++;
                    if (char === '(') abreParenteses++;
                    if (char === ')') fechaParenteses++;
                    if (char === '[') abreColchetes++;
                    if (char === ']') fechaColchetes++;
                }

                console.log(`   Chaves: ${abreChaves} abrem, ${fechaChaves} fecham`);
                console.log(`   Parênteses: ${abreParenteses} abrem, ${fechaParenteses} fecham`);
                console.log(`   Colchetes: ${abreColchetes} abrem, ${fechaColchetes} fecham`);

                if (abreChaves !== fechaChaves) {
                    console.log(`   ❌ ERRO: Chaves desbalanceadas!`);
                }
                if (abreParenteses !== fechaParenteses) {
                    console.log(`   ❌ ERRO: Parênteses desbalanceados!`);
                }
                if (abreColchetes !== fechaColchetes) {
                    console.log(`   ❌ ERRO: Colchetes desbalanceados!`);
                }

                // Verificar erros comuns
                if (conteudo.includes('function (')) {
                    const matches = conteudo.match(/function \(/g);
                    console.log(`   ⚠️ Funções anônimas encontradas: ${matches?.length || 0}`);
                }

                // Procurar por async/await órfãos
                const asyncCount = (conteudo.match(/async\s+function/g) || []).length;
                const awaitCount = (conteudo.match(/await\s+/g) || []).length;
                console.log(`   Async functions: ${asyncCount}, Awaits: ${awaitCount}`);

            } catch (error) {
                console.log(`   ❌ ERRO ao analisar: ${error.message}`);
            }
        }

        console.log('');

    } else {
        console.log(`❌ ${arquivo} NÃO ENCONTRADO\n`);
    }
});

// Verificar tamanho do script.js
const scriptPath = path.join(process.cwd(), 'frontend/script.js');
if (fs.existsSync(scriptPath)) {
    const stats = fs.statSync(scriptPath);
    const tamanhoMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('====================================');
    console.log('ANÁLISE DO SCRIPT.JS');
    console.log('====================================');
    console.log(`Tamanho: ${tamanhoMB} MB`);

    if (stats.size > 500000) {
        console.log('⚠️ ALERTA: script.js muito grande! Pode estar causando lentidão.');
    }

    // Contar funções
    const conteudo = fs.readFileSync(scriptPath, 'utf8');
    const funcoes = conteudo.match(/function\s+\w+\s*\(/g) || [];
    const asyncFuncoes = conteudo.match(/async\s+function\s+\w+\s*\(/g) || [];

    console.log(`Funções declaradas: ${funcoes.length}`);
    console.log(`Funções async: ${asyncFuncoes.length}`);

    // Listar todas as funções
    console.log('\nFunções encontradas:');
    funcoes.forEach(f => {
        console.log(`  - ${f}`);
    });
}

console.log('\n====================================');
console.log('FIM DO DIAGNÓSTICO');
console.log('====================================');
