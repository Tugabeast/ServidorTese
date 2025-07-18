const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 CLASSIFICAR POST
router.post('/', (req, res) => {
    const { postId, studyId, categoryIds, sentimentoCategoryIds } = req.body;
    const userId = req.user.username;

    if (!postId || !studyId || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({ message: 'Dados inválidos para classificação temática.' });
    }

    const thematicValues = categoryIds.map(categoryId => [postId, studyId, categoryId, userId]);
    const sentimentValue = (Array.isArray(sentimentoCategoryIds) && sentimentoCategoryIds.length > 0)
        ? [[postId, studyId, sentimentoCategoryIds[0], userId]] : [];

    const insertQuery = `
        INSERT INTO postsclassification (postId, studyId, post_classification, userId)
        VALUES ? ON DUPLICATE KEY UPDATE post_classification = VALUES(post_classification)
    `;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ message: 'Erro interno.', error: err });

        db.query(insertQuery, [thematicValues], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ message: 'Erro nas temáticas.', error: err }));

            if (sentimentValue.length > 0) {
                db.query(insertQuery, [sentimentValue], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ message: 'Erro no sentimento.', error: err }));
                    db.commit(err => {
                        if (err) return db.rollback(() => res.status(500).json({ message: 'Erro no commit.', error: err }));
                        res.status(201).json({ message: 'Classificação completa realizada.' });
                    });
                });
            } else {
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ message: 'Erro no commit.', error: err }));
                    res.status(201).json({ message: 'Classificação temática realizada.' });
                });
            }
        });
    });
});

// 🔹 CLASSIFICAÇÕES DO USER LOGADO
router.get('/user', (req, res) => {
    const username = req.user.username;

    const query = `
        SELECT pc.postId, pc.post_classification, c.categoryType
        FROM postsclassification pc
        JOIN categories c ON pc.post_classification = c.id
        WHERE pc.userId = ?
    `;

    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar classificações.', error: err });

        const classifiedPosts = {};
        results.forEach(({ postId, post_classification, categoryType }) => {
            if (!classifiedPosts[postId]) {
                classifiedPosts[postId] = { thematic: [], sentiment: [] };
            }
            if (categoryType === 'tematicas') {
                classifiedPosts[postId].thematic.push(post_classification);
            } else if (categoryType === 'sentimento') {
                classifiedPosts[postId].sentiment = [post_classification];
            }
        });

        res.json(classifiedPosts);
    });
});

module.exports = router;
