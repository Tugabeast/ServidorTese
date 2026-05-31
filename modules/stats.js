const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { logger } = require('../utils/logger');

/**
 * Função auxiliar com a lógica comum de validação.
 *
 * Regras:
 * - Conta o número de utilizadores que responderam a cada par (post, pergunta).
 * - Para perguntas de seleção múltipla:
 *   valida todas as categorias que atingem a percentagem mínima de concordância.
 * - Para perguntas de seleção única:
 *   valida apenas a categoria mais votada, desde que não exista empate no primeiro lugar.
 * - A resposta do utilizador é considerada validada apenas quando coincide com o conjunto validado.
 */
const validationCTE = `
  WITH QuestionMode AS (
    SELECT
      id AS questionId,
      CASE
        WHEN LOWER(inputType) IN (
          'checkbox',
          'multiple',
          'multi',
          'multipla',
          'múltipla',
          'selecao multipla',
          'seleção múltipla',
          'seleção multipla',
          'multiple choice'
        )
        THEN 1
        ELSE 0
      END AS isMultiple
    FROM question
  ),

  StudyParams AS (
    SELECT
      p.id AS postId,
      q.id AS questionId,
      s.minClassificationsPerPost AS minCls,
      s.validationAgreementPercent AS agreePct,
      qm.isMultiple
    FROM post p
    JOIN study s ON s.id = p.studyId
    JOIN question q ON q.studyId = s.id
    JOIN QuestionMode qm ON qm.questionId = q.id
  ),

  Respondents AS (
    SELECT
      postId,
      questionId,
      COUNT(DISTINCT userId) AS totalUsers
    FROM classification
    GROUP BY postId, questionId
  ),

  CategoryCounts AS (
    SELECT
      postId,
      questionId,
      categoryId,
      COUNT(DISTINCT userId) AS votes
    FROM classification
    GROUP BY postId, questionId, categoryId
  ),

  CategoryScores AS (
    SELECT
      cc.postId,
      cc.questionId,
      cc.categoryId,
      cc.votes,
      r.totalUsers,
      sp.minCls,
      sp.agreePct,
      sp.isMultiple,
      (cc.votes * 100.0 / r.totalUsers) AS agreementPercent
    FROM CategoryCounts cc
    JOIN Respondents r
      ON r.postId = cc.postId
     AND r.questionId = cc.questionId
    JOIN StudyParams sp
      ON sp.postId = cc.postId
     AND sp.questionId = cc.questionId
    WHERE r.totalUsers >= sp.minCls
  ),

  RankedSingle AS (
    SELECT
      cs.*,
      RANK() OVER (
        PARTITION BY cs.postId, cs.questionId
        ORDER BY cs.votes DESC
      ) AS categoryRank
    FROM CategoryScores cs
    WHERE cs.isMultiple = 0
  ),

  SingleValidated AS (
    SELECT
      rs.postId,
      rs.questionId,
      rs.categoryId
    FROM RankedSingle rs
    WHERE rs.categoryRank = 1
      AND rs.agreementPercent >= rs.agreePct
      AND NOT EXISTS (
        SELECT 1
        FROM RankedSingle other
        WHERE other.postId = rs.postId
          AND other.questionId = rs.questionId
          AND other.categoryId <> rs.categoryId
          AND other.votes = rs.votes
      )
  ),

  MultipleValidated AS (
    SELECT
      cs.postId,
      cs.questionId,
      cs.categoryId
    FROM CategoryScores cs
    WHERE cs.isMultiple = 1
      AND cs.agreementPercent >= cs.agreePct
  ),

  ValidatedCategories AS (
    SELECT * FROM SingleValidated
    UNION ALL
    SELECT * FROM MultipleValidated
  ),

  ValidatedSets AS (
    SELECT
      postId,
      questionId,
      GROUP_CONCAT(categoryId ORDER BY categoryId SEPARATOR ',') AS validatedSet
    FROM ValidatedCategories
    GROUP BY postId, questionId
  ),

  UserSets AS (
    SELECT
      userId,
      postId,
      questionId,
      GROUP_CONCAT(DISTINCT categoryId ORDER BY categoryId SEPARATOR ',') AS userSet
    FROM classification
    GROUP BY userId, postId, questionId
  )
`;

