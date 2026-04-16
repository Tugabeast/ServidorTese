const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');
const { logger } = require('../utils/logger');

const getStudyProgress = async (userId, studyId) => {
    const progressQuery = `
        SELECT
            s.id,
            s.name,
            s.minClassificationsPerPost,
            s.maxClassificationsPerUser,
            COUNT(DISTINCT p.id) AS totalPosts,

            SUM(
                CASE
                    WHEN (
                        SELECT COUNT(DISTINCT c1.userId)
                        FROM classification c1
                        WHERE c1.postId = p.id
                    ) >= s.minClassificationsPerPost
                    THEN 1
                    ELSE 0
                END
            ) AS completedPosts,

            SUM(
                CASE
                    WHEN (
                        SELECT COUNT(DISTINCT c2.userId)
                        FROM classification c2
                        WHERE c2.postId = p.id
                    ) < s.minClassificationsPerPost
                    THEN 1
                    ELSE 0
                END
            ) AS remainingPosts,

            SUM(
                CASE
                    WHEN NOT EXISTS (
                        SELECT 1
                        FROM classification cu
                        WHERE cu.postId = p.id
                          AND cu.userId = ?
                    )
                    AND (
                        SELECT COUNT(DISTINCT c3.userId)
                        FROM classification c3
                        WHERE c3.postId = p.id
                    ) < s.minClassificationsPerPost
                    THEN 1
                    ELSE 0
                END
            ) AS rawAvailablePostsForUser,

            (
                SELECT COUNT(DISTINCT c4.postId)
                FROM classification c4
                JOIN question q4 ON q4.id = c4.questionId
                WHERE c4.userId = ?
                  AND q4.studyId = s.id
            ) AS userDonePosts

        FROM study s
        LEFT JOIN post p ON p.studyId = s.id
        WHERE s.id = ?
        GROUP BY s.id, s.name, s.minClassificationsPerPost, s.maxClassificationsPerUser
    `;

    const [rows] = await db.promise().query(progressQuery, [userId, userId, studyId]);

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];

    const totalPosts = Number(row.totalPosts || 0);
    const completedPosts = Number(row.completedPosts || 0);
    const remainingPosts = Number(row.remainingPosts || 0);
    const rawAvailablePostsForUser = Number(row.rawAvailablePostsForUser || 0);
    const userDonePosts = Number(row.userDonePosts || 0);

    const maxClassificationsPerUser =
        row.maxClassificationsPerUser !== null
            ? Number(row.maxClassificationsPerUser)
            : null;

    const userRemainingLimit =
        maxClassificationsPerUser !== null
            ? Math.max(0, maxClassificationsPerUser - userDonePosts)
            : null;

    const availablePostsForUser =
        userRemainingLimit !== null
            ? Math.max(0, Math.min(rawAvailablePostsForUser, userRemainingLimit))
            : rawAvailablePostsForUser;

    return {
        studyId: Number(row.id),
        studyName: row.name,
        totalPosts,
        completedPosts,
        remainingPosts,
        availablePostsForUser,
        userDonePosts,
        minClassificationsPerPost: Number(row.minClassificationsPerPost || 0),
        maxClassificationsPerUser,
        userRemainingLimit,
        completionPercentage:
            totalPosts > 0 ? Math.round((completedPosts / totalPosts) * 100) : 0,
    };
};

/**
 * @openapi
 * /posts/investigador:
 *   get:
 *     tags: [Posts]
 *     summary: Listar posts criados pelo investigador autenticado
 *     description: Retorna posts dos estudos cujo `addedBy` é o `username` do utilizador autenticado. Inclui imagens em base64.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de posts do investigador.
 *       401:
 *         description: Não autenticado.
 *       500:
 *         description: Erro ao buscar posts.
 */
