const { chromium } = require('playwright');

/**
 * Configuração de Debugging Automatizado para Claude Code
 * Sistema de Marcos Geodésicos - COGEP
 */

async function setupAutomatedDebugger() {
    console.log('🚀 Iniciando debugger automatizado...');

    const browser = await chromium.launch({
        headless: false, // Mantém visível para debug
        args: [
            '--remote-debugging-port=9222',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await browser.newPage();

    // Arrays para armazenar logs
    const consoleLogs = [];
    const errors = [];
    const warnings = [];
    const networkErrors = [];

    // ===== CAPTURA DE CONSOLE LOGS =====
    page.on('console', msg => {
        const logEntry = {
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString(),
            location: msg.location()
        };

        consoleLogs.push(logEntry);

        // Formatação colorida no terminal
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const prefix = `[${timestamp}] ${logEntry.type.toUpperCase()}:`;

        console.log(`${prefix} ${logEntry.text}`);

        // Armazena erros e warnings separadamente
        if (logEntry.type === 'error') {
            errors.push(logEntry);
            console.error(`🔴 ERRO DETECTADO: ${logEntry.text}`);
            if (logEntry.location) {
                console.error(`   📍 Local: ${logEntry.location.url}:${logEntry.location.lineNumber}`);
            }
        }

        if (logEntry.type === 'warning') {
            warnings.push(logEntry);
            console.warn(`⚠️  WARNING: ${logEntry.text}`);
        }
    });

    // ===== CAPTURA DE ERROS JAVASCRIPT NÃO TRATADOS =====
    page.on('pageerror', exception => {
        const errorEntry = {
            message: exception.message,
            stack: exception.stack,
            timestamp: new Date().toISOString()
        };

        errors.push(errorEntry);
        console.error('💥 EXCEPTION NÃO TRATADA:');
        console.error(exception.message);
        console.error(exception.stack);
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
        console.error(`🌐 NETWORK ERROR: ${errorEntry.method} ${errorEntry.url}`);
        console.error(`   Motivo: ${errorEntry.failure}`);
    });

    // ===== MONITORAMENTO DE REQUISIÇÕES =====
    page.on('response', response => {
        if (response.status() >= 400) {
            console.warn(`⚠️  HTTP ${response.status()}: ${response.url()}`);
        }
    });

    return {
        browser,
        page,
        consoleLogs,
        errors,
        warnings,
        networkErrors,

        // Método para gerar relatório
        async generateReport() {
            console.log('\n📊 ===== RELATÓRIO DE DEBUGGING =====\n');
            console.log(`Total de logs: ${consoleLogs.length}`);
            console.log(`🔴 Erros: ${errors.length}`);
            console.log(`⚠️  Warnings: ${warnings.length}`);
            console.log(`🌐 Erros de rede: ${networkErrors.length}`);

            if (errors.length > 0) {
                console.log('\n🔴 DETALHES DOS ERROS:');
                errors.forEach((error, index) => {
                    console.log(`\n--- Erro ${index + 1} ---`);
                    console.log(error.text || error.message);
                    if (error.location) {
                        console.log(`Local: ${error.location.url}:${error.location.lineNumber}`);
                    }
                });
            }

            return {
                summary: {
                    totalLogs: consoleLogs.length,
                    errors: errors.length,
                    warnings: warnings.length,
                    networkErrors: networkErrors.length
                },
                errors,
                warnings,
                networkErrors,
                allLogs: consoleLogs
            };
        },

        // Método para screenshot
        async takeScreenshot(filename = 'debug-screenshot.png') {
            await page.screenshot({
                path: filename,
                fullPage: true
            });
            console.log(`📸 Screenshot salvo: ${filename}`);
            return filename;
        },

        // Método para cleanup
        async close() {
            await browser.close();
            console.log('🔚 Debugger encerrado');
        }
    };
}

// ===== FUNÇÃO PRINCIPAL DE TESTE =====
async function runDebugSession(url = 'http://localhost:3001') {
    const dbg = await setupAutomatedDebugger();

    try {
        console.log(`\n🌐 Navegando para: ${url}\n`);
        await dbg.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('✅ Página carregada\n');
        console.log('⏳ Aguardando 5 segundos para capturar logs...\n');

        // Aguarda 5 segundos para capturar logs de inicialização
        await dbg.page.waitForTimeout(5000);

        // Gera relatório
        const report = await dbg.generateReport();

        // Tira screenshot se houver erros
        if (report.errors.length > 0) {
            await dbg.takeScreenshot('error-screenshot.png');
        }

        return report;

    } catch (error) {
        console.error('❌ Erro durante teste:', error);
        await dbg.takeScreenshot('crash-screenshot.png');
        throw error;
    } finally {
        // Mantém o navegador aberto por mais 10 segundos para inspeção
        console.log('\n⏸️  Mantendo navegador aberto por 10 segundos para inspeção...');
        await dbg.page.waitForTimeout(10000);
        await dbg.close();
    }
}

// ===== EXECUÇÃO =====
if (require.main === module) {
    runDebugSession()
        .then(report => {
            console.log('\n✅ Sessão de debugging concluída');
            process.exit(report.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ Falha na sessão de debugging');
            process.exit(1);
        });
}

module.exports = { setupAutomatedDebugger, runDebugSession };
