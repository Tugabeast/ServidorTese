const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 LISTAR ESTUDOS
router.get('/', (req, res) => {
    const query = `
        SELECT id, name, obs, addedBy, startedAt, updatedBy, finishedAt, createdAt, updatedAt
        FROM studies
        ORDER BY createdAt DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar estudos.', error: err });
        res.json(results);
    });
});

// 🔹 CRIAR ESTUDO
router.post('/', (req, res) => {
    const { name, obs, addedBy } = req.body;

    if (!name || !addedBy) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const checkQuery = 'SELECT COUNT(*) AS count FROM studies WHERE name = ?';
    db.query(checkQuery, [name], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao verificar duplicação.' });

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Estudo já existe.' });
        }

        const insertQuery = `
            INSERT INTO studies (name, obs, addedBy, startedAt, createdAt)
            VALUES (?, ?, ?, NOW(), NOW())
        `;
        db.query(insertQuery, [name, obs, addedBy], (err) => {
            if (err) return res.status(500).json({ message: 'Erro ao criar estudo.', error: err });
            res.status(201).json({ message: 'Estudo criado com sucesso.' });
        });
    });
});

// 🔹 ATUALIZAR ESTUDO
router.put('/:studyId', (req, res) => {
    const { name, obs, updatedBy, finishedAt } = req.body;
    const { studyId } = req.params;

    let query = `
        UPDATE studies SET name = ?, obs = ?, updatedBy = ?, updatedAt = NOW()
    `;
    const params = [name, obs, updatedBy];

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

// 🔹 APAGAR ESTUDO
router.delete('/:studyId', (req, res) => {
    const { studyId } = req.params;
    db.query('DELETE FROM studies WHERE id = ?', [studyId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar estudo.', error: err });
        res.json({ message: 'Estudo apagado com sucesso.' });
    });
});

module.exports = router;
