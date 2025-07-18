const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Rota única para classificar post com temáticas e sentimento (nova estrutura unificada)
router.post('/classify', (req, res) => {
  const { postId, studyId, categoryIds, sentimentoCategoryIds } = req.body;
  const userId = req.user.username;

  if (!postId || !studyId || !Array.isArray(categoryIds) || categoryIds.length === 0 || !userId) {
    return res.status(400).json({ message: 'Dados inválidos para classificação temática.' });
  }

  // Prepara valores temáticos
  const thematicValues = categoryIds.map(categoryId => [postId, studyId, categoryId, userId]);

  // Prepara valor de sentimento (espera apenas 1)
  const sentimentValue = (
    Array.isArray(sentimentoCategoryIds) && sentimentoCategoryIds.length > 0
      ? [[postId, studyId, sentimentoCategoryIds[0], userId]]
      : []
  );

  // Query genérica (para qualquer categoria)
  const insertQuery = `
    INSERT INTO postsclassification (postId, studyId, post_classification, userId)
    VALUES ?
    ON DUPLICATE KEY UPDATE post_classification = VALUES(post_classification)
  `;

  db.beginTransaction(err => {
    if (err) {
      console.error("❌ Erro ao iniciar transação:", err);
      return res.status(500).json({ message: 'Erro interno.' });
    }

    db.query(insertQuery, [thematicValues], (err) => {
      if (err) {
        return db.rollback(() => {
          console.error("❌ Erro ao inserir categorias temáticas:", err);
          return res.status(500).json({ message: 'Erro ao salvar categorias temáticas.' });
        });
      }

      if (sentimentValue.length > 0) {
        db.query(insertQuery, [sentimentValue], (err) => {
          if (err) {
            return db.rollback(() => {
              console.error("❌ Erro ao inserir categoria de sentimento:", err);
              return res.status(500).json({ message: 'Erro ao salvar categoria de sentimento.' });
            });
          }

          db.commit(err => {
            if (err) {
              return db.rollback(() => {
                console.error("❌ Erro no commit da transação:", err);
                return res.status(500).json({ message: 'Erro ao confirmar classificação.' });
              });
            }

            console.log("✅ Classificação temática e de sentimento salva com sucesso!");
            res.status(201).json({ message: 'Classificação completa realizada!' });
          });
        });
      } else {
        db.commit(err => {
          if (err) {
            return db.rollback(() => {
              console.error("❌ Erro no commit (só temáticas):", err);
              return res.status(500).json({ message: 'Erro ao confirmar classificação temática.' });
            });
          }

          console.log("✅ Classificação temática salva (sem sentimento)!");
          res.status(201).json({ message: 'Classificação temática realizada!' });
        });
      }
    });
  });
});


// 🔹 Obter posts classificados (temáticas + sentimento) para o user logado
router.get('/classified-posts', (req, res) => {
  const username = req.user.username;

  const query = `
    SELECT pc.postId, pc.post_classification, c.categoryType
    FROM postsclassification pc
    JOIN categories c ON pc.post_classification = c.id
    WHERE pc.userId = ?
  `;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar classificações:", err);
      return res.status(500).json({ message: 'Erro ao buscar classificações.', error: err });
    }

    const classifiedPosts = {};

    results.forEach(({ postId, post_classification, categoryType }) => {
      if (!classifiedPosts[postId]) {
        classifiedPosts[postId] = { thematic: [], sentiment: [] };
      }

      if (categoryType === 'tematicas') {
        classifiedPosts[postId].thematic.push(post_classification);
      } else if (categoryType === 'sentimento') {
        classifiedPosts[postId].sentiment = [post_classification]; // só pode 1
      }
    });

    res.json(classifiedPosts);
  });
});


module.exports = router;
