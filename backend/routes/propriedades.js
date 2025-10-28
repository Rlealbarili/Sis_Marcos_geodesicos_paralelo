const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres-connection');

// ========================================
// GET /api/propriedades - Listar todas
// ========================================

router.get('/', async (req, res) => {
    try {
        const { tipo, municipio, cliente_id, ativo, busca } = req.query;

        let sqlQuery = 'SELECT * FROM vw_propriedades_completa WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filtros
        if (tipo && tipo !== 'todos') {
            sqlQuery += ` AND tipo = $${paramIndex}`;
            params.push(tipo.toUpperCase());
            paramIndex++;
        }

        if (municipio && municipio !== 'todos') {
            sqlQuery += ` AND municipio = $${paramIndex}`;
            params.push(municipio);
            paramIndex++;
        }

        if (cliente_id) {
            sqlQuery += ` AND cliente_id = $${paramIndex}`;
            params.push(cliente_id);
            paramIndex++;
        }

        if (ativo !== undefined) {
            sqlQuery += ` AND ativo = $${paramIndex}`;
            params.push(ativo === 'true');
            paramIndex++;
        }

        if (busca) {
            sqlQuery += ` AND (nome_propriedade ILIKE $${paramIndex} OR municipio ILIKE $${paramIndex} OR matricula ILIKE $${paramIndex})`;
            params.push(`%${busca}%`);
            paramIndex++;
        }

        sqlQuery += ' ORDER BY nome_propriedade ASC';

        const result = await query(sqlQuery, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Erro ao buscar propriedades:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar propriedades',
            error: error.message
        });
    }
});

// ========================================
// GET /api/propriedades/:id - Buscar por ID
// ========================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM vw_propriedades_completa WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao buscar propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar propriedade',
            error: error.message
        });
    }
});

// ========================================
// POST /api/propriedades - Criar nova
// ========================================

router.post('/', async (req, res) => {
    try {
        const {
            nome_propriedade,
            tipo,
            matricula,
            municipio,
            comarca,
            uf,
            area_m2,
            perimetro_m,
            endereco,
            cliente_id,
            observacoes
        } = req.body;

        // Validações
        if (!nome_propriedade || !tipo || !municipio) {
            return res.status(400).json({
                success: false,
                message: 'Nome, tipo e município são obrigatórios'
            });
        }

        const tipoUpper = tipo.toUpperCase();
        if (!['RURAL', 'URBANA', 'INDUSTRIAL', 'COMERCIAL'].includes(tipoUpper)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo inválido (use: RURAL, URBANA, INDUSTRIAL, COMERCIAL)'
            });
        }

        const result = await query(
            `INSERT INTO propriedades
            (nome_propriedade, tipo, matricula, municipio, comarca, uf, area_m2, perimetro_m, endereco, cliente_id, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [nome_propriedade, tipoUpper, matricula, municipio, comarca, uf || 'PR', area_m2, perimetro_m, endereco, cliente_id, observacoes]
        );

        res.status(201).json({
            success: true,
            message: 'Propriedade criada com sucesso',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar propriedade:', error);

        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao criar propriedade',
            error: error.message
        });
    }
});

// ========================================
// PUT /api/propriedades/:id - Atualizar
// ========================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome_propriedade,
            tipo,
            matricula,
            municipio,
            comarca,
            uf,
            area_m2,
            perimetro_m,
            endereco,
            cliente_id,
            observacoes,
            ativo
        } = req.body;

        // Converter tipo para uppercase se fornecido
        const tipoUpper = tipo ? tipo.toUpperCase() : null;

        const result = await query(
            `UPDATE propriedades
            SET nome_propriedade = COALESCE($1, nome_propriedade),
                tipo = COALESCE($2, tipo),
                matricula = COALESCE($3, matricula),
                municipio = COALESCE($4, municipio),
                comarca = COALESCE($5, comarca),
                uf = COALESCE($6, uf),
                area_m2 = COALESCE($7, area_m2),
                perimetro_m = COALESCE($8, perimetro_m),
                endereco = COALESCE($9, endereco),
                cliente_id = COALESCE($10, cliente_id),
                observacoes = COALESCE($11, observacoes),
                ativo = COALESCE($12, ativo)
            WHERE id = $13
            RETURNING *`,
            [nome_propriedade, tipoUpper, matricula, municipio, comarca, uf, area_m2, perimetro_m, endereco, cliente_id, observacoes, ativo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Propriedade atualizada com sucesso',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar propriedade',
            error: error.message
        });
    }
});

// ========================================
// DELETE /api/propriedades/:id - Excluir
// ========================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se tem marcos vinculados (se tabela marcos_geodesicos existir)
        try {
            const checkMarcos = await query(
                `SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'marcos_geodesicos'
                ) as table_exists`,
                []
            );

            if (checkMarcos.rows[0].table_exists) {
                const countMarcos = await query(
                    'SELECT COUNT(*) as count FROM marcos_geodesicos WHERE propriedade_id = $1',
                    [id]
                );

                if (parseInt(countMarcos.rows[0].count) > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Não é possível excluir propriedade com marcos vinculados'
                    });
                }
            }
        } catch (checkError) {
            // Se der erro ao verificar, continua com a exclusão
            console.warn('Aviso ao verificar marcos:', checkError.message);
        }

        const result = await query(
            'DELETE FROM propriedades WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Propriedade não encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Propriedade excluída com sucesso'
        });

    } catch (error) {
        console.error('Erro ao excluir propriedade:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir propriedade',
            error: error.message
        });
    }
});

module.exports = router;
