/**
 * Script de teste para validar a correção do erro SSL do WFS CAR
 */

const fetch = require('node-fetch');
const https = require('https');

console.log('🧪 Testando conexão WFS CAR com correção SSL...\n');

// Criar agente HTTPS que aceita certificados com problemas
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testarWFS() {
    const url = 'https://geoserver.car.gov.br/geoserver/wfs?service=WFS&version=2.0.0&request=GetCapabilities';

    console.log('📡 URL:', url);
    console.log('🔐 Agente HTTPS: rejectUnauthorized = false\n');

    try {
        console.log('⏳ Fazendo requisição...');

        const response = await fetch(url, {
            timeout: 10000,
            agent: httpsAgent
        });

        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`📝 Content-Type: ${response.headers.get('content-type')}\n`);

        if (response.ok) {
            const text = await response.text();
            const linhas = text.split('\n').length;

            console.log('✅ SUCESSO! Conexão WFS estabelecida com sucesso!');
            console.log(`📄 Resposta recebida: ${text.length} bytes (${linhas} linhas)`);
            console.log('\n🎉 A correção do erro SSL funcionou!');

            return true;
        } else {
            console.error('❌ Erro HTTP:', response.status);
            return false;
        }

    } catch (error) {
        console.error('❌ FALHA na conexão:');
        console.error('   Erro:', error.message);
        console.error('\n💡 Possíveis causas:');
        console.error('   - Sem conexão com a internet');
        console.error('   - Servidor WFS offline');
        console.error('   - Firewall bloqueando requisições');

        return false;
    }
}

// Executar teste
testarWFS().then(sucesso => {
    process.exit(sucesso ? 0 : 1);
}).catch(error => {
    console.error('💥 Erro crítico:', error);
    process.exit(1);
});
