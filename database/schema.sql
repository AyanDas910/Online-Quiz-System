CREATE DATABASE IF NOT EXISTS online_quiz
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE online_quiz;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE quizzes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_quiz_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  points DECIMAL(7,2) NOT NULL DEFAULT 1.00,
  position INT UNSIGNED NOT NULL,
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_position (quiz_id, position),
  INDEX idx_question_quiz (quiz_id)
) ENGINE=InnoDB;

CREATE TABLE options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  option_text VARCHAR(1000) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  position TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_option_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_question_option_position (question_id, position),
  INDEX idx_option_question (question_id)
) ENGINE=InnoDB;

CREATE TABLE attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  quiz_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME(3) NOT NULL,
  deadline_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  status ENUM('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
  score DECIMAL(9,2) NULL,
  max_score DECIMAL(9,2) NOT NULL,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  INDEX idx_attempt_user_date (user_id, started_at),
  INDEX idx_attempt_quiz_status (quiz_id, status)
) ENGINE=InnoDB;

CREATE TABLE attempt_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NULL,
  is_correct BOOLEAN NOT NULL,
  awarded_points DECIMAL(7,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_answer_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_answer_question FOREIGN KEY (question_id) REFERENCES questions(id),
  CONSTRAINT fk_answer_option FOREIGN KEY (option_id) REFERENCES options(id),
  UNIQUE KEY uq_attempt_question (attempt_id, question_id)
) ENGINE=InnoDB;
