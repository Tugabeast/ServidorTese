const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔹 Rota para procurar todas as categorias
router.get('/', (req, res) => {
  const query = 'SELECT id, name, categoryType, addedBy, updatedBy, createdAt, updatedAt FROM categories';
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ message: 'Erro ao procurar categorias', error: err });
    } else {
      res.json(results);
    }
  });
});

// 🔹 Rota para obter categorias temáticas associadas a um estudo específico
router.get('/study/:studyId', (req, res) => {
  const { studyId } = req.params;

  const query = `
    SELECT c.id, c.name
    FROM categories c
    JOIN studiescategories sc ON c.id = sc.categoryId
    WHERE sc.studyId = ? AND c.categoryType = 'tematicas';
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias temáticas:", err);
      return res.status(500).json({ message: 'Erro ao buscar categorias temáticas', error: err });
    }
    res.json(results);
  });
});

// 🔹 Rota para obter categorias de sentimento associadas a um estudo específico
router.get('/study/sentimentos/:studyId', (req, res) => {
  const { studyId } = req.params;

  const query = `
    SELECT c.id, c.name
    FROM categories c
    JOIN studiescategories sc ON c.id = sc.categoryId
    WHERE sc.studyId = ? AND c.categoryType = 'sentimento';
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias de sentimento:", err);
      return res.status(500).json({ message: 'Erro ao buscar categorias de sentimento', error: err });
    }
    res.json(results);
  });
});

// 🔹 Criar uma nova categoria
router.post('/', (req, res) => {
  const { name, categoryType, addedBy } = req.body;

  if (!name || !categoryType || !addedBy) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  const checkQuery = 'SELECT COUNT(*) AS count FROM categories WHERE name = ?';
  db.query(checkQuery, [name], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar duplicação' });

    if (result[0].count > 0) {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
    }

    const insertQuery = `
      INSERT INTO categories (name, categoryType, addedBy, createdAt, updatedAt)
      VALUES (?, ?, ?, NOW(), NOW())
    `;
    db.query(insertQuery, [name, categoryType, addedBy], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar categoria' });
      res.status(201).json({ message: 'Categoria criada com sucesso' });
    });
  });
});



// 🔹 Atualizar uma categoria
router.put('/:id', (req, res) => {
  const { name, categoryType, updatedBy } = req.body;
  const { id } = req.params;

  if (!name || !categoryType || !updatedBy) {
    return res.status(400).json({ 
      message: 'Todos os campos são obrigatórios (name, categoryType, updatedBy)' 
    });
  }

  const query = `
    UPDATE categories
    SET name = ?, categoryType = ?, updatedBy = ?, updatedAt = NOW()
    WHERE id = ?
  `;

  db.query(query, [name, categoryType, updatedBy, id], (err) => {
    if (err) {
      console.error('Erro ao atualizar categoria:', err);
      return res.status(500).json({ 
        message: 'Erro ao atualizar categoria', 
        error: err.message 
      });
    }
    res.json({ message: 'Categoria atualizada com sucesso' });
  });
});

// 🔹 Apagar uma categoria
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM categories WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Erro ao apagar categoria:', err);
      return res.status(500).json({
        message: 'Erro ao apagar categoria',
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria não encontrada' });
    }

    res.json({ message: 'Categoria apagada com sucesso' });
  });
});

// 🔹 Desassociar uma categoria de um estudo
router.delete('/:studyId/:categoryId', (req, res) => {
  const { studyId, categoryId } = req.params;

  const query = `
    DELETE FROM studiescategories
    WHERE studyId = ? AND categoryId = ?
  `;

  db.query(query, [studyId, categoryId], (err, result) => {
    if (err) {
      console.error('Erro ao desassociar categoria do estudo:', err);
      return res.status(500).json({ message: 'Erro ao desassociar categoria' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Associação não encontrada' });
    }

    res.json({ message: 'Categoria desassociada com sucesso' });
  });
});

// 🔹 Associar uma categoria a um estudo
router.post('/associate', (req, res) => {
  const { studyId, categoryId, addedBy } = req.body;

  if (!studyId || !categoryId || !addedBy) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  // Evita duplicação
  const checkQuery = `
    SELECT * FROM studiescategories
    WHERE studyId = ? AND categoryId = ?
  `;
  db.query(checkQuery, [studyId, categoryId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar duplicação' });

    if (results.length > 0) {
      return res.status(409).json({ error: 'Esta categoria já está associada a este estudo' });
    }

    const insertQuery = `
      INSERT INTO studiescategories (studyId, categoryId, addedBy, createdAt)
      VALUES (?, ?, ?, NOW())
    `;
    db.query(insertQuery, [studyId, categoryId, addedBy], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao associar categoria' });
      res.status(201).json({ message: 'Categoria associada com sucesso' });
    });
  });
});

// 🔹 Obter categorias ainda não associadas a um estudo
router.get('/available/:studyId', (req, res) => {
  const { studyId } = req.params;

  const query = `
    SELECT c.*
    FROM categories c
    WHERE c.id NOT IN (
      SELECT categoryId FROM studiescategories WHERE studyId = ?
    )
    ORDER BY c.categoryType, c.name
  `;

  db.query(query, [studyId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar categorias disponíveis:', err);
      return res.status(500).json({ error: 'Erro ao buscar categorias disponíveis' });
    }
    res.json(results);
  });
});




module.exports = router;
