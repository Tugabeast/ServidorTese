const mysql = require('mysql');

// Configuração da conexão com a base de dados
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_estudos_estga_1mes',
  port: 3307,
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
