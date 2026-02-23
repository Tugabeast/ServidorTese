const jwt = require('jsonwebtoken');
require('dotenv').config();
const { logger } = require('../utils/logger');

module.exports = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        logger.warn(`[AUTH MIDDLEWARE] Acesso negado: Nenhum token fornecido na rota -> ${req.originalUrl}`);
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.APP_SECRET);
        req.user = decoded;
        
        logger.debug(`[AUTH MIDDLEWARE] Token válido (UserID: ${decoded.id}) | Rota -> ${req.originalUrl}`);
        
        next();
    } catch (err) {
        logger.warn(`[AUTH MIDDLEWARE] Token inválido ou expirado na rota -> ${req.originalUrl} | Motivo: ${err.message}`);
        return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
};