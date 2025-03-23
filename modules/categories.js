const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Rota para procurar todas as categorias
router.get('/', (req, res) => {
  const query = 'SELECT id, name, addedBy, updatedBy, createdAt, updatedAt FROM categories';
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ message: 'Erro ao procurar categorias', error: err });
    } else {
      res.json(results);
    }
  });
});

// 🔹 Rota para obter categorias associadas a um estudo específico
router.get('/study/:studyId', (req, res) => {
  const { studyId } = req.params;
  //console.log(`Recebida requisição para categorias do estudo ID: ${studyId}`); // Log para depuração

  const query = `
      SELECT c.id, c.name 
      FROM categories c
      JOIN studiescategories sc ON c.id = sc.categoryId
      WHERE sc.studyId = ?;
  `;

  db.query(query, [studyId], (err, results) => {
      if (err) {
          console.error("❌ Erro ao buscar categorias:", err);
          return res.status(500).json({ message: 'Erro ao buscar categorias', error: err });
      }
      //console.log(`✅ Categorias encontradas para studyId ${studyId}:`, results);
      res.json(results);
  });
});

// 🔹 Rota para obter categorias de sentimento associadas a um estudo específico
router.get('/study/sentimentos/:studyId', (req, res) => {
  const { studyId } = req.params;

  console.log(`Recebida requisição para categorias de sentimento do estudo ID: ${studyId}`);

  const query = `
      SELECT cs.id, cs.name
      FROM categories_sentimento cs
      JOIN studiescategories sc ON cs.id = sc.sentimentoCategoryId
      WHERE sc.studyId = ?;
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias de sentimento:", err);
      return res.status(500).json({ message: 'Erro ao buscar categorias de sentimento', error: err });
    }

    if (results.length === 0) {
      console.log(`⚠️ Nenhuma categoria de sentimento encontrada para studyId ${studyId}`);
    } else {
      console.log(`✅ Categorias de sentimento encontradas para studyId ${studyId}:`, results);
    }

    res.json(results);
  });
});



module.exports = router;
