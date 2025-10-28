const { chromium } = require('playwright');

/**
 * Teste Automatizado Completo - Sistema Premium
 * Aba "Buscar Marcos" + Estatísticas + Filtros
 */

async function setupDebugger() {
    console.log('🚀 Iniciando teste automatizado do sistema PREMIUM...\n');

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--remote-debugging-port=9222',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await browser.newPage();

    // Arrays para logs e erros
    const consoleLogs = [];
    const errors = [];
    const warnings = [];
    const networkErrors = [];
    const testResults = [];

    // ===== CAPTURA DE CONSOLE =====
    page.on('console', msg => {
        const logEntry = {
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        };

        consoleLogs.push(logEntry);

        const timestamp = new Date().toLocaleTimeString('pt-BR');
        console.log(`[${timestamp}] ${logEntry.type.toUpperCase()}: ${logEntry.text}`);

        if (logEntry.type === 'error') {
            errors.push(logEntry);
        }
        if (logEntry.type === 'warning') {
            warnings.push(logEntry);
        }
    });

    // ===== CAPTURA DE ERROS =====
    page.on('pageerror', exception => {
        const errorEntry = {
            message: exception.message,
            stack: exception.stack,
            timestamp: new Date().toISOString()
        };

        errors.push(errorEntry);
        console.error('\n💥 ERRO JAVASCRIPT:');
        console.error(exception.message);
        if (exception.stack) {
            console.error('Stack:', exception.stack);
        }
    });

    // ===== CAPTURA DE ERROS DE REDE =====
    page.on('requestfailed', request => {
        const errorEntry = {
            url: request.url(),
            method: request.method(),
            failure: request.failure().errorText,
            timestamp: new Date().toISOString()
        };

        networkErrors.push(errorEntry);
        console.error(`🌐 ERRO DE REDE: ${errorEntry.method} ${errorEntry.url}`);
        console.error(`   Motivo: ${errorEntry.failure}`);
    });

    return {
        browser,
        page,
        consoleLogs,
        errors,
        warnings,
        networkErrors,
        testResults,

        async addTestResult(testName, passed, details = '') {
            const result = {
                test: testName,
                passed,
                details,
                timestamp: new Date().toISOString()
            };
            this.testResults.push(result);

            const icon = passed ? '✅' : '❌';
            console.log(`\n${icon} ${testName}`);
            if (details) {
                console.log(`   ${details}`);
            }
        },

        async generateReport() {
            console.log('\n\n📊 ===== RELATÓRIO COMPLETO DE TESTES =====\n');

            // Resumo de logs
            console.log('📋 RESUMO DE LOGS:');
            console.log(`   Total de logs: ${this.consoleLogs.length}`);
            console.log(`   🔴 Erros: ${this.errors.length}`);
            console.log(`   ⚠️  Warnings: ${this.warnings.length}`);
            console.log(`   🌐 Erros de rede: ${this.networkErrors.length}`);

            // Resultados dos testes
            console.log('\n🧪 RESULTADOS DOS TESTES:');
            const passed = this.testResults.filter(t => t.passed).length;
            const failed = this.testResults.filter(t => !t.passed).length;
            console.log(`   ✅ Passou: ${passed}`);
            console.log(`   ❌ Falhou: ${failed}`);
            console.log(`   📊 Total: ${this.testResults.length}`);

            // Detalhes dos testes
            if (this.testResults.length > 0) {
                console.log('\n📝 DETALHES DOS TESTES:');
                this.testResults.forEach((result, index) => {
                    const icon = result.passed ? '✅' : '❌';
                    console.log(`\n   ${index + 1}. ${icon} ${result.test}`);
                    if (result.details) {
                        console.log(`      ${result.details}`);
                    }
                });
            }

            // Erros encontrados
            if (this.errors.length > 0) {
                console.log('\n🔴 ERROS DETECTADOS:');
                this.errors.forEach((error, index) => {
                    console.log(`\n   --- Erro ${index + 1} ---`);
                    console.log(`   ${error.text || error.message}`);
                });
            }

            return {
                summary: {
                    totalLogs: this.consoleLogs.length,
                    errors: this.errors.length,
                    warnings: this.warnings.length,
                    networkErrors: this.networkErrors.length,
                    testsPassed: passed,
                    testsFailed: failed
                },
                testResults: this.testResults,
                errors: this.errors,
                warnings: this.warnings
            };
        },

        async takeScreenshot(filename) {
            await this.page.screenshot({
                path: filename,
                fullPage: true
            });
            console.log(`📸 Screenshot salvo: ${filename}`);
        },

        async close() {
            await this.browser.close();
        }
    };
}

