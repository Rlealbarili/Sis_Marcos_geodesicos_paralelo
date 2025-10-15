const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/marcos.db');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  ESTATÍSTICAS DO BANCO DE DADOS - SISTEMA COGEP           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

try {
    const db = new Database(DB_PATH, { readonly: true });

    // Estatísticas gerais
    console.log('📊 ESTATÍSTICAS GERAIS:\n');

    const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM marcos').get().count,
        ativos: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
        inativos: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 0').get().count
    };

    console.log(`   Total de marcos: ${stats.total}`);
    console.log(`   ├─ Ativos: ${stats.ativos} (${((stats.ativos/stats.total)*100).toFixed(1)}%)`);
    console.log(`   └─ Inativos: ${stats.inativos} (${((stats.inativos/stats.total)*100).toFixed(1)}%)`);

    // Por tipo
    console.log('\n📐 POR TIPO:\n');

    const tipos = {
        V: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'V' AND ativo = 1").get().count,
        M: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'M' AND ativo = 1").get().count,
        P: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'P' AND ativo = 1").get().count
    };

    console.log(`   Tipo V: ${tipos.V} (${((tipos.V/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   Tipo M: ${tipos.M} (${((tipos.M/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   Tipo P: ${tipos.P} (${((tipos.P/stats.ativos)*100).toFixed(1)}%)`);

    // Por status de campo
    console.log('\n🗺️  POR STATUS DE CAMPO:\n');

    const statusCampo = {
        levantados: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'LEVANTADO' AND ativo = 1").get().count,
        pendentes: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1").get().count,
        naoDefinido: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE (status_campo IS NULL OR status_campo = '') AND ativo = 1").get().count
    };

    console.log(`   📍 Levantados: ${statusCampo.levantados} (${((statusCampo.levantados/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   ⏳ Pendentes: ${statusCampo.pendentes} (${((statusCampo.pendentes/stats.ativos)*100).toFixed(1)}%)`);
    if (statusCampo.naoDefinido > 0) {
        console.log(`   ❓ Não definido: ${statusCampo.naoDefinido} (${((statusCampo.naoDefinido/stats.ativos)*100).toFixed(1)}%)`);
    }

    // Validação de coordenadas
    console.log('\n✅ VALIDAÇÃO DE COORDENADAS:\n');

    const validacao = {
        validadas: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 1 AND ativo = 1").get().count,
        invalidas: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1").get().count,
        pendentes: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas IS NULL AND ativo = 1").get().count
    };

    console.log(`   ✅ Validadas: ${validacao.validadas} (${((validacao.validadas/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   ❌ Inválidas: ${validacao.invalidas} (${((validacao.invalidas/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   ⏳ Pendentes: ${validacao.pendentes} (${((validacao.pendentes/stats.ativos)*100).toFixed(1)}%)`);

    // Coordenadas
    console.log('\n🗺️  COORDENADAS:\n');

    const coordenadas = {
        comCoordenadas: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenada_e IS NOT NULL AND coordenada_n IS NOT NULL AND ativo = 1").get().count,
        semCoordenadas: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE (coordenada_e IS NULL OR coordenada_n IS NULL) AND ativo = 1").get().count
    };

    console.log(`   Com coordenadas: ${coordenadas.comCoordenadas} (${((coordenadas.comCoordenadas/stats.ativos)*100).toFixed(1)}%)`);
    console.log(`   Sem coordenadas: ${coordenadas.semCoordenadas} (${((coordenadas.semCoordenadas/stats.ativos)*100).toFixed(1)}%)`);

    // Terrenos
    console.log('\n🏞️  TERRENOS:\n');

    const terrenos = {
        total: db.prepare('SELECT COUNT(*) as count FROM poligonos WHERE ativo = 1').get().count,
        emAndamento: db.prepare("SELECT COUNT(*) as count FROM poligonos WHERE status = 'Em Andamento' AND ativo = 1").get().count,
        finalizado: db.prepare("SELECT COUNT(*) as count FROM poligonos WHERE status = 'Finalizado' AND ativo = 1").get().count,
        aprovado: db.prepare("SELECT COUNT(*) as count FROM poligonos WHERE status = 'Aprovado' AND ativo = 1").get().count
    };

    console.log(`   Total: ${terrenos.total}`);
    if (terrenos.total > 0) {
        console.log(`   ├─ Em Andamento: ${terrenos.emAndamento}`);
        console.log(`   ├─ Finalizado: ${terrenos.finalizado}`);
        console.log(`   └─ Aprovado: ${terrenos.aprovado}`);
    }

    // Clientes
    console.log('\n👥 CLIENTES:\n');

    const clientes = db.prepare('SELECT COUNT(*) as count FROM clientes WHERE ativo = 1').get().count;
    console.log(`   Total: ${clientes}`);

    // Últimas atividades
    console.log('\n📅 ÚLTIMAS ATIVIDADES:\n');

    const ultimoCadastro = db.prepare(`
        SELECT codigo, data_cadastro
        FROM marcos
        WHERE ativo = 1
        ORDER BY data_cadastro DESC
        LIMIT 1
    `).get();

    const ultimaValidacao = db.prepare(`
        SELECT MAX(data_validacao) as data
        FROM marcos
        WHERE data_validacao IS NOT NULL
    `).get();

    if (ultimoCadastro) {
        const data = new Date(ultimoCadastro.data_cadastro);
        console.log(`   Último marco cadastrado: ${ultimoCadastro.codigo}`);
        console.log(`   Data: ${data.toLocaleString('pt-BR')}`);
    }

    if (ultimaValidacao && ultimaValidacao.data) {
        const data = new Date(ultimaValidacao.data);
        console.log(`\n   Última validação: ${data.toLocaleString('pt-BR')}`);
    }

    // Top 5 marcos mais recentes
    console.log('\n📋 ÚLTIMOS 5 MARCOS CADASTRADOS:\n');

    const ultimos = db.prepare(`
        SELECT codigo, tipo, localizacao, data_cadastro
        FROM marcos
        WHERE ativo = 1
        ORDER BY data_cadastro DESC
        LIMIT 5
    `).all();

    if (ultimos.length > 0) {
        ultimos.forEach((m, i) => {
            const data = new Date(m.data_cadastro);
            console.log(`   ${i + 1}. ${m.codigo} (${m.tipo}) - ${m.localizacao || 'S/Local'} - ${data.toLocaleDateString('pt-BR')}`);
        });
    } else {
        console.log('   Nenhum marco cadastrado');
    }

    // Distribuição por localização (top 10)
    console.log('\n📍 TOP 10 LOCALIZAÇÕES:\n');

    const localizacoes = db.prepare(`
        SELECT localizacao, COUNT(*) as total
        FROM marcos
        WHERE ativo = 1 AND localizacao IS NOT NULL AND localizacao != ''
        GROUP BY localizacao
        ORDER BY total DESC
        LIMIT 10
    `).all();

    if (localizacoes.length > 0) {
        localizacoes.forEach((loc, i) => {
            const pct = ((loc.total / stats.ativos) * 100).toFixed(1);
            console.log(`   ${i + 1}. ${loc.localizacao}: ${loc.total} (${pct}%)`);
        });
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ Estatísticas carregadas com sucesso!\n');

    db.close();

} catch (error) {
    console.error('❌ Erro ao carregar estatísticas:', error.message);
    console.error('\n   Possíveis causas:');
    console.error('   - Banco de dados não existe');
    console.error('   - Banco de dados está corrompido');
    console.error('   - Servidor Node.js está usando o banco (fechar servidor)\n');
    process.exit(1);
}
