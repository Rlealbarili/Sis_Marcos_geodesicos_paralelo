const fs = require('fs');
const path = require('path');

console.log('====================================');
console.log('DIAGNÓSTICO DO SISTEMA');
console.log('====================================\n');

// ==========================================
// ESTRUTURA ESPERADA
// ==========================================

const estruturaEsperada = {
    backend: {
        arquivos: [
            'server.js',
            'migrate.js',
            'unstructured-processor.js',
            'reset-database.js',
            'clean-migrations.js'
        ],
        migrations: [
            '001_create_integrated_schema.sql'
        ],
        database: [
            'marcos.db'
        ]
    },
    frontend: {
        arquivos: [
            'index.html',
            'importar-memorial.html',
            'script.js',
            'styles.css'
        ]
    },
    raiz: [
        'package.json',
        '.gitignore'
    ]
};

// ==========================================
// ENDPOINTS ESPERADOS NO SERVER.JS
// ==========================================

const endpointsEsperados = [
    // Marcos
    'GET /api/marcos',
    'GET /api/buscar-marcos',

    // Clientes
    'GET /api/clientes',
    'GET /api/clientes/:id',
    'POST /api/clientes',
    'PUT /api/clientes/:id',
    'DELETE /api/clientes/:id',

    // Propriedades
    'GET /api/propriedades',
    'GET /api/propriedades/:id',
    'POST /api/propriedades',
    'PUT /api/propriedades/:id',
    'DELETE /api/propriedades/:id',
    'GET /api/propriedades/:id/vertices',

    // Integrado
    'POST /api/salvar-memorial-completo',
    'GET /api/memoriais-importados',
    'GET /api/propriedades-mapa',

    // Importação
    'POST /api/importar-memorial-v2'
];

// ==========================================
// FUNÇÕES ESPERADAS NO SCRIPT.JS
// ==========================================

const funcoesEsperadasJS = [
    'trocarAba',
    'atualizarEstatisticas',
    'carregarListaClientes',
    'carregarListaPropriedades',
    'carregarHistorico',
    'abrirModalNovoCliente',
    'abrirModalNovaPropriedade',
    'salvarCliente',
    'salvarPropriedade',
    'excluirCliente',
    'excluirPropriedade',
    'processarMemorial',
    'aplicarFiltrosMapa',
    'carregarPropriedades',
    'criarCamadasPropriedades',
    'adicionarInteracoesPoligono'
];

// ==========================================
// VERIFICAÇÃO DE ARQUIVOS
// ==========================================

function verificarArquivo(caminho) {
    const caminhoCompleto = path.join(process.cwd(), caminho);
    const existe = fs.existsSync(caminhoCompleto);

    if (existe) {
        const stats = fs.statSync(caminhoCompleto);
        return {
            existe: true,
            tamanho: stats.size,
            modificado: stats.mtime
        };
    }

    return { existe: false };
}

console.log('📁 VERIFICANDO ESTRUTURA DE ARQUIVOS\n');

// Backend
console.log('BACKEND:');
estruturaEsperada.backend.arquivos.forEach(arquivo => {
    const resultado = verificarArquivo(`backend/${arquivo}`);
    const status = resultado.existe ? '✅' : '❌';
    const info = resultado.existe ? `(${(resultado.tamanho / 1024).toFixed(1)} KB)` : '(NÃO ENCONTRADO)';
    console.log(`  ${status} backend/${arquivo} ${info}`);
});

// Migrations
console.log('\nMIGRATIONS:');
estruturaEsperada.backend.migrations.forEach(arquivo => {
    const resultado = verificarArquivo(`backend/migrations/${arquivo}`);
    const status = resultado.existe ? '✅' : '❌';
    const info = resultado.existe ? `(${(resultado.tamanho / 1024).toFixed(1)} KB)` : '(NÃO ENCONTRADO)';
    console.log(`  ${status} backend/migrations/${arquivo} ${info}`);
});

// Database
console.log('\nDATABASE:');
// Tentar em múltiplos locais
const locaisBanco = ['backend/marcos.db', 'database/marcos.db', 'marcos.db'];
let bancoEncontrado = false;
locaisBanco.forEach(local => {
    const resultado = verificarArquivo(local);
    if (resultado.existe) {
        console.log(`  ✅ ${local} (${(resultado.tamanho / 1024 / 1024).toFixed(1)} MB)`);
        bancoEncontrado = true;
    }
});
if (!bancoEncontrado) {
    console.log('  ❌ marcos.db NÃO ENCONTRADO em nenhum local');
}

