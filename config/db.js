const mysql = require('mysql2');
require('dotenv').config();

// Configuração da conexão com a base de dados
// Configuração da Pool de conexões
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10, // Quantas conexões podem estar abertas ao mesmo tempo
  queueLimit: 0
});

/*
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
});
*/
/*
// Conectar apenas uma vez ao inicializar
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar a base de dados:', err);
    process.exit(1); // Encerra o processo se não conseguir conectar
  }
  console.log('Conexão com a base de dados estabelecida');
});
*/

console.log('Pool de conexões configurada.');

module.exports = db;
