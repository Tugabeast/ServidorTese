const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

// IMPORTAR O LOGGER
const { logger } = require('../utils/logger');

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Obter todos os utilizadores
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de utilizadores.
 *       500:
 *         description: Erro ao procurar utilizadores.
 */
// rota para obter todos os utilizadores
router.get('/', (req, res) => {
    logger.info(`[USERS - GET ALL] Pedido para listar todos os utilizadores (Solicitado por UserID: ${req.user?.id})`);

    const query = `
        SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy
        FROM user
    `;
    db.query(query, (err, results) => {
        if (err) {
            logger.error(`[USERS - GET ALL] Erro na BD ao listar utilizadores. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao procurar utilizadores', error: err });
        }
        
        logger.debug(`[USERS - GET ALL] Sucesso: Devolvidos ${results.length} utilizadores.`);
        res.status(200).json(results);
    });
});

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Adicionar utilizador (ADMIN)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, email, type]
 *             properties:
 *               username: { type: string, example: "novo_user" }
 *               password: { type: string, format: password, example: "123456" }
 *               email: { type: string, format: email, example: "user@dominio.com" }
 *               type: { type: string, example: "user" }
 *               createdBy: { type: string, example: "admin" }
 *     responses:
 *       201:
 *         description: Utilizador adicionado com sucesso.
 *       400:
 *         description: Campos obrigatórios em falta.
 *       409:
 *         description: Utilizador ou email já registado.
 *       500:
 *         description: Erro ao criar utilizador.
 */

// rota para adicionar um utilizador ( sendo ADMIN )
router.post('/', async (req, res) => {
    const { username, password, email, type, createdBy } = req.body;

    logger.info(`[USERS - POST] Pedido (Admin) para criar novo utilizador '${username}' (${email})`);

    if (!username || !password || !email || !type) {
        logger.warn(`[USERS - POST] Falha: Campos obrigatórios em falta para criar utilizador.`);
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const checkQuery = 'SELECT username FROM user WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) {
            logger.error(`[USERS - POST] Erro na BD ao verificar duplicação do utilizador '${username}'. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro no servidor', error: err });
        }

        if (results.length > 0) {
            logger.warn(`[USERS - POST] Falha: Utilizador ou email já registado ('${username}' / '${email}')`);
            return res.status(409).json({ message: 'Utilizador ou email já registado.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const insertQuery = `
                INSERT INTO user (username, password, email, type, createdBy, updatedBy, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, NULL, NOW(), NULL)
            `;
            db.query(
                insertQuery,
                [username, hashedPassword, email, type, createdBy || 'admin'],
                (err) => {
                    if (err) {
                        logger.error(`[USERS - POST] Erro na BD ao inserir utilizador '${username}'. MSG: ${err.message}`, { stack: err.stack });
                        return res.status(500).json({ message: 'Erro ao criar utilizador', error: err });
                    }
                    
                    logger.info(`[USERS - POST] Sucesso: Utilizador '${username}' criado por '${createdBy || 'admin'}'`);
                    res.status(201).json({ message: 'Utilizador adicionado com sucesso.' });
                }
            );
        } catch (hashErr) {
            logger.error(`[USERS - POST] Erro ao aplicar hash na password de '${username}'. MSG: ${hashErr.message}`, { stack: hashErr.stack });
            return res.status(500).json({ message: 'Erro interno ao processar dados de segurança', error: hashErr });
        }
    });
});


/**
 * @openapi
 * /users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Obter utilizador por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Utilizador encontrado.
 *       404:
 *         description: Utilizador não encontrado.
 *       500:
 *         description: Erro ao procurar utilizador.
 */

// rota para obter user por id
router.get('/:userId', (req, res) => {
    const { userId } = req.params;
    
    logger.info(`[USERS - GET BY ID] Pedido para detalhes do UserID: ${userId}`);

    const query = `
        SELECT id, username, email, type, createdAt, updatedAt, createdBy, updatedBy
        FROM user
        WHERE id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            logger.error(`[USERS - GET BY ID] Erro na BD ao procurar UserID: ${userId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao procurar utilizador', error: err });
        }
        if (results.length === 0) {
            logger.warn(`[USERS - GET BY ID] Falha: UserID: ${userId} não encontrado.`);
            return res.status(404).json({ message: 'Utilizador não encontrado' });
        }
        
        res.status(200).json(results[0]);
    });
});


/**
 * @openapi
 * /users/{userId}:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar utilizador
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, type]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               type: { type: string, example: "user" }
 *               password: { type: string, format: password }
 *               updatedBy: { type: string, example: "admin" }
 *     responses:
 *       200:
 *         description: Utilizador atualizado com sucesso.
 *       404:
 *         description: Utilizador não encontrado.
 *       409:
 *         description: Username ou email já existe.
 *       500:
 *         description: Erro ao atualizar utilizador.
 */

// rota para atualizar um utilizador
router.put('/:userId', async (req, res) => {
    const { username, email, type, password, updatedBy } = req.body;
    const { userId } = req.params;

    logger.info(`[USERS - PUT] Pedido (Admin) para atualizar UserID: ${userId} (Novo Username: '${username}')`);

    if (!username || !email || !type) {
        logger.warn(`[USERS - PUT] Falha: Campos obrigatórios em falta no UserID: ${userId}`);
        return res.status(400).json({ message: 'Username, email e tipo são obrigatórios.' });
    }

    try {
        let query = `
            UPDATE user SET username = ?, email = ?, type = ?, updatedAt = NOW(), updatedBy = ?
        `;
        const params = [username, email, type, updatedBy || 'system'];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `, password = ?`;
            params.push(hashedPassword);
        }

        query += ` WHERE id = ?`;
        params.push(userId);

        db.query(query, params, (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    logger.warn(`[USERS - PUT] Falha (ER_DUP_ENTRY): Conflito ao atualizar UserID: ${userId}. Já existe username ou email.`);
                    return res.status(409).json({ message: 'Username ou email já existe.' });
                }
                logger.error(`[USERS - PUT] Erro na BD ao atualizar UserID: ${userId}. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao atualizar utilizador', error: err });
            }
            if (result.affectedRows === 0) {
                logger.warn(`[USERS - PUT] Falha: UserID: ${userId} não encontrado para atualizar.`);
                return res.status(404).json({ message: 'Utilizador não encontrado.' });
            }

            logger.info(`[USERS - PUT] Sucesso: UserID: ${userId} atualizado com sucesso por '${updatedBy || 'system'}'.`);
            res.status(200).json({ message: 'Utilizador atualizado com sucesso.' });
        });
    } catch (err) {
        logger.error(`[USERS - PUT] Erro crítico bloqueado no try/catch (UserID: ${userId}). MSG: ${err.message}`, { stack: err.stack });
        res.status(500).json({ message: 'Erro interno do servidor', error: err });
    }
});

/**
 * @openapi
 * /users/{userId}:
 *   delete:
 *     tags: [Users]
 *     summary: Eliminar utilizador
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Utilizador removido com sucesso.
 *       404:
 *         description: Utilizador não encontrado.
 *       500:
 *         description: Erro ao eliminar utilizador.
 */

// rota para eliminar um utilizador
router.delete('/:userId', (req, res) => {
    const { userId } = req.params;

    logger.info(`[USERS - DELETE] Pedido para apagar UserID: ${userId}`);

    const query = 'DELETE FROM user WHERE id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) {
            logger.error(`[USERS - DELETE] Erro na BD ao apagar UserID: ${userId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao eliminar utilizador', error: err });
        }
        if (result.affectedRows === 0) {
            logger.warn(`[USERS - DELETE] Falha: UserID: ${userId} não encontrado para eliminar.`);
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }

        logger.info(`[USERS - DELETE] Sucesso: UserID: ${userId} apagado com sucesso.`);
        res.status(200).json({ message: 'Utilizador removido com sucesso.' });
    });
});

/**
 * @openapi
 * /users/{userId}/studies:
 *   post:
 *     tags: [Users]
 *     summary: Associar utilizador a um estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studyId]
 *             properties:
 *               studyId: { type: integer, example: 4 }
 *     responses:
 *       201:
 *         description: Utilizador associado com sucesso.
 *       409:
 *         description: Associação já existente.
 *       400:
 *         description: ID do estudo em falta.
 *       500:
 *         description: Erro ao associar utilizador ao estudo.
 */

// Associar utilizador a um estudo
router.post('/:userId/studies', (req, res) => {
  const { userId } = req.params;
  const { studyId } = req.body;

  logger.info(`[USER_STUDY - POST] Pedido para associar UserID: ${userId} ao Estudo ID: ${studyId}`);

  if (!studyId) {
      logger.warn(`[USER_STUDY - POST] Falha: ID do estudo em falta ao associar UserID: ${userId}`);
      return res.status(400).json({ message: 'ID do estudo em falta.' });
  }

  const checkQuery = 'SELECT * FROM user_study WHERE userId = ? AND studyId = ?';
  db.query(checkQuery, [userId, studyId], (err, result) => {
    if (err) {
        logger.error(`[USER_STUDY - POST] Erro na BD ao verificar associação entre UserID: ${userId} e Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao verificar associação.', error: err });
    }
    
    if (result.length > 0) {
        logger.warn(`[USER_STUDY - POST] Falha: Associação já existente (UserID: ${userId}, Estudo ID: ${studyId})`);
        return res.status(409).json({ message: 'Associação já existente.' });
    }

    const insertQuery = 'INSERT INTO user_study (userId, studyId) VALUES (?, ?)';
    db.query(insertQuery, [userId, studyId], (err) => {
      if (err) {
          logger.error(`[USER_STUDY - POST] Erro na BD ao inserir associação entre UserID: ${userId} e Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
          return res.status(500).json({ message: 'Erro ao associar utilizador ao estudo.', error: err });
      }
      
      logger.info(`[USER_STUDY - POST] Sucesso: UserID: ${userId} associado ao Estudo ID: ${studyId}`);
      res.status(201).json({ message: 'Utilizador associado com sucesso.' });
    });
  });
});

/**
 * @openapi
 * /users/{userId}/studies:
 *   get:
 *     tags: [Users]
 *     summary: Obter estudos associados a um utilizador
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de estudos do utilizador.
 *       500:
 *         description: Erro ao obter estudos.
 */

// Obter estudos de um utilizador
router.get('/:userId/studies', (req, res) => {
  const { userId } = req.params;

  logger.info(`[USER_STUDY - GET] Pedido para listar estudos associados ao UserID: ${userId}`);

  const query = `
    SELECT s.* FROM user_study us
    JOIN study s ON s.id = us.studyId
    WHERE us.userId = ?
  `;
  db.query(query, [userId], (err, results) => {
    if (err) {
        logger.error(`[USER_STUDY - GET] Erro na BD ao listar estudos do UserID: ${userId}. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao obter estudos.', error: err });
    }
    
    logger.debug(`[USER_STUDY - GET] Sucesso: Devolvidos ${results.length} estudos para o UserID: ${userId}`);
    res.status(200).json(results);
  });
});

/**
 * @openapi
 * /users/{userId}/studies/{studyId}:
 *   delete:
 *     tags: [Users]
 *     summary: Remover associação entre utilizador e estudo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo do utilizador removido com sucesso.
 *       404:
 *         description: Associação não encontrada.
 *       500:
 *         description: Erro ao remover associação.
 */

//  Eliminar associação entre utilizador e estudo
router.delete('/:userId/studies/:studyId', (req, res) => {
  const { userId, studyId } = req.params;

  logger.info(`[USER_STUDY - DELETE] Pedido para remover a associação do UserID: ${userId} com o Estudo ID: ${studyId}`);

  const deleteQuery = 'DELETE FROM user_study WHERE userId = ? AND studyId = ?';
  db.query(deleteQuery, [userId, studyId], (err, result) => {
    if (err) {
        logger.error(`[USER_STUDY - DELETE] Erro na BD ao apagar a associação. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao remover associação.', error: err });
    }
    if (result.affectedRows === 0) {
        logger.warn(`[USER_STUDY - DELETE] Falha: Associação não encontrada (UserID: ${userId}, Estudo ID: ${studyId})`);
        return res.status(404).json({ message: 'Associação não encontrada.' });
    }

    logger.info(`[USER_STUDY - DELETE] Sucesso: Estudo ID: ${studyId} removido do utilizador UserID: ${userId}`);
    res.status(200).json({ message: 'Estudo do utilizador removido com sucesso.' });
  });
});


module.exports = router;
