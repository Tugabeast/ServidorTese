const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @openapi
 * /classifications:
 *   post:
 *     tags: [Classifications]
 *     summary: Classificar post
 *     description: Regista classificações temáticas (múltiplas) e/ou de sentimento (geralmente única) para um **post** e **pergunta**. Entradas duplicadas são ignoradas (INSERT IGNORE).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, questionId]
 *             properties:
 *               postId:
 *                 type: integer
 *                 example: 101
 *               questionId:
 *                 type: integer
 *                 example: 7
 *               categoryIds:
 *                 type: array
 *                 description: IDs de categorias **temáticas** (pode ser múltiplo).
 *                 items:
 *                   type: integer
 *                 example: [2, 5, 9]
 *               sentimentoCategoryIds:
 *                 type: array
 *                 description: IDs de categorias de **sentimento** (normalmente apenas 1).
 *                 items:
 *                   type: integer
 *                 example: [3]
 *     responses:
 *       201:
 *         description: Classificação registrada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Classificação registrada com sucesso.
 *       200:
 *         description: Nada novo foi inserido (já estava classificado).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post já classificado anteriormente. A avançar para o próximo.
 *       400:
 *         description: Dados inválidos para classificação.
 *       500:
 *         description: Erro ao classificar o post.
 */

// CLASSIFICAR POST
router.post('/', (req, res) => {
    const { postId, questionId, categoryIds, sentimentoCategoryIds } = req.body;
    const userId = req.user.id;

    if (!postId || (!Array.isArray(categoryIds) && !Array.isArray(sentimentoCategoryIds))) {
        return res.status(400).json({ message: 'Dados inválidos para classificação.' });
    }

    // Agrupar todas as classificações (temáticas e sentimento)
    const thematicValues = (categoryIds || []).map(categoryId => [userId, postId, questionId, categoryId]);
    const sentimentValues = (sentimentoCategoryIds || []).map(categoryId => [userId, postId, questionId, categoryId]);
    const allValues = [...thematicValues, ...sentimentValues];

    if (allValues.length === 0) {
        return res.status(400).json({ message: 'Nenhuma categoria selecionada.' });
    }

    const insertQuery = `
        INSERT IGNORE INTO classification (userId, postId, questionId, categoryId)
        VALUES ?
    `;

    db.query(insertQuery, [allValues], (err, result) => {
        if (err) {
            console.error('Erro ao inserir classificações:', err);
            return res.status(500).json({ message: 'Erro ao classificar o post.', error: err });
        }

        if (result.affectedRows === 0) {
            // Nenhuma linha foi inserida, já estava tudo classificado
            return res.status(409).json({ message: 'Post já classificado anteriormente. A avançar para o próximo.' });
        }

        res.status(201).json({ message: 'Classificação registrada com sucesso.' });
    });
});

/**
 * @openapi
 * /classifications/user:
 *   get:
 *     tags: [Classifications]
 *     summary: Obter classificações do utilizador autenticado
 *     description: Retorna as classificações do utilizador ativo, agrupadas por **postId** → **questionId** → **categoryIds**. Para categorias de **sentimento**, é devolvido apenas um ID (substitui anteriores).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estrutura de classificações por post e pergunta.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 description: postId
 *                 additionalProperties:
 *                   type: array
 *                   description: questionId → array de categoryId (1 no caso de sentimento).
 *                   items:
 *                     type: integer
 *             examples:
 *               exemplo:
 *                 value:
 *                   "45":
 *                     "7": [2, 5]
 *                     "8": [3]        # sentimento
 *                   "46":
 *                     "7": [9]
 *       500:
 *         description: Erro ao buscar classificações.
 */

// CLASSIFICAÇÕES DO USER com sessão iniciada
router.get('/user', (req, res) => {
    const userId = req.user.id;
    console.log('🔐 Utilizador autenticado:', userId);

    const query = `
        SELECT cl.postId, cl.questionId, cl.categoryId, c.categoryType
        FROM classification cl
        JOIN categories c ON cl.categoryId = c.id
        WHERE cl.userId = ?
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('❌ Erro ao buscar classificações do user:', err);
            return res.status(500).json({ message: 'Erro ao buscar classificações.', error: err });
        }

        console.log('📥 Resultados da base de dados:', results);

        const classifiedPosts = {};
        results.forEach(({ postId, questionId, categoryId, categoryType }) => {
            if (!classifiedPosts[postId]) {
                classifiedPosts[postId] = {};
            }
            if (!classifiedPosts[postId][questionId]) {
                classifiedPosts[postId][questionId] = [];
            }

            if (categoryType === 'sentimento') {
                classifiedPosts[postId][questionId] = [categoryId];
            } else {
                classifiedPosts[postId][questionId].push(categoryId);
            }
        });

        console.log('✅ Estrutura final enviada para o frontend:', classifiedPosts);

        res.status(201).json(classifiedPosts);
    });
});





module.exports = router;
