const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

console.log('=€ SETUP COMPLETO DO SISTEMA (PORTA 5434)\n');
console.log('='.repeat(60) + '\n');

async function executar(comando, descricao) {
    console.log(`\n=Ì ${descricao}`);
    console.log(`=» ${comando}\n`);

    try {
        const { stdout, stderr } = await execPromise(comando, {
            maxBuffer: 10 * 1024 * 1024
        });

        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('Pulling')) console.warn(stderr);

        console.log(` ${descricao} - CONCLUÍDO\n`);
        return true;
    } catch (error) {
        console.error(`L Erro em: ${descricao}`);
        console.error(error.message);
        return false;
    }
}

async function aguardar(segundos, mensagem) {
    console.log(`ó ${mensagem} (${segundos}s)...`);
    for (let i = segundos; i > 0; i--) {
        process.stdout.write(`\ró ${i}s restantes...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\r Concluído!           \n');
}

async function verificarDocker() {
    try {
        await execPromise('docker --version');
        console.log(' Docker está instalado\n');
        return true;
    } catch (error) {
        console.error('L Docker não está instalado!');
        console.error('\n=å Instale Docker Desktop:');
        console.error('   https://www.docker.com/products/docker-desktop/\n');
        return false;
    }
}

async function main() {
    try {
        // 1. Verificar Docker
        console.log('1ã  VERIFICANDO DOCKER');
        console.log('='.repeat(60));

        if (!await verificarDocker()) {
            process.exit(1);
        }

        // 2. Limpar containers antigos (se existirem)
        console.log('\n2ã  LIMPANDO CONTAINERS ANTIGOS');
        console.log('='.repeat(60));

        await executar('docker rm -f marcos-geodesicos-postgres 2>NUL || echo "Nenhum container antigo"', 'Removendo container antigo');

        // 3. Subir container
        console.log('\n3ã  CRIANDO CONTAINER POSTGRESQL + POSTGIS (PORTA 5434)');
        console.log('='.repeat(60));

        await executar('docker-compose up -d', 'Criando container PostgreSQL');

        // 4. Aguardar PostgreSQL
        console.log('\n4ã  AGUARDANDO POSTGRESQL INICIALIZAR');
        console.log('='.repeat(60));

        await aguardar(35, 'Aguardando PostgreSQL');

        // Verificar se está rodando
        try {
            const { stdout } = await execPromise('docker ps --filter name=marcos-geodesicos-postgres');
            if (!stdout.includes('Up')) {
                throw new Error('Container não está rodando');
            }
            console.log(' Container está rodando\n');
        } catch (error) {
            console.error('L Container não iniciou corretamente');
            console.error('   Execute: docker-compose logs postgres\n');
            process.exit(1);
        }

        // 5. Criar estrutura
        console.log('\n5ã  CRIANDO ESTRUTURA E FUNÇÕES POSTGIS');
        console.log('='.repeat(60));

        if (!await executar('node backend/database/criar-funcoes-postgis.js', 'Criando estrutura')) {
            console.error('L Falha ao criar estrutura');
            process.exit(1);
        }

        // 6. Exportar SQLite
        console.log('\n6ã  EXPORTANDO SQLITE ’ CSV');
        console.log('='.repeat(60));

        if (!await executar('node backend/scripts/exportar-sqlite-csv.js', 'Exportando SQLite')) {
            console.error('L Falha ao exportar SQLite');
            process.exit(1);
        }

        // 7. Importar PostgreSQL
        console.log('\n7ã  IMPORTANDO CSV ’ POSTGRESQL');
        console.log('='.repeat(60));

        if (!await executar('node backend/scripts/importar-csv-postgres.js', 'Importando dados')) {
            console.error('L Falha ao importar dados');
            process.exit(1);
        }

        // 8. Validar
        console.log('\n8ã  VALIDANDO MIGRAÇÃO');
        console.log('='.repeat(60));

        await executar('node backend/scripts/validar-migracao.js', 'Validando migração');

        // 9. Sucesso
        console.log('\n' + '='.repeat(60));
        console.log('<‰ SETUP COMPLETO FINALIZADO COM SUCESSO!');
        console.log('='.repeat(60) + '\n');

        console.log('=Ë INFORMAÇÕES DO SISTEMA:\n');
        console.log('= PostgreSQL:');
        console.log('   Host: localhost');
        console.log('   Porta: 5434');
        console.log('   Banco: marcos_geodesicos');
        console.log('   Usuário: postgres');
        console.log('   Senha: marcos123\n');

        console.log('=Ë PRÓXIMOS PASSOS:\n');
        console.log('1. Iniciar servidor:');
        console.log('   node backend/server-postgres.js\n');
        console.log('2. Abrir no navegador:');
        console.log('   http://localhost:3001\n');
        console.log('3. Testar API:');
        console.log('   http://localhost:3001/api/health\n');

        console.log('=Ê COMANDOS ÚTEIS:\n');
        console.log('" Ver logs: docker-compose logs postgres');
        console.log('" Parar: docker-compose down');
        console.log('" Reiniciar: docker-compose restart');
        console.log('" Validar: node backend/scripts/validar-migracao.js\n');

    } catch (error) {
        console.error('\nL ERRO FATAL:', error.message);
        console.error('\n=Þ Verifique os logs e tente novamente\n');
        process.exit(1);
    }
}

main();
