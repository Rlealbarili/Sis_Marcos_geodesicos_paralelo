const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function importar() {
    const csvPath = path.join(__dirname, '../../database/export_marcos.csv');

    if (!fs.existsSync(csvPath)) {
        console.error('❌ Arquivo CSV não encontrado:', csvPath);
        process.exit(1);
    }

    console.log('📥 IMPORTANDO CSV → POSTGRESQL\n');
    console.log(`📂 Arquivo: ${csvPath}\n`);

    const client = new Client({
        host: 'localhost',
        port: 5434,
        database: 'marcos_geodesicos',
        user: 'postgres',
        password: 'marcos123'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');

        // Ler CSV
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');

        console.log(`📊 Total de linhas: ${lines.length}\n`);

        const headers = lines[0].split(',');
        console.log(`📋 Colunas: ${headers.join(', ')}\n`);

        await client.query('BEGIN');

        let inseridos = 0;
        let erros = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const values = parseCsvLine(line);

                if (values.length !== headers.length) {
                    console.warn(`⚠️  Linha ${i + 1}: colunas incorretas, pulando...`);
                    erros++;
                    continue;
                }

                const marco = {};
                headers.forEach((header, idx) => {
                    marco[header] = values[idx] === '' ? null : values[idx];
                });

                // Preparar valores
                const codigo = marco.codigo;
                const tipo = marco.tipo;
                const municipio = marco.municipio;
                const estado = marco.estado || 'PR';
                const coordenada_e = parseFloat(marco.coordenada_e) || null;
                const coordenada_n = parseFloat(marco.coordenada_n) || null;
                const altitude = parseFloat(marco.altitude) || null;
                const latitude = parseFloat(marco.latitude) || null;
                const longitude = parseFloat(marco.longitude) || null;
                const data_levantamento = marco.data_levantamento || null;
                const metodo = marco.metodo || null;
                const precisao_h = parseFloat(marco.precisao_horizontal) || null;
                const precisao_v = parseFloat(marco.precisao_vertical) || null;
                const observacoes = marco.observacoes || null;
                const status = marco.status || 'LEVANTADO';

                // Criar geometria PostGIS
                let geomValue = null;
                if (latitude !== null && longitude !== null) {
                    geomValue = `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;
                }

                await client.query(`
                    INSERT INTO marcos_levantados (
                        codigo, tipo, municipio, estado,
                        coordenada_e, coordenada_n, altitude,
                        latitude, longitude, geom,
                        data_levantamento, metodo,
                        precisao_horizontal, precisao_vertical,
                        observacoes, status
                    ) VALUES (
                        $1, $2, $3, $4,
                        $5, $6, $7,
                        $8, $9, ${geomValue || 'NULL'},
                        $10, $11,
                        $12, $13,
                        $14, $15
                    )
                    ON CONFLICT (codigo) DO UPDATE SET
                        tipo = EXCLUDED.tipo,
                        municipio = EXCLUDED.municipio,
                        coordenada_e = EXCLUDED.coordenada_e,
                        coordenada_n = EXCLUDED.coordenada_n,
                        altitude = EXCLUDED.altitude,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        geom = EXCLUDED.geom,
                        atualizado_em = NOW()
                `, [
                    codigo, tipo, municipio, estado,
                    coordenada_e, coordenada_n, altitude,
                    latitude, longitude,
                    data_levantamento, metodo,
                    precisao_h, precisao_v,
                    observacoes, status
                ]);

                inseridos++;

                if (inseridos % 50 === 0) {
                    console.log(`   ⏳ Processados: ${inseridos} marcos...`);
                }

            } catch (error) {
                console.error(`❌ Erro linha ${i + 1}:`, error.message);
                erros++;
                if (erros > 100) {
                    console.error('\n❌ Muitos erros, abortando...\n');
                    throw new Error('Limite de erros excedido');
                }
            }
        }

        await client.query('COMMIT');

        console.log('\n✅ IMPORTAÇÃO CONCLUÍDA!\n');
        console.log(`   ✅ Inseridos/Atualizados: ${inseridos}`);
        console.log(`   ❌ Erros: ${erros}\n`);

        // Estatísticas
        const stats = await client.query(`
            SELECT
                COUNT(*) as total,
                COUNT(geom) as com_geometria,
                COUNT(CASE WHEN tipo = 'V' THEN 1 END) as tipo_v,
                COUNT(CASE WHEN tipo = 'M' THEN 1 END) as tipo_m,
                COUNT(CASE WHEN tipo = 'P' THEN 1 END) as tipo_p
            FROM marcos_levantados
        `);

        console.log('📊 ESTATÍSTICAS NO POSTGRESQL:');
        console.log(`   Total: ${stats.rows[0].total}`);
        console.log(`   Com geometria: ${stats.rows[0].com_geometria}`);
        console.log(`   Tipo V: ${stats.rows[0].tipo_v}`);
        console.log(`   Tipo M: ${stats.rows[0].tipo_m}`);
        console.log(`   Tipo P: ${stats.rows[0].tipo_p}\n`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro fatal:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

importar().catch(err => {
    console.error('❌ Falha na importação:', err);
    process.exit(1);
});
