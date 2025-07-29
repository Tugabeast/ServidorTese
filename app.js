const express = require('express');
const cors = require('cors');

const authMiddleware = require('./middlewares/authMiddleware');

const authRoutes = require('./modules/auth');
const usersRoutes = require('./modules/users');
const profileRoutes = require('./modules/profile');
const categoriesRoutes = require('./modules/categories');
const studiesRoutes = require('./modules/studies');
const postsRoutes = require('./modules/posts');
const classificationsRoutes = require('./modules/classifications');
const statsRoutes = require('./modules/stats');
const questionRoutes = require ('./modules/questions')

const app = express();

app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 🔓 Rotas públicas
app.use('/auth', authRoutes);

// 🔒 Rotas privadas protegidas
app.use('/users', authMiddleware, usersRoutes);
app.use('/profile', authMiddleware, profileRoutes);
app.use('/categories', authMiddleware, categoriesRoutes);
app.use('/studies', authMiddleware, studiesRoutes);
app.use('/posts', authMiddleware, postsRoutes);
app.use('/classifications', authMiddleware, classificationsRoutes);
app.use('/stats', authMiddleware, statsRoutes);
app.use('/questions', authMiddleware, questionRoutes);

module.exports = app;
