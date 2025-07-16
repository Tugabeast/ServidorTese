const express = require('express');
const cors = require('cors');

const authMiddleware = require('./middlewares/authMiddleware');
const postsRoutes = require('./modules/posts');
const categoriesRoutes = require('./modules/categories');
const classificationsRoutes = require('./modules/classifications');
const registerRoutes = require('./modules/register');
const loginRoutes = require('./modules/login');
const statsRoutes = require('./modules/stats');
const profileRoutes = require('./modules/profile'); 
const usersRoutes = require('./modules/users');
const studiesRoutes = require('./modules/studies');

const app = express();

app.use(cors());
app.use(express.json());




// 🔒 Proteger as rotas usando o middleware
app.use('/posts', authMiddleware, postsRoutes);
app.use('/categories', authMiddleware, categoriesRoutes);
app.use('/classifications', authMiddleware, classificationsRoutes);
app.use('/stats', authMiddleware, statsRoutes); 
app.use('/profile', authMiddleware, profileRoutes);
app.use('/users', usersRoutes);
app.use('/studies', studiesRoutes);

module.exports = app;
