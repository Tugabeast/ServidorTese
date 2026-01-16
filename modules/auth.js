const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registar novo utilizador
 *     description: Cria um utilizador do tipo **user**. Verifica duplicação por `username` ou `email`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: goncalo
 *               email:
 *                 type: string
 *                 format: email
 *                 example: goncalo@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 123456
 *     responses:
 *       201:
 *         description: Utilizador criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Utilizador criado com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       409:
 *         description: Utilizador ou email já registado.
 *       500:
 *         description: Erro no servidor.
 */

// rota para o registo da conta
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const checkQuery = 'SELECT username FROM user WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], async (err, results) => {    
        if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

        if (results.length > 0) {
            return res.status(409).json({ message: 'Utilizador ou email já registado.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertQuery = `
                INSERT INTO user (username, password, email, type, createdBy, updatedBy, createdAt, updatedAt)
                VALUES (?, ?, ?, 'user', ?, NULL, NOW(), NULL)
            `;
            db.query(insertQuery, [username, hashedPassword, email, username], (err) => {
                if (err) return res.status(500).json({ message: 'Erro ao criar utilizador', error: err });
                return res.status(201).json({ message: 'Utilizador criado com sucesso.' });
            });
        } catch (error) {
            return res.status(500).json({ message: 'Erro no servidor', error });
        }
    });
});


/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Início de sessão
 *     description: Autentica por `email` e `password` e devolve um **JWT**.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: goncalo@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 123456
 *     responses:
 *       201:
 *         description: Login realizado com sucesso. (Devolve token e info básica do utilizador)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login realizado com sucesso.
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 type:
 *                   type: string
 *                   example: user
 *                 username:
 *                   type: string
 *                   example: goncalo
 *                 userId:
 *                   type: integer
 *                   example: 12
 *       400:
 *         description: Email e password são obrigatórios.
 *       401:
 *         description: Password incorreta.
 *       404:
 *         description: Utilizador não encontrado.
 *       500:
 *         description: Erro no servidor.
 */

// rota para o login 
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e password são obrigatórios.' });
    }

    const query = 'SELECT id, username, email, password, type FROM user WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

        if (results.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }

        const user = results[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Password incorreta.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username, type: user.type },
            process.env.APP_SECRET
        );

        return res.status(201).json({
            message: 'Login realizado com sucesso.',
            token,
            type: user.type,
            username: user.username,
            userId: user.id,
        });
    });
});

module.exports = router;
