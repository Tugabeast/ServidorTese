const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');


// 🔹 LISTAR POSTS DOS ESTUDOS DO UTILIZADOR
router.get('/', (req, res) => {
    const userId = req.user?.id;

    console.log('➡️ Requisição para /posts recebida');
    console.log('🔐 Utilizador autenticado:', req.user);

    if (!userId) {
        console.error('❌ req.user.id está undefined');
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

    console.log('📥 Executando query de posts...');
    db.query(query, [req.user.username], (err, postsResults) => {
        if (err) {
            console.error('❌ Erro ao buscar posts:', err);
            return res.status(500).json({ message: 'Erro ao buscar posts.', error: err });
        }

        console.log('✅ Posts encontrados:', postsResults.length);

        const postIds = postsResults.map(post => post.id);
        if (postIds.length === 0) {
            console.log('⚠️ Nenhum post encontrado para os estudos do utilizador.');
            return res.json({ posts: [] });
        }

        console.log('🔎 IDs dos posts encontrados:', postIds);

        db.query(imagesQuery, [postIds], (err, imagesResults) => {
            if (err) {
                console.error('❌ Erro ao buscar imagens:', err);
                return res.status(500).json({ message: 'Erro ao buscar imagens.', error: err });
            }

            console.log('🖼️ Imagens retornadas do banco:', imagesResults.length);

            const imagesByPostId = {};
            imagesResults.forEach(img => {
                if (!img.image_data) {
                    console.warn(`⚠️ Imagem nula ignorada para o postId: ${img.postId}`);
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

            console.log('📤 Enviando posts ao frontend...');
            res.json({ posts });
        });
    });
});


// 🔹 DETALHE DE UM POST
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM post WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('❌ Erro ao buscar post por ID:', err);
            return res.status(500).json({ message: 'Erro ao buscar post.', error: err });
        }
        res.json(results[0]);
    });
});

// 🔹 IMPORTAR JSON DE POSTS VIA FRONTEND
router.post('/import', async (req, res) => {
    const { posts, studyId } = req.body;

    if (!Array.isArray(posts) || !studyId) {
        return res.status(400).json({ message: 'Formato de dados inválido ou studyId em falta.' });
    }

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
                    console.warn(`⚠️ Erro ao importar imagem ${images[i]}:`, imgErr);
                }
            }
        } catch (err) {
            console.error('❌ Erro ao importar post:', err);
        }
    }

    res.status(201).json({ message: 'Importação concluída com sucesso.' });
});

module.exports = router;
