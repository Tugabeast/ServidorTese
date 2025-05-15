const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();  // Carrega as variáveis do .env

router.post('/', (req, res) => {
  console.log('Requisição de login recebida:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e password são obrigatórios' });
  }

  const query = 'SELECT username, email, password, type, active FROM users WHERE email = ?';
  
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error("❌ Erro no servidor:", err);
      return res.status(500).json({ message: 'Erro no servidor', error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Utilizador não encontrado' });
    }

    const user = results[0];

    try {
      const isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (!isPasswordCorrect) {
        return res.status(401).json({ message: 'Password incorreta' });
      }

      if (!user.active) {
        return res.status(403).json({ message: 'Utilizador inativo' });
      }

      // 🔹 Criando o token JWT com `email` e `username`
      const token = jwt.sign(
        { email: user.email, username: user.username, type: user.type },  // Payload com email, username e tipo
        process.env.APP_SECRET  // Chave secreta
      );

      return res.status(200).json({
        message: 'Login realizado com sucesso',
        token: token,  // Manda o token para o cliente
        type: user.type,
        username: user.username,
      });
    } catch (err) {
      console.error("❌ Erro ao validar a password:", err);
      return res.status(500).json({ message: 'Erro ao validar a password', error: err });
    }
  });
});

module.exports = router;
