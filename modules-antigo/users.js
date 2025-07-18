const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middlewares/authMiddleware');
require('dotenv').config();

// 🔓 Públicas

// Registar novo utilizador
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  const checkQuery = 'SELECT username FROM user WHERE username = ? OR email = ?';
  db.query(checkQuery, [username, email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

    if (results.length > 0) {
      return res.status(409).json({ message: 'Utilizador ou email já registado' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const insertQuery = `
        INSERT INTO user (username, password, email, type, createdBy, updatedBy, createdAt, updatedAt)
        VALUES (?, ?, ?, 'user', ?, NULL, NOW(), NULL)
      `;

      db.query(insertQuery, [username, hashedPassword, email, username], (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao criar utilizador', error: err });

        return res.status(201).json({ message: 'Utilizador criado com sucesso' });
      });

    } catch (error) {
      return res.status(500).json({ message: 'Erro ao processar password', error });
    }
  });
});


// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e password são obrigatórios' });
  }

  const query = 'SELECT id, username, email, password, type FROM user WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    const user = results[0];
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Password incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, type: user.type },
      process.env.APP_SECRET
    );

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      type: user.type,
      username: user.username,
      userId: user.id,
    });
  });
});

// 🔒 Protegidas

// Obter todos os utilizadores
router.get('/getAll', authMiddleware, (req, res) => {
  const query = 'SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy FROM user';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar utilizadores', error: err });
    res.status(200).json(results);
  });
});

// Obter utilizador por ID
router.get('/getUser/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy FROM user WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro ao buscar utilizador', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Utilizador não encontrado' });
    res.status(200).json(results[0]);
  });
});

// Adicionar novo utilizador (admin/investigador)
router.post('/add', authMiddleware, async (req, res) => {
  const { username, password, email, type, createdBy } = req.body;

  if (!username || !password || !email || !type) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta' });
  }

  const checkQuery = 'SELECT username FROM user WHERE username = ? OR email = ?';
  db.query(checkQuery, [username, email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

    if (results.length > 0) {
      return res.status(409).json({ message: 'Utilizador ou email já registado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO user (username, password, email, type, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, NULL, NOW(), NULL)
    `;
    db.query(
      insertQuery,
      [
        username,
        hashedPassword,
        email,
        type,
        createdBy || 'admin',
        createdBy || 'admin',
      ],
      (err) => {
        if (err) return res.status(500).json({ message: 'Erro ao criar utilizador', error: err });

        res.status(201).json({ message: 'Utilizador adicionado com sucesso' });
      }
    );
  });
});

// Atualizar utilizador
router.put('/EditUser/:userId', authMiddleware, async (req, res) => {
  // 1. Adicionar 'username' aos dados recebidos do body
  const { username, email, type, password, updatedBy } = req.body;
  const { userId } = req.params;

  // Validação básica para os campos essenciais
  if (!username || !email || !type) {
    return res.status(400).json({ message: 'Username, email e tipo são obrigatórios' });
  }

  try {
    // 2. Adicionar o campo 'username' à query SQL e aos parâmetros
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
        // Tratar erro de username/email duplicado
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Username ou email já existe.' });
        }
        return res.status(500).json({ message: 'Erro ao atualizar utilizador', error: err });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Utilizador não encontrado' });
      }

      res.status(200).json({ message: 'Utilizador atualizado com sucesso' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor', error: err });
  }
});

// Apagar utilizador
router.delete('/DeleteUser/:userId', authMiddleware, (req, res) => {
  const { userId } = req.params;

  const query = 'DELETE FROM user WHERE id = ?';
  db.query(query, [userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Erro ao apagar utilizador', error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Utilizador não encontrado' });

    res.status(200).json({ message: 'Utilizador removido com sucesso' });
  });
});

module.exports = router;
