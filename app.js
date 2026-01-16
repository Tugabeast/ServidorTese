const express = require('express');
const cors = require('cors');

// Added to handle logging files
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
// End logging section



//const a = require('./config/insertDatasetDB');
//const b = require('./config/insertImageDB');
const authMiddleware = require('./middlewares/authMiddleware');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const authRoutes = require('./modules/auth');
const usersRoutes = require('./modules/users');
const profileRoutes = require('./modules/profile');
const categoriesRoutes = require('./modules/categories');
const studiesRoutes = require('./modules/studies');
const postsRoutes = require('./modules/posts');
const classificationsRoutes = require('./modules/classifications');
const statsRoutes = require('./modules/stats');
const questionRoutes = require('./modules/questions')

const app = express();

app.use(cors());


// For logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
// End logging section

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Swagger UI 
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
//  Rotas públicas
app.use('/auth', authRoutes);
//  Rotas privadas & protegidas
app.use('/users', authMiddleware, usersRoutes);
app.use('/profile', authMiddleware, profileRoutes);
app.use('/categories', authMiddleware, categoriesRoutes);
app.use('/studies', authMiddleware, studiesRoutes);
app.use('/posts', authMiddleware, postsRoutes);
app.use('/classifications', authMiddleware, classificationsRoutes);
app.use('/stats', authMiddleware, statsRoutes);
app.use('/questions', authMiddleware, questionRoutes);



app.get('/openapi.json', (req, res) => res.json(swaggerSpec));

module.exports = app;
