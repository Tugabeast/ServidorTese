const express = require('express');
const router = express.Router();
const db = require('../config/db');

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
        res.json(results);
    });
});

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
        res.json({ message: 'Categoria atualizada com sucesso.' });
    });
});

// ELIMINAR CATEGORIA
router.delete('/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    db.query('DELETE FROM categories WHERE id = ?', [categoryId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar categoria.', error: err });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Categoria não encontrada.' });
        res.json({ message: 'Categoria apagada com sucesso.' });
    });
});

module.exports = router;
