const express = require('express');
const router = express.Router();
const db = require('../config/db');

// LISTAR ESTUDOS DE UM UTILIZADOR
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
        if (err) return res.status(500).json({ message: 'Erro ao procurar estudos.', error: err });
        res.json(results);
    });
});


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
            res.json({ message: 'Estudo atualizado com sucesso.' });
        });
    });
});


// 🔹 APAGAR ESTUDO
router.delete('/:studyId', (req, res) => {
    db.query('DELETE FROM study WHERE id = ?', [req.params.studyId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar estudo.', error: err });
        res.json({ message: 'Estudo apagado com sucesso.' });
    });
});

module.exports = router;
