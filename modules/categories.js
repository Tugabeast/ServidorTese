const express = require('express');
const router = express.Router();
const db = require('../config/db');

function toSlug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase().trim()
    .replace(/\s+/g, '-')            // espaços -> hífen
    .replace(/[^a-z0-9_-]/g, '')     // só chars seguros
    .replace(/\d+/g, '')             // remove dígitos
    .replace(/-+/g, '-')             // colapsa '-'
    .replace(/^-+|-+$/g, '')         // trim '-'
    .slice(0, 30);                   // limite
}
const TYPE_RE = /^[a-z][a-z_-]{1,29}$/; // 2–30 chars, sem dígitos

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Listar todas as categorias
 *     description: Retorna todas as categorias associadas ao investigador (`addedBy`) correspondente ao `username`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome de utilizador do investigador.
 *     responses:
 *       200:
 *         description: Lista de categorias.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:           { type: integer }
 *                   name:         { type: string }
 *                   categoryType: { type: string, example: tematicas }
 *                   questionId:   { type: integer }
 *                   questionName: { type: string }
 *       400: { description: Nome de utilizador não fornecido. }
 *       500: { description: Erro ao procurar categorias. }
 */
// LISTAR TODAS AS CATEGORIAS
router.get('/', (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ message: 'Nome de utilizador não fornecido.' });
  }

  const query = `
    SELECT c.*, q.question AS questionName
    FROM categories c
    LEFT JOIN question q ON c.questionId = q.id
    LEFT JOIN study s    ON q.studyId    = s.id
    WHERE s.addedBy = ?
    ORDER BY c.categoryType, c.name
  `;

  db.query(query, [username], (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro ao procurar categorias.', error: err });
    res.status(200).json(results);
  });
});

/**
 * @openapi
 * /categories/types:
 *   get:
 *     tags: [Categories]
 *     summary: Listar tipos de categoria (sugestões)
 *     description: Devolve a lista distinta de `categoryType` já existentes. Quando `username` é fornecido, devolve apenas os tipos pertencentes ao investigador.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: false
 *         schema:
 *           type: string
 *         description: Nome de utilizador do investigador para filtrar as sugestões.
 *     responses:
 *       200:
 *         description: Lista de tipos (strings).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: string, example: tematicas }
 *       500: { description: Erro ao obter tipos. }
 */
// SUGESTÕES DE TIPOS
router.get('/types', (req, res) => {
  const { username } = req.query;

  let sql;
  let params = [];
  if (username) {
    sql = `
      SELECT DISTINCT c.categoryType
      FROM categories c
      JOIN question q ON q.id = c.questionId
      JOIN study   s ON s.id = q.studyId
      WHERE s.addedBy = ?
        AND c.categoryType IS NOT NULL
        AND c.categoryType <> ''
      ORDER BY c.categoryType
    `;
    params = [username];
  } else {
    sql = `
      SELECT DISTINCT categoryType
      FROM categories
      WHERE categoryType IS NOT NULL
        AND categoryType <> ''
      ORDER BY categoryType
    `;
  }

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao obter tipos.', error: err });
    res.json((rows || []).map(r => r.categoryType));
  });
});

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Criar nova categoria
 *     description: Cria uma nova categoria associada a uma pergunta (`questionId`).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryType, questionId]
 *             properties:
 *               name:         { type: string,  example: "Fake News" }
 *               categoryType: { type: string,  example: "temáticas" }
 *               questionId:   { type: integer, example: 5 }
 *     responses:
 *       201: { description: Categoria criada com sucesso. }
 *       400: { description: Campos obrigatórios em falta / Tipo inválido. }
 *       409: { description: Categoria já existe. }
 *       500: { description: Erro ao criar categoria. }
 */
