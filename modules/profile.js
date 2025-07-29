const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

// ATUALIZAR PERFIL (USERNAME e/ou PASSWORD)
router.put('/update-profile', async (req, res) => {
    const { currentUsername, newUsername, currentPassword, newPassword } = req.body;

    if (!currentUsername || (!newUsername && !newPassword)) {
        return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
    }

    const query = 'SELECT * FROM user WHERE username = ?';
    db.query(query, [currentUsername], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }

        const user = results[0];

        // Verifica se novo username já existe
        if (newUsername) {
            const usernameCheckQuery = 'SELECT * FROM user WHERE username = ?';
            const [usernameCheck] = await db.promise().query(usernameCheckQuery, [newUsername]);
            if (usernameCheck.length > 0) {
                return res.status(409).json({ message: 'Username já existe.' });
            }
        }

        // Verifica password apenas se o user quiser alterar a password
        if (newPassword) {
            const passwordMatches = await bcrypt.compare(currentPassword, user.password);
            if (!passwordMatches) {
                return res.status(400).json({ message: 'Password atual incorreta.' });
            }
        }

        let queryUpdate = 'UPDATE user SET ';
        const params = [];
        if (newUsername) {
            queryUpdate += 'username = ?, ';
            params.push(newUsername);
        }
        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            queryUpdate += 'password = ?, ';
            params.push(hashedPassword);
        }
        queryUpdate += 'updatedAt = NOW(), updatedBy = ? WHERE username = ?';
        params.push(currentUsername); // updatedBy
        params.push(currentUsername); // WHERE username = ?

        db.query(queryUpdate, params, (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar perfil.', error: err });
            }
            res.status(200).json({ message: 'Perfil atualizado com sucesso.' });
        });

    });
});


module.exports = router;
