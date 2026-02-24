const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');

// IMPORTAR O LOGGER
const { logger } = require('../utils/logger');

/**
 * @openapi
 * /posts:
 *   get:
 *     tags: [Posts]
 *     summary: Listar posts dos estudos do utilizador autenticado
 *     description: Retorna posts (com imagens e perguntas+categorias) de todos os estudos associados ao utilizador pelo `user_study`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de posts com dados agregados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       pageName: { type: string }
 *                       details: { type: string }
 *                       likesCount: { type: integer }
 *                       commentsCount: { type: integer }
 *                       sharesCount: { type: integer }
 *                       studyId: { type: integer }
 *                       studyName: { type: string }
 *                       images:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             image_data: { type: string, description: "base64" }
 *                             isFrontPage: { type: integer }
 *                       questions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id: { type: integer }
 *                             question: { type: string }
 *                             content: { type: string }
 *                             inputType: { type: string }
 *                             categories:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id: { type: integer }
 *                                   name: { type: string }
 *                                   categoryType: { type: string }
 *       401:
 *         description: Token inválido ou não autenticado.
 *       500:
 *         description: Erro ao buscar posts.
 */

// LISTAR POSTS DOS ESTUDOS DO UTILIZADOR
/*
router.get('/', async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Token inválido ou utilizador não autenticado.' });
  }

  try {
    // Obter os estudos associados ao utilizador
    const [studyRows] = await db.promise().query(
      'SELECT studyId FROM user_study WHERE userId = ?', [userId]
    );
    const studyIds = studyRows.map(row => row.studyId);
    //console.log('📚 Estudos associados ao user:', studyIds);

    if (studyIds.length === 0) {
      console.log('⚠️ Nenhum estudo associado.');
      return res.json({ posts: [] });
    }

    // Obter os posts associados a esses estudos
    const [posts] = await db.promise().query(
      `SELECT p.*, s.name AS studyName FROM post p
       INNER JOIN study s ON s.id = p.studyId
       WHERE p.studyId IN (?)`, [studyIds]
    );
    //console.log('📝 Posts encontrados:', posts);

    if (posts.length === 0) {
      console.log('⚠️ Nenhum post associado aos estudos.');
      return res.json({ posts: [] });
    }

    const postIds = posts.map(p => p.id);

    // Obter imagens dos posts
    const [images] = await db.promise().query(
      `SELECT postId, image_data, isFrontPage FROM image WHERE postId IN (?)`, [postIds]
    );
    //console.log('🖼️ Imagens encontradas:', images);

    const imagesByPost = {};
    images.forEach(img => {
      if (!imagesByPost[img.postId]) imagesByPost[img.postId] = [];
      imagesByPost[img.postId].push({
        image_data: img.image_data?.toString('base64') || null,
        isFrontPage: img.isFrontPage
      });
    });

    // Obter perguntas por estudo
    const [questions] = await db.promise().query(
      `SELECT * FROM question WHERE studyId IN (?)`, [studyIds]
    );
    //console.log('❓ Perguntas encontradas:', questions);

    const questionIds = questions.map(q => q.id);

    // Obter categorias por pergunta
    let categoriesByQuestion = {};
    if (questionIds.length > 0) {
      const [categories] = await db.promise().query(
        `SELECT * FROM categories WHERE questionId IN (?)`, [questionIds]
      );
      //console.log('🏷️ Categorias encontradas:', categories);

      categories.forEach(cat => {
        if (!categoriesByQuestion[cat.questionId]) {
          categoriesByQuestion[cat.questionId] = [];
        }
        categoriesByQuestion[cat.questionId].push(cat);
      });
    }

    const questionsByStudy = {};
    questions.forEach(q => {
      if (!questionsByStudy[q.studyId]) questionsByStudy[q.studyId] = [];
      questionsByStudy[q.studyId].push({
        ...q,
        categories: categoriesByQuestion[q.id] || []
      });
    });

    const postsWithData = posts.map(post => {
      const postQuestions = questions
          .filter(q => q.studyId === post.studyId)
          .map(q => ({
          ...q,
          categories: categoriesByQuestion[q.id] || []
          }));

      return {
          id: post.id,
          pageName: post.pageName,
          details: post.details,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          studyId: post.studyId,
          studyName: post.studyName,
          images: imagesByPost[post.id] || [],
          questions: postQuestions,
      };
    });


    //console.log('📦 Dados finais enviados para o frontend:', postsWithData);

    res.status(200).json({ posts: postsWithData });
  } catch (err) {
    console.error('❌ Erro na rota /posts:', err);
    res.status(500).json({ message: 'Erro ao receber posts com dados.', error: err });
  }
});
*/


