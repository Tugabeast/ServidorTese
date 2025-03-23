const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Rota para classificar (ou atualizar classificação) de um post com várias categorias (temáticas e sentimentais)
router.post('/classify', (req, res) => {
  const { postId, studyId, categoryIds, sentimentoCategoryIds } = req.body;  // categoryIds e sentimentoCategoryIds são arrays de IDs de categorias
  const userId = req.user.username;  // Pegando o userId do token

  console.log("📩 Dados recebidos para classificação:", { postId, studyId, categoryIds, sentimentoCategoryIds, userId });

  // Validação dos campos obrigatórios para classificação temática
  if (!postId || !studyId || !Array.isArray(categoryIds) || categoryIds.length === 0 || !userId) {
    console.error("❌ Erro: Campos obrigatórios ausentes ou inválidos (classificação temática)!");
    return res.status(400).json({ message: 'Todos os campos são obrigatórios para a classificação temática' });
  }

  // Montar múltiplas entradas para as categorias temáticas no banco de dados
  const valuesCategories = categoryIds.map(categoryId => [postId, studyId, categoryId, userId]);

  // Inserir ou atualizar a classificação do post para múltiplas categorias temáticas
  const queryCategories = `
    INSERT INTO postsclassification (postId, studyId, post_classification, userId)
    VALUES ?
    ON DUPLICATE KEY UPDATE post_classification = VALUES(post_classification)
  `;

  // Se houver categorias sentimentais, montar entradas para elas
  let querySentimentoCategories = null;
  let valuesSentimentoCategories = null;

  if (Array.isArray(sentimentoCategoryIds) && sentimentoCategoryIds.length > 0) {
    valuesSentimentoCategories = sentimentoCategoryIds.map(sentimentoCategoryId => [postId, studyId, sentimentoCategoryId, userId]);

    // Query para categorias de sentimento
    querySentimentoCategories = `
      INSERT INTO post_sentimento_classifications (postId, studyId, sentimentoCategoryId, userId)
      VALUES ?
      ON DUPLICATE KEY UPDATE sentimentoCategoryId = VALUES(sentimentoCategoryId)
    `;
  }

  // Iniciar transação
  db.beginTransaction((err) => {
    if (err) {
      console.error("❌ Erro ao iniciar transação:", err);
      return res.status(500).json({ message: 'Erro ao classificar post', error: err });
    }

    // Executar query para categorias temáticas
    db.query(queryCategories, [valuesCategories], (err, result) => {
      if (err) {
        return db.rollback(() => {
          console.error("❌ Erro ao classificar post (temáticas):", err);
          return res.status(500).json({ message: 'Erro ao classificar post (temáticas)', error: err });
        });
      }

      // Se houver categorias sentimentais, executar a query
      if (querySentimentoCategories && valuesSentimentoCategories) {
        db.query(querySentimentoCategories, [valuesSentimentoCategories], (err, result) => {
          if (err) {
            return db.rollback(() => {
              console.error("❌ Erro ao classificar post (sentimentos):", err);
              return res.status(500).json({ message: 'Erro ao classificar post (sentimentos)', error: err });
            });
          }

          // Commit da transação após ambas as classificações
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                console.error("❌ Erro ao confirmar transação:", err);
                return res.status(500).json({ message: 'Erro ao confirmar classificação', error: err });
              });
            }

            console.log("✅ Post classificado com sucesso em várias categorias (temáticas e sentimentais)!");
            return res.status(201).json({ message: 'Post classificado com sucesso em várias categorias!' });
          });
        });
      } else {
        // Se não houver categorias sentimentais, só fazer o commit para as temáticas
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              console.error("❌ Erro ao confirmar transação:", err);
              return res.status(500).json({ message: 'Erro ao confirmar classificação', error: err });
            });
          }

          console.log("✅ Post classificado com sucesso em várias categorias (somente temáticas)!");
          return res.status(201).json({ message: 'Post classificado com sucesso em várias categorias!' });
        });
      }
    });
  });
});


// 🔹 Rota para obter os posts já classificados com múltiplas categorias (temáticas e sentimentais)
router.get('/classified-posts', (req, res) => {
  const { username } = req.user;  // Obtém o username do token

  if (!username) {
    return res.status(400).json({ message: 'Erro: User não autenticado.' });
  }

  const queryCategories = `
    SELECT postId, post_classification
    FROM postsclassification
    WHERE userId = ?
  `;

  const querySentimentoCategories = `
    SELECT postId, sentimentoCategoryId
    FROM post_sentimento_classifications
    WHERE userId = ?
  `;

  db.query(queryCategories, [username], (err, resultsCategories) => {
    if (err) {
      console.error("Erro ao buscar posts classificados (temáticas):", err);
      return res.status(500).json({ message: 'Erro ao buscar posts classificados (temáticas)', error: err });
    }

    const classifiedPosts = {};
    resultsCategories.forEach(row => {
      if (!classifiedPosts[row.postId]) {
        classifiedPosts[row.postId] = {
          thematic: [],
          sentiment: [],
        };
      }
      classifiedPosts[row.postId].thematic.push(row.post_classification);  // Classificações temáticas
    });

    db.query(querySentimentoCategories, [username], (err, resultsSentimentos) => {
      if (err) {
        console.error("Erro ao buscar posts classificados (sentimentos):", err);
        return res.status(500).json({ message: 'Erro ao buscar posts classificados (sentimentos)', error: err });
      }

      resultsSentimentos.forEach(row => {
        if (classifiedPosts[row.postId]) {
          classifiedPosts[row.postId].sentiment.push(row.sentimentoCategoryId);  // Classificações sentimentais
        }
      });

      res.json(classifiedPosts);
    });
  });
});

module.exports = router;
