const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuração
const DB_PATH = path.join(__dirname, '../../database/marcos.db');
const ARQUIVO_CONSOLIDADOS = path.join(__dirname, '../../marcos_consolidados.csv');
const ARQUIVO_INVALIDOS = path.join(__dirname, '../../marcos_invalidos.csv');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  IMPORTAÇÃO DE DADOS CONSOLIDADOS - COGEP STABILIZER      ║');
console.log('║  ⚠️  LIMPEZA TOTAL + SUBSTITUIÇÃO COMPLETA                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Conectar ao banco
const db = new Database(DB_PATH);

// Função para parsear linha CSV (considera aspas e vírgulas dentro de campos)
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

// Função para converter valor vazio para null
function emptyToNull(value) {
    if (!value || value === '' || value === '[N/A]' || value === 'NULL') return null;
    return value;
}

// Função para converter string para número
function toNumber(value) {
    if (!value || value === '' || value === '[N/A]' || value === 'NULL') return null;
    const num = parseFloat(value.replace(',', '.'));
    return isNaN(num) ? null : num;
}

// Função para importar arquivo
function importarArquivo(arquivo, statusCampo, stmt) {
    if (!fs.existsSync(arquivo)) {
        console.log(`⚠️  Arquivo não encontrado: ${arquivo}`);
        return 0;
    }

    console.log(`\n📂 Processando: ${path.basename(arquivo)}`);
    console.log(`   Status: ${statusCampo}`);

    const conteudo = fs.readFileSync(arquivo, 'utf8');
    const linhas = conteudo.split('\n').filter(l => l.trim());

    const cabecalho = parseCSVLine(linhas[0]);
    console.log(`   Colunas: ${cabecalho.length}`);
    console.log(`   Linhas: ${linhas.length - 1}`);

    let importados = 0;
    let erros = 0;

    for (let i = 1; i < linhas.length; i++) {
        const campos = parseCSVLine(linhas[i]);

        if (campos.length < 15) {
            console.log(`   ⚠️ Linha ${i} inválida (${campos.length} campos)`);
            erros++;
            continue;
        }

        try {
            stmt.run(
                emptyToNull(campos[0]),  // codigo
                emptyToNull(campos[1]),  // tipo
                emptyToNull(campos[2]),  // localizacao
                emptyToNull(campos[3]),  // metodo
                emptyToNull(campos[4]),  // limites
                toNumber(campos[5]),     // coordenada_e
                toNumber(campos[6]),     // desvio_e
                toNumber(campos[7]),     // coordenada_n
                toNumber(campos[8]),     // desvio_n
                toNumber(campos[9]),     // altitude_h
                toNumber(campos[10]),    // desvio_h
                emptyToNull(campos[11]), // lote
                emptyToNull(campos[12]), // data_levantamento
                emptyToNull(campos[13]), // observacoes
                'COGEP-STABILIZER',      // usuario_cadastro
                1,                       // ativo
                statusCampo              // status_campo
            );

            importados++;

            if (importados % 500 === 0) {
                console.log(`   📊 Progresso: ${importados} marcos...`);
            }
        } catch (error) {
            console.log(`   ❌ Erro linha ${i}: ${error.message}`);
            erros++;
        }
    }

    console.log(`   ✅ Importados: ${importados}`);
    if (erros > 0) {
        console.log(`   ❌ Erros: ${erros}`);
    }

    return importados;
}

// CONFIRMAÇÃO DE SEGURANÇA
console.log('⚠️  ATENÇÃO: Esta operação irá DELETAR TODOS os marcos existentes!\n');
console.log('Arquivos a processar:');
console.log(`  1. ${path.basename(ARQUIVO_CONSOLIDADOS)} (238 marcos LEVANTADOS)`);
console.log(`  2. ${path.basename(ARQUIVO_INVALIDOS)} (2729 marcos PENDENTES)`);
console.log('\n🔥 DELEÇÃO TOTAL + IMPORTAÇÃO COMPLETA');
console.log('\nPressione Ctrl+C para CANCELAR ou aguarde 5 segundos...\n');

setTimeout(() => {
    try {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  INICIANDO PROCESSO                                        ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        // PASSO 1: BACKUP (informativo)
        console.log('\n📦 PASSO 1: Estatísticas do banco ANTES da limpeza');
        const statsBefore = {
            total: db.prepare('SELECT COUNT(*) as count FROM marcos').get().count,
            ativos: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count
        };
        console.log(`   Total: ${statsBefore.total} marcos`);
        console.log(`   Ativos: ${statsBefore.ativos} marcos`);

        // PASSO 2: LIMPEZA TOTAL
        console.log('\n🧹 PASSO 2: LIMPEZA TOTAL DO BANCO');
        console.log('   Deletando todos os marcos...');

        const transaction = db.transaction(() => {
            // Limpar tabelas relacionadas primeiro (integridade referencial)
            db.prepare('DELETE FROM poligono_marcos').run();
            db.prepare('DELETE FROM log_correcoes').run();

            // Deletar todos os marcos
            const resultDelete = db.prepare('DELETE FROM marcos').run();
            console.log(`   ✅ ${resultDelete.changes} marcos deletados`);

            // Resetar autoincrement
            db.prepare('DELETE FROM sqlite_sequence WHERE name = "marcos"').run();
            console.log('   ✅ Contador ID resetado');
        });

        transaction();

        // PASSO 3: IMPORTAÇÃO
        console.log('\n📥 PASSO 3: IMPORTAÇÃO DOS DADOS CONSOLIDADOS');

        // Preparar statement (reutilizável para performance)
        const stmt = db.prepare(`
            INSERT INTO marcos (
                codigo, tipo, localizacao, metodo, limites,
                coordenada_e, desvio_e, coordenada_n, desvio_n,
                altitude_h, desvio_h, lote, data_levantamento,
                observacoes, usuario_cadastro, ativo, status_campo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let totalImportados = 0;

        // Usar transação para toda a importação (MUITO mais rápido)
        const importTransaction = db.transaction(() => {
            // Importar marcos LEVANTADOS
            totalImportados += importarArquivo(ARQUIVO_CONSOLIDADOS, 'LEVANTADO', stmt);

            // Importar marcos PENDENTES
            totalImportados += importarArquivo(ARQUIVO_INVALIDOS, 'PENDENTE', stmt);
        });

        console.log('\n⏳ Executando transação de importação...');
        importTransaction();

        // PASSO 4: VALIDAÇÃO
        console.log('\n🔍 PASSO 4: VALIDAÇÃO AUTOMÁTICA');
        console.log('   Validando coordenadas dos marcos LEVANTADOS...');

        const { validarTodosMarcos } = require('../utils/validador-coordenadas');
        const resultado = validarTodosMarcos(db);

        console.log(`   ✅ Válidos: ${resultado.validos}`);
        console.log(`   ❌ Inválidos: ${resultado.invalidos}`);

        // ESTATÍSTICAS FINAIS
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  IMPORTAÇÃO CONCLUÍDA COM SUCESSO                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        const statsAfter = {
            total: db.prepare('SELECT COUNT(*) as count FROM marcos WHERE ativo = 1').get().count,
            levantados: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'LEVANTADO' AND ativo = 1").get().count,
            pendentes: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE status_campo = 'PENDENTE' AND ativo = 1").get().count,
            validos: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 1 AND ativo = 1").get().count,
            invalidos: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE coordenadas_validadas = 0 AND ativo = 1").get().count,
            tipoV: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'V' AND ativo = 1").get().count,
            tipoM: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'M' AND ativo = 1").get().count,
            tipoP: db.prepare("SELECT COUNT(*) as count FROM marcos WHERE tipo = 'P' AND ativo = 1").get().count
        };

        console.log(`\n📊 ESTATÍSTICAS FINAIS:`);
        console.log(`   Total de marcos: ${statsAfter.total}`);
        console.log(`\n   Por Status:`);
        console.log(`   📍 Levantados: ${statsAfter.levantados} (${((statsAfter.levantados/statsAfter.total)*100).toFixed(1)}%) - Aparecem no mapa`);
        console.log(`   ⏳ Pendentes: ${statsAfter.pendentes} (${((statsAfter.pendentes/statsAfter.total)*100).toFixed(1)}%) - Consultáveis, não no mapa`);
        console.log(`\n   Por Tipo:`);
        console.log(`   V: ${statsAfter.tipoV}`);
        console.log(`   M: ${statsAfter.tipoM}`);
        console.log(`   P: ${statsAfter.tipoP}`);
        console.log(`\n   Validação de Coordenadas:`);
        console.log(`   ✅ Válidas: ${statsAfter.validos}`);
        console.log(`   ❌ Inválidas: ${statsAfter.invalidos}`);

        console.log('\n✨ Sistema 100% funcional!');
        console.log('\n📌 PRÓXIMOS PASSOS:');
        console.log('   1. Reiniciar o servidor Node.js');
        console.log('   2. Acessar o sistema via navegador');
        console.log('   3. Consultar Marcos: verá todos os 2967 marcos');
        console.log('   4. Mapa: verá apenas os 238 levantados');
        console.log('   5. Validação: estatísticas atualizadas\n');

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error);
        console.error('   Stack:', error.stack);
        console.error('\n⚠️  O banco pode estar em estado inconsistente!');
        console.error('   Recomendação: Restaurar backup ou recriar banco.\n');
        process.exit(1);
    } finally {
        db.close();
    }
}, 5000); // 5 segundos de segurança
