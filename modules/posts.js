const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 LISTAR POSTS (COM PAGINAÇÃO E IMAGENS)
router.get('/', (req, res) => {
    const userName = req.user.username;
    const limit = parseInt(req.query.limit, 10) || 10;
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const query = `
        SELECT p.id, p.pageName, IFNULL(p.details, '') AS details, p.likesCount, p.commentsCount, p.sharesCount, p.studyId
        FROM posts p
        WHERE p.studyId IN (
            SELECT study_id FROM userstudies WHERE user_name = ?
        )
        ORDER BY RAND()
        LIMIT ? OFFSET ?;
    `;

    const imagesQuery = `
        SELECT pi.post_id, pi.image_data, pi.isFrontPage
        FROM posts_image pi
        WHERE pi.post_id IN (?)
    `;

    const countQuery = `
        SELECT COUNT(*) AS total FROM posts p
        WHERE p.studyId IN (
            SELECT study_id FROM userstudies WHERE user_name = ?
        );
    `;

    db.query(countQuery, [userName], (err, countResult) => {
        if (err) return res.status(500).json({ message: 'Erro ao contar os posts.', error: err });

        const totalPosts = countResult[0].total;
        db.query(query, [userName, limit, offset], (err, postsResults) => {
            if (err) return res.status(500).json({ message: 'Erro ao buscar posts.', error: err });

            const postIds = postsResults.map(post => post.id);
            if (postIds.length === 0) {
                return res.json({ posts: [], currentPage: page, total: totalPosts });
            }

            db.query(imagesQuery, [postIds], (err, imagesResults) => {
                if (err) return res.status(500).json({ message: 'Erro ao buscar imagens.', error: err });

                const imagesByPostId = {};
                imagesResults.forEach(img => {
                    if (!imagesByPostId[img.post_id]) {
                        imagesByPostId[img.post_id] = [];
                    }
                    imagesByPostId[img.post_id].push({
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

                res.json({ posts, currentPage: page, total: totalPosts });
            });
        });
    });
});

router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM posts WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar post.', error: err });
        res.json(results[0]);
    });
});

module.exports = router;