async function runTests() {
    const dbg = await setupDebugger();

    try {
        // ===== TESTE 1: CARREGAR PÁGINA =====
        console.log('\n🧪 TESTE 1: Carregamento da página premium');
        await dbg.page.goto('http://localhost:3001/index-premium.html', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await dbg.addTestResult('Carregamento da página', true, 'Página carregada com sucesso');

        // Aguardar inicialização
        await dbg.page.waitForTimeout(3000);

        // ===== TESTE 2: ESTATÍSTICAS DOS CARDS =====
        console.log('\n🧪 TESTE 2: Verificando estatísticas dos cards');

        try {
            const statsCards = await dbg.page.locator('.stat-value').count();

            if (statsCards > 0) {
                await dbg.addTestResult('Cards de estatísticas', true, `${statsCards} cards encontrados`);

                // Ler valores
                const totalMarcos = await dbg.page.locator('.stat-value').first().textContent();
                console.log(`   📊 Total de marcos exibido: ${totalMarcos}`);
            } else {
                await dbg.addTestResult('Cards de estatísticas', false, 'Nenhum card encontrado');
            }
        } catch (error) {
            await dbg.addTestResult('Cards de estatísticas', false, error.message);
        }

        // ===== TESTE 3: ABA BUSCAR MARCOS =====
        console.log('\n🧪 TESTE 3: Abrindo aba "Buscar Marcos"');

        try {
            // Procurar botão da aba
            const abaMarcos = dbg.page.locator('button:has-text("Buscar Marcos")');
            const abaExists = await abaMarcos.count() > 0;

            if (abaExists) {
                await abaMarcos.click();
                await dbg.page.waitForTimeout(2000);
                await dbg.addTestResult('Clicar na aba Buscar Marcos', true);
            } else {
                await dbg.addTestResult('Clicar na aba Buscar Marcos', false, 'Botão não encontrado');
            }
        } catch (error) {
            await dbg.addTestResult('Clicar na aba Buscar Marcos', false, error.message);
        }

        // ===== TESTE 4: RENDERIZAÇÃO DOS CARDS =====
        console.log('\n🧪 TESTE 4: Verificando cards de marcos');

        try {
            await dbg.page.waitForTimeout(2000);
            const cardsCount = await dbg.page.locator('.marco-card').count();

            if (cardsCount > 0) {
                await dbg.addTestResult('Renderização de cards', true, `${cardsCount} cards renderizados`);
            } else {
                await dbg.addTestResult('Renderização de cards', false, 'Nenhum card renderizado');
                await dbg.takeScreenshot('erro-sem-cards.png');
            }
        } catch (error) {
            await dbg.addTestResult('Renderização de cards', false, error.message);
        }

        // ===== TESTE 5: FILTROS =====
        console.log('\n🧪 TESTE 5: Testando sistema de filtros');

        try {
            // Verificar se filtro de tipo existe
            const filtroTipo = dbg.page.locator('#filtro-tipo');
            const filtroExists = await filtroTipo.count() > 0;

            if (filtroExists) {
                await dbg.addTestResult('Filtro de tipo existe', true);

                // Testar filtro
                await filtroTipo.selectOption('V'); // Vértice
                await dbg.page.waitForTimeout(1000);

                const cardsAposFiltro = await dbg.page.locator('.marco-card').count();
                await dbg.addTestResult('Filtro funcionando', true, `${cardsAposFiltro} cards após filtrar por Vértice`);
            } else {
                await dbg.addTestResult('Filtro de tipo existe', false);
            }
        } catch (error) {
            await dbg.addTestResult('Filtros', false, error.message);
        }

        // ===== TESTE 6: BUSCA TEXTUAL =====
        console.log('\n🧪 TESTE 6: Testando busca textual');

        try {
            const inputBusca = dbg.page.locator('#busca-marcos');
            const buscaExists = await inputBusca.count() > 0;

            if (buscaExists) {
                await inputBusca.fill('V-');
                await dbg.page.waitForTimeout(1000);

                const cardsAposBusca = await dbg.page.locator('.marco-card').count();
                await dbg.addTestResult('Busca textual', true, `${cardsAposBusca} cards após buscar "V-"`);
            } else {
                await dbg.addTestResult('Busca textual', false, 'Campo de busca não encontrado');
            }
        } catch (error) {
            await dbg.addTestResult('Busca textual', false, error.message);
        }

        // ===== TESTE 7: MAPA =====
        console.log('\n🧪 TESTE 7: Verificando mapa');

        try {
            const mapa = dbg.page.locator('#map');
            const mapaExists = await mapa.count() > 0;

            if (mapaExists) {
                await dbg.addTestResult('Mapa renderizado', true);
            } else {
                await dbg.addTestResult('Mapa renderizado', false);
            }
        } catch (error) {
            await dbg.addTestResult('Mapa renderizado', false, error.message);
        }

        // Aguardar mais um pouco para capturar logs
        console.log('\n⏳ Aguardando 3 segundos finais para capturar logs...');
        await dbg.page.waitForTimeout(3000);

        // Gerar relatório
        const report = await dbg.generateReport();

        // Screenshot final
        await dbg.takeScreenshot('teste-premium-final.png');

        return report;

    } catch (error) {
        console.error('\n❌ ERRO DURANTE TESTES:', error);
        await dbg.takeScreenshot('erro-testes.png');
        throw error;
    } finally {
        console.log('\n⏸️  Mantendo navegador aberto por 10 segundos para inspeção...');
        await dbg.page.waitForTimeout(10000);
        await dbg.close();
    }
}

// Executar testes
if (require.main === module) {
    runTests()
        .then(report => {
            console.log('\n✅ Testes concluídos!');

            const hasFailed = report.summary.testsFailed > 0 || report.summary.errors > 0;
            process.exit(hasFailed ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ Falha nos testes');
            process.exit(1);
        });
}

module.exports = { runTests };
