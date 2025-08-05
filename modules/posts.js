const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');


// LISTAR POSTS DOS ESTUDOS DO UTILIZADOR
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

    res.json({ posts: postsWithData });
  } catch (err) {
    console.error('❌ Erro na rota /posts:', err);
    res.status(500).json({ message: 'Erro ao buscar posts com dados.', error: err });
  }
});


router.get('/investigador', (req, res) => {
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


// DETALHES DE UM POST
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM post WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('❌ Erro ao buscar post por ID:', err);
            return res.status(500).json({ message: 'Erro ao procurar post.', error: err });
        }
        res.json(results[0]);
    });
});

// IMPORTAR JSON DE POSTS
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
