const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Listar todos os utilizadores
router.get('/', (req, res) => {
  const query = 'SELECT username, name, email, type, active, createdAt, updatedAt FROM users';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar utilizadores' });
    res.json(results);
  });
});

// 🔹 Criar novo utilizador
router.post('/', async (req, res) => {
  const { username, name, password, email, type, active } = req.body;

  if (!username || !password || !email || !type) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // ✅ Cria hash da password

    const query = `
      INSERT INTO users (username, name, password, email, type, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    db.query(query, [username, name, hashedPassword, email, type, active], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar utilizador' });
      res.status(201).json({ message: 'Utilizador criado com sucesso' });
    });
  } catch (error) {
    console.error('Erro ao encriptar password:', error);
    res.status(500).json({ error: 'Erro ao criar utilizador' });
  }
});

// 🔹 Atualizar utilizador
const bcrypt = require('bcrypt');

router.put('/:username', async (req, res) => {
  const { name, email, type, active, password } = req.body;
  const { username } = req.params;

  try {
    let query = `
      UPDATE users SET name = ?, email = ?, type = ?, active = ?, updatedAt = NOW()
    `;
    const params = [name, email, type, active];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE username = ?`;
    params.push(username);

    db.query(query, params, (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar utilizador' });
      res.json({ message: 'Utilizador atualizado com sucesso' });
    });
  } catch (err) {
    console.error('Erro ao atualizar utilizador:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// 🔹 Apagar utilizador
router.delete('/:username', (req, res) => {
  const { username } = req.params;

  const query = 'DELETE FROM users WHERE username = ?';
  db.query(query, [username], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao apagar utilizador' });
    res.json({ message: 'Utilizador apagado com sucesso' });
  });
});



module.exports = router;
