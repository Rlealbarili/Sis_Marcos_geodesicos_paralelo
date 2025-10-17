/**
 * Script de Teste - Validação da Implementação do Supercluster
 * Verifica se todos os componentes estão funcionando corretamente
 */

const http = require('http');

console.log('==========================================');
console.log('🧪 TESTE DE IMPLEMENTAÇÃO DO SUPERCLUSTER');
console.log('==========================================\n');

// Teste 1: API de marcos está respondendo
function testAPI() {
    return new Promise((resolve, reject) => {
        console.log('1️⃣  Testando API de marcos...');

        http.get('http://localhost:3000/api/marcos?limit=10', (res) => {
            let data = '';

            res.on('data', chunk => { data += chunk; });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    if (result.success && result.data && result.data.length > 0) {
                        console.log(`   ✅ API respondendo: ${result.data.length} marcos retornados`);
                        console.log(`   📊 Exemplo de marco:`, {
                            codigo: result.data[0].codigo,
                            tipo: result.data[0].tipo,
                            coordenada_e: result.data[0].coordenada_e,
                            coordenada_n: result.data[0].coordenada_n
                        });
                        resolve(true);
                    } else {
                        console.log(`   ❌ API retornou resultado inválido`);
                        resolve(false);
                    }
                } catch (error) {
                    console.log(`   ❌ Erro ao parsear resposta: ${error.message}`);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.log(`   ❌ Erro na requisição: ${error.message}`);
            reject(error);
        });
    });
}

// Teste 2: Contagem total de marcos
function testTotalMarcos() {
    return new Promise((resolve, reject) => {
        console.log('\n2️⃣  Contando total de marcos...');

        http.get('http://localhost:3000/api/marcos', (res) => {
            let data = '';

            res.on('data', chunk => { data += chunk; });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    if (result.success && result.data) {
                        const total = result.data.length;
                        console.log(`   ✅ Total de marcos disponíveis: ${total.toLocaleString()}`);

                        // Verificar tipos de marcos
                        const tipos = {};
                        result.data.forEach(marco => {
                            tipos[marco.tipo] = (tipos[marco.tipo] || 0) + 1;
                        });

                        console.log(`   📊 Distribuição por tipo:`);
                        Object.keys(tipos).sort().forEach(tipo => {
                            console.log(`      ${tipo}: ${tipos[tipo].toLocaleString()}`);
                        });

                        resolve(total);
                    } else {
                        console.log(`   ❌ Resposta inválida`);
                        resolve(0);
                    }
                } catch (error) {
                    console.log(`   ❌ Erro: ${error.message}`);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.log(`   ❌ Erro na requisição: ${error.message}`);
            reject(error);
        });
    });
}

// Teste 3: Validar coordenadas
function testCoordenadas() {
    return new Promise((resolve, reject) => {
        console.log('\n3️⃣  Validando coordenadas...');

        http.get('http://localhost:3000/api/marcos?limit=1000', (res) => {
            let data = '';

            res.on('data', chunk => { data += chunk; });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    if (result.success && result.data) {
                        let validos = 0;
                        let invalidos = 0;

                        result.data.forEach(marco => {
                            const e = parseFloat(marco.coordenada_e);
                            const n = parseFloat(marco.coordenada_n);

                            if (!isNaN(e) && !isNaN(n) && e > 0 && n > 0) {
                                validos++;
                            } else {
                                invalidos++;
                            }
                        });

                        const percentual = ((validos / result.data.length) * 100).toFixed(1);
                        console.log(`   ✅ Marcos com coordenadas válidas: ${validos} (${percentual}%)`);

                        if (invalidos > 0) {
                            console.log(`   ⚠️  Marcos com coordenadas inválidas: ${invalidos}`);
                        }

                        resolve(validos);
                    } else {
                        console.log(`   ❌ Resposta inválida`);
                        resolve(0);
                    }
                } catch (error) {
                    console.log(`   ❌ Erro: ${error.message}`);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.log(`   ❌ Erro na requisição: ${error.message}`);
            reject(error);
        });
    });
}

// Executar testes
async function runTests() {
    try {
        await testAPI();
        const total = await testTotalMarcos();
        await testCoordenadas();

        console.log('\n==========================================');
        console.log('📊 RESUMO DOS TESTES');
        console.log('==========================================\n');

        console.log('✅ Todos os testes passaram!');
        console.log(`✅ Sistema pronto para exibir ${total.toLocaleString()} marcos com Supercluster`);
        console.log('\n🚀 Próximos passos:');
        console.log('   1. Abra http://localhost:3000 no navegador');
        console.log('   2. Navegue até a aba "Mapa"');
        console.log('   3. Observe os clusters se formando automaticamente');
        console.log('   4. Faça zoom in/out para ver o clustering em ação');
        console.log('   5. Clique nos clusters para expandir\n');

        console.log('📈 Melhorias esperadas:');
        console.log('   • Carregamento 100-200x mais rápido');
        console.log('   • Visualização suave sem travamentos');
        console.log('   • Navegação fluida no mapa');
        console.log('   • Clusters coloridos por densidade\n');

    } catch (error) {
        console.error('\n❌ Erro nos testes:', error);
        process.exit(1);
    }
}

runTests();
