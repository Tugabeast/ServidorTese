const express = require('express');
const router = express.Router();
const db = require('../config/db');

// IMPORTAR O LOGGER
const { logger } = require('../utils/logger');

/**
 * @openapi
 * /studies:
 *   get:
 *     tags: [Studies]
 *     summary: Listar estudos de um utilizador (investigador)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema: { type: string }
 *         description: Investigador (addedBy) dono dos estudos.
 *     responses:
 *       200:
 *         description: Lista de estudos.
 *       400:
 *         description: Username não fornecido.
 *       404:
 *         description: Nenhum estudo encontrado para o investigador.
 *       500:
 *         description: Erro ao procurar estudos.
 */
// LISTAR ESTUDOS DE UM Ivnestigador
router.get('/', (req, res) => {
    const { username } = req.query;

    logger.info(`[STUDIES - GET] Pedido para listar estudos do investigador: ${username || 'NÃO FORNECIDO'}`);

    if (!username) {
        logger.warn(`[STUDIES - GET] Falha: Username não fornecido.`);
        return res.status(400).json({ message: 'Username não fornecido.' });
    }

    const query = `
        SELECT 
            id, name, obs, addedBy, startedAt, updatedBy, finishedAt,
            createdAt, updatedAt, minClassificationsPerPost, maxClassificationsPerUser , validationAgreementPercent
        FROM study
        WHERE addedBy = ?
        ORDER BY createdAt DESC
    `;
    db.query(query, [username], (err, results) => {
        if (err) {
            logger.error(`[STUDIES - GET] Erro na BD ao obter estudos de ${username}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao obter estudos.', error: err });
        }
        
    if (!results || results.length === 0) {
        logger.warn(`[STUDIES - GET] Nenhum estudo encontrado para o investigador ${username}.`);
        return res.status(404).json({ message: 'Nenhum estudo encontrado para este investigador.' });
    }

    logger.debug(`[STUDIES - GET] Sucesso: ${results.length} estudos encontrados para o investigador ${username}.`);
    res.status(200).json(results);
    });
});

/**
 * @openapi
 * /studies:
 *   post:
 *     tags: [Studies]
 *     summary: Criar estudo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, addedBy]
 *             properties:
 *               name: { type: string, example: "Eleições 2026" }
 *               obs: { type: string, example: "Posts do X/Twitter" }
 *               addedBy: { type: string, example: "goncalo" }
 *               minClassificationsPerPost: { type: integer, example: 3 }
 *               validationAgreementPercent: { type: integer, example: 60 }
 *     responses:
 *       201:
 *         description: Estudo criado com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       404:
 *         description: Investigador não encontrado. 
 *       409:
 *         description: Estudo já existe.
 *       500:
 *         description: Erro ao criar estudo.
 */

// 🔹 CRIAR ESTUDO
router.post('/', (req, res) => {
    const { name, obs, addedBy, minClassificationsPerPost, maxClassificationsPerUser, validationAgreementPercent } = req.body;

    logger.info(`[STUDIES - POST] Pedido para criar o estudo '${name}' pelo investigador '${addedBy}'`);

    if (!name || !addedBy) {
        logger.warn(`[STUDIES - POST] Falha: Campos obrigatórios em falta (name ou addedBy).`);
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const userQuery = 'SELECT id FROM user WHERE username = ?';

    db.query(userQuery, [addedBy], (userErr, userRows) => {
        if (userErr) {
            logger.error(`[STUDIES - POST] Erro na BD ao verificar investigador '${addedBy}'. MSG: ${userErr.message}`, { stack: userErr.stack });
            return res.status(500).json({ message: 'Erro ao verificar investigador.', error: userErr });
        }

        if (!userRows || userRows.length === 0) {
            logger.warn(`[STUDIES - POST] Falha: Investigador '${addedBy}' não encontrado.`);
            return res.status(404).json({ message: 'Investigador não encontrado.' });
        }

        const checkQuery = 'SELECT COUNT(*) AS count FROM study WHERE name = ?';

        db.query(checkQuery, [name], (err, result) => {
            if (err) {
                logger.error(`[STUDIES - POST] Erro na BD ao verificar duplicação do estudo '${name}'. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao verificar duplicação.' });
            }

            if (result[0].count > 0) {
                logger.warn(`[STUDIES - POST] Falha: Tentativa de criar estudo com nome já existente ('${name}').`);
                return res.status(409).json({ message: 'Estudo já existe.' });
            }

            const insertQuery = `
                INSERT INTO study (name, obs, addedBy, startedAt, createdAt, minClassificationsPerPost, maxClassificationsPerUser, validationAgreementPercent)
                VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?)
            `;

            db.query(insertQuery, [name, obs, addedBy, minClassificationsPerPost, maxClassificationsPerUser, validationAgreementPercent], (err) => {
                if (err) {
                    logger.error(`[STUDIES - POST] Erro na BD ao inserir o estudo '${name}'. MSG: ${err.message}`, { stack: err.stack });
                    return res.status(500).json({ message: 'Erro ao criar estudo.', error: err });
                }

                logger.info(`[STUDIES - POST] Sucesso: Estudo '${name}' criado com sucesso por '${addedBy}'.`);
                res.status(201).json({ message: 'Estudo criado com sucesso.' });
            });
        });
    });
});


