const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testarAPI() {
    console.log('🧪 Iniciando testes da API...\n');
    console.log('='.repeat(60) + '\n');

    try {
        // ========================================
        // TESTE 1: Listar Clientes
        // ========================================
        console.log('📋 Teste 1: GET /api/clientes');
        const clientesRes = await axios.get(`${BASE_URL}/clientes`);
        console.log(`✅ ${clientesRes.data.total} clientes encontrados`);
        if (clientesRes.data.data.length > 0) {
            console.log(`   Primeiro cliente: ${clientesRes.data.data[0]?.nome || 'N/A'}`);
        }
        console.log('');

        // ========================================
        // TESTE 2: Listar Propriedades
        // ========================================
        console.log('🏢 Teste 2: GET /api/propriedades');
        const propriedadesRes = await axios.get(`${BASE_URL}/propriedades`);
        console.log(`✅ ${propriedadesRes.data.total} propriedades encontradas`);
        if (propriedadesRes.data.data.length > 0) {
            console.log(`   Primeira propriedade: ${propriedadesRes.data.data[0]?.nome_propriedade || 'N/A'}`);
        }
        console.log('');

        // ========================================
        // TESTE 3: Criar Cliente
        // ========================================
        console.log('➕ Teste 3: POST /api/clientes');
        const novoCliente = {
            nome: 'Cliente Teste API',
            tipo_pessoa: 'fisica',
            cpf_cnpj: '999.999.999-99',
            email: 'teste@api.com',
            telefone: '(41) 99999-8888'
        };
        const createClienteRes = await axios.post(`${BASE_URL}/clientes`, novoCliente);
        const clienteId = createClienteRes.data.data.id;
        console.log(`✅ Cliente criado com ID: ${clienteId}`);
        console.log(`   Nome: ${createClienteRes.data.data.nome}`);
        console.log('');

        // ========================================
        // TESTE 4: Criar Propriedade
        // ========================================
        console.log('➕ Teste 4: POST /api/propriedades');
        const novaPropriedade = {
            nome_propriedade: 'Propriedade Teste API',
            tipo: 'RURAL',
            matricula: 'TEST-001',
            municipio: 'Campo Largo',
            comarca: 'Campo Largo',
            uf: 'PR',
            area_m2: 50000,
            perimetro_m: 900,
            cliente_id: clienteId,
            observacoes: 'Propriedade criada via teste automatizado'
        };
        const createPropRes = await axios.post(`${BASE_URL}/propriedades`, novaPropriedade);
        const propriedadeId = createPropRes.data.data.id;
        console.log(`✅ Propriedade criada com ID: ${propriedadeId}`);
        console.log(`   Nome: ${createPropRes.data.data.nome_propriedade}`);
        console.log('');

        // ========================================
        // TESTE 5: Buscar Propriedade por ID
        // ========================================
        console.log(`🔍 Teste 5: GET /api/propriedades/${propriedadeId}`);
        const getPropRes = await axios.get(`${BASE_URL}/propriedades/${propriedadeId}`);
        console.log(`✅ Propriedade encontrada: ${getPropRes.data.data.nome_propriedade}`);
        console.log(`   Tipo: ${getPropRes.data.data.tipo}`);
        console.log(`   Município: ${getPropRes.data.data.municipio}`);
        console.log(`   Cliente: ${getPropRes.data.data.cliente_nome || 'N/A'}`);
        console.log('');

        // ========================================
        // TESTE 6: Atualizar Propriedade
        // ========================================
        console.log(`✏️  Teste 6: PUT /api/propriedades/${propriedadeId}`);
        const updateRes = await axios.put(`${BASE_URL}/propriedades/${propriedadeId}`, {
            area_m2: 75000,
            perimetro_m: 1100,
            observacoes: 'Atualizado via teste de API - área expandida'
        });
        console.log(`✅ Propriedade atualizada`);
        console.log(`   Nova área: ${updateRes.data.data.area_m2} m²`);
        console.log(`   Novo perímetro: ${updateRes.data.data.perimetro_m} m`);
        console.log('');

        // ========================================
        // TESTE 7: Buscar Cliente por ID
        // ========================================
        console.log(`🔍 Teste 7: GET /api/clientes/${clienteId}`);
        const getClienteRes = await axios.get(`${BASE_URL}/clientes/${clienteId}`);
        console.log(`✅ Cliente encontrado: ${getClienteRes.data.data.nome}`);
        console.log(`   Tipo: ${getClienteRes.data.data.tipo_pessoa}`);
        console.log(`   CPF/CNPJ: ${getClienteRes.data.data.cpf_cnpj || 'N/A'}`);
        console.log(`   Total de propriedades: ${getClienteRes.data.data.total_propriedades || 0}`);
        console.log('');

        // ========================================
        // TESTE 8: Filtrar Propriedades por Tipo
        // ========================================
        console.log('🔍 Teste 8: GET /api/propriedades?tipo=RURAL');
        const filtroRes = await axios.get(`${BASE_URL}/propriedades?tipo=RURAL`);
        console.log(`✅ ${filtroRes.data.total} propriedades rurais encontradas`);
        console.log('');

        // ========================================
        // TESTE 9: Filtrar Propriedades por Município
        // ========================================
        console.log('🔍 Teste 9: GET /api/propriedades?municipio=Campo Largo');
        const filtroMunicipioRes = await axios.get(`${BASE_URL}/propriedades?municipio=Campo Largo`);
        console.log(`✅ ${filtroMunicipioRes.data.total} propriedades em Campo Largo encontradas`);
        console.log('');

        // ========================================
        // TESTE 10: Excluir Propriedade
        // ========================================
        console.log(`🗑️  Teste 10: DELETE /api/propriedades/${propriedadeId}`);
        const deletePropRes = await axios.delete(`${BASE_URL}/propriedades/${propriedadeId}`);
        console.log(`✅ Propriedade excluída`);
        console.log(`   Mensagem: ${deletePropRes.data.message}`);
        console.log('');

        // ========================================
        // TESTE 11: Excluir Cliente
        // ========================================
        console.log(`🗑️  Teste 11: DELETE /api/clientes/${clienteId}`);
        const deleteClienteRes = await axios.delete(`${BASE_URL}/clientes/${clienteId}`);
        console.log(`✅ Cliente excluído`);
        console.log(`   Mensagem: ${deleteClienteRes.data.message}`);
        console.log('');

        // ========================================
        // TESTE 12: Verificar Exclusão
        // ========================================
        console.log(`🔍 Teste 12: Verificar exclusão - GET /api/propriedades/${propriedadeId}`);
        try {
            await axios.get(`${BASE_URL}/propriedades/${propriedadeId}`);
            console.log('❌ Erro: Propriedade ainda existe!');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('✅ Confirmado: Propriedade não existe mais (404)');
            } else {
                throw error;
            }
        }
        console.log('');

        console.log('='.repeat(60));
        console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.error('❌ ERRO NOS TESTES:');
        console.log('='.repeat(60));

        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Mensagem: ${error.response.data.message || error.message}`);
            console.error(`   Erro: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error('   Erro de conexão: Servidor não está respondendo');
            console.error('   Verifique se o servidor está rodando em http://localhost:3001');
        } else {
            console.error(`   ${error.message}`);
        }

        console.log('='.repeat(60) + '\n');
        process.exit(1);
    }
}

// Verificar se axios está disponível
if (!axios) {
    console.error('❌ Erro: axios não está instalado');
    console.error('Execute: npm install axios');
    process.exit(1);
}

// Executar testes
console.log('🔧 Aguardando servidor iniciar...\n');
setTimeout(() => {
    testarAPI();
}, 2000);
