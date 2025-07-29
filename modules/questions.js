const express = require('express');
const router = express.Router();
const db = require('../config/db');

// LISTAR TODAS AS PERGUNTAS COM O ESTUDO
router.get('/', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Username não fornecido.' });
    }

    const query = `
        SELECT q.id, q.question, q.content, q.inputType, s.name as studyName, q.studyId
        FROM question q
        JOIN study s ON q.studyId = s.id
        WHERE s.addedBy = ?
        ORDER BY q.createdAt DESC
    `;

    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao procurar perguntas.', error: err });
        res.json(results);
    });
});

// LISTAR PERGUNTAS DE UM ESTUDO
router.get('/:studyId', (req, res) => {
    const { studyId } = req.params;

    const query = `
        SELECT id, question, content, inputType, createdAt
        FROM question
        WHERE studyId = ?
        ORDER BY createdAt DESC
    `;

    db.query(query, [studyId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao procurar perguntas.', error: err });
        res.json(results);
    });
});

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

// ATUALIZAR PERGUNTA
router.put('/:questionId', (req, res) => {
    const { question, content, inputType } = req.body;
    const { questionId } = req.params;

    const query = `
        UPDATE question 
        SET question = ?, content = ?, inputType = ?
        WHERE id = ?
    `;

    db.query(query, [question, content, inputType, questionId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao atualizar pergunta.', error: err });
        res.json({ message: 'Pergunta atualizada com sucesso.' });
    });
});

// 🔹 APAGAR PERGUNTA
router.delete('/:questionId', (req, res) => {
    const { questionId } = req.params;

    const query = 'DELETE FROM question WHERE id = ?';
    db.query(query, [questionId], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar pergunta.', error: err });
        res.json({ message: 'Pergunta apagada com sucesso.' });
    });
});

module.exports = router;