/**
 * @openapi
 * /stats/user:
 *   get:
 *     tags: [Stats]
 *     summary: Estatísticas do utilizador autenticado
 *     description: |
 *       Devolve o número de classificações validadas e por validar do utilizador autenticado.
 *       A validação é calculada com base nos parâmetros definidos em cada estudo:
 *       número mínimo de classificações e percentagem mínima de concordância.
 *       Em perguntas de seleção múltipla, a resposta validada pode corresponder a um conjunto de categorias.
 *       Em perguntas de seleção única, é considerada apenas a categoria com maior concordância, desde que não exista empate.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso.
 *       404:
 *         description: Nenhuma estatística encontrada para o utilizador autenticado.
 *       500:
 *         description: Erro ao obter estatísticas.
 */
router.get('/user', (req, res) => {
  const username = req.user.username;

  logger.info(`[STATS - GET USER] Pedido de estatísticas pessoais para o utilizador: ${username}`);

  const sql = `
    ${validationCTE}

    SELECT
      COALESCE(SUM(CASE WHEN us.userSet = vs.validatedSet THEN 1 ELSE 0 END), 0) AS validated,
      COALESCE(SUM(CASE WHEN us.userSet = vs.validatedSet THEN 0 ELSE 1 END), 0) AS not_validated
    FROM UserSets us
    JOIN user u ON u.id = us.userId
    LEFT JOIN ValidatedSets vs
      ON vs.postId = us.postId
     AND vs.questionId = us.questionId
    WHERE u.username = ?;
  `;

  db.query(sql, [username], (err, rows) => {
    if (err) {
      logger.error(`[STATS - GET USER] Erro na BD ao calcular estatísticas para ${username}. MSG: ${err.message}`, {
        stack: err.stack,
      });

      return res.status(500).json({
        message: 'Erro ao obter estatísticas.',
        error: err,
      });
    }

    const stats = rows[0] || { validated: 0, not_validated: 0 };

    if (Number(stats.validated) === 0 && Number(stats.not_validated) === 0) {
      logger.warn(`[STATS - GET USER] Nenhuma estatística encontrada para o utilizador: ${username}`);
      return res.status(404).json({ message: 'Nenhuma estatística encontrada para este utilizador.' });
    }

    logger.debug(
      `[STATS - GET USER] Sucesso: Estatísticas de ${username} geradas. Validadas: ${stats.validated}, Não Validadas: ${stats.not_validated}`
    );

    res.status(200).json(stats);
  });
});

/**
 * @openapi
 * /stats/general:
 *   get:
 *     tags: [Stats]
 *     summary: Estatísticas gerais dos utilizadores nos estudos do investigador autenticado
 *     description: |
 *       Devolve estatísticas agregadas por utilizador.
 *       - Admin vê estatísticas de todos os estudos.
 *       - Investigador vê apenas estatísticas dos estudos que criou.
 *       - Utilizador comum vê apenas estatísticas dos estudos aos quais está associado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas gerais obtidas com sucesso.
 *       400:
 *         description: Utilizador autenticado inválido.
 *       404:
 *         description: Nenhuma estatística encontrada.
 *       500:
 *         description: Erro ao obter estatísticas.
 */
