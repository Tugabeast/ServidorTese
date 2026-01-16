const jwt = require('jsonwebtoken');
require('dotenv').config();
const { logger } = require('../aux/logger');


module.exports = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        console.log('❌ Nenhum token fornecido');
        logger.warn('No token received in request headers! Access denied.');
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.APP_SECRET);
        //console.log('🔹 Token válido:', decoded);
        req.user = decoded;  // Armazena os dados do user na requisição
        logger.info(`Valid token! User ID: ${decoded.id}`);
        next();
    } catch (err) {
        console.error('❌ Erro ao validar token:', err.message);
        logger.error(`Invalid token! Error: ${err.message}`);
        return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
};
