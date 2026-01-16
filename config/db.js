const mysql = require('mysql2');
require('dotenv').config();

// Configuração da conexão com a base de dados
/*const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    connectionLimit: 10, // Number of connections to keep in the pool
  });*/


const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
});

// Conectar apenas uma vez ao inicializar
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar a base de dados:', err);
    process.exit(1); // Encerra o processo se não conseguir conectar
  }
  console.log('Conexão com a base de dados estabelecida');
});

module.exports = db;
