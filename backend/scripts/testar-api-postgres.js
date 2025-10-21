const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testarAPI() {
    console.log('🧪 TESTANDO API POSTGRESQL\n');

    const testes = [
        {
            nome: 'Health Check',
            metodo: 'GET',
            url: '/health'
        },
        {
            nome: 'Estatísticas',
            metodo: 'GET',
            url: '/estatisticas'
        },
        {
            nome: 'Listar Marcos (limite 5)',
            metodo: 'GET',
            url: '/marcos?limite=5&levantados=true'
        },
        {
            nome: 'Buscar por Código',
            metodo: 'GET',
            url: '/marcos/FHV-M-0001'
        },
        {
            nome: 'Busca por Raio (5km de Londrina)',
            metodo: 'GET',
            url: '/marcos/raio/-25.4245693/-49.6158113/5000'
        },
        {
            nome: 'Busca por BBox (Paraná)',
            metodo: 'GET',
            url: '/marcos/bbox?minLat=-27&minLng=-55&maxLat=-22&maxLng=-48'
        },
        {
            nome: 'GeoJSON Collection',
            metodo: 'GET',
            url: '/marcos/geojson?limite=10'
        },
        {
            nome: 'Buscar por Tipo M',
            metodo: 'GET',
            url: '/marcos/buscar?tipo=M'
        }
    ];

    for (const teste of testes) {
        console.log(`📌 ${teste.nome}`);
        console.log(`   ${teste.metodo} ${teste.url}`);

        try {
            const start = Date.now();
            const response = await axios.get(`${BASE_URL}${teste.url}`);
            const duration = Date.now() - start;

            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   ⏱️  Tempo: ${duration}ms`);

            if (response.data) {
                const keys = Object.keys(response.data);
                console.log(`   📊 Resposta: ${keys.join(', ')}`);

                // Mostrar dados extras para alguns testes
                if (teste.url.includes('/estatisticas')) {
                    console.log(`   📈 Total marcos: ${response.data.total_marcos}`);
                }
                if (teste.url.includes('/raio/')) {
                    console.log(`   📍 Encontrados: ${response.data.total_encontrados}`);
                }
                if (teste.url.includes('/bbox')) {
                    console.log(`   📍 Encontrados: ${response.data.total_encontrados}`);
                }
                if (teste.url.includes('/buscar')) {
                    console.log(`   📍 Total: ${response.data.total}`);
                }
            }

            console.log();
        } catch (error) {
            console.log(`   ❌ Erro: ${error.message}`);
            if (error.response) {
                console.log(`   📄 Status: ${error.response.status}`);
                console.log(`   📄 Dados: ${JSON.stringify(error.response.data)}`);
            }
            console.log();
        }
    }

    console.log('✅ TESTES CONCLUÍDOS!\n');
}

testarAPI();
