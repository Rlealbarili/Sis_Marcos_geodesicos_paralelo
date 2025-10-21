const http = require('http');

// Teste 1: Apenas levantados
console.log('========================================');
console.log('TESTE 1: levantados=true');
console.log('========================================\n');

http.get('http://localhost:3000/api/marcos?levantados=true&limite=500', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log('Total no banco:', result.total);
        console.log('Retornados:', result.count);
        console.log('Levantados:', result.levantados);
        console.log('Pendentes:', result.pendentes);
        console.log('\nPrimeiros 3 marcos:');
        result.data.slice(0, 3).forEach(m => {
            console.log(`  ${m.codigo}: lat=${m.latitude?.toFixed(4)}, lng=${m.longitude?.toFixed(4)}`);
        });

        // Teste 2
        console.log('\n========================================');
        console.log('TESTE 2: Sem filtro (com prioridade)');
        console.log('========================================\n');

        http.get('http://localhost:3000/api/marcos?limite=250', (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                const result2 = JSON.parse(data2);
                console.log('Retornados:', result2.count);
                console.log('Levantados:', result2.levantados);
                console.log('Pendentes:', result2.pendentes);

                const comCoord = result2.data.filter(m => m.latitude != null).length;
                const semCoord = result2.data.filter(m => m.latitude == null).length;

                console.log('\nDistribuicao por prioridade:');
                console.log('  Com coordenadas (prioridade 1):', comCoord);
                console.log('  Sem coordenadas (prioridade 2):', semCoord);

                if (comCoord === 218) {
                    console.log('\n✅ PRIORIDADE FUNCIONANDO! Todos os 218 marcos com coordenadas vieram primeiro!');
                } else {
                    console.log('\n❌ Problema: Esperava 218 marcos com coordenadas, mas recebeu', comCoord);
                }
            });
        });
    });
});
