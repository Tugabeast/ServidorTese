// docs/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Socialfy API',
      version: '1.0.0',
      description:
        'Documentação da API (OpenAPI 3) – autenticação via Bearer JWT.',
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Local' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // apontar para os teus ficheiros de rotas onde vais pôr as anotações JSDoc
  apis: ['./modules/**/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
