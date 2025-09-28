const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @openapi
 * /questions/{studyId}:
 *   get:
 *     tags: [Questions]
 *     summary: Listar perguntas de um estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *      200:
 *         description: Lista de perguntas do estudo.
 *      400:
 *         description: Campos obrigatórios em falta.
 *      404:
 *         description: Não foram encontradas perguntas para o estudo.
 *      500:
 *         description: Erro ao procurar perguntas.
 */

// LISTAR PERGUNTAS DE UM ESTUDO
router.get('/:studyId', (req, res) => {
    const { studyId } = req.params;

    if (!studyId) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = `
        SELECT id, question, content, inputType, createdAt
        FROM question
        WHERE studyId = ?
        ORDER BY createdAt DESC
    `;

    db.query(query, [studyId], (err, results) => {
        if (err) {
        return res
            .status(500)
            .json({ message: 'Erro ao procurar perguntas.', error: err });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ message: 'Não foram encontradas perguntas para o estudo.' });
        }

        res.status(200).json(results);
    });
});

/**
 * @openapi
 * /questions:
 *   post:
 *     tags: [Questions]
 *     summary: Criar pergunta
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, content, inputType, studyId]
 *             properties:
 *               question: { type: string, example: "A publicação é..." }
 *               content: { type: string, example: "Selecione as categorias pertinentes" }
 *               inputType: { type: string, example: "checkbox" }
 *               studyId: { type: integer, example: 4 }
 *     responses:
 *       201:
 *         description: Pergunta criada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       500:
 *         description: Erro ao criar pergunta.
 */

// 🔹 CRIAR PERGUNTA
router.post('/', (req, res) => {
    const { question, content, inputType, studyId } = req.body;

    if (!question || !content || !inputType || !studyId) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const insertQuery = `
        INSERT INTO question (question, content, inputType, studyId, createdAt)
        VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [question, content, inputType, studyId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao criar pergunta.', error: err });
            res.status(201).json({ message: 'Pergunta criada com sucesso.' });
    });
});

/**
 * @openapi
 * /questions/{questionId}:
 *   put:
 *     tags: [Questions]
 *     summary: Atualizar pergunta
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question: { type: string }
 *               content: { type: string }
 *               inputType: { type: string }
 *     responses:
 *       200:
 *         description: Pergunta atualizada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       404:
 *         description: Pergunta não encontrada.
 *       500:
 *         description: Erro ao atualizar pergunta.
 */

// ATUALIZAR PERGUNTA
router.put('/:questionId', (req, res) => {
    const { question, content, inputType } = req.body;
    const { questionId } = req.params;

    // 🔹 Verificação de campos obrigatórios
    if (!questionId || !question || !content || !inputType) {
        return res
        .status(400)
        .json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = `
        UPDATE question 
        SET question = ?, content = ?, inputType = ?
        WHERE id = ?
    `;

    db.query(query, [question, content, inputType, questionId], (err, result) => {
        if (err) {
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar pergunta.', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pergunta não encontrada.' });
        }

        res.status(200).json({ message: 'Pergunta atualizada com sucesso.' });
    });
});

/**
 * @openapi
 * /questions/{questionId}:
 *   delete:
 *     tags: [Questions]
 *     summary: Apagar pergunta
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pergunta apagada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       404:
 *         description: Pergunta não encontrada.
 *       500:
 *         description: Erro ao apagar pergunta.
 */

// 🔹 APAGAR PERGUNTA
router.delete('/:questionId', (req, res) => {
    const { questionId } = req.params;

    // 🔹 Verificação de campo obrigatório
    if (!questionId) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = 'DELETE FROM question WHERE id = ?';
    db.query(query, [questionId], (err, result) => {
        if (err) {
        return res
            .status(500)
            .json({ message: 'Erro ao apagar pergunta.', error: err });
        }

        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pergunta não encontrada.' });
        }

        res.status(200).json({ message: 'Pergunta apagada com sucesso.' });
    });
});

module.exports = router;
