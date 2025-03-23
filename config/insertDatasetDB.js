const db = require('./db');  // Caminho do arquivo de conexão ao banco de dados
//const dataset = require('../datasetsapify/partidos/dataset-cdspp.json');  // Caminho do seu dataset JSON
//const dataset = require('../datasetsapify/partidos/dataset-ps.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_chega.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_LiberalPT.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_blocoesquerda.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_LIVREpt.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_Partido_PAN.json'); 
//const dataset = require('../datasetsapify/partidos/dataset_pcp_pt.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_LMontenegropm.json'); 
const dataset = require('../datasetsapify/politicos/dataset_NunoMeloMDN.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_PNSpedronuno.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_AndreCVentura.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_ruirochaliberal.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_MRMortagua.json'); 
//const dataset = require('../datasetsapify/politicos/dataset_ruitavares.json');
//const dataset = require('../datasetsapify/politicos/dataset_InesSousaReal.json');

dataset.forEach(post => {
  const {
    user,
    url,          // Este é o postLink
    username,
    id,
    text,
    likes,
    replies,
    retweets
  } = post;

  const postLink = url;  // postLink: o URL principal fora do objeto "user"
  const pageLink = user.url;  // pageLink: o URL dentro do objeto "user"

  // Substituímos `user.userFullName` por `user.username` para pegar o username como pageName
  const query = `
    INSERT INTO posts (pageName, pageLink, postLink, postId, details, likesCount, commentsCount, sharesCount, isRetweet, socialName, studyId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const isRetweet = post.isRetweet ? 1 : 0;
  const socialName = "Twitter";
  const studyId = 17;  // Defina o estudo conforme necessário

  // Usando `user.username` como `pageName`
  db.query(query, [username, pageLink, postLink, id, text, likes, replies, retweets, isRetweet, socialName, studyId], (err, result) => {
    if (err) {
      console.error("Erro ao inserir post:", err);
    } else {
      console.log("Post inserido com sucesso:", result.insertId);
    }
  });
});
