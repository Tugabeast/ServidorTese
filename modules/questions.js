const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { logger } = require('../utils/logger');


/**
 * @openapi
 * /questions:
 *   get:
 *     tags: [Questions]
 *     summary: Listar perguntas (por investigador ou por estudo)
 *     description: |
 *       Lista perguntas:
 *       - Se for fornecido studyId, retorna perguntas desse estudo.
 *       - Se for fornecido username (sem studyId), retorna todas as perguntas dos estudos criados por esse investigador.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: false
 *         schema:
 *           type: string
 *         description: Nome do investigador (addedBy no estudo).
 *       - in: query
 *         name: studyId
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID do estudo para filtrar perguntas.
 *     responses:
 *       200:
 *         description: Lista de perguntas retornada com sucesso.
 *       400:
 *         description: Nome de utilizador não fornecido (quando necessário).
 *       500:
 *         description: Erro ao procurar perguntas.
 */
// LISTAR PERGUNTAS por username (todas as perguntas dos estudos do investigador)
// Opcionalmente podes filtrar por studyId: /questions?username=...&studyId=11
router.get('/', (req, res) => {
  const { username, studyId } = req.query;

  logger.info(`[QUESTIONS - GET ALL] Pedido para listar perguntas. Username: ${username || 'N/A'} | StudyID: ${studyId || 'N/A'}`);

  if (studyId) {
    const q = `
      SELECT q.id, q.question, q.content, q.inputType, q.studyId,
             s.name AS studyName, q.createdAt
      FROM question q
      LEFT JOIN study s ON s.id = q.studyId
      WHERE q.studyId = ?
      ORDER BY q.createdAt DESC
    `;
    return db.query(q, [studyId], (err, rows) => {
      if (err) {
          logger.error(`[QUESTIONS - GET ALL] Erro na BD ao procurar perguntas pelo StudyID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
          return res.status(500).json({ message: 'Erro ao procurar perguntas.', error: err });
      }
      logger.debug(`[QUESTIONS - GET ALL] Sucesso: Encontradas ${rows?.length || 0} perguntas para o StudyID: ${studyId}`);
      return res.status(200).json(rows || []);
    });
  }

  if (!username) {
    logger.warn(`[QUESTIONS - GET ALL] Falha: Nome de utilizador não fornecido e sem studyId.`);
    return res.status(400).json({ message: 'Nome de utilizador não fornecido.' });
  }

  const q = `
    SELECT q.id, q.question, q.content, q.inputType, q.studyId,
           s.name AS studyName, q.createdAt
    FROM question q
    JOIN study s ON s.id = q.studyId
    WHERE s.addedBy = ?
    ORDER BY q.createdAt DESC
  `;
  db.query(q, [username], (err, rows) => {
    if (err) {
        logger.error(`[QUESTIONS - GET ALL] Erro na BD ao procurar perguntas para o investigador: ${username}. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao procurar perguntas.', error: err });
    }
    logger.debug(`[QUESTIONS - GET ALL] Sucesso: Encontradas ${rows?.length || 0} perguntas globais para o investigador: ${username}`);
    return res.status(200).json(rows || []);
  });
});




/**
 * @openapi
 * /questions/{studyId}:
 *   get:
 *     tags: [Questions]
 *     summary: Listar perguntas de um estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *      200:
 *         description: Lista de perguntas do estudo.
 *      400:
 *         description: Campos obrigatórios em falta.
 *      404:
 *         description: Não foram encontradas perguntas para o estudo.
 *      500:
 *         description: Erro ao procurar perguntas.
 */

// LISTAR PERGUNTAS DE UM ESTUDO
router.get('/:studyId', (req, res) => {
    const { studyId } = req.params;

    logger.info(`[QUESTIONS - GET BY STUDY] Pedido para obter perguntas do Estudo ID: ${studyId}`);

    if (!studyId) {
        logger.warn(`[QUESTIONS - GET BY STUDY] Falha: studyId em falta.`);
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = `
        SELECT id, question, content, inputType, createdAt
        FROM question
        WHERE studyId = ?
        ORDER BY createdAt DESC
    `;

    db.query(query, [studyId], (err, results) => {
        if (err) {
            logger.error(`[QUESTIONS - GET BY STUDY] Erro na BD ao obter perguntas do Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao procurar perguntas.', error: err });
        }

        if (!results || results.length === 0) {
            logger.info(`[QUESTIONS - GET BY STUDY] Sem resultados: Não foram encontradas perguntas para o Estudo ID: ${studyId}`);
            return res.status(404).json({ message: 'Não foram encontradas perguntas para o estudo.' });
        }

        logger.debug(`[QUESTIONS - GET BY STUDY] Sucesso: ${results.length} perguntas retornadas para o Estudo ID: ${studyId}`);
        res.status(200).json(results);
    });
});

/**
 * @openapi
 * /questions:
 *   post:
 *     tags: [Questions]
 *     summary: Criar pergunta
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, content, inputType, studyId]
 *             properties:
 *               question: { type: string, example: "A publicação é..." }
 *               content: { type: string, example: "Selecione as categorias pertinentes" }
 *               inputType: { type: string, example: "checkbox" }
 *               studyId: { type: integer, example: 4 }
 *     responses:
 *       201:
 *         description: Pergunta criada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       500:
 *         description: Erro ao criar pergunta.
 */

// 🔹 CRIAR PERGUNTA
router.post('/', (req, res) => {
  const { question, content, inputType, studyId } = req.body;

  logger.info(`[QUESTIONS - POST] Pedido para criar pergunta '${question}' no Estudo ID: ${studyId}`);

  if (!question || !content || !inputType || !studyId) {
    logger.warn(`[QUESTIONS - POST] Falha: Campos obrigatórios em falta para criação de pergunta.`);
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  // verifica duplicado no MESMO estudo (case/space-insensitive)
  const dupQuery = `
    SELECT COUNT(*) AS cnt
    FROM question
    WHERE studyId = ?
      AND LOWER(TRIM(question)) = LOWER(TRIM(?))
  `;
  db.query(dupQuery, [studyId, question], (err, rows) => {
    if (err) {
        logger.error(`[QUESTIONS - POST] Erro na BD ao verificar duplicação de pergunta no Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao verificar duplicados.', error: err });
    }
    if (rows[0].cnt > 0) {
      logger.warn(`[QUESTIONS - POST] Falha: Pergunta '${question}' já existe no Estudo ID: ${studyId}.`);
      return res.status(409).json({ message: 'Já existe uma pergunta com esse nome neste estudo.' });
    }

    const insertQuery = `
      INSERT INTO question (question, content, inputType, studyId, createdAt)
      VALUES (?, ?, ?, ?, NOW())
    `;
    db.query(insertQuery, [question, content, inputType, studyId], (err2) => {
      if (err2) {
        // também apanha violação de UNIQUE na BD (se criares o índice)
        if (err2.code === 'ER_DUP_ENTRY') {
          logger.warn(`[QUESTIONS - POST] Falha (ER_DUP_ENTRY): Pergunta '${question}' já existe no Estudo ID: ${studyId}.`);
          return res.status(409).json({ message: 'Já existe uma pergunta com esse nome neste estudo.' });
        }
        logger.error(`[QUESTIONS - POST] Erro na BD ao inserir pergunta '${question}' no Estudo ID: ${studyId}. MSG: ${err2.message}`, { stack: err2.stack });
        return res.status(500).json({ message: 'Erro ao criar pergunta.', error: err2 });
      }
      
      logger.info(`[QUESTIONS - POST] Sucesso: Pergunta '${question}' criada no Estudo ID: ${studyId}.`);
      res.status(201).json({ message: 'Pergunta criada com sucesso.' });
    });
  });
});

/**
 * @openapi
 * /questions/{questionId}:
 *   put:
 *     tags: [Questions]
 *     summary: Atualizar pergunta
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question: { type: string }
 *               content: { type: string }
 *               inputType: { type: string }
 *     responses:
 *       200:
 *         description: Pergunta atualizada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       404:
 *         description: Pergunta não encontrada.
 *       500:
 *         description: Erro ao atualizar pergunta.
 */

// ATUALIZAR PERGUNTA
router.put('/:questionId', (req, res) => {
  const { question, content, inputType, studyId } = req.body;
  const { questionId } = req.params;

  logger.info(`[QUESTIONS - PUT] Pedido para atualizar pergunta ID: ${questionId} (Novo nome: '${question}', Estudo ID: ${studyId})`);

  if (!questionId || !question || !content || !inputType || !studyId) {
    logger.warn(`[QUESTIONS - PUT] Falha: Campos obrigatórios em falta no ID: ${questionId}`);
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  const dupQuery = `
    SELECT COUNT(*) AS cnt
    FROM question
    WHERE studyId = ?
      AND LOWER(TRIM(question)) = LOWER(TRIM(?))
      AND id <> ?
  `;
  db.query(dupQuery, [studyId, question, questionId], (err, rows) => {
    if (err) {
        logger.error(`[QUESTIONS - PUT] Erro na BD ao verificar duplicação na edição da pergunta ID: ${questionId}. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao verificar duplicados.', error: err });
    }
    if (rows[0].cnt > 0) {
      logger.warn(`[QUESTIONS - PUT] Falha: A edição para '${question}' conflitaria com outra pergunta no Estudo ID: ${studyId}.`);
      return res.status(409).json({ message: 'Já existe uma pergunta com esse nome neste estudo.' });
    }

    const updateQuery = `
      UPDATE question
      SET question = ?, content = ?, inputType = ?, studyId = ?
      WHERE id = ?
    `;
    db.query(updateQuery, [question, content, inputType, studyId, questionId], (err2, result) => {
      if (err2) {
        if (err2.code === 'ER_DUP_ENTRY') {
          logger.warn(`[QUESTIONS - PUT] Falha (ER_DUP_ENTRY): A edição para '${question}' conflitaria no Estudo ID: ${studyId}.`);
          return res.status(409).json({ message: 'Já existe uma pergunta com esse nome neste estudo.' });
        }
        logger.error(`[QUESTIONS - PUT] Erro na BD ao atualizar pergunta ID: ${questionId}. MSG: ${err2.message}`, { stack: err2.stack });
        return res.status(500).json({ message: 'Erro ao atualizar pergunta.', error: err2 });
      }
      if (result.affectedRows === 0) {
        logger.warn(`[QUESTIONS - PUT] Falha: Pergunta ID: ${questionId} não encontrada para atualização.`);
        return res.status(404).json({ message: 'Pergunta não encontrada.' });
      }
      
      logger.info(`[QUESTIONS - PUT] Sucesso: Pergunta ID: ${questionId} atualizada com sucesso.`);
      res.status(200).json({ message: 'Pergunta atualizada com sucesso.' });
    });
  });
});

/**
 * @openapi
 * /questions/{questionId}:
 *   delete:
 *     tags: [Questions]
 *     summary: Apagar pergunta
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pergunta apagada com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       404:
 *         description: Pergunta não encontrada.
 *       500:
 *         description: Erro ao apagar pergunta.
 */

// 🔹 APAGAR PERGUNTA
router.delete('/:questionId', (req, res) => {
    const { questionId } = req.params;

    logger.info(`[QUESTIONS - DELETE] Pedido para apagar pergunta ID: ${questionId}`);

    if (!questionId) {
        logger.warn(`[QUESTIONS - DELETE] Falha: questionId não fornecido.`);
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = 'DELETE FROM question WHERE id = ?';
    db.query(query, [questionId], (err, result) => {
        if (err) {
            logger.error(`[QUESTIONS - DELETE] Erro na BD ao apagar pergunta ID: ${questionId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao apagar pergunta.', error: err });
        }

        if (result.affectedRows === 0) {
            logger.warn(`[QUESTIONS - DELETE] Falha: Pergunta ID: ${questionId} não encontrada.`);
            return res.status(404).json({ message: 'Pergunta não encontrada.' });
        }

        logger.info(`[QUESTIONS - DELETE] Sucesso: Pergunta ID: ${questionId} apagada com sucesso.`);
        res.status(200).json({ message: 'Pergunta apagada com sucesso.' });
    });
});

module.exports = router;
