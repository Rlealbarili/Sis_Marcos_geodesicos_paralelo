const turf = require('@turf/turf');

class SpatialAnalyzer {
    constructor(pool) {
        this.pool = pool;
    }

    // Analisar sobreposição de propriedade existente
    async analisarSobreposicao(propriedadeId) {
        try {
            console.log(`🔍 Analisando sobreposições: Propriedade #${propriedadeId}`);

            const result = await this.pool.query(`
                SELECT * FROM analisar_sobreposicao($1)
            `, [propriedadeId]);

            const sobreposicoes = result.rows;

            console.log(`📊 ${sobreposicoes.length} sobreposições encontradas`);

            // Salvar na tabela de histórico
            for (const s of sobreposicoes) {
                await this.salvarSobreposicao(propriedadeId, s);
            }

            return {
                sucesso: true,
                total_sobreposicoes: sobreposicoes.length,
                sobreposicoes: sobreposicoes
            };

        } catch (error) {
            console.error('Erro ao analisar sobreposição:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async salvarSobreposicao(propriedadeId, dados) {
        try {
            await this.pool.query(`
                INSERT INTO sigef_sobreposicoes (
                    propriedade_local_id,
                    parcela_sigef_id,
                    tipo_sobreposicao,
                    area_sobreposicao_m2,
                    percentual_sobreposicao
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
            `, [
                propriedadeId,
                dados.parcela_sigef_id,
                dados.tipo_sobreposicao,
                dados.area_sobreposicao_m2,
                dados.percentual_propriedade
            ]);
        } catch (error) {
            console.error('Erro ao salvar sobreposição:', error);
        }
    }

    // Identificar confrontantes (SIGEF + CAR)
    async identificarConfrontantes(propriedadeId, raioMetros = 500) {
        try {
            console.log(`🔍 Identificando confrontantes: Propriedade #${propriedadeId}`);

            // 1. Buscar confrontantes SIGEF
            const sigefResult = await this.pool.query(`
                SELECT * FROM identificar_confrontantes($1, $2)
            `, [propriedadeId, raioMetros]);

            const confrontantesSIGEF = sigefResult.rows;

            console.log(`📊 ${confrontantesSIGEF.length} confrontantes SIGEF encontrados`);

            // 2. Buscar confrontantes CAR
            let confrontantesCAR = [];
            try {
                const carResult = await this.pool.query(`
                    SELECT * FROM buscar_car_proximos($1, $2)
                `, [propriedadeId, raioMetros]);

                confrontantesCAR = carResult.rows.map(row => ({
                    car_id: row.car_id,
                    codigo_car: row.codigo_car,
                    nome_proprietario: `Imóvel CAR - ${row.municipio}`,
                    tipo_confrontacao: row.intersecta ? 'Sobreposição' : 'Próximo',
                    municipio: row.municipio,
                    area_ha: parseFloat(row.area_ha || 0),
                    distancia_m: parseFloat(row.distancia_m || 0),
                    azimute_graus: parseFloat(row.azimute || 0),
                    situacao: row.situacao,
                    fonte: 'CAR'
                }));

                console.log(`🌾 ${confrontantesCAR.length} confrontantes CAR encontrados`);
            } catch (carError) {
                console.warn('⚠️  Erro ao buscar confrontantes CAR:', carError.message);
                // Continua sem confrontantes CAR
            }

            // 3. Salvar confrontantes SIGEF na tabela
            for (const c of confrontantesSIGEF) {
                await this.salvarConfrontante(propriedadeId, c);
            }

            // 4. Combinar resultados
            const todosConfrontantes = [
                ...confrontantesSIGEF,
                ...confrontantesCAR
            ];

            console.log(`✅ Total: ${todosConfrontantes.length} confrontantes (${confrontantesSIGEF.length} SIGEF + ${confrontantesCAR.length} CAR)`);

            return {
                sucesso: true,
                total_confrontantes: todosConfrontantes.length,
                total_sigef: confrontantesSIGEF.length,
                total_car: confrontantesCAR.length,
                confrontantes: todosConfrontantes
            };

        } catch (error) {
            console.error('Erro ao identificar confrontantes:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async salvarConfrontante(propriedadeId, dados) {
        try {
            await this.pool.query(`
                INSERT INTO sigef_confrontantes (
                    parcela_id,
                    parcela_vizinha_id,
                    tipo_contato,
                    distancia_m,
                    comprimento_contato_m,
                    azimute
                )
                SELECT $1, $2, $3, $4, $5, $6
                WHERE EXISTS (SELECT 1 FROM propriedades WHERE id = $1)
                ON CONFLICT DO NOTHING
            `, [
                propriedadeId,
                dados.parcela_sigef_id,
                dados.tipo_contato,
                dados.distancia_m,
                dados.comprimento_contato_m,
                dados.azimute
            ]);
        } catch (error) {
            // Ignora erros de constraint
        }
    }

    // Calcular score de viabilidade
    async calcularScoreViabilidade(propriedadeId) {
        try {
            const result = await this.pool.query(`
                SELECT * FROM calcular_score_viabilidade($1)
            `, [propriedadeId]);

            return {
                sucesso: true,
                ...result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao calcular score:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    // Analisar área desenhada no mapa (PRÉ-cadastro)
    async analisarAreaPreCadastro(geometryWKT, srid = 31982) {
        try {
            console.log('🔍 Analisando área pré-cadastro');

            const result = await this.pool.query(`
                SELECT * FROM analisar_area_pre_cadastro($1, $2)
            `, [geometryWKT, srid]);

            return {
                sucesso: true,
                ...result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao analisar área:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    // Análise completa de propriedade
    async analiseCompleta(propriedadeId) {
        try {
            console.log(`🔬 Executando análise completa: Propriedade #${propriedadeId}`);

            const [sobreposicoes, confrontantes, score] = await Promise.all([
                this.analisarSobreposicao(propriedadeId),
                this.identificarConfrontantes(propriedadeId),
                this.calcularScoreViabilidade(propriedadeId)
            ]);

            return {
                sucesso: true,
                propriedade_id: propriedadeId,
                sobreposicoes,
                confrontantes,
                score
            };

        } catch (error) {
            console.error('Erro na análise completa:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    // Obter estatísticas gerais de análise
    async getEstatisticas() {
        try {
            const result = await this.pool.query(`
                SELECT
                    COUNT(DISTINCT propriedade_local_id) as propriedades_analisadas,
                    COUNT(*) as total_sobreposicoes,
                    SUM(area_sobreposicao_m2) as area_total_sobreposta_m2,
                    AVG(percentual_sobreposicao) as media_percentual_sobreposicao
                FROM sigef_sobreposicoes
            `);

            const confrontantesResult = await this.pool.query(`
                SELECT COUNT(*) as total_confrontantes
                FROM sigef_confrontantes
            `);

            return {
                sucesso: true,
                ...result.rows[0],
                ...confrontantesResult.rows[0]
            };

        } catch (error) {
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }
}

module.exports = SpatialAnalyzer;
