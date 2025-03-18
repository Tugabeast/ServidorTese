const express = require('express');
const router = express.Router();
const db = require('../config/db');


router.get('/', (req, res) => {
  const userName = req.user.username;
  if (!userName) {
    return res.status(400).json({ message: 'Nome do utilizador não encontrado' });
  }

  const limit = parseInt(req.query.limit, 10) || 10;  // Definir limite de posts por página
  const page = parseInt(req.query.page, 10) || 1;
  const offset = (page - 1) * limit;

  // Consulta principal para obter os posts, SEM filtrar por imagens
  const query = `
    SELECT p.id, p.pageName, IFNULL(p.details, '') AS details, p.likesCount, 
           p.commentsCount, p.sharesCount, p.studyId
    FROM posts p
    WHERE p.studyId IN (
        SELECT study_id FROM userstudies WHERE user_name = ?
    )
    ORDER BY p.id ASC
    LIMIT ? OFFSET ?;
  `;

  // Nova consulta para pegar imagens associadas (se existirem) num segundo passo
  const imagesQuery = `
    SELECT pi.post_id, pi.image_data, pi.isFrontPage
    FROM posts_image pi
    WHERE pi.post_id IN (?);
  `;

  // Consulta para contar o total de posts (sem limitar)
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM posts p
    WHERE p.studyId IN (
        SELECT study_id FROM userstudies WHERE user_name = ?
    );
  `;

  // Primeiro, obter o total de posts
  db.query(countQuery, [userName], (err, countResult) => {
    if (err) {
      console.error("Erro ao contar os posts:", err);
      return res.status(500).json({ message: 'Erro ao contar os posts', error: err });
    }

    const totalPosts = countResult[0].total;

    // Buscar os posts limitados com base na página e limite
    db.query(query, [userName, limit, offset], (err, postsResults) => {
      if (err) {
        console.error("Erro ao buscar posts:", err);
        return res.status(500).json({ message: 'Erro ao buscar posts', error: err });
      }

      const postIds = postsResults.map(post => post.id);  // Coletar IDs dos posts

      if (postIds.length === 0) {
        return res.json({
          posts: [],
          currentPage: page,
          total: totalPosts
        });
      }

      // Agora buscar as imagens associadas
      db.query(imagesQuery, [postIds], (err, imagesResults) => {
        if (err) {
          console.error("Erro ao buscar imagens:", err);
          return res.status(500).json({ message: 'Erro ao buscar imagens', error: err });
        }

        // Criar um dicionário de imagens por post
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

        // Montar os posts com as imagens
        const posts = postsResults.map(post => ({
          id: post.id,
          pageName: post.pageName,
          details: post.details,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          studyId: post.studyId,
          images: imagesByPostId[post.id] || []  // Adicionar imagens ou array vazio
        }));

        console.log(`📦 Total de posts recebidos da base de dados: ${posts.length}`);

        res.json({
          posts: posts,
          currentPage: page,
          total: totalPosts
        });
      });
    });
  });
});



// 🔹 Rota para procurar um post específico pelo ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM posts WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(results[0]);
    }
  });
});

// Rota para atualizar a categoria de um post
router.put('/:id/category', (req, res) => {
  const { id } = req.params;
  const { categoryId } = req.body;
  const query = 'UPDATE posts SET categoryId = ? WHERE id = ?';
  db.query(query, [categoryId, id], (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json({ message: 'Categoria atualizada com sucesso' });
    }
  });
});

module.exports = router;
