const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 ESTATÍSTICAS DO USER LOGADO
router.get('/user', (req, res) => {
    const username = req.user.username;
    const query = `WITH ThemeCounts AS (
      SELECT postId, post_classification, COUNT(*) as total_votes
      FROM postsclassification
      GROUP BY postId, post_classification
    ),
    ValidThemes AS (
      SELECT postId, post_classification
      FROM ThemeCounts
      WHERE total_votes >= 3
    ),
    UserClassifications AS (
      SELECT postId, post_classification
      FROM postsclassification
      WHERE userId = ?
    ),
    AllUserPostIds AS (
      SELECT DISTINCT postId FROM UserClassifications
    ),
    ValidUserClassifications AS (
      SELECT uc.postId
      FROM UserClassifications uc
      JOIN ValidThemes vt ON uc.postId = vt.postId AND uc.post_classification = vt.post_classification
    ),
    WeightedValidations AS (
      SELECT vuc.postId, COUNT(*) * 1.0 / (SELECT COUNT(*) FROM UserClassifications uc2 WHERE uc2.postId = vuc.postId) AS weight
      FROM ValidUserClassifications vuc
      GROUP BY vuc.postId
    )
    SELECT COALESCE(SUM(wv.weight), 0) AS validated, (SELECT COUNT(*) FROM AllUserPostIds) - COALESCE(SUM(wv.weight), 0) AS not_validated
    FROM WeightedValidations wv;`;
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar estatísticas.', error: err });
        res.json(results[0] || { validated: 0, not_validated: 0 });
    });
});

// 🔹 ESTATÍSTICAS DE TODOS (ANONIMIZADAS)
router.get('/general', (req, res) => {
    const loggedUser = req.user.username;
    const query = `
        WITH UserVotes AS (
            SELECT userId, postId, post_classification
            FROM postsclassification
        ),
        AllVotes AS (
            SELECT postId, post_classification, COUNT(*) as count
            FROM postsclassification
            GROUP BY postId, post_classification
        ),
        ValidVotes AS (
            SELECT postId, post_classification
            FROM AllVotes
            WHERE count >= 3 AND (postId, count) IN (
                SELECT postId, MAX(count)
                FROM AllVotes
                GROUP BY postId
            )
        ),
        UserClassifications AS (
            SELECT uv.userId, uv.postId, COUNT(*) as total
            FROM UserVotes uv
            GROUP BY uv.userId, uv.postId
        ),
        UserValidClassifications AS (
            SELECT uv.userId, uv.postId, COUNT(*) as correct
            FROM UserVotes uv
            JOIN ValidVotes vv ON uv.postId = vv.postId AND uv.post_classification = vv.post_classification
            GROUP BY uv.userId, uv.postId
        ),
        UserScores AS (
            SELECT uc.userId, SUM(COALESCE(uvc.correct, 0) / uc.total) as validated,
                   COUNT(*) - SUM(COALESCE(uvc.correct, 0) / uc.total) as not_validated
            FROM UserClassifications uc
            LEFT JOIN UserValidClassifications uvc ON uc.userId = uvc.userId AND uc.postId = uvc.postId
            GROUP BY uc.userId
        ),
        Anonymized AS (
            SELECT userId, CASE
               WHEN userId = ? THEN userId
               ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY userId))
            END AS anonymizedUser
            FROM (SELECT DISTINCT userId FROM postsclassification) u
        )
        SELECT a.anonymizedUser, ROUND(COALESCE(us.validated, 0), 2) AS validated,
               ROUND(COALESCE(us.not_validated, 0), 2) AS not_validated
        FROM Anonymized a
        LEFT JOIN UserScores us ON a.userId = us.userId
    `;
    db.query(query, [loggedUser], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar estatísticas.', error: err });
        res.json(results);
    });
});

module.exports = router;