// Frontend
console.log('\nFRONTEND:');
estruturaEsperada.frontend.arquivos.forEach(arquivo => {
    const resultado = verificarArquivo(`frontend/${arquivo}`);
    const status = resultado.existe ? '✅' : '❌';
    const info = resultado.existe ? `(${(resultado.tamanho / 1024).toFixed(1)} KB)` : '(NÃO ENCONTRADO)';
    console.log(`  ${status} frontend/${arquivo} ${info}`);
});

// Raiz
console.log('\nRAIZ:');
estruturaEsperada.raiz.forEach(arquivo => {
    const resultado = verificarArquivo(arquivo);
    const status = resultado.existe ? '✅' : '❌';
    const info = resultado.existe ? `(${(resultado.tamanho / 1024).toFixed(1)} KB)` : '(NÃO ENCONTRADO)';
    console.log(`  ${status} ${arquivo} ${info}`);
});

// ==========================================
// VERIFICAÇÃO DE CONTEÚDO
// ==========================================

console.log('\n====================================');
console.log('📝 VERIFICANDO CONTEÚDO DOS ARQUIVOS');
console.log('====================================\n');

// Verificar server.js
console.log('BACKEND/SERVER.JS:');
const serverPath = path.join(process.cwd(), 'backend/server.js');
if (fs.existsSync(serverPath)) {
    const conteudo = fs.readFileSync(serverPath, 'utf8');

    console.log('  Endpoints encontrados:');
    endpointsEsperados.forEach(endpoint => {
        const [metodo, rota] = endpoint.split(' ');
        const rotaLimpa = rota.replace(/:\w+/g, ''); // Remove :id, :propriedade_id, etc
        const regex = new RegExp(`app\\.${metodo.toLowerCase()}\\(['"]${rotaLimpa.replace(/\//g, '\\/')}`, 'i');
        const encontrado = regex.test(conteudo);
        const status = encontrado ? '✅' : '❌';
        console.log(`    ${status} ${endpoint}`);
    });

    // Verificar linhas de código
    const linhas = conteudo.split('\n').length;
    console.log(`\n  Total de linhas: ${linhas}`);
} else {
    console.log('  ❌ Arquivo não encontrado');
}

// Verificar script.js
console.log('\nFRONTEND/SCRIPT.JS:');
const scriptPath = path.join(process.cwd(), 'frontend/script.js');
if (fs.existsSync(scriptPath)) {
    const conteudo = fs.readFileSync(scriptPath, 'utf8');

    console.log('  Funções encontradas:');
    funcoesEsperadasJS.forEach(funcao => {
        const regex = new RegExp(`(function ${funcao}|const ${funcao}|async function ${funcao})`, 'g');
        const encontrado = regex.test(conteudo);
        const status = encontrado ? '✅' : '❌';
        console.log(`    ${status} ${funcao}()`);
    });

    // Verificar linhas de código
    const linhas = conteudo.split('\n').length;
    console.log(`\n  Total de linhas: ${linhas}`);
} else {
    console.log('  ❌ Arquivo não encontrado');
}

// Verificar index.html
console.log('\nFRONTEND/INDEX.HTML:');
const indexPath = path.join(process.cwd(), 'frontend/index.html');
if (fs.existsSync(indexPath)) {
    const conteudo = fs.readFileSync(indexPath, 'utf8');

    // Verificar estrutura esperada do PROMPT 3.4
    const estruturasEsperadas = [
        { nome: 'Header', regex: /<header class="main-header">/ },
        { nome: 'Navigation Tabs', regex: /<nav class="main-nav">/ },
        { nome: 'Tab Mapa', regex: /id="tab-mapa"/ },
        { nome: 'Tab Importar', regex: /id="tab-importar"/ },
        { nome: 'Tab Propriedades', regex: /id="tab-propriedades"/ },
        { nome: 'Tab Clientes', regex: /id="tab-clientes"/ },
        { nome: 'Tab Histórico', regex: /id="tab-historico"/ },
        { nome: 'Modal Cliente', regex: /id="modal-cliente"/ },
        { nome: 'Modal Propriedade', regex: /id="modal-propriedade"/ }
    ];

    console.log('  Estruturas encontradas:');
    estruturasEsperadas.forEach(estrutura => {
        const encontrado = estrutura.regex.test(conteudo);
        const status = encontrado ? '✅' : '❌';
        console.log(`    ${status} ${estrutura.nome}`);
    });

    const linhas = conteudo.split('\n').length;
    console.log(`\n  Total de linhas: ${linhas}`);
} else {
    console.log('  ❌ Arquivo não encontrado');
}

