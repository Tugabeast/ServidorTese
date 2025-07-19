-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3307:3307
-- Tempo de geração: 19-Jul-2025 às 02:34
-- Versão do servidor: 10.4.32-MariaDB
-- versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `tese_final`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `categoryType` varchar(255) NOT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `questionId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `categories`
--

INSERT INTO `categories` (`id`, `name`, `categoryType`, `createdAt`, `questionId`) VALUES
(1, 'Sim', 'tematicas', '2025-07-07 15:09:29', 1),
(2, 'Não', 'tematicas', '2025-07-07 15:09:29', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `classification`
--

CREATE TABLE `classification` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `postId` int(11) NOT NULL,
  `questionId` int(11) NOT NULL,
  `categoryId` int(11) NOT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `image`
--

CREATE TABLE `image` (
  `id` int(11) NOT NULL,
  `image_data` longblob DEFAULT NULL,
  `isFrontPage` tinyint(1) DEFAULT 0,
  `postId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `image`
--

INSERT INTO `image` (`id`, `image_data`, `isFrontPage`, `postId`) VALUES
(1, NULL, 1, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `post`
--

CREATE TABLE `post` (
  `id` int(11) NOT NULL,
  `pageName` varchar(255) DEFAULT NULL,
  `pageLink` varchar(255) DEFAULT NULL,
  `postLink` varchar(255) DEFAULT NULL,
  `postId` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `likesCount` int(11) DEFAULT NULL,
  `commentsCount` int(11) DEFAULT NULL,
  `sharesCount` int(11) DEFAULT NULL,
  `isRetweet` tinyint(1) DEFAULT NULL,
  `socialName` varchar(255) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `studyId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `post`
--

INSERT INTO `post` (`id`, `pageName`, `pageLink`, `postLink`, `postId`, `details`, `likesCount`, `commentsCount`, `sharesCount`, `isRetweet`, `socialName`, `createdAt`, `studyId`) VALUES
(1, '@partidox', 'https://x.com/partidox', 'https://x.com/partidox/status/111', '111', 'Post de exemplo sobre política.', 120, 15, 10, 0, 'Twitter', '2025-05-30 18:54:15', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `question`
--

CREATE TABLE `question` (
  `id` int(11) NOT NULL,
  `question` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `inputType` varchar(255) NOT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `studyId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `question`
--

INSERT INTO `question` (`id`, `question`, `content`, `inputType`, `createdAt`, `studyId`) VALUES
(1, 'O post fala sobre política?', 'Classifica se o conteúdo está relacionado com política.', 'radio', '2025-07-07 15:09:29', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `study`
--

CREATE TABLE `study` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `obs` text DEFAULT NULL,
  `addedBy` varchar(255) DEFAULT NULL,
  `startedAt` datetime DEFAULT NULL,
  `finishedAt` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updatedBy` varchar(255) DEFAULT NULL,
  `minClassificationsPerPost` int(11) DEFAULT 3,
  `validationAgreementPercent` decimal(5,2) DEFAULT 66.66
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `study`
--

INSERT INTO `study` (`id`, `name`, `obs`, `addedBy`, `startedAt`, `finishedAt`, `createdAt`, `updatedAt`, `updatedBy`, `minClassificationsPerPost`, `validationAgreementPercent`) VALUES
(1, 'Estudo sobre discurso político 2025', 'Análise de publicações políticas.', 'investigador1', '2025-06-01 00:00:00', NULL, '2025-07-07 15:09:29', '2025-07-07 15:09:29', NULL, 3, 66.66);

-- --------------------------------------------------------

--
-- Estrutura da tabela `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT NULL,
  `createdBy` varchar(255) DEFAULT NULL,
  `updatedBy` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `user`
--

INSERT INTO `user` (`id`, `username`, `password`, `email`, `type`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`) VALUES
(1, 'ana_matos', 'senha123', 'ana@example.com', 'admin', '2025-07-07 15:09:29', NULL, NULL, NULL),
(2, 'investigador1', 'senha123', 'inv1@example.com', 'investigador', '2025-07-07 15:09:29', NULL, NULL, NULL),
(3, 'aluno1', 'senha123', 'aluno1@example.com', 'user', '2025-07-07 15:09:29', NULL, NULL, NULL),
(4, 'teste', '$2b$10$nPuCaZSt14mgu.vlE7153eZwQXbI4Nn3RqUg/LlAg/JddZEHpgMXW', 'teste@gmail.com', 'user', '2025-07-08 14:24:49', NULL, 'teste', NULL),
(5, 'teste1', '$2b$10$fn2rijFRjRG.WuTnZ5R/LuhpWrvtUscPpZFgPE/LNSmHNyitIHQz.', 'teste1@gmail.com', 'admin', '2025-07-16 14:44:47', '2025-07-18 19:25:47', 'teste1', 'teste12'),
(6, 'teste123456', '$2b$10$VVdvstTZ3rjb1LgUHA29cusUvuVhFKN0ICpyCO3RjNRbwsaUpr4ze', 'teste123456@gmail.com', 'user', '2025-07-16 15:03:48', '2025-07-18 19:16:57', 'teste123456', 'teste123456'),
(7, 'goncalo', '$2b$10$YNYqRrTQbnAY32b2oDnvWO5T/7Jqq3FRZ//giZEZ5ZV4Lp4gBc/Jy', 'goncalo.alves@live.com', 'investigator', '2025-07-16 16:09:32', '2025-07-18 19:22:33', 'goncalo', 'goncalo1');

-- --------------------------------------------------------

--
-- Estrutura da tabela `user_study`
--

CREATE TABLE `user_study` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `studyId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `user_study`
--

INSERT INTO `user_study` (`id`, `userId`, `studyId`) VALUES
(1, 1, 1),
(2, 2, 1),
(3, 3, 1);

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `questionId` (`questionId`);

--
-- Índices para tabela `classification`
--
ALTER TABLE `classification`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_classification` (`userId`,`postId`,`questionId`,`categoryId`),
  ADD KEY `postId` (`postId`),
  ADD KEY `questionId` (`questionId`),
  ADD KEY `categoryId` (`categoryId`);

--
-- Índices para tabela `image`
--
ALTER TABLE `image`
  ADD PRIMARY KEY (`id`),
  ADD KEY `postId` (`postId`);

--
-- Índices para tabela `post`
--
ALTER TABLE `post`
  ADD PRIMARY KEY (`id`),
  ADD KEY `studyId` (`studyId`);

--
-- Índices para tabela `question`
--
ALTER TABLE `question`
  ADD PRIMARY KEY (`id`),
  ADD KEY `studyId` (`studyId`);

--
-- Índices para tabela `study`
--
ALTER TABLE `study`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices para tabela `user_study`
--
ALTER TABLE `user_study`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_study` (`userId`,`studyId`),
  ADD KEY `studyId` (`studyId`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de tabela `classification`
--
ALTER TABLE `classification`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `image`
--
ALTER TABLE `image`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `post`
--
ALTER TABLE `post`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `question`
--
ALTER TABLE `question`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `study`
--
ALTER TABLE `study`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de tabela `user_study`
--
ALTER TABLE `user_study`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restrições para despejos de tabelas
--

--
-- Limitadores para a tabela `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`questionId`) REFERENCES `question` (`id`);

--
-- Limitadores para a tabela `classification`
--
ALTER TABLE `classification`
  ADD CONSTRAINT `classification_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `user` (`id`),
  ADD CONSTRAINT `classification_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `post` (`id`),
  ADD CONSTRAINT `classification_ibfk_3` FOREIGN KEY (`questionId`) REFERENCES `question` (`id`),
  ADD CONSTRAINT `classification_ibfk_4` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`);

--
-- Limitadores para a tabela `image`
--
ALTER TABLE `image`
  ADD CONSTRAINT `image_ibfk_1` FOREIGN KEY (`postId`) REFERENCES `post` (`id`);

--
-- Limitadores para a tabela `post`
--
ALTER TABLE `post`
  ADD CONSTRAINT `post_ibfk_1` FOREIGN KEY (`studyId`) REFERENCES `study` (`id`);

--
-- Limitadores para a tabela `question`
--
ALTER TABLE `question`
  ADD CONSTRAINT `question_ibfk_1` FOREIGN KEY (`studyId`) REFERENCES `study` (`id`);

--
-- Limitadores para a tabela `user_study`
--
ALTER TABLE `user_study`
  ADD CONSTRAINT `user_study_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `user` (`id`),
  ADD CONSTRAINT `user_study_ibfk_2` FOREIGN KEY (`studyId`) REFERENCES `study` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