/**
 * @openapi
 * /studies/{studyId}:
 *   put:
 *     tags: [Studies]
 *     summary: Atualizar estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               obs: { type: string }
 *               updatedBy: { type: string }
 *               finishedAt: { type: string, format: date-time }
 *               minClassificationsPerPost: { type: integer }
 *               validationAgreementPercent: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo atualizado com sucesso.
 *       404:
 *         description: Estudo não encontrado.
 *       409:
 *         description: Já existe outro estudo com esse nome.
 *       500:
 *         description: Erro ao atualizar estudo.
 */

// 🔹 ATUALIZAR ESTUDO
router.put('/:studyId', (req, res) => {
    let { name, obs, updatedBy, finishedAt, minClassificationsPerPost, maxClassificationsPerUser, validationAgreementPercent } = req.body;
    const { studyId } = req.params;

    logger.info(`[STUDIES - PUT] Pedido para atualizar Estudo ID: ${studyId} (Novo nome: '${name}') por '${updatedBy}'`);

    //Se o frontend mandar string vazia, converte para null
    minClassificationsPerPost = minClassificationsPerPost === '' ? null : minClassificationsPerPost;
    maxClassificationsPerUser = maxClassificationsPerUser === '' ? null : maxClassificationsPerUser;
    validationAgreementPercent = validationAgreementPercent === '' ? null : validationAgreementPercent;

    let finalFinishedAt;
    if (finishedAt === undefined || finishedAt === null || String(finishedAt).trim() === '') {
        finalFinishedAt = null;
    } else {
        finalFinishedAt = finishedAt;
    }

    const checkQuery = 'SELECT COUNT(*) AS count FROM study WHERE name = ? AND id != ?';
    db.query(checkQuery, [name, studyId], (err, result) => {
        if (err) {
            logger.error(`[STUDIES - PUT] Erro na BD ao verificar duplicação. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao verificar duplicação.' });
        }

        if (result[0].count > 0) {
            logger.warn(`[STUDIES - PUT] Falha: Já existe outro estudo com o nome '${name}'.`);
            return res.status(409).json({ message: 'Já existe outro estudo com esse nome.' });
        }

        // A query agora obriga o finishedAt a ser atualizado sempre (mesmo para o limpar com NULL)
        let query = `
            UPDATE study SET 
                name = ?, 
                obs = ?, 
                updatedBy = ?, 
                updatedAt = NOW(),
                minClassificationsPerPost = ?, 
                maxClassificationsPerUser = ?, 
                validationAgreementPercent = ?,
                finishedAt = ?
            WHERE id = ?
        `;
        
        const params = [
            name, 
            obs, 
            updatedBy, 
            minClassificationsPerPost, 
            maxClassificationsPerUser, 
            validationAgreementPercent,
            finalFinishedAt,
            studyId
        ];

        db.query(query, params, (err, result) => {
            if (err) {
                logger.error(`[STUDIES - PUT] Erro na BD ao atualizar Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao atualizar estudo.', error: err });
            }

            if (result.affectedRows === 0) {
                logger.warn(`[STUDIES - PUT] Falha: Estudo ID ${studyId} não encontrado.`);
                return res.status(404).json({ message: 'Estudo não encontrado.' });
            }

            logger.info(`[STUDIES - PUT] Sucesso: Estudo ID: ${studyId} atualizado.`);
            res.status(200).json({ message: 'Estudo atualizado com sucesso.' });
        });
    });
});


