const express = require('express');
const router = express.Router();
const db = require('../config/db');

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
            return res.status(200).json({ message: 'Post já classificado anteriormente. A avançar para o próximo.' });
        }

        res.status(201).json({ message: 'Classificação registrada com sucesso.' });
    });
});


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

        res.json(classifiedPosts);
    });
});





module.exports = router;
