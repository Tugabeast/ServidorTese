const express = require('express');
const cors = require('cors');

const authMiddleware = require('./middlewares/authMiddleware');

const authRoutes = require('./modules/auth');
const usersRoutes = require('./modules/users');
const profileRoutes = require('./modules/profile');
const categoriesRoutes = require('./modules/categories');
const studiesRoutes = require('./modules/studies');
const studyCategoriesRoutes = require('./modules/studyCategories');
const postsRoutes = require('./modules/posts');
const classificationsRoutes = require('./modules/classifications');
const statsRoutes = require('./modules/stats');

const app = express();

app.use(cors());
app.use(express.json());

// 🔓 Rotas públicas
app.use('/auth', authRoutes);

// 🔒 Rotas privadas protegidas
app.use('/users', authMiddleware, usersRoutes);
app.use('/profile', authMiddleware, profileRoutes);
app.use('/categories', authMiddleware, categoriesRoutes);
app.use('/studies', authMiddleware, studiesRoutes);
app.use('/studies', authMiddleware, studyCategoriesRoutes);  
app.use('/posts', authMiddleware, postsRoutes);
app.use('/classifications', authMiddleware, classificationsRoutes);
app.use('/stats', authMiddleware, statsRoutes);

module.exports = app;
