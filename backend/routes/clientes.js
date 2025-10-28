const express = require('express');
const router = express.Router();
const { query } = require('../database/postgres-connection');

// ========================================
// GET /api/clientes - Listar todos
// ========================================

router.get('/', async (req, res) => {
    try {
        const { tipo_pessoa, ativo, busca } = req.query;

        let sqlQuery = 'SELECT * FROM vw_clientes_completa WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filtros
        if (tipo_pessoa && tipo_pessoa !== 'todos') {
            sqlQuery += ` AND tipo_pessoa = $${paramIndex}`;
            params.push(tipo_pessoa);
            paramIndex++;
        }

        if (ativo !== undefined) {
            sqlQuery += ` AND ativo = $${paramIndex}`;
            params.push(ativo === 'true');
            paramIndex++;
        }

        if (busca) {
            sqlQuery += ` AND (nome ILIKE $${paramIndex} OR cpf_cnpj ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${busca}%`);
            paramIndex++;
        }

        sqlQuery += ' ORDER BY nome ASC';

        const result = await query(sqlQuery, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar clientes',
            error: error.message
        });
    }
});

// ========================================
// GET /api/clientes/:id - Buscar por ID
// ========================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM vw_clientes_completa WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar cliente',
            error: error.message
        });
    }
});

// ========================================
// POST /api/clientes - Criar novo
// ========================================

router.post('/', async (req, res) => {
    try {
        const { nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, observacoes } = req.body;

        // Validações
        if (!nome || !tipo_pessoa) {
            return res.status(400).json({
                success: false,
                message: 'Nome e tipo de pessoa são obrigatórios'
            });
        }

        if (!['fisica', 'juridica'].includes(tipo_pessoa)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de pessoa inválido (use "fisica" ou "juridica")'
            });
        }

        const result = await query(
            `INSERT INTO clientes
            (nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, observacoes]
        );

        res.status(201).json({
            success: true,
            message: 'Cliente criado com sucesso',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar cliente:', error);

        if (error.code === '23505') { // Unique violation
            return res.status(400).json({
                success: false,
                message: 'CPF/CNPJ já cadastrado'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro ao criar cliente',
            error: error.message
        });
    }
});

// ========================================
// PUT /api/clientes/:id - Atualizar
// ========================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, observacoes, ativo } = req.body;

        const result = await query(
            `UPDATE clientes
            SET nome = COALESCE($1, nome),
                tipo_pessoa = COALESCE($2, tipo_pessoa),
                cpf_cnpj = COALESCE($3, cpf_cnpj),
                email = COALESCE($4, email),
                telefone = COALESCE($5, telefone),
                endereco = COALESCE($6, endereco),
                observacoes = COALESCE($7, observacoes),
                ativo = COALESCE($8, ativo)
            WHERE id = $9
            RETURNING *`,
            [nome, tipo_pessoa, cpf_cnpj, email, telefone, endereco, observacoes, ativo, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Cliente atualizado com sucesso',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar cliente',
            error: error.message
        });
    }
});

// ========================================
// DELETE /api/clientes/:id - Excluir
// ========================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se tem propriedades vinculadas
        const checkProps = await query(
            'SELECT COUNT(*) as count FROM propriedades WHERE cliente_id = $1',
            [id]
        );

        if (parseInt(checkProps.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir cliente com propriedades vinculadas'
            });
        }

        const result = await query(
            'DELETE FROM clientes WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Cliente excluído com sucesso'
        });

    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir cliente',
            error: error.message
        });
    }
});

module.exports = router;
