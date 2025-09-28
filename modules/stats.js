const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @openapi
 * /stats/user:
 *   get:
 *     tags: [Stats]
 *     summary: Estatísticas do utilizador autenticado
 *     description: Devolve totais ponderados de classificações **validadas** vs **não validadas** para o utilizador autenticado (regra ≥3 votos iguais).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Totais do utilizador.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 validated: { type: number, example: 12.5 }
 *                 not_validated: { type: number, example: 7.5 }
 *       500:
 *         description: Erro ao procurar estatísticas.
 */

//  ESTATÍSTICAS DO USER com sessao iniciada
router.get('/user', (req, res) => {
  const username = req.user.username;
  const query = `
    WITH ThemeCounts AS (
      SELECT postId, categoryId, COUNT(*) as total_votes
      FROM classification
      GROUP BY postId, categoryId
    ),
    ValidThemes AS (
      SELECT postId, categoryId
      FROM ThemeCounts
      WHERE total_votes >= 3
    ),
    UserClassifications AS (
      SELECT c.postId, c.categoryId
      FROM classification c
      JOIN user u ON u.id = c.userId
      WHERE u.username = ?
    ),
    AllUserPostIds AS (
      SELECT DISTINCT postId FROM UserClassifications
    ),
    ValidUserClassifications AS (
      SELECT uc.postId
      FROM UserClassifications uc
      JOIN ValidThemes vt ON uc.postId = vt.postId AND uc.categoryId = vt.categoryId
    ),
    WeightedValidations AS (
      SELECT vuc.postId,
             COUNT(*) * 1.0 / (SELECT COUNT(*) FROM UserClassifications uc2 WHERE uc2.postId = vuc.postId) AS weight
      FROM ValidUserClassifications vuc
      GROUP BY vuc.postId
    )
    SELECT COALESCE(SUM(wv.weight), 0) AS validated,
           (SELECT COUNT(*) FROM AllUserPostIds) - COALESCE(SUM(wv.weight), 0) AS not_validated
    FROM WeightedValidations wv;
  `;
  db.query(query, [username], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro ao procurar estatísticas.', error: err });
    res.json(results[0] || { validated: 0, not_validated: 0 });
  });
});

/**
 * @openapi
 * /stats/general:
 *   get:
 *     tags: [Stats]
 *     summary: Estatísticas gerais (anonimizadas)
 *     description: Estatísticas agregadas por utilizador com anonimização (mostra `username` apenas para o próprio e para investigadores).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de utilizadores com validações.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   anonymizedUser: { type: string, example: "Utilizador 2" }
 *                   validated: { type: number, example: 10.75 }
 *                   not_validated: { type: number, example: 3.25 }
 *       500:
 *         description: Erro ao procurar estatísticas.
 */

// ESTATÍSTICAS DE TODOS os utilizadores com classificações feitas(ANONIMIZADAS)
router.get('/general', (req, res) => {
  const loggedUser = req.user.username;
  const userType = req.user.type;

  const query = `
    WITH UserVotes AS (
      SELECT c.userId, c.postId, c.categoryId
      FROM classification c
    ),
    AllVotes AS (
      SELECT postId, categoryId, COUNT(*) as count
      FROM classification
      GROUP BY postId, categoryId
    ),
    ValidVotes AS (
      SELECT postId, categoryId
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
      JOIN ValidVotes vv ON uv.postId = vv.postId AND uv.categoryId = vv.categoryId
      GROUP BY uv.userId, uv.postId
    ),
    UserScores AS (
      SELECT uc.userId,
             SUM(COALESCE(uvc.correct, 0) / uc.total) as validated,
             COUNT(*) - SUM(COALESCE(uvc.correct, 0) / uc.total) as not_validated
      FROM UserClassifications uc
      LEFT JOIN UserValidClassifications uvc
        ON uc.userId = uvc.userId AND uc.postId = uvc.postId
      GROUP BY uc.userId
    ),
    Anonymized AS (
      SELECT u.id as userId,
             CASE
               WHEN ? = 'investigator' THEN u.username
               WHEN u.username = ? THEN u.username
               ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY u.id))
             END AS anonymizedUser
      FROM user u
      WHERE u.id IN (SELECT DISTINCT userId FROM classification)
    )
    SELECT a.anonymizedUser,
           ROUND(COALESCE(us.validated, 0), 2) AS validated,
           ROUND(COALESCE(us.not_validated, 0), 2) AS not_validated
    FROM Anonymized a
    LEFT JOIN UserScores us ON a.userId = us.userId;
  `;

  db.query(query, [userType, loggedUser], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro ao procurar estatísticas.', error: err });
    res.json(results);
  });
});


module.exports = router;
