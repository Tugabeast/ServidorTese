const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Listar todas as categorias
 *     description: Retorna todas as categorias associadas ao investigador (`addedBy`) correspondente ao `username`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome de utilizador do investigador.
 *     responses:
 *       200:
 *         description: Lista de categorias.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   categoryType:
 *                     type: string
 *                     example: tematicas
 *                   questionId:
 *                     type: integer
 *                   questionName:
 *                     type: string
 *       400:
 *         description: Nome de utilizador não fornecido.
 *       500:
 *         description: Erro ao procurar categorias.
 */

// LISTAR TODAS AS CATEGORIAS
router.get('/', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Nome de utilizador não fornecido.' });
    }

    const query = `
        SELECT c.*, q.question AS questionName
        FROM categories c
        LEFT JOIN question q ON c.questionId = q.id
        LEFT JOIN study s ON q.studyId = s.id
        WHERE s.addedBy = ?
        ORDER BY c.categoryType, c.name
    `;

    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao procurar categorias.', error: err });
        res.status(200).json(results);
    });
});

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Criar nova categoria
 *     description: Cria uma nova categoria associada a uma pergunta (`questionId`).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryType, questionId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fake News
 *               categoryType:
 *                 type: string
 *                 example: tematicas
 *               questionId:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       409:
 *         description: Categoria já existe.
 *       500:
 *         description: Erro ao criar categoria.
 */

// CRIAR NOVA CATEGORIA
router.post('/', (req, res) => {
    const { name, categoryType, questionId } = req.body;

    if (!name || !categoryType || !questionId) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const checkQuery = 'SELECT COUNT(*) AS count FROM categories WHERE name = ?';
    db.query(checkQuery, [name], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao verificar duplicação.', error: err });

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Categoria já existe.' });
        }

        const insertQuery = `
            INSERT INTO categories (name, categoryType, questionId, createdAt)
            VALUES (?, ?, ?, NOW())
        `;
        db.query(insertQuery, [name, categoryType, questionId], (err) => {
            if (err) return res.status(500).json({ message: 'Erro ao criar categoria.', error: err });
            res.status(201).json({ message: 'Categoria criada com sucesso.' });
        });
    });
});

/**
 * @openapi
 * /categories/{categoryId}:
 *   put:
 *     tags: [Categories]
 *     summary: Atualizar categoria
 *     description: Atualiza os dados de uma categoria existente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryType, questionId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Desinformação
 *               categoryType:
 *                 type: string
 *                 example: sentimento
 *               questionId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       500:
 *         description: Erro ao atualizar categoria.
 */

// ATUALIZAR CATEGORIA
router.put('/:categoryId', (req, res) => {
    const { name, categoryType, questionId } = req.body;
    const { categoryId } = req.params;

    if (!name || !categoryType || !questionId) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = `
        UPDATE categories
        SET name = ?, categoryType = ?, questionId = ?
        WHERE id = ?
    `;
    db.query(query, [name, categoryType, questionId, categoryId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao atualizar categoria.', error: err });
        res.status(201).json({ message: 'Categoria atualizada com sucesso.' });
    });
});

/**
 * @openapi
 * /categories/{categoryId}:
 *   delete:
 *     tags: [Categories]
 *     summary: Apagar categoria
 *     description: Elimina uma categoria pelo seu ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Categoria apagada com sucesso.
 *       404:
 *         description: Categoria não encontrada.
 *       500:
 *         description: Erro ao apagar categoria.
 */

// ELIMINAR CATEGORIA
router.delete('/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    db.query('DELETE FROM categories WHERE id = ?', [categoryId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar categoria.', error: err });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Categoria não encontrada.' });
        res.status(201).json({ message: 'Categoria apagada com sucesso.' });
    });
});

module.exports = router;