/**
 * @openapi
 * /posts/investigador:
 *   get:
 *     tags: [Posts]
 *     summary: Listar posts criados pelo investigador autenticado
 *     description: Retorna posts dos estudos cujo `addedBy` é o `username` do utilizador autenticado. Inclui imagens (base64).
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
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Post encontrado.
 *       500:
 *         description: Erro ao procurar post.
 */

// DETALHES DE UM POST
router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    logger.info(`[POSTS - GET BY ID] Pedido de detalhes para o post ID: ${id}`);

    db.query('SELECT * FROM post WHERE id = ?', [id], (err, results) => {
        if (err) {
            logger.error(`[POSTS - GET BY ID] Erro na BD ao procurar post ID: ${id}. MSG: ${err.message}`, { stack: err.stack });
            return res.status(500).json({ message: 'Erro ao procurar post.', error: err });
        }
        
        if(results.length === 0) {
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
 *     description: Recebe um array de posts com campos do Twitter/X e guarda em `post` e `image`. Imagens são buscadas por URL e guardadas em binário.
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
 *                         url: { type: string, example: "https://twitter.com/somepage" }
 *                     url: { type: string, example: "https://twitter.com/.../status/..." }
 *                     username: { type: string, example: "SomePage" }
 *                     id: { type: string, example: "1888888888888888888" }
 *                     text: { type: string }
 *                     likes: { type: integer }
 *                     replies: { type: integer }
 *                     retweets: { type: integer }
 *                     images:
 *                       type: array
 *                       items: { type: string, example: "https://pbs.twimg.com/media/....jpg" }
 *     responses:
 *       201:
 *         description: Importação concluída com sucesso.
 *       400:
 *         description: Formato inválido.
 *       500:
 *         description: Erro ao importar.
 */

// IMPORTAR JSON DE POSTS
router.post('/', async (req, res) => {
    const { posts, studyId } = req.body;
    const userId = req.user?.id; // Assumindo que tens middleware de autenticação aqui também

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
        const pageLink = user.url;
        const pageName = username;

        const insertPostQuery = `
            INSERT INTO post (pageName, pageLink, postLink, postId, details,
                              likesCount, commentsCount, sharesCount,
                              isRetweet, socialName, studyId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        try {
            const [insertResult] = await db.promise().query(insertPostQuery, [
                pageName, pageLink, postLink, id, text, likes, replies, retweets, 0, 'Twitter', studyId
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


// LISTAR POSTS (MODO "PRÓXIMO" OU MODO "HISTÓRICO")
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
        // A. Verificar permissões
        const [studyRows] = await db.promise().query(
            'SELECT studyId FROM user_study WHERE userId = ?', [userId]
        );
        const allowedStudyIds = studyRows.map(row => row.studyId);

        if (allowedStudyIds.length === 0) {
            logger.info(`[POSTS - FEED] Utilizador (ID: ${userId}) sem estudos associados.`);
            return res.json({ posts: [] });
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

        let posts = [];

        // --- LÓGICA DIVIDIDA CONFORME PEDIDO DOS PROFESSORES ---
        
        if (showHistory) {
            // === MODO HISTÓRICO ===
            logger.debug(`[POSTS - FEED] A executar query de histórico para o UserID: ${userId} (Estudo ID: ${targetStudyId})`);
            
            const historyQuery = `
                SELECT DISTINCT p.*, s.name AS studyName, max(c.createdAt) AS createdAtMax
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
                return res.json({ posts: [], message: 'Ainda não classificaste nenhum post neste estudo.' });
            }

        } else {
            // === MODO "PRÓXIMO POST" LOTE RANDOMIZADO ===
            logger.debug(`[POSTS - FEED] A validar limites para o UserID: ${userId} (Estudo ID: ${targetStudyId})`);
            
            const checkLimitQuery = `
                SELECT s.maxClassificationsPerUser,
                (SELECT COUNT(DISTINCT c.postId) FROM classification c 
                 JOIN question q ON c.questionId = q.id
                 WHERE q.studyId = s.id AND c.userId = ?) as total_posts_done
                FROM study s WHERE s.id = ?
            `;
            const [limitResult] = await db.promise().query(checkLimitQuery, [userId, targetStudyId]);

            let limitToFetch = 10;

            if (limitResult.length > 0) {
                const { maxClassificationsPerUser, total_posts_done } = limitResult[0];
                
                if (maxClassificationsPerUser !== null) {
                    const remaining = maxClassificationsPerUser - total_posts_done;
                    
                    if (remaining <= 0) {
                        logger.info(`[POSTS - FEED] Limite atingido para o UserID: ${userId} no Estudo ID: ${targetStudyId}`);
                        return res.json({ 
                            posts: [], 
                            message: 'Parabéns! Já atingiste o limite de classificações para este estudo.' 
                        });
                    }
                    
                    limitToFetch = Math.min(10, remaining); 
                }
            }

            logger.debug(`[POSTS - FEED] A buscar lote randomizado (Limite: ${limitToFetch}) para o UserID: ${userId}`);

            const getNextPostQuery = `
                SELECT p.*, s.name AS studyName, s.minClassificationsPerPost
                FROM post p
                JOIN study s ON p.studyId = s.id
                WHERE p.studyId = ?
                AND NOT EXISTS (
                    SELECT 1 FROM classification c_user 
                    WHERE c_user.postId = p.id AND c_user.userId = ?
                )
                AND (
                    SELECT COUNT(DISTINCT c_total.userId) 
                    FROM classification c_total WHERE c_total.postId = p.id
                ) < s.minClassificationsPerPost
                ORDER BY RAND() 
                LIMIT ?
            `;
            
            [posts] = await db.promise().query(getNextPostQuery, [targetStudyId, userId, limitToFetch]);

            if (posts.length === 0) {
                logger.info(`[POSTS - FEED] Nenhum post novo disponível para classificação (UserID: ${userId})`);
                return res.json({ posts: [], message: 'Não existem mais posts disponíveis neste momento.' });
            }
        }

        // --- CARREGAMENTO DE DADOS EXTRAS ---
        logger.debug(`[POSTS - FEED] A carregar imagens e perguntas associadas para ${posts.length} posts.`);
        
        const postIds = posts.map(p => p.id);

        const [images] = await db.promise().query(
            `SELECT postId, image_data, isFrontPage FROM image WHERE postId IN (?)`, [postIds]
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
            `SELECT * FROM question WHERE studyId = ?`, [targetStudyId]
        );
        const questionIds = questions.map(q => q.id);
        
        let categoriesByQuestion = {};
        if (questionIds.length > 0) {
            const [categories] = await db.promise().query(
                `SELECT * FROM categories WHERE questionId IN (?)`, [questionIds]
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
                details: post.details,
                likesCount: post.likesCount,
                commentsCount: post.commentsCount,
                sharesCount: post.sharesCount,
                studyId: post.studyId,
                studyName: post.studyName,
                socialName: post.socialName,
                postLink: post.postLink,
                images: imagesByPost[post.id] || [],
                questions: postQuestions
            };
        });

        logger.info(`[POSTS - FEED] Sucesso: Dados compilados e enviados ao UserID: ${userId} (${posts.length} posts carregados)`);
        res.status(200).json({ posts: postsWithData });

    } catch (err) {
        logger.error(`[POSTS - FEED] Erro crítico na rota principal de publicações. MSG: ${err.message}`, { stack: err.stack });
        res.status(500).json({ message: 'Erro ao receber posts.', error: err });
    }
});

module.exports = router;


