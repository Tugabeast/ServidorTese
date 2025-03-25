const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Rota para procurar todas as categorias
router.get('/', (req, res) => {
  const query = 'SELECT id, name, categoryType, addedBy, updatedBy, createdAt, updatedAt FROM categories';
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ message: 'Erro ao procurar categorias', error: err });
    } else {
      res.json(results);
    }
  });
});

// 🔹 Rota para obter categorias temáticas associadas a um estudo específico
router.get('/study/:studyId', (req, res) => {
  const { studyId } = req.params;

  const query = `
    SELECT c.id, c.name
    FROM categories c
    JOIN studiescategories sc ON c.id = sc.categoryId
    WHERE sc.studyId = ? AND c.categoryType = 'tematicas';
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias temáticas:", err);
      return res.status(500).json({ message: 'Erro ao buscar categorias temáticas', error: err });
    }
    res.json(results);
  });
});

// 🔹 Rota para obter categorias de sentimento associadas a um estudo específico
router.get('/study/sentimentos/:studyId', (req, res) => {
  const { studyId } = req.params;

  const query = `
    SELECT c.id, c.name
    FROM categories c
    JOIN studiescategories sc ON c.id = sc.categoryId
    WHERE sc.studyId = ? AND c.categoryType = 'sentimento';
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias de sentimento:", err);
      return res.status(500).json({ message: 'Erro ao buscar categorias de sentimento', error: err });
    }
    res.json(results);
  });
});

module.exports = router;
