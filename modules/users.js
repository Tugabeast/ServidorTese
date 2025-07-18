const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

// rota para obter todos os utilizadores
router.get('/', (req, res) => {
    const query = `
        SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy
        FROM user
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar utilizadores', error: err });
        res.status(200).json(results);
    });
});

// rota para obter user pode id
router.get('/:userId', (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy
        FROM user
        WHERE id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar utilizador', error: err });
        if (results.length === 0) return res.status(404).json({ message: 'Utilizador não encontrado' });
        res.status(200).json(results[0]);
    });
});

// rota para adicionar um utilizador (ADMIN OU INVESTIGADOR)
router.post('/', async (req, res) => {
    const { username, password, email, type, createdBy } = req.body;

    if (!username || !password || !email || !type) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const checkQuery = 'SELECT username FROM user WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

        if (results.length > 0) {
            return res.status(409).json({ message: 'Utilizador ou email já registado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const insertQuery = `
            INSERT INTO user (username, password, email, type, createdBy, updatedBy, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, NULL, NOW(), NULL)
        `;
        db.query(
            insertQuery,
            [username, hashedPassword, email, type, createdBy || 'admin'],
            (err) => {
                if (err) return res.status(500).json({ message: 'Erro ao criar utilizador', error: err });
                res.status(201).json({ message: 'Utilizador adicionado com sucesso.' });
            }
        );
    });
});

// rota para atualizar um utilizador
router.put('/:userId', async (req, res) => {
    const { username, email, type, password, updatedBy } = req.body;
    const { userId } = req.params;

    if (!username || !email || !type) {
        return res.status(400).json({ message: 'Username, email e tipo são obrigatórios.' });
    }

    try {
        let query = `
            UPDATE user SET username = ?, email = ?, type = ?, updatedAt = NOW(), updatedBy = ?
        `;
        const params = [username, email, type, updatedBy || 'system'];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `, password = ?`;
            params.push(hashedPassword);
        }

        query += ` WHERE id = ?`;
        params.push(userId);

        db.query(query, params, (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'Username ou email já existe.' });
                }
                return res.status(500).json({ message: 'Erro ao atualizar utilizador', error: err });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Utilizador não encontrado.' });
            }

            res.status(200).json({ message: 'Utilizador atualizado com sucesso.' });
        });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno do servidor', error: err });
    }
});

// rota para apagar um utilizador
router.delete('/:userId', (req, res) => {
    const { userId } = req.params;

    const query = 'DELETE FROM user WHERE id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Erro ao apagar utilizador', error: err });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });

        res.status(200).json({ message: 'Utilizador removido com sucesso.' });
    });
});

module.exports = router;
