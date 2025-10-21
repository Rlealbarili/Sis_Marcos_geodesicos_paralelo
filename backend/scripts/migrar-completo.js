const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function executarMigracao() {
    console.log('🚀 MIGRAÇÃO COMPLETA: SQLITE → POSTGRESQL\n');

    const scripts = [
        { nome: 'Criar funções PostGIS', comando: 'node backend/database/criar-funcoes-postgis.js' },
        { nome: 'Exportar SQLite', comando: 'node backend/scripts/exportar-sqlite-csv.js' },
        { nome: 'Importar PostgreSQL', comando: 'node backend/scripts/importar-csv-postgres.js' },
        { nome: 'Validar migração', comando: 'node backend/scripts/validar-migracao.js' }
    ];

    for (const script of scripts) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📌 ${script.nome}`);
        console.log('='.repeat(60) + '\n');

        try {
            const { stdout, stderr } = await execPromise(script.comando);
            console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (error) {
            console.error(`❌ Erro ao executar: ${script.nome}`);
            console.error(error.message);
            if (error.stdout) console.log(error.stdout);
            if (error.stderr) console.error(error.stderr);
            process.exit(1);
        }
    }

    console.log('\n🎉 MIGRAÇÃO COMPLETA FINALIZADA!\n');
}

executarMigracao();
