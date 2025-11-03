class CARAnalyzer {
    constructor(pool) {
        this.pool = pool;
    }

    async compararPropriedadeComCAR(propriedadeId) {
        try {
            console.log(`🔍 Comparando propriedade #${propriedadeId} com CAR...`);

            const result = await this.pool.query(`
                SELECT
                    ci.id as car_id,
                    ci.codigo_imovel,
                    ci.numero_car,
                    ci.nome_proprietario,
                    ci.area_imovel as area_car_ha,
                    ci.area_vegetacao_nativa,
                    ci.area_app,
                    ci.area_reserva_legal,
                    ci.status_car,
                    ST_Area(ST_Intersection(p.geometry, ci.geometry)) as area_intersecao_m2,
                    (ST_Area(ST_Intersection(p.geometry, ci.geometry)) / ST_Area(p.geometry) * 100) as percentual_intersecao,
                    ST_AsText(ST_Intersection(p.geometry, ci.geometry)) as wkt_intersecao,
                    p.area_calculada as area_propriedade_m2,
                    ABS(p.area_calculada - (ci.area_imovel * 10000)) as diferenca_area_m2,
                    ABS((p.area_calculada - (ci.area_imovel * 10000)) / p.area_calculada * 100) as diferenca_percentual
                FROM propriedades p
                CROSS JOIN car_imoveis ci
                WHERE p.id = $1
                AND p.geometry IS NOT NULL
                AND ci.geometry IS NOT NULL
                AND ST_Intersects(p.geometry, ci.geometry)
                AND ST_Area(ST_Intersection(p.geometry, ci.geometry)) > 1000
                ORDER BY area_intersecao_m2 DESC
                LIMIT 10
            `, [propriedadeId]);

            console.log(`📊 ${result.rows.length} imóveis CAR encontrados com interseção`);

            // Salvar comparações
            for (const row of result.rows) {
                await this.salvarComparacao(propriedadeId, null, row.car_id, row);
            }

            return {
                sucesso: true,
                total_car_encontrados: result.rows.length,
                imoveis_car: result.rows
            };

        } catch (error) {
            console.error('Erro ao comparar com CAR:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async salvarComparacao(propriedadeId, sigefId, carId, dados) {
        try {
            const areasCoincidem = dados.diferenca_percentual < 5; // Tolerância de 5%

            let status = 'conforme';
            if (dados.diferenca_percentual >= 5 && dados.diferenca_percentual < 10) {
                status = 'divergente_leve';
            } else if (dados.diferenca_percentual >= 10) {
                status = 'divergente_grave';
            }

            await this.pool.query(`
                INSERT INTO comparacao_sigef_car (
                    propriedade_local_id,
                    parcela_sigef_id,
                    car_imovel_id,
                    tem_car,
                    tem_sigef,
                    areas_coincidem,
                    diferenca_area_m2,
                    diferenca_percentual,
                    area_intersecao_m2,
                    status_analise
                ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9)
                ON CONFLICT DO NOTHING
            `, [
                propriedadeId,
                sigefId,
                carId,
                sigefId !== null,
                areasCoincidem,
                dados.diferenca_area_m2,
                dados.diferenca_percentual,
                dados.area_intersecao_m2,
                status
            ]);

        } catch (error) {
            console.error('Erro ao salvar comparação:', error);
        }
    }

    async analisarConformidadeAmbiental(propriedadeId) {
        try {
            // Buscar CAR da propriedade
            const carResult = await this.pool.query(`
                SELECT ci.*
                FROM comparacao_sigef_car csc
                JOIN car_imoveis ci ON csc.car_imovel_id = ci.id
                WHERE csc.propriedade_local_id = $1
                ORDER BY csc.area_intersecao_m2 DESC
                LIMIT 1
            `, [propriedadeId]);

            if (carResult.rows.length === 0) {
                return {
                    sucesso: true,
                    tem_car: false,
                    conforme: false,
                    mensagem: 'Imóvel não possui CAR cadastrado'
                };
            }

            const car = carResult.rows[0];

            // Verificar conformidade
            const issues = [];

            // 1. Reserva Legal (mínimo 20% para área geral)
            const percentualRL = (car.area_reserva_legal / car.area_imovel) * 100;
            if (percentualRL < 20) {
                issues.push({
                    tipo: 'reserva_legal',
                    gravidade: 'alta',
                    mensagem: `Reserva Legal insuficiente: ${percentualRL.toFixed(1)}% (mínimo 20%)`
                });
            }

            // 2. Vegetação Nativa
            const percentualVN = (car.area_vegetacao_nativa / car.area_imovel) * 100;
            if (percentualVN < 10) {
                issues.push({
                    tipo: 'vegetacao_nativa',
                    gravidade: 'media',
                    mensagem: `Baixa cobertura de vegetação nativa: ${percentualVN.toFixed(1)}%`
                });
            }

            // 3. APP
            if (!car.area_app || car.area_app === 0) {
                issues.push({
                    tipo: 'app',
                    gravidade: 'media',
                    mensagem: 'Área de Preservação Permanente não declarada'
                });
            }

            const conforme = issues.length === 0;

            return {
                sucesso: true,
                tem_car: true,
                conforme,
                car_id: car.id,
                numero_car: car.numero_car,
                status_car: car.status_car,
                areas: {
                    imovel_ha: car.area_imovel,
                    vegetacao_nativa_ha: car.area_vegetacao_nativa,
                    app_ha: car.area_app,
                    reserva_legal_ha: car.area_reserva_legal,
                    uso_consolidado_ha: car.area_uso_consolidado
                },
                percentuais: {
                    vegetacao_nativa: percentualVN.toFixed(2),
                    reserva_legal: percentualRL.toFixed(2)
                },
                issues,
                nivel_conformidade: conforme ? 'CONFORME' : issues.some(i => i.gravidade === 'alta') ? 'NÃO_CONFORME' : 'ATENÇÃO_NECESSÁRIA'
            };

        } catch (error) {
            console.error('Erro ao analisar conformidade:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async obterEstatisticasCAR(estado = null) {
        try {
            let query = `
                SELECT
                    COUNT(*) as total_imoveis,
                    COUNT(DISTINCT municipio) as total_municipios,
                    SUM(area_imovel) as area_total_ha,
                    SUM(area_vegetacao_nativa) as area_vegetacao_nativa_ha,
                    SUM(area_app) as area_app_ha,
                    SUM(area_reserva_legal) as area_reserva_legal_ha,
                    SUM(area_uso_consolidado) as area_uso_consolidado_ha,
                    COUNT(CASE WHEN tipo_imovel = 'pequena_propriedade' THEN 1 END) as pequenas_propriedades,
                    COUNT(CASE WHEN tipo_imovel = 'media_propriedade' THEN 1 END) as medias_propriedades,
                    COUNT(CASE WHEN tipo_imovel = 'grande_propriedade' THEN 1 END) as grandes_propriedades,
                    COUNT(CASE WHEN status_car = 'ativo' THEN 1 END) as imoveis_ativos,
                    COUNT(CASE WHEN status_car = 'cancelado' THEN 1 END) as imoveis_cancelados
                FROM car_imoveis
            `;

            const params = [];
            if (estado) {
                query += ' WHERE estado = $1';
                params.push(estado);
            }

            const result = await this.pool.query(query, params);

            return {
                sucesso: true,
                estado: estado || 'TODOS',
                estatisticas: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas CAR:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    async buscarImovelPorCPFCNPJ(cpfCnpj) {
        try {
            const result = await this.pool.query(`
                SELECT
                    id,
                    codigo_imovel,
                    numero_car,
                    nome_proprietario,
                    estado,
                    municipio,
                    area_imovel,
                    area_vegetacao_nativa,
                    area_app,
                    area_reserva_legal,
                    status_car,
                    tipo_imovel
                FROM car_imoveis
                WHERE cpf_cnpj = $1
                ORDER BY area_imovel DESC
            `, [cpfCnpj]);

            return {
                sucesso: true,
                total: result.rows.length,
                imoveis: result.rows
            };

        } catch (error) {
            console.error('Erro ao buscar imóvel por CPF/CNPJ:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }
}

module.exports = CARAnalyzer;
