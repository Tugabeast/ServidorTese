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

  if (!postId || !questionId) {
    return res.status(400).json({ message: 'postId e questionId são obrigatórios.' });
  }

  const thematic = Array.isArray(categoryIds) ? categoryIds : [];
  const sentiment = Array.isArray(sentimentoCategoryIds) ? sentimentoCategoryIds : [];
  const all = [...thematic, ...sentiment];

  if (all.length === 0) {
    return res.status(400).json({ message: 'Nenhuma categoria selecionada.' });
  }

  // 1. Obter uma conexão da pool
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Erro ao obter conexão da pool:', err);
      return res.status(500).json({ message: 'Erro de conexão à base de dados.' });
    }

    // 2. Iniciar a transação NA CONEXÃO
    connection.beginTransaction((err) => {
      if (err) {
        connection.release(); // Importante: libertar se falhar
        return res.status(500).json({ message: 'Erro ao iniciar transação.', error: err });
      }

      const delSql = `DELETE FROM classification WHERE userId = ? AND postId = ? AND questionId = ?`;
      
      // Nota: Usar 'connection.query' e não 'db.query'
      connection.query(delSql, [userId, postId, questionId], (delErr, delResult) => {
        if (delErr) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ message: 'Erro ao remover classificações anteriores.', error: delErr });
          });
        }

        const values = all.map(catId => [userId, postId, questionId, catId]);
        const insSql = `INSERT INTO classification (userId, postId, questionId, categoryId) VALUES ?`;

        connection.query(insSql, [values], (insErr) => {
          if (insErr) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Erro ao gravar novas classificações.', error: insErr });
            });
          }

          // 3. Confirmar a transação
          connection.commit((commitErr) => {
            if (commitErr) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ message: 'Erro ao concluir transação.', error: commitErr });
              });
            }

            // 4. Libertar a conexão no final
            connection.release();

            const status = delResult.affectedRows > 0 ? 200 : 201;
            const msg = delResult.affectedRows > 0
              ? 'Classificação atualizada com sucesso.'
              : 'Classificação registada com sucesso.';
            return res.status(status).json({ message: msg });
          });
        });
      });
    });
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

        res.status(200).json(classifiedPosts);
    });
});


module.exports = router;
