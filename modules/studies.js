const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @openapi
 * /studies:
 *   get:
 *     tags: [Studies]
 *     summary: Listar estudos de um utilizador (investigador)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema: { type: string }
 *         description: Investigador (addedBy) dono dos estudos.
 *     responses:
 *       200:
 *         description: Lista de estudos.
 *       400:
 *         description: Username não fornecido.
 *       500:
 *         description: Erro ao procurar estudos.
 */
// LISTAR ESTUDOS DE UM Ivnestigador
router.get('/', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Username não fornecido.' });
    }

    const query = `
        SELECT 
            id, name, obs, addedBy, startedAt, updatedBy, finishedAt,
            createdAt, updatedAt, minClassificationsPerPost, validationAgreementPercent
        FROM study
        WHERE addedBy = ?
        ORDER BY createdAt DESC
    `;
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao obter estudos.', error: err });
        res.status(200).json(results);
    });
});

/**
 * @openapi
 * /studies:
 *   post:
 *     tags: [Studies]
 *     summary: Criar estudo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, addedBy]
 *             properties:
 *               name: { type: string, example: "Eleições 2026" }
 *               obs: { type: string, example: "Posts do X/Twitter" }
 *               addedBy: { type: string, example: "goncalo" }
 *               minClassificationsPerPost: { type: integer, example: 3 }
 *               validationAgreementPercent: { type: integer, example: 60 }
 *     responses:
 *       201:
 *         description: Estudo criado com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       409:
 *         description: Estudo já existe.
 *       500:
 *         description: Erro ao criar estudo.
 */

// 🔹 CRIAR ESTUDO
router.post('/', (req, res) => {
    const { name, obs, addedBy, minClassificationsPerPost, validationAgreementPercent } = req.body;

    if (!name || !addedBy) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const checkQuery = 'SELECT COUNT(*) AS count FROM study WHERE name = ?';
    db.query(checkQuery, [name], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao verificar duplicação.' });

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Estudo já existe.' });
        }

        const insertQuery = `
            INSERT INTO study (name, obs, addedBy, startedAt, createdAt, minClassificationsPerPost, validationAgreementPercent)
            VALUES (?, ?, ?, NOW(), NOW(), ?, ?)
        `;
        db.query(insertQuery, [name, obs, addedBy, minClassificationsPerPost, validationAgreementPercent], (err) => {
            if (err) return res.status(500).json({ message: 'Erro ao criar estudo.', error: err });
            res.status(201).json({ message: 'Estudo criado com sucesso.' });
        });
    });
});


/**
 * @openapi
 * /studies/{studyId}:
 *   put:
 *     tags: [Studies]
 *     summary: Atualizar estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               obs: { type: string }
 *               updatedBy: { type: string }
 *               finishedAt: { type: string, format: date-time }
 *               minClassificationsPerPost: { type: integer }
 *               validationAgreementPercent: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo atualizado com sucesso.
 *       409:
 *         description: Já existe outro estudo com esse nome.
 *       500:
 *         description: Erro ao atualizar estudo.
 */

// 🔹 ATUALIZAR ESTUDO
router.put('/:studyId', (req, res) => {
    const { name, obs, updatedBy, finishedAt, minClassificationsPerPost, validationAgreementPercent } = req.body;
    const { studyId } = req.params;

    // Verificar duplicação (mas excluir o próprio estudo)
    const checkQuery = 'SELECT COUNT(*) AS count FROM study WHERE name = ? AND id != ?';
    db.query(checkQuery, [name, studyId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao verificar duplicação.' });

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Já existe outro estudo com esse nome.' });
        }

        let query = `
            UPDATE study SET 
                name = ?, obs = ?, updatedBy = ?, updatedAt = NOW(),
                minClassificationsPerPost = ?, validationAgreementPercent = ?
        `;
        const params = [name, obs, updatedBy, minClassificationsPerPost, validationAgreementPercent];

        if (finishedAt) {
            query += ', finishedAt = ?';
            params.push(finishedAt);
        }

        query += ' WHERE id = ?';
        params.push(studyId);

        db.query(query, params, (err) => {
            if (err) return res.status(500).json({ message: 'Erro ao atualizar estudo.', error: err });
            res.status(200).json({ message: 'Estudo atualizado com sucesso.' });
        });
    });
});

/**
 * @openapi
 * /studies/{studyId}:
 *   delete:
 *     tags: [Studies]
 *     summary: Apagar estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo apagado com sucesso.
 *       404:
 *         description: Estudo não encontrado.
 *       500:
 *         description: Erro ao apagar estudo.
 */

// 🔹 APAGAR ESTUDO
router.delete('/:studyId', (req, res) => {
    db.query('DELETE FROM study WHERE id = ?', [req.params.studyId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao apagar estudo.', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Estudo não encontrado.' });
        }

        res.status(200).json({ message: 'Estudo apagado com sucesso.' });
    });
});


module.exports = router;
