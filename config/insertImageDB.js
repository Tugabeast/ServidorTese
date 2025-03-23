const axios = require('axios');
const db = require('./db');  // Caminho para o arquivo de conexão ao banco de dados
//const dataset = require('../datasetsapify/partidos/dataset-cdspp.json');  // Caminho para o dataset JSON
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
    const { user, url, id, images } = post;

    const postLink = url;

    // 1. Primeiro, busca o ID do post na tabela 'posts' usando o postLink
    const selectPostQuery = 'SELECT id FROM posts WHERE postLink = ?';

    db.query(selectPostQuery, [postLink], (err, results) => {
        if (err) {
            console.error("Erro ao buscar post:", err);
        } else if (results.length > 0) {
            const postId = results[0].id;  // Obtém o ID do post

            // 2. Se houver imagens, faça o download e insira na tabela 'posts_image'
            if (images && Array.isArray(images)) {
                images.forEach(async (imageUrl, imageIndex) => {
                    try {
                        // Baixa a imagem
                        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                        const imageData = Buffer.from(response.data, 'binary');  // Converte para buffer

                        const isFrontPage = imageIndex === 0 ? 1 : 0;

                        // Insere a imagem na tabela 'posts_image'
                        const insertImageQuery = `
                          INSERT INTO posts_image (image_data, isFrontPage, post_id)
                          VALUES (?, ?, ?)
                        `;

                        db.query(insertImageQuery, [imageData, isFrontPage, postId], (err, result) => {
                            if (err) {
                                console.error("Erro ao inserir imagem:", err);
                            } else {
                                console.log(`Imagem inserida com sucesso para o post ${postId}`);
                            }
                        });
                    } catch (error) {
                        console.error("Erro ao baixar a imagem:", error);
                    }
                });
            } else {
                console.log(`Post ${postId} não contém imagens.`);
            }
        } else {
            console.log(`Post com o link ${postLink} não encontrado.`);
        }
    });
});