router.get('/general', (req, res) => {
  const loggedUserId = req.user?.id || req.user?.userId;

  logger.info(
    `[STATS - GET GENERAL] Pedido de estatísticas gerais pelo UserID: ${loggedUserId || 'NÃO IDENTIFICADO'}`
  );

  if (!loggedUserId) {
    logger.warn('[STATS - GET GENERAL] Falha: utilizador autenticado sem ID válido.');
    return res.status(400).json({
      message: 'Utilizador autenticado inválido.'
    });
  }

  const sql = `
    ${validationCTE},

    CurrentUser AS (
      SELECT id, username, type
      FROM user
      WHERE id = ?
    ),

    RelevantStudies AS (
      SELECT s.id
      FROM study s
      CROSS JOIN CurrentUser cu
      WHERE
        cu.type = 'admin'
        OR (
          cu.type = 'investigator'
          AND s.addedBy = cu.username
        )
        OR (
          cu.type NOT IN ('admin', 'investigator')
          AND EXISTS (
            SELECT 1
            FROM user_study us_scope
            WHERE us_scope.studyId = s.id
              AND us_scope.userId = cu.id
          )
        )
    ),

    UserScores AS (
      SELECT
        user_sets.userId,
        COALESCE(
          SUM(
            CASE 
              WHEN user_sets.userSet = validated_sets.validatedSet 
              THEN 1 
              ELSE 0 
            END
          ), 
          0
        ) AS validated,
        COALESCE(
          SUM(
            CASE 
              WHEN user_sets.userSet = validated_sets.validatedSet 
              THEN 0 
              ELSE 1 
            END
          ), 
          0
        ) AS not_validated
      FROM UserSets user_sets
      INNER JOIN post p
        ON p.id = user_sets.postId
      INNER JOIN RelevantStudies rs
        ON rs.id = p.studyId
      LEFT JOIN ValidatedSets validated_sets
        ON validated_sets.postId = user_sets.postId
       AND validated_sets.questionId = user_sets.questionId
      GROUP BY user_sets.userId
    ),

    Anonymized AS (
      SELECT
        u.id AS userId,
        CASE
          WHEN cu.type IN ('admin', 'investigator') THEN u.username
          WHEN u.id = cu.id THEN u.username
          ELSE CONCAT('Utilizador ', DENSE_RANK() OVER (ORDER BY u.id))
        END AS anonymizedUser
      FROM user u
      CROSS JOIN CurrentUser cu
      WHERE u.id IN (
        SELECT DISTINCT userId
        FROM UserScores
      )
    )

    SELECT
      a.anonymizedUser,
      ROUND(COALESCE(us.validated, 0), 2) AS validated,
      ROUND(COALESCE(us.not_validated, 0), 2) AS not_validated
    FROM Anonymized a
    INNER JOIN UserScores us
      ON us.userId = a.userId
    WHERE COALESCE(us.validated, 0) + COALESCE(us.not_validated, 0) > 0
    ORDER BY a.anonymizedUser ASC;
  `;

  db.query(sql, [loggedUserId], (err, rows) => {
    if (err) {
      logger.error(`[STATS - GET GENERAL] Erro na BD ao calcular estatísticas gerais. MSG: ${err.message}`, {
        stack: err.stack,
      });

      return res.status(500).json({
        message: 'Erro ao obter estatísticas gerais.',
        error: err,
      });
    }

    if (!rows || rows.length === 0) {
      logger.warn(`[STATS - GET GENERAL] Nenhuma estatística encontrada para os estudos do UserID: ${loggedUserId}.`);

      return res.status(404).json({
        message: 'Nenhuma estatística encontrada para os seus estudos.'
      });
    }

    logger.debug(
      `[STATS - GET GENERAL] Sucesso: ${rows.length} utilizadores processados para os estudos do UserID: ${loggedUserId}.`
    );

    return res.status(200).json(rows);
  });
});

/**
 * @openapi
 * /stats/timeline:
 *   get:
 *     tags: [Stats]
 *     summary: Obter timeline de atividade do utilizador autenticado
 *     description: Retorna o número de classificações feitas pelo utilizador autenticado, agrupadas por dia.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Timeline obtida com sucesso.
 *       404:
 *         description: Nenhuma atividade encontrada para o utilizador autenticado. 
 *       500:
 *         description: Erro ao obter timeline.
 */
router.get('/timeline', (req, res) => {
  const userId = req.user.id || req.user.userId;

  logger.info(`[STATS - GET TIMELINE] Pedido de timeline para o UserID: ${userId}`);

  const sql = `
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m-%d') AS date,
      COUNT(*) AS count
    FROM classification
    WHERE userId = ?
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
    ORDER BY date ASC;
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      logger.error(`[STATS - GET TIMELINE] Erro na BD ao obter timeline do UserID: ${userId}. MSG: ${err.message}`, {
        stack: err.stack,
      });

      return res.status(500).json({
        message: 'Erro ao obter timeline.',
        error: err,
      });
    }

    if (!rows || rows.length === 0) {
      logger.warn(`[STATS - GET TIMELINE] Nenhuma atividade encontrada para o UserID: ${userId}`);
      return res.status(404).json({ message: 'Nenhuma atividade encontrada para este utilizador.' });
    }

    logger.debug(`[STATS - GET TIMELINE] Sucesso: ${rows.length} dias encontrados para o UserID: ${userId}`);

    res.status(200).json(rows);
  });
});

module.exports = router;