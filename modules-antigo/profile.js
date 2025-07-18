const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

// Rota para alterar a password
router.post('/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  // Verifique se o user existe
  const query = 'SELECT * FROM users WHERE username = ?';
  db.query(query, [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ message: 'User não encontrado' });
    }

    const user = results[0];
    const passwordMatches = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatches) {
      return res.status(400).json({ message: 'Password atual incorreta' });
    }

    // Encripta a nova password e atualiza
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = 'UPDATE users SET password = ? WHERE username = ?';

    db.query(updateQuery, [hashedPassword, username], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Erro ao atualizar a password' });
      }

      return res.status(200).json({ message: 'Password alterada com sucesso' });
    });
  });
});

module.exports = router;
