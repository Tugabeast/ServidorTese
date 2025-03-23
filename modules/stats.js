const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Rota para buscar estatísticas de posts classificados por user
router.get('/user-stats', (req, res) => {
  const { username } = req.user;

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

// Rota para obter estatísticas de classificações validadas do user
router.get('/validated-classifications', (req, res) => {
  const username = req.user.username;

  const query = `
    WITH ValidThemes AS (
      SELECT postId, post_classification
      FROM postsclassification
      GROUP BY postId, post_classification
      HAVING COUNT(*) >= 3
    ),
    ValidSentiments AS (
      SELECT postId, sentimentoCategoryId
      FROM post_sentimento_classifications
      GROUP BY postId, sentimentoCategoryId
      HAVING COUNT(*) >= 3
    ),
    UserThemes AS (
      SELECT postId, post_classification
      FROM postsclassification
      WHERE userId = ?
    ),
    UserSentiments AS (
      SELECT postId, sentimentoCategoryId
      FROM post_sentimento_classifications
      WHERE userId = ?
    ),
    AllUserClassifications AS (
      SELECT ut.postId, ut.post_classification AS category, 'theme' AS type
      FROM UserThemes ut
      UNION ALL
      SELECT us.postId, us.sentimentoCategoryId AS category, 'sentiment' AS type
      FROM UserSentiments us
    ),
    ValidatedClassifications AS (
      SELECT ut.postId, 'theme' AS type
      FROM UserThemes ut
      JOIN ValidThemes vt ON ut.postId = vt.postId AND ut.post_classification = vt.post_classification
      UNION ALL
      SELECT us.postId, 'sentiment' AS type
      FROM UserSentiments us
      JOIN ValidSentiments vs ON us.postId = vs.postId AND us.sentimentoCategoryId = vs.sentimentoCategoryId
    )
    SELECT
      (SELECT COUNT(*) FROM ValidatedClassifications) AS validated,
      (SELECT COUNT(*) FROM AllUserClassifications) - (SELECT COUNT(*) FROM ValidatedClassifications) AS not_validated
  `;

  db.query(query, [username, username], (err, results) => {
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

// Rota para estatísticas de todos os users com anonimização
router.get('/validated-classifications-all', (req, res) => {
  const loggedUser = req.user.username;

  const query = `
      WITH
      ValidThemes AS (
        SELECT postId, post_classification
        FROM postsclassification
        GROUP BY postId, post_classification
        HAVING COUNT(*) >= 3
      ),
      ValidSentiments AS (
        SELECT postId, sentimentoCategoryId
        FROM post_sentimento_classifications
        GROUP BY postId, sentimentoCategoryId
        HAVING COUNT(*) >= 3
      ),
      Users AS (
        SELECT DISTINCT userId FROM postsclassification
        UNION
        SELECT DISTINCT userId FROM post_sentimento_classifications
      ),
      Anonymized AS (
        SELECT
          userId,
          CASE
            WHEN userId = ? THEN userId
            ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY userId))
          END AS anonymizedUser
        FROM Users
      ),
      UserThemeCounts AS (
        SELECT userId, COUNT(*) AS total_theme_classifications
        FROM postsclassification
        GROUP BY userId
      ),
      UserSentimentCounts AS (
        SELECT userId, COUNT(*) AS total_sentiment_classifications
        FROM post_sentimento_classifications
        GROUP BY userId
      ),
      UserThemeValidated AS (
        SELECT p.userId, COUNT(*) AS validated_theme_classifications
        FROM postsclassification p
        JOIN ValidThemes vt ON p.postId = vt.postId AND p.post_classification = vt.post_classification
        GROUP BY p.userId
      ),
      UserSentimentValidated AS (
        SELECT ps.userId, COUNT(*) AS validated_sentiment_classifications
        FROM post_sentimento_classifications ps
        JOIN ValidSentiments vs ON ps.postId = vs.postId AND ps.sentimentoCategoryId = vs.sentimentoCategoryId
        GROUP BY ps.userId
      )
      SELECT
        a.anonymizedUser,
        COALESCE(utv.validated_theme_classifications, 0) + COALESCE(usv.validated_sentiment_classifications, 0) AS validated,
        (COALESCE(utc.total_theme_classifications, 0) + COALESCE(usc.total_sentiment_classifications, 0)) -
        (COALESCE(utv.validated_theme_classifications, 0) + COALESCE(usv.validated_sentiment_classifications, 0)) AS not_validated
      FROM Anonymized a
      LEFT JOIN UserThemeCounts utc ON a.userId = utc.userId
      LEFT JOIN UserSentimentCounts usc ON a.userId = usc.userId
      LEFT JOIN UserThemeValidated utv ON a.userId = utv.userId
      LEFT JOIN UserSentimentValidated usv ON a.userId = usv.userId

  `;

  db.query(query, [loggedUser], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar estatísticas de classificação para todos os users:", err);
      return res.status(500).json({ message: "Erro ao buscar estatísticas", error: err });
    }

    res.json(results);
  });
});



module.exports = router;