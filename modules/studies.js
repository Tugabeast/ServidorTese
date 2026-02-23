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
            createdAt, updatedAt, minClassificationsPerPost, validationAgreementPercent
        FROM study
        WHERE addedBy = ?
        ORDER BY createdAt DESC
    `;
    db.query(query, [username], (err, results) => {
        if (err) {
            logger.error(`[STUDIES - GET] Erro na BD ao obter estudos de ${username}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao obter estudos.', error: err });
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
 *       409:
 *         description: Estudo já existe.
 *       500:
 *         description: Erro ao criar estudo.
 */

// 🔹 CRIAR ESTUDO
router.post('/', (req, res) => {
    const { name, obs, addedBy, minClassificationsPerPost, validationAgreementPercent } = req.body;

    logger.info(`[STUDIES - POST] Pedido para criar o estudo '${name}' pelo investigador '${addedBy}'`);

    if (!name || !addedBy) {
        logger.warn(`[STUDIES - POST] Falha: Campos obrigatórios em falta (name ou addedBy).`);
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
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
            INSERT INTO study (name, obs, addedBy, startedAt, createdAt, minClassificationsPerPost, validationAgreementPercent)
            VALUES (?, ?, ?, NOW(), NOW(), ?, ?)
        `;
        db.query(insertQuery, [name, obs, addedBy, minClassificationsPerPost, validationAgreementPercent], (err) => {
            if (err) {
                logger.error(`[STUDIES - POST] Erro na BD ao inserir o estudo '${name}'. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao criar estudo.', error: err });
            }
            
            logger.info(`[STUDIES - POST] Sucesso: Estudo '${name}' criado com sucesso por '${addedBy}'.`);
            res.status(201).json({ message: 'Estudo criado com sucesso.' });
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
 *       409:
 *         description: Já existe outro estudo com esse nome.
 *       500:
 *         description: Erro ao atualizar estudo.
 */

// 🔹 ATUALIZAR ESTUDO
router.put('/:studyId', (req, res) => {
    const { name, obs, updatedBy, finishedAt, minClassificationsPerPost, validationAgreementPercent } = req.body;
    const { studyId } = req.params;

    logger.info(`[STUDIES - PUT] Pedido para atualizar Estudo ID: ${studyId} (Novo nome: '${name}') por '${updatedBy}'`);

    // Verificar duplicação (mas excluir o próprio estudo)
    const checkQuery = 'SELECT COUNT(*) AS count FROM study WHERE name = ? AND id != ?';
    db.query(checkQuery, [name, studyId], (err, result) => {
        if (err) {
            logger.error(`[STUDIES - PUT] Erro na BD ao verificar duplicação para Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao verificar duplicação.' });
        }

        if (result[0].count > 0) {
            logger.warn(`[STUDIES - PUT] Falha: Já existe outro estudo com o nome '${name}'. Conflito com ID: ${studyId}`);
            return res.status(409).json({ message: 'Já existe outro estudo com esse nome.' });
        }

        let query = `
            UPDATE study SET 
                name = ?, obs = ?, updatedBy = ?, updatedAt = NOW(),
                minClassificationsPerPost = ?, validationAgreementPercent = ?
        `;
        const params = [name, obs, updatedBy, minClassificationsPerPost, validationAgreementPercent];

        if (finishedAt) {
            query += ', finishedAt = ?';
            params.push(finishedAt);
        }

        query += ' WHERE id = ?';
        params.push(studyId);

        db.query(query, params, (err) => {
            if (err) {
                logger.error(`[STUDIES - PUT] Erro na BD ao atualizar Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao atualizar estudo.', error: err });
            }
            logger.info(`[STUDIES - PUT] Sucesso: Estudo ID: ${studyId} atualizado com sucesso.`);
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estudo apagado com sucesso.
 *       404:
 *         description: Estudo não encontrado.
 *       500:
 *         description: Erro ao apagar estudo.
 */

// 🔹 APAGAR ESTUDO
router.delete('/:studyId', (req, res) => {
    const { studyId } = req.params;

    logger.info(`[STUDIES - DELETE] Pedido para apagar Estudo ID: ${studyId}`);

    db.query('DELETE FROM study WHERE id = ?', [studyId], (err, result) => {
        if (err) {
            logger.error(`[STUDIES - DELETE] Erro na BD ao apagar Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao apagar estudo.', error: err });
        }

        if (result.affectedRows === 0) {
            logger.warn(`[STUDIES - DELETE] Falha: Estudo ID: ${studyId} não encontrado.`);
            return res.status(404).json({ message: 'Estudo não encontrado.' });
        }

        logger.info(`[STUDIES - DELETE] Sucesso: Estudo ID: ${studyId} apagado com sucesso.`);
        res.status(200).json({ message: 'Estudo apagado com sucesso.' });
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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 4
 *                   name:
 *                     type: string
 *                     example: "Estudo Eleições 2026"
 *                   obs:
 *                     type: string
 *                     example: "Análise de publicações políticas"
 *       401:
 *         description: Não autenticado (token inválido ou ausente).
 *       500:
 *         description: Erro ao obter estudos do utilizador.
 */
router.get('/user', (req, res) => {
    const userId = req.user.id; 

    logger.info(`[STUDIES - GET USER] Pedido para listar estudos associados ao UserID: ${userId}`);

    // JOIN entre study e user_study para saber quais os estudos deste user específico
    const query = `
        SELECT s.id, s.name, s.obs
        FROM study s
        INNER JOIN user_study us ON s.id = us.studyId
        WHERE us.userId = ?
        ORDER BY s.createdAt DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            logger.error(`[STUDIES - GET USER] Erro na BD ao buscar estudos do participante UserID: ${userId}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ 
                message: 'Erro ao obter estudos do utilizador.', 
                error: err 
            });
        }
        
        logger.debug(`[STUDIES - GET USER] Sucesso: Encontrados ${results.length} estudos para o UserID: ${userId}`);
        res.status(200).json(results);
    });
});

module.exports = router;



