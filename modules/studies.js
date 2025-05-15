const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Obter todos os estudos
router.get('/', (req, res) => {
  const query = `
    SELECT id, name, obs, addedBy, startedAt, updatedBy, finishedAt, createdAt, updatedAt
    FROM studies
    ORDER BY createdAt DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar estudos' });
    res.json(results);
  });
});

// 🔹 Criar novo estudo
router.post('/', (req, res) => {
  const { name, obs, addedBy } = req.body;

  if (!name || !addedBy) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  const checkQuery = 'SELECT COUNT(*) AS count FROM studies WHERE name = ?';
  db.query(checkQuery, [name], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar duplicação' });

    if (result[0].count > 0) {
      return res.status(409).json({ error: 'Já existe um estudo com esse nome' });
    }

    const insertQuery = `
      INSERT INTO studies (name, obs, addedBy, startedAt, createdAt, updatedBy, finishedAt)
      VALUES (?, ?, ?, NOW(), NOW(), NULL, NULL)
    `;
    db.query(insertQuery, [name, obs, addedBy], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar estudo' });
      res.status(201).json({ message: 'Estudo criado com sucesso' });
    });
  });
});

// 🔹 Atualizar estudo
router.put('/:id', (req, res) => {
  const { name, obs, updatedBy, finishedAt } = req.body;
  const { id } = req.params;

  let query = `
    UPDATE studies SET
      name = ?,
      obs = ?,
      updatedBy = ?,
      updatedAt = NOW()
  `;
  const params = [name, obs, updatedBy];

  if (finishedAt) {
    query += `, finishedAt = ?`;
    params.push(finishedAt);
  }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar estudo' });
    res.json({ message: 'Estudo atualizado com sucesso' });
  });
});

// 🔹 Apagar estudo
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM studies WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao apagar estudo' });
    res.json({ message: 'Estudo apagado com sucesso' });
  });
});

module.exports = router;