// Verificar styles.css
console.log('\nFRONTEND/STYLES.CSS:');
const stylesPath = path.join(process.cwd(), 'frontend/styles.css');
if (fs.existsSync(stylesPath)) {
    const conteudo = fs.readFileSync(stylesPath, 'utf8');

    const classesEsperadas = [
        '.main-header',
        '.main-nav',
        '.nav-tab',
        '.tab-content',
        '.mapa-container',
        '.filtros-mapa',
        '.gestao-container',
        '.modal',
        '.modal-content',
        '.btn-primary',
        '.item-card'
    ];

    console.log('  Classes CSS encontradas:');
    classesEsperadas.forEach(classe => {
        const encontrado = conteudo.includes(classe);
        const status = encontrado ? '✅' : '❌';
        console.log(`    ${status} ${classe}`);
    });

    const linhas = conteudo.split('\n').length;
    console.log(`\n  Total de linhas: ${linhas}`);
} else {
    console.log('  ❌ Arquivo não encontrado');
}

// ==========================================
// VERIFICAÇÃO DO BANCO DE DADOS
// ==========================================

console.log('\n====================================');
console.log('🗄️ VERIFICANDO BANCO DE DADOS');
console.log('====================================\n');

try {
    const Database = require('better-sqlite3');

    // Tentar abrir banco em diferentes locais
    let db = null;
    let localBanco = null;

    for (const local of locaisBanco) {
        const caminho = path.join(process.cwd(), local);
        if (fs.existsSync(caminho)) {
            db = new Database(caminho);
            localBanco = local;
            break;
        }
    }

    if (db) {
        console.log(`Banco encontrado em: ${localBanco}\n`);

        // Verificar tabelas
        const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

        const tabelasEsperadas = [
            'marcos',
            'clientes',
            'propriedades',
            'vertices',
            'memoriais_importados',
            'schema_migrations'
        ];

        console.log('Tabelas no banco:');
        tabelasEsperadas.forEach(tabela => {
            const existe = tabelas.find(t => t.name === tabela);
            const status = existe ? '✅' : '❌';

            if (existe) {
                const count = db.prepare(`SELECT COUNT(*) as total FROM ${tabela}`).get();
                console.log(`  ${status} ${tabela} (${count.total} registros)`);
            } else {
                console.log(`  ${status} ${tabela} (NÃO EXISTE)`);
            }
        });

        db.close();
    } else {
        console.log('❌ Banco de dados não encontrado');
    }
} catch (error) {
    console.log('❌ Erro ao verificar banco:', error.message);
}

// ==========================================
// RESUMO FINAL
// ==========================================

console.log('\n====================================');
console.log('📊 RESUMO DO DIAGNÓSTICO');
console.log('====================================\n');

console.log('PRÓXIMOS PASSOS RECOMENDADOS:\n');

console.log('1. Se faltam arquivos do BACKEND:');
console.log('   - Execute os prompts da FASE 2 (Backend API)');
console.log('   - Verifique se server.js tem todos os endpoints\n');

console.log('2. Se falta estrutura HTML (abas, modais):');
console.log('   - Execute PROMPT 3.4 (Estrutura HTML)\n');

console.log('3. Se faltam estilos CSS:');
console.log('   - Execute PROMPT 3.5 (CSS completo)\n');

console.log('4. Se faltam funções JavaScript:');
console.log('   - Execute PROMPT 3.6 (JavaScript parte 1)');
console.log('   - Execute PROMPT 3.7 (JavaScript parte 2)\n');

console.log('5. Se o banco não tem as tabelas:');
console.log('   - Execute: npm run migrate\n');

console.log('====================================\n');