// CRIAR NOVA CATEGORIA
router.post('/', (req, res) => {
  const { name, categoryType, questionId } = req.body;

  if (!name || !categoryType || !questionId) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  const normalizedType = toSlug(categoryType);
  if (!normalizedType || !TYPE_RE.test(normalizedType)) {
    return res.status(400).json({ message: 'Tipo de categoria inválido.' });
  }

  // 1) garantir que a pergunta existe e obter o studyId
  const qStudy = 'SELECT studyId FROM question WHERE id = ?';
  db.query(qStudy, [questionId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao verificar pergunta.', error: err });
    if (!rows.length) return res.status(400).json({ message: 'Pergunta inválida.' });

    const studyId = rows[0].studyId;

    // 2) duplicado por estudo (nome + studyId)
    const dup = `
      SELECT COUNT(*) AS cnt
      FROM categories c
      JOIN question q ON q.id = c.questionId
      WHERE c.name = ? AND q.studyId = ?
    `;
    db.query(dup, [name, studyId], (err2, r2) => {
      if (err2) return res.status(500).json({ message: 'Erro ao verificar duplicação.', error: err2 });
      if (r2[0].cnt > 0) {
        return res.status(409).json({ message: 'Já existe uma categoria com esse nome neste estudo.' });
      }

      // 3) inserir
      const ins = `
        INSERT INTO categories (name, categoryType, questionId, createdAt)
        VALUES (?, ?, ?, NOW())
      `;
      db.query(ins, [name, normalizedType, questionId], (err3) => {
        if (err3) return res.status(500).json({ message: 'Erro ao criar categoria.', error: err3 });
        res.status(201).json({ message: 'Categoria criada com sucesso.' });
      });
    });
  });
});

/**
 * @openapi
 * /categories/{categoryId}:
 *   put:
 *     tags: [Categories]
 *     summary: Atualizar categoria
 *     description: Atualiza os dados de uma categoria existente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryType, questionId]
 *             properties:
 *               name:         { type: string }
 *               categoryType: { type: string }
 *               questionId:   { type: integer }
 *     responses:
 *       200: { description: Categoria atualizada com sucesso. }
 *       400: { description: Campos obrigatórios em falta / Tipo inválido. }
 *       404: { description: Categoria não encontrada. }
 *       409: { description: Duplicado no estudo. }
 *       500: { description: Erro ao atualizar categoria. }
 */
// ATUALIZAR CATEGORIA
router.put('/:categoryId', (req, res) => {
  const { name, categoryType, questionId } = req.body;
  const { categoryId } = req.params;

  if (!name || !categoryType || !questionId) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  const normalizedType = toSlug(categoryType);
  if (!normalizedType || !TYPE_RE.test(normalizedType)) {
    return res.status(400).json({ message: 'Tipo de categoria inválido.' });
  }

  // 1) obter o studyId a partir da pergunta escolhida
  const qStudy = 'SELECT studyId FROM question WHERE id = ?';
  db.query(qStudy, [questionId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Erro ao verificar pergunta.', error: err });
    if (!rows.length) return res.status(400).json({ message: 'Pergunta inválida.' });

    const studyId = rows[0].studyId;

    // 2) duplicado por estudo, ignorando o próprio id
    const dup = `
      SELECT COUNT(*) AS cnt
      FROM categories c
      JOIN question q ON q.id = c.questionId
      WHERE c.name = ? AND q.studyId = ? AND c.id <> ?
    `;
    db.query(dup, [name, studyId, categoryId], (err2, r2) => {
      if (err2) return res.status(500).json({ message: 'Erro ao verificar duplicação.', error: err2 });
      if (r2[0].cnt > 0) {
        return res.status(409).json({ message: 'Já existe uma categoria com esse nome neste estudo.' });
      }

      // 3) atualizar
      const upd = `
        UPDATE categories
        SET name = ?, categoryType = ?, questionId = ?
        WHERE id = ?
      `;
      db.query(upd, [name, normalizedType, questionId, categoryId], (err3, r3) => {
        if (err3) return res.status(500).json({ message: 'Erro ao atualizar categoria.', error: err3 });
        if (r3.affectedRows === 0) return res.status(404).json({ message: 'Categoria não encontrada.' });
        res.status(200).json({ message: 'Categoria atualizada com sucesso.' });
      });
    });
  });
});

/**
 * @openapi
 * /categories/{categoryId}:
 *   delete:
 *     tags: [Categories]
 *     summary: Apagar categoria
 *     description: Elimina uma categoria pelo seu ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200: { description: Categoria apagada com sucesso. }
 *       404: { description: Categoria não encontrada. }
 *       500: { description: Erro ao apagar categoria. }
 */
// ELIMINAR CATEGORIA
router.delete('/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  db.query('DELETE FROM categories WHERE id = ?', [categoryId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Erro ao apagar categoria.', error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Categoria não encontrada.' });
    res.status(200).json({ message: 'Categoria apagada com sucesso.' });
  });
});

module.exports = router;
