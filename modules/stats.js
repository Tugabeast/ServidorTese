const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Rota para buscar estatísticas de posts classificados por user
router.get('/user-stats', (req, res) => {
  const { username } = req.user; // Extrai o username do token

  if (!username) {
    return res.status(400).json({ message: 'username não encontrado no token.' });
  }

  const query = `
    SELECT COUNT(*) as classifiedPostsCount, studyId
    FROM postsclassification
    WHERE userId = ?
    GROUP BY studyId
  `;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar estatísticas:", err);
      return res.status(500).json({ message: 'Erro ao buscar estatísticas', error: err });
    }

    res.status(200).json(results);
  });
});


//  Rota para obter as estatísticas de classificação do user
router.get('/validated-classifications', (req, res) => {
  const username = req.user.username; 
  const query = `
    SELECT 
      COUNT(DISTINCT CASE WHEN sub.correct_category = p.post_classification THEN p.postId END) AS validated,
      COUNT(DISTINCT p.postId) - COUNT(DISTINCT CASE WHEN sub.correct_category = p.post_classification THEN p.postId END) AS not_validated
    FROM postsclassification p
    LEFT JOIN (
      SELECT postId, CASE WHEN COUNT(post_classification) >= 3 THEN post_classification ELSE NULL END AS correct_category
      FROM postsclassification 
      GROUP BY postId, post_classification
    ) AS sub 
    ON p.postId = sub.postId
    WHERE p.userId = ?
    `;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar classificações validadas:", err);
      return res.status(500).json({ message: "Erro ao buscar estatísticas", error: err });
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({ validated: 0, not_validated: 0 });
    }
  });
});



// 🔹 Rota para obter as estatísticas de classificação de TODOS os users (com anonimização)
router.get('/validated-classifications-all', (req, res) => {
  const loggedUser = req.user.username; // Obtém o username do user logado

  const query = `
    WITH RankedUsers AS (
      SELECT 
        userId,
        CASE 
          WHEN userId = ? THEN userId
          ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY userId)) 
        END AS anonymizedUser
      FROM postsclassification
      GROUP BY userId
    )
    SELECT 
      r.anonymizedUser,
      COUNT(DISTINCT CASE WHEN sub.correct_category = p.post_classification THEN p.postId END) AS validated,
      COUNT(DISTINCT p.postId) - COUNT(DISTINCT CASE WHEN sub.correct_category = p.post_classification THEN p.postId END) AS not_validated
    FROM postsclassification p
    JOIN RankedUsers r ON p.userId = r.userId
    LEFT JOIN (
      SELECT postId, CASE WHEN COUNT(post_classification) >= 3 THEN post_classification ELSE NULL END AS correct_category
      FROM postsclassification 
      GROUP BY postId, post_classification
    ) AS sub 
    ON p.postId = sub.postId
    GROUP BY r.anonymizedUser

  `;

  db.query(query, [loggedUser], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar estatísticas de classificação para todos os users:", err);
      return res.status(500).json({ message: "Erro ao buscar estatísticas", error: err });
    }
  
    if (!Array.isArray(results)) {
      console.error("❌ API deve retornar um array, mas recebeu:", results);
      return res.status(500).json({ message: "Erro inesperado no formato de resposta" });
    }
  
    res.json(results);
  });
});

module.exports = router;






