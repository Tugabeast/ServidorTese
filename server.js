const app = require('./app');
const { logger } = require('./utils/logger'); // Importa o teu logger
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Servidor esta a rodar na porta ${PORT}`);
  logger.info(`🚀 Servidor a rodar com sucesso na porta ${PORT}`);
});