/**
 * @openapi
 * /studies/{studyId}:
 *   delete:
 *     tags: [Studies]
 *     summary: Apagar estudo
 *     description: Apaga um estudo, incluindo as perguntas e categorias associadas.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo, perguntas e categorias associadas apagados com sucesso.
 *       400:
 *         description: ID do estudo inválido.
 *       404:
 *         description: Estudo não encontrado.
 *       500:
 *         description: Erro ao apagar estudo.
 */
router.delete('/:studyId', (req, res) => {
  const { studyId } = req.params;

  logger.info(`[STUDIES - DELETE] Pedido para apagar Estudo ID: ${studyId}`);

  if (!studyId || isNaN(Number(studyId))) {
    logger.warn(`[STUDIES - DELETE] Falha: ID inválido recebido (${studyId}).`);
    return res.status(400).json({ message: 'ID do estudo inválido.' });
  }

  db.getConnection((connErr, connection) => {
    if (connErr) {
      logger.error(`[STUDIES - DELETE] Erro ao obter ligação à BD. MSG: ${connErr.message}`, {
        stack: connErr.stack
      });

      return res.status(500).json({
        message: 'Erro ao apagar estudo.',
        error: connErr
      });
    }

    connection.beginTransaction((txErr) => {
      if (txErr) {
        connection.release();

        logger.error(`[STUDIES - DELETE] Erro ao iniciar transação. MSG: ${txErr.message}`, {
          stack: txErr.stack
        });

        return res.status(500).json({
          message: 'Erro ao apagar estudo.',
          error: txErr
        });
      }

      const checkStudyQuery = 'SELECT id FROM study WHERE id = ?';

      connection.query(checkStudyQuery, [studyId], (checkErr, studyRows) => {
        if (checkErr) {
          return connection.rollback(() => {
            connection.release();

            logger.error(`[STUDIES - DELETE] Erro ao verificar Estudo ID: ${studyId}. MSG: ${checkErr.message}`, {
              stack: checkErr.stack
            });

            return res.status(500).json({
              message: 'Erro ao verificar estudo.',
              error: checkErr
            });
          });
        }

        if (!studyRows || studyRows.length === 0) {
          return connection.rollback(() => {
            connection.release();

            logger.warn(`[STUDIES - DELETE] Estudo ID ${studyId} não encontrado.`);

            return res.status(404).json({
              message: 'Estudo não encontrado.'
            });
          });
        }

        const deleteCategoriesQuery = `
          DELETE c
          FROM categories c
          INNER JOIN question q ON q.id = c.questionId
          WHERE q.studyId = ?
        `;

        connection.query(deleteCategoriesQuery, [studyId], (catErr, catResult) => {
          if (catErr) {
            return connection.rollback(() => {
              connection.release();

              logger.error(`[STUDIES - DELETE] Erro ao apagar categorias do Estudo ID: ${studyId}. MSG: ${catErr.message}`, {
                stack: catErr.stack
              });

              return res.status(500).json({
                message: 'Erro ao apagar categorias associadas ao estudo.',
                error: catErr
              });
            });
          }

          const deleteQuestionsQuery = 'DELETE FROM question WHERE studyId = ?';

          connection.query(deleteQuestionsQuery, [studyId], (questionErr, questionResult) => {
            if (questionErr) {
              return connection.rollback(() => {
                connection.release();

                logger.error(`[STUDIES - DELETE] Erro ao apagar perguntas do Estudo ID: ${studyId}. MSG: ${questionErr.message}`, {
                  stack: questionErr.stack
                });

                return res.status(500).json({
                  message: 'Erro ao apagar perguntas associadas ao estudo.',
                  error: questionErr
                });
              });
            }

            const deleteUserStudyQuery = 'DELETE FROM user_study WHERE studyId = ?';

            connection.query(deleteUserStudyQuery, [studyId], (userStudyErr, userStudyResult) => {
              if (userStudyErr) {
                return connection.rollback(() => {
                  connection.release();

                  logger.error(`[STUDIES - DELETE] Erro ao apagar associações user_study do Estudo ID: ${studyId}. MSG: ${userStudyErr.message}`, {
                    stack: userStudyErr.stack
                  });

                  return res.status(500).json({
                    message: 'Erro ao apagar associações do estudo.',
                    error: userStudyErr
                  });
                });
              }

              const deleteStudyQuery = 'DELETE FROM study WHERE id = ?';

              connection.query(deleteStudyQuery, [studyId], (studyErr, studyResult) => {
                if (studyErr) {
                  return connection.rollback(() => {
                    connection.release();

                    logger.error(`[STUDIES - DELETE] Erro ao apagar Estudo ID: ${studyId}. MSG: ${studyErr.message}`, {
                      stack: studyErr.stack
                    });

                    return res.status(500).json({
                      message: 'Erro ao apagar estudo.',
                      error: studyErr
                    });
                  });
                }

                if (studyResult.affectedRows === 0) {
                  return connection.rollback(() => {
                    connection.release();

                    logger.warn(`[STUDIES - DELETE] Estudo ID ${studyId} não encontrado no momento da eliminação.`);

                    return res.status(404).json({
                      message: 'Estudo não encontrado.'
                    });
                  });
                }

                connection.commit((commitErr) => {
                  if (commitErr) {
                    return connection.rollback(() => {
                      connection.release();

                      logger.error(`[STUDIES - DELETE] Erro ao confirmar transação. MSG: ${commitErr.message}`, {
                        stack: commitErr.stack
                      });

                      return res.status(500).json({
                        message: 'Erro ao apagar estudo.',
                        error: commitErr
                      });
                    });
                  }

                  connection.release();

                  logger.info(
                    `[STUDIES - DELETE] Sucesso: Estudo ID ${studyId} apagado. Categorias apagadas: ${catResult.affectedRows}. Perguntas apagadas: ${questionResult.affectedRows}. Associações user_study apagadas: ${userStudyResult.affectedRows}.`
                  );

                  return res.status(200).json({
                    message: 'Estudo, perguntas e categorias associadas apagados com sucesso.'
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

/**
 * @openapi
 * /studies/user:
 *   get:
 *     tags: [Studies]
 *     summary: Listar estudos associados ao utilizador autenticado
 *     description: |
 *       Retorna todos os estudos aos quais o utilizador autenticado
 *       está associado através da tabela user_study.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estudos retornada com sucesso.
 *       400:
 *         description: Utilizador autenticado inválido.
 *       401:
 *         description: Não autenticado (token inválido ou ausente).
 *       404:
 *         description: Nenhum estudo associado ao utilizador autenticado.
 *       500:
 *         description: Erro ao obter estudos do utilizador.
 */
router.get('/user', (req, res) => {
    const userId = req.user?.id || req.user?.userId;

    logger.info(`[STUDIES - GET USER] Pedido para listar estudos associados ao UserID: ${userId || 'NÃO IDENTIFICADO'}`);

    if (!userId) {
        logger.warn(`[STUDIES - GET USER] Falha: utilizador autenticado sem ID válido.`);
        return res.status(400).json({
            message: 'Utilizador autenticado inválido.'
        });
    }

    const query = `
        SELECT 
            s.id,
            s.name,
            s.obs,
            s.addedBy,
            s.startedAt,
            s.finishedAt,
            s.createdAt,
            s.updatedAt,
            s.minClassificationsPerPost,
            s.maxClassificationsPerUser,
            s.validationAgreementPercent
        FROM study s
        INNER JOIN user_study us ON s.id = us.studyId
        WHERE us.userId = ?
        ORDER BY s.createdAt DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            logger.error(`[STUDIES - GET USER] Erro na BD ao buscar estudos do UserID: ${userId}. MSG: ${err.message}`, {
                stack: err.stack
            });

            return res.status(500).json({
                message: 'Erro ao obter estudos do utilizador.',
                error: err
            });
        }

        if (!results || results.length === 0) {
            logger.warn(`[STUDIES - GET USER] Nenhum estudo associado ao UserID: ${userId}.`);

            return res.status(404).json({
                message: 'Nenhum estudo associado a este utilizador.'
            });
        }

        logger.debug(`[STUDIES - GET USER] Sucesso: Encontrados ${results.length} estudos para o UserID: ${userId}.`);

        return res.status(200).json(results);
    });
});

module.exports = router;



