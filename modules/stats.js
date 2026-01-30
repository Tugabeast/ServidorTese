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
  const sql = `
    /* Contagem por categoria dentro de cada (post, pergunta) */
    WITH CatCounts AS (
      SELECT c.postId, c.questionId, c.categoryId, COUNT(*) AS cnt
      FROM classification c
      GROUP BY c.postId, c.questionId, c.categoryId
    ),
    /* Total de votos por (post, pergunta) */
    Totals AS (
      SELECT postId, questionId, SUM(cnt) AS N
      FROM CatCounts
      GROUP BY postId, questionId
    ),
    /* Ranking das categorias por (post, pergunta) */
    Ranked AS (
      SELECT cc.postId, cc.questionId, cc.categoryId, cc.cnt,
             RANK() OVER (PARTITION BY cc.postId, cc.questionId ORDER BY cc.cnt DESC) AS rnk
      FROM CatCounts cc
    ),
    /* Apenas (post, pergunta) com top único (sem empate) */
    TopUnique AS (
      SELECT r.postId, r.questionId, r.categoryId, r.cnt
      FROM Ranked r
      JOIN (
        SELECT postId, questionId
        FROM Ranked
        WHERE rnk = 1
        GROUP BY postId, questionId
        HAVING COUNT(*) = 1
      ) t ON t.postId = r.postId AND t.questionId = r.questionId
      WHERE r.rnk = 1
    ),
    /* Métricas do estudo por post */
    StudyParams AS (
      SELECT p.id AS postId,
             s.minClassificationsPerPost AS minCls,
             s.validationAgreementPercent AS agreePct
      FROM post p
      JOIN study s ON s.id = p.studyId
    ),
    /* (post, pergunta) validados segundo o estudo */
    ValidatedQ AS (
      SELECT tu.postId, tu.questionId, tu.categoryId AS topCategoryId
      FROM TopUnique tu
      JOIN Totals tot ON tot.postId = tu.postId AND tot.questionId = tu.questionId
      JOIN StudyParams sp ON sp.postId = tu.postId
      WHERE tot.N >= sp.minCls
        AND (tu.cnt * 100.0 / tot.N) >= sp.agreePct
    ),
    /* Classificações do utilizador */
    UserClass AS (
      SELECT c.postId, c.questionId, c.categoryId
      FROM classification c
      JOIN user u ON u.id = c.userId
      WHERE u.username = ?
    ),
    /* Total de respostas do user por (post, pergunta) */
    UserQTotals AS (
      SELECT postId, questionId, COUNT(*) AS userTotal
      FROM UserClass
      GROUP BY postId, questionId
    ),
    /* Nº de respostas do user que acertam no rótulo validado (uma ou zero por pergunta) */
    UserQCorrect AS (
      SELECT uc.postId, uc.questionId, COUNT(*) AS userCorrect
      FROM UserClass uc
      JOIN ValidatedQ vq
        ON vq.postId = uc.postId
       AND vq.questionId = uc.questionId
       AND vq.topCategoryId = uc.categoryId
      GROUP BY uc.postId, uc.questionId
    ),
    /* Peso por pergunta = acertos / total do user naquela pergunta */
    Weights AS (
      SELECT t.postId, t.questionId,
             COALESCE(c.userCorrect, 0) * 1.0 / t.userTotal AS weight
      FROM UserQTotals t
      LEFT JOIN UserQCorrect c
        ON c.postId = t.postId AND c.questionId = t.questionId
    )
    SELECT
      COALESCE(SUM(weight), 0) AS validated,
      (SELECT COUNT(*) FROM UserQTotals) - COALESCE(SUM(weight), 0) AS not_validated
    FROM Weights;
  `;
  db.query(sql, [username], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao obter estatísticas.', error: err });
    res.status(200).json(rows[0] || { validated: 0, not_validated: 0 });
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
// ESTATÍSTICAS GERAIS (ANONIMIZADAS) - FILTRADAS POR ESTUDO COMUM
router.get('/general', (req, res) => {
    const loggedUser = req.user.username;
    const userId = req.user.id; // <--- Precisamos do ID para verificar a tabela user_study
    const userType = req.user.type;
  
    const sql = `
      /* Contagem por categoria dentro de cada (post, pergunta) */
      WITH CatCounts AS (
        SELECT c.postId, c.questionId, c.categoryId, COUNT(*) AS cnt
        FROM classification c
        GROUP BY c.postId, c.questionId, c.categoryId
      ),
      Totals AS (
        SELECT postId, questionId, SUM(cnt) AS N
        FROM CatCounts
        GROUP BY postId, questionId
      ),
      Ranked AS (
        SELECT cc.postId, cc.questionId, cc.categoryId, cc.cnt,
               RANK() OVER (PARTITION BY cc.postId, cc.questionId ORDER BY cc.cnt DESC) AS rnk
        FROM CatCounts cc
      ),
      TopUnique AS (
        SELECT r.postId, r.questionId, r.categoryId, r.cnt
        FROM Ranked r
        JOIN (
          SELECT postId, questionId
          FROM Ranked
          WHERE rnk = 1
          GROUP BY postId, questionId
          HAVING COUNT(*) = 1
        ) t ON t.postId = r.postId AND t.questionId = r.questionId
        WHERE r.rnk = 1
      ),
      StudyParams AS (
        SELECT p.id AS postId,
               s.minClassificationsPerPost AS minCls,
               s.validationAgreementPercent AS agreePct
        FROM post p
        JOIN study s ON s.id = p.studyId
      ),
      ValidatedQ AS (
        SELECT tu.postId, tu.questionId, tu.categoryId AS topCategoryId
        FROM TopUnique tu
        JOIN Totals tot ON tot.postId = tu.postId AND tot.questionId = tu.questionId
        JOIN StudyParams sp ON sp.postId = tu.postId
        WHERE tot.N >= sp.minCls
          AND (tu.cnt * 100.0 / tot.N) >= sp.agreePct
      ),
      /* Totais do user por (post, pergunta) */
      UserQTotals AS (
        SELECT c.userId, c.postId, c.questionId, COUNT(*) AS total
        FROM classification c
        GROUP BY c.userId, c.postId, c.questionId
      ),
      /* Acertos do user por (post, pergunta) */
      UserQCorrect AS (
        SELECT c.userId, c.postId, c.questionId, COUNT(*) AS correct
        FROM classification c
        JOIN ValidatedQ vq
          ON vq.postId = c.postId
          AND vq.questionId = c.questionId
          AND vq.topCategoryId = c.categoryId
        GROUP BY c.userId, c.postId, c.questionId
      ),
      /* Score ponderado por pergunta e agregado por utilizador */
      UserScores AS (
        SELECT t.userId,
               SUM(COALESCE(c.correct,0) * 1.0 / t.total) AS validated,
               COUNT(*) - SUM(COALESCE(c.correct,0) * 1.0 / t.total) AS not_validated
        FROM UserQTotals t
        LEFT JOIN UserQCorrect c
          ON c.userId = t.userId AND c.postId = t.postId AND c.questionId = t.questionId
        GROUP BY t.userId
      ),
      /* Anonimização e FILTRAGEM POR ESTUDO */
      Anonymized AS (
        SELECT u.id AS userId,
               CASE
                 WHEN ? = 'investigator' THEN u.username
                 WHEN u.username = ? THEN u.username
                 ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY u.id))
               END AS anonymizedUser
        FROM user u
        WHERE u.id IN (SELECT DISTINCT userId FROM classification)
        
        /* NOVA CONDIÇÃO:
           Só mostramos users que estejam num estudo partilhado com o user logado.
           Se o user logado for 'investigator', mostra tudo (ou remove essa linha se quiseres restringir também).
        */
        AND (
            ? = 'investigator'
            OR EXISTS (
                SELECT 1 
                FROM user_study us_me
                JOIN user_study us_other ON us_me.studyId = us_other.studyId
                WHERE us_me.userId = ?    -- User Logado
                  AND us_other.userId = u.id -- User da Lista
            )
        )
      )
      SELECT a.anonymizedUser,
             ROUND(COALESCE(us.validated, 0), 2)     AS validated,
             ROUND(COALESCE(us.not_validated, 0), 2) AS not_validated
      FROM Anonymized a
      LEFT JOIN UserScores us ON a.userId = us.userId;
    `;
  
    // ATENÇÃO À ORDEM DOS PARÂMETROS:
    // 1. userType (para o CASE)
    // 2. loggedUser (para o CASE)
    // 3. userType (para o WHERE do filtro)
    // 4. userId (para o WHERE do filtro - user_study)
    
    db.query(sql, [userType, loggedUser, userType, userId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Erro ao obter estatísticas.', error: err });
      res.status(200).json(rows);
    });
  });


router.get('/timeline', (req, res) => {
  const userId = req.user.id; // Assume que o ID vem no token

  const sql = `
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m-%d') as date, 
      COUNT(*) as count
    FROM classification
    WHERE userId = ?
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao obter timeline.', error: err });
    res.status(200).json(rows);
  });
});



module.exports = router;
