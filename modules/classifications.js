const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Rota para classificar (ou atualizar classificação) de um post
router.post('/classify', (req, res) => {
  const { postId, studyId, categoryId } = req.body;
  const userId = req.user.username;  // Pegando o userId do token

  console.log("📩 Dados recebidos para classificação:", { postId, studyId, categoryId, userId });

  if (!postId || !studyId || !categoryId || !userId) {
    console.error("❌ Erro: Campos obrigatórios ausentes!");
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  // Inserir ou atualizar a classificação do post usando 'ON DUPLICATE KEY UPDATE'
  const query = `
    INSERT INTO postsclassification (postId, studyId, post_classification, userId)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE post_classification = VALUES(post_classification)
  `;

  db.query(query, [postId, studyId, categoryId, userId], (err, result) => {
    if (err) {
      console.error("❌ Erro ao classificar post:", err);
      return res.status(500).json({ message: 'Erro ao classificar post', error: err });
    }

    console.log("✅ Post classificado com sucesso!");
    return res.status(201).json({ message: 'Post classificado com sucesso!' });
  });
});

// 🔹 Rota para obter os posts já classificados
router.get('/classified-posts', (req, res) => {
  const { username } = req.user;  // Obtém o username do token

  if (!username) {
    return res.status(400).json({ message: 'Erro: User não autenticado.' });
  }

  const query = `
    SELECT postId, post_classification
    FROM postsclassification
    WHERE userId = ?
  `;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Erro ao buscar posts classificados:", err);
      return res.status(500).json({ message: 'Erro ao buscar posts classificados', error: err });
    }

    const classifiedPosts = {};
    results.forEach(row => {
      classifiedPosts[row.postId] = row.post_classification;
    });

    res.json(classifiedPosts);
  });
});

module.exports = router;
