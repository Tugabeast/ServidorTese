const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');

router.post('/', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  // Verifica se o utilizador já existe
  const checkQuery = 'SELECT username FROM users WHERE username = ? OR email = ?';
  db.query(checkQuery, [username, email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

    if (results.length > 0) {
      return res.status(409).json({ message: 'Uutilizador ou email já registado' });
    }

    // Criptografa a senha 
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO users (username, name, password, email, type, active, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'user', 1, 'user' , 'user' , NOW(), NOW())
    `;

    db.query(insertQuery, [username, username, hashedPassword, email], (err, result) => {
      if (err) return res.status(500).json({ message: 'Erro no servidor', error: err });

      return res.status(201).json({ message: 'Utilizador criado com sucesso' });
    });
  });
});

module.exports = router;