router.get('/investigador', (req, res) => {
    const userId = req.user?.id;
    const username = req.user?.username;

    logger.info(`[POSTS - INVESTIGADOR] Pedido de publicações para o investigador: ${username} (ID: ${userId})`);

    if (!userId) {
        logger.warn(`[POSTS - INVESTIGADOR] Falha: Token sem user.id`);
        return res.status(401).json({ message: 'Token inválido ou utilizador não autenticado.' });
    }

    const query = `
        SELECT DISTINCT p.id, p.pageName, IFNULL(p.details, '') AS details,
               p.likesCount, p.commentsCount, p.sharesCount, p.studyId,
               s.name AS studyName
        FROM post p
        INNER JOIN study s ON p.studyId = s.id
        WHERE s.addedBy = ?
    `;

    const imagesQuery = `
        SELECT i.postId, i.image_data, i.isFrontPage
        FROM image i
        WHERE i.postId IN (?);
    `;

    db.query(query, [username], (err, postsResults) => {
        if (err) {
            logger.error(`[POSTS - INVESTIGADOR] Erro ao buscar publicações para o utilizador ${username}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao buscar posts.', error: err });
        }

        const postIds = postsResults.map(post => post.id);

        if (postIds.length === 0) {
            logger.info(`[POSTS - INVESTIGADOR] Nenhum post encontrado para o investigador ${username}.`);
            return res.json({ posts: [] });
        }

        db.query(imagesQuery, [postIds], (err, imagesResults) => {
            if (err) {
                logger.error(`[POSTS - INVESTIGADOR] Erro ao buscar imagens para os posts do investigador ${username}. MSG: ${err.message}`, { stack: err.stack });
                return res.status(500).json({ message: 'Erro ao buscar imagens.', error: err });
            }

            const imagesByPostId = {};
            imagesResults.forEach(img => {
                if (!img.image_data) {
                    logger.warn(`[POSTS - INVESTIGADOR] Imagem nula detetada e ignorada para o postId: ${img.postId}`);
                    return;
                }

                if (!imagesByPostId[img.postId]) {
                    imagesByPostId[img.postId] = [];
                }

                imagesByPostId[img.postId].push({
                    image_data: img.image_data.toString('base64'),
                    isFrontPage: img.isFrontPage
                });
            });

            const posts = postsResults.map(post => ({
                id: post.id,
                pageName: post.pageName,
                details: post.details,
                likesCount: post.likesCount,
                commentsCount: post.commentsCount,
                sharesCount: post.sharesCount,
                studyId: post.studyId,
                images: imagesByPostId[post.id] || []
            }));

            logger.info(`[POSTS - INVESTIGADOR] Sucesso: Enviadas ${posts.length} publicações para o investigador ${username}.`);
            res.status(200).json({ posts });
        });
    });
});

/**
 * @openapi
 * /posts/progress:
 *   get:
 *     tags: [Posts]
 *     summary: Obter progresso do estudo para o utilizador autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Progresso calculado com sucesso.
 *       400:
 *         description: studyId em falta.
 *       401:
 *         description: Não autenticado.
 *       403:
 *         description: Sem permissão para o estudo.
 *       500:
 *         description: Erro ao calcular progresso.
 */
router.get('/progress', async (req, res) => {
    const userId = req.user?.id;
    const selectedStudyId = req.query.studyId;

    if (!userId) {
        return res.status(401).json({ message: 'Token inválido.' });
    }

    if (!selectedStudyId) {
        return res.status(400).json({ message: 'studyId é obrigatório.' });
    }

    try {
        const [studyRows] = await db.promise().query(
            'SELECT studyId FROM user_study WHERE userId = ?',
            [userId]
        );

        const allowedStudyIds = studyRows.map(row => row.studyId);
        const targetStudyId = parseInt(selectedStudyId, 10);

        if (!allowedStudyIds.includes(targetStudyId)) {
            return res.status(403).json({ message: 'Sem permissão.' });
        }

        const progress = await getStudyProgress(userId, targetStudyId);

        return res.status(200).json({ progress });
    } catch (err) {
        logger.error(`[POSTS - PROGRESS] Erro ao calcular progresso. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao calcular progresso.', error: err });
    }
});

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     tags: [Posts]
 *     summary: Detalhes de um post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post encontrado.
 *       404:
 *         description: Post não encontrado.
 *       500:
 *         description: Erro ao procurar post.
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;

    logger.info(`[POSTS - GET BY ID] Pedido de detalhes para o post ID: ${id}`);

    db.query('SELECT * FROM post WHERE id = ?', [id], (err, results) => {
        if (err) {
            logger.error(`[POSTS - GET BY ID] Erro na BD ao procurar post ID: ${id}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao procurar post.', error: err });
        }

        if (results.length === 0) {
            logger.warn(`[POSTS - GET BY ID] Post ID: ${id} não encontrado.`);
            return res.status(404).json({ message: 'Post não encontrado.' });
        }

        res.json(results[0]);
    });
});

/**
 * @openapi
 * /posts:
 *   post:
 *     tags: [Posts]
 *     summary: Importar posts a partir de JSON (Twitter)
 *     description: Recebe um array de posts com campos do Twitter/X e guarda em `post` e `image`. As imagens são buscadas por URL e guardadas em binário.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [posts, studyId]
 *             properties:
 *               studyId:
 *                 type: integer
 *                 example: 12
 *               posts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           example: "https://twitter.com/somepage"
 *                     url:
 *                       type: string
 *                       example: "https://twitter.com/.../status/..."
 *                     username:
 *                       type: string
 *                       example: "SomePage"
 *                     id:
 *                       type: string
 *                       example: "1888888888888888888"
 *                     text:
 *                       type: string
 *                     likes:
 *                       type: integer
 *                     replies:
 *                       type: integer
 *                     retweets:
 *                       type: integer
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                         example: "https://pbs.twimg.com/media/....jpg"
 *     responses:
 *       201:
 *         description: Importação concluída com sucesso.
 *       400:
 *         description: Formato inválido.
 *       500:
 *         description: Erro ao importar.
 */
router.post('/', async (req, res) => {
    const { posts, studyId } = req.body;
    const userId = req.user?.id;

    logger.info(`[POSTS - IMPORT] Início da importação de publicações para o Estudo ID: ${studyId}. Solicitado por UserID: ${userId}`);

    if (!Array.isArray(posts) || !studyId) {
        logger.warn(`[POSTS - IMPORT] Falha: Formato inválido ou studyId em falta. UserID: ${userId}`);
        return res.status(400).json({ message: 'Formato de dados inválido ou studyId em falta.' });
    }

    let sucessCount = 0;
    let errorCount = 0;

    for (const post of posts) {
        const { user, url, username, id, text, likes, replies, retweets, images = [] } = post;

        const postLink = url;
        const pageLink = user?.url || null;
        const pageName = username;

        const insertPostQuery = `
            INSERT INTO post (pageName, pageLink, postLink, postId, details,
                              likesCount, commentsCount, sharesCount,
                              isRetweet, socialName, studyId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        try {
            const [insertResult] = await db.promise().query(insertPostQuery, [
                pageName,
                pageLink,
                postLink,
                id,
                text,
                likes,
                replies,
                retweets,
                0,
                'Twitter',
                studyId
            ]);

            const postId = insertResult.insertId;
            sucessCount++;

            for (let i = 0; i < images.length; i++) {
                try {
                    const imageRes = await axios.get(images[i], { responseType: 'arraybuffer' });
                    const imageData = Buffer.from(imageRes.data, 'binary');
                    const isFrontPage = i === 0 ? 1 : 0;

                    await db.promise().query(`
                        INSERT INTO image (image_data, isFrontPage, postId)
                        VALUES (?, ?, ?)
                    `, [imageData, isFrontPage, postId]);
                } catch (imgErr) {
                    logger.warn(`[POSTS - IMPORT] Erro ao importar imagem da URL: ${images[i]} para o Post ID local: ${postId}. MSG: ${imgErr.message}`);
                }
            }
        } catch (err) {
            errorCount++;
            logger.error(`[POSTS - IMPORT] Erro ao inserir post do Twitter (Original ID: ${id}) no Estudo ID: ${studyId}. MSG: ${err.message}`, { stack: err.stack });
        }
    }

    logger.info(`[POSTS - IMPORT] Importação concluída. Estudo ID: ${studyId}. Sucesso: ${sucessCount} | Falhas: ${errorCount}`);

    if (errorCount > 0 && sucessCount === 0) {
        return res.status(500).json({ message: 'Erro ao importar todas as publicações.' });
    }

    res.status(201).json({ message: `Importação concluída. ${sucessCount} publicações inseridas.` });
});

/**
 * @openapi
 * /posts:
 *   get:
 *     tags: [Posts]
 *     summary: Listar publicações do estudo selecionado para o utilizador autenticado
 *     description: |
 *       Retorna publicações do estudo selecionado associadas ao utilizador autenticado.
 *
 *       Suporta dois modos:
 *       - includeClassified=false: devolve apenas publicações ainda não classificadas pelo utilizador e que ainda não atingiram o número mínimo de classificações do estudo
 *       - includeClassified=true: devolve publicações já classificadas pelo utilizador nesse estudo
 *
 *       A resposta inclui também o objeto `progress`, com informação sobre o estado global do estudo.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studyId
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID do estudo a consultar. Se não for enviado, é usado o primeiro estudo associado ao utilizador.
 *       - in: query
 *         name: includeClassified
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Define se devem ser devolvidas publicações já classificadas pelo utilizador.
 *     responses:
 *       200:
 *         description: Publicações obtidas com sucesso.
 *       401:
 *         description: Token inválido ou não autenticado.
 *       403:
 *         description: O utilizador não tem permissão para aceder ao estudo indicado.
 *       500:
 *         description: Erro interno ao receber posts.
 */
router.get('/', async (req, res) => {
    const userId = req.user?.id;
    const selectedStudyId = req.query.studyId;
    const showHistory = req.query.includeClassified === 'true';

    logger.info(`[POSTS - FEED] Pedido recebido. UserID: ${userId} | Estudo ID alvo: ${selectedStudyId || 'Nenhum'} | Modo Histórico: ${showHistory}`);

    if (!userId) {
        logger.warn(`[POSTS - FEED] Falha: Token inválido ou em falta.`);
        return res.status(401).json({ message: 'Token inválido.' });
    }

    try {
        const [studyRows] = await db.promise().query(
            'SELECT studyId FROM user_study WHERE userId = ?',
            [userId]
        );
        const allowedStudyIds = studyRows.map(row => row.studyId);

        if (allowedStudyIds.length === 0) {
            logger.info(`[POSTS - FEED] Utilizador (ID: ${userId}) sem estudos associados.`);
            return res.json({ posts: [], progress: null });
        }

        let targetStudyId = allowedStudyIds[0];

        if (selectedStudyId && selectedStudyId !== 'undefined' && selectedStudyId !== '') {
            const idToCheck = parseInt(selectedStudyId, 10);

            if (allowedStudyIds.includes(idToCheck)) {
                targetStudyId = idToCheck;
            } else {
                logger.warn(`[POSTS - FEED] Tentativa de acesso a estudo não permitido (Estudo: ${idToCheck}, UserID: ${userId})`);
                return res.status(403).json({ message: 'Sem permissão.' });
            }
        }

        const progress = await getStudyProgress(userId, targetStudyId);
        let posts = [];

        if (showHistory) {
            const historyQuery = `
                SELECT DISTINCT p.*, s.name AS studyName, MAX(c.createdAt) AS createdAtMax
                FROM post p
                JOIN study s ON p.studyId = s.id
                JOIN classification c ON c.postId = p.id
                WHERE p.studyId = ?
                  AND c.userId = ?
                GROUP BY p.id
                ORDER BY createdAtMax DESC
            `;

            [posts] = await db.promise().query(historyQuery, [targetStudyId, userId]);

            if (posts.length === 0) {
                logger.info(`[POSTS - FEED] Modo Histórico: Sem publicações para apresentar (UserID: ${userId})`);
                return res.json({
                    posts: [],
                    progress,
                    message: 'Ainda não classificaste nenhum post neste estudo.'
                });
            }
        } else {
            const checkLimitQuery = `
                SELECT s.maxClassificationsPerUser,
                       (
                           SELECT COUNT(DISTINCT c.postId)
                           FROM classification c
                           JOIN question q ON c.questionId = q.id
                           WHERE q.studyId = s.id
                             AND c.userId = ?
                       ) AS total_posts_done
                FROM study s
                WHERE s.id = ?
            `;

            const [limitResult] = await db.promise().query(checkLimitQuery, [userId, targetStudyId]);

            let limitToFetch = 10;

            if (limitResult.length > 0) {
                const maxClassificationsPerUser = limitResult[0].maxClassificationsPerUser !== null
                    ? Number(limitResult[0].maxClassificationsPerUser)
                    : null;

                const totalPostsDone = Number(limitResult[0].total_posts_done || 0);

                if (maxClassificationsPerUser !== null) {
                    const remaining = Math.max(0, maxClassificationsPerUser - totalPostsDone);

                    if (remaining <= 0) {
                        logger.info(`[POSTS - FEED] Limite atingido para o UserID: ${userId} no Estudo ID: ${targetStudyId}`);
                        return res.json({
                            posts: [],
                            progress,
                            message: 'Parabéns! Já atingiste o limite de classificações para este estudo.'
                        });
                    }

                    limitToFetch = Math.min(10, remaining);
                }
            }

            const getNextPostQuery = `
                SELECT p.*, s.name AS studyName, s.minClassificationsPerPost
                FROM post p
                JOIN study s ON p.studyId = s.id
                WHERE p.studyId = ?
                  AND NOT EXISTS (
                      SELECT 1
                      FROM classification c_user
                      WHERE c_user.postId = p.id
                        AND c_user.userId = ?
                  )
                  AND (
                      SELECT COUNT(DISTINCT c_total.userId)
                      FROM classification c_total
                      WHERE c_total.postId = p.id
                  ) < s.minClassificationsPerPost
                ORDER BY RAND()
                LIMIT ?
            `;

            [posts] = await db.promise().query(getNextPostQuery, [targetStudyId, userId, limitToFetch]);

            if (posts.length === 0) {
                logger.info(`[POSTS - FEED] Nenhum post novo disponível para classificação (UserID: ${userId})`);
                return res.json({
                    posts: [],
                    progress,
                    message: 'Não existem mais posts disponíveis neste momento.'
                });
            }
        }

        const postIds = posts.map(p => p.id);

        const [images] = await db.promise().query(
            `SELECT postId, image_data, isFrontPage FROM image WHERE postId IN (?)`,
            [postIds]
        );

        const imagesByPost = {};
        images.forEach(img => {
            if (!imagesByPost[img.postId]) imagesByPost[img.postId] = [];
            imagesByPost[img.postId].push({
                image_data: img.image_data ? img.image_data.toString('base64') : null,
                isFrontPage: img.isFrontPage
            });
        });

        const [questions] = await db.promise().query(
            `SELECT * FROM question WHERE studyId = ?`,
            [targetStudyId]
        );

        const questionIds = questions.map(q => q.id);
        let categoriesByQuestion = {};

        if (questionIds.length > 0) {
            const [categories] = await db.promise().query(
                `SELECT * FROM categories WHERE questionId IN (?)`,
                [questionIds]
            );

            categories.forEach(cat => {
                if (!categoriesByQuestion[cat.questionId]) categoriesByQuestion[cat.questionId] = [];
                categoriesByQuestion[cat.questionId].push(cat);
            });
        }

        const postsWithData = posts.map(post => {
            const postQuestions = questions.map(q => ({
                ...q,
                categories: categoriesByQuestion[q.id] || []
            }));

            return {
                id: post.id,
                pageName: post.pageName,
                pageLink: post.pageLink,
                postLink: post.postLink,
                details: post.details,
                likesCount: post.likesCount,
                commentsCount: post.commentsCount,
                sharesCount: post.sharesCount,
                studyId: post.studyId,
                studyName: post.studyName,
                socialName: post.socialName,
                images: imagesByPost[post.id] || [],
                questions: postQuestions
            };
        });

        logger.info(`[POSTS - FEED] Sucesso: Dados compilados e enviados ao UserID: ${userId} (${posts.length} posts carregados)`);

        return res.status(200).json({
            posts: postsWithData,
            progress
        });

    } catch (err) {
        logger.error(`[POSTS - FEED] Erro crítico na rota principal de publicações. MSG: ${err.message}`, { stack: err.stack });
        return res.status(500).json({ message: 'Erro ao receber posts.', error: err });
    }
});

module.exports = router;