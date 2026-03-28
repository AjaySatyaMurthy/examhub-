CREATE DATABASE IF NOT EXISTS exam_management;
USE exam_management;

-- Users table (admin, faculty, student)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'faculty', 'student') NOT NULL DEFAULT 'student',
  phone VARCHAR(15),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL
);

-- Students (extends users)
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  roll_number VARCHAR(20) UNIQUE NOT NULL,
  department_id INT NOT NULL,
  semester INT NOT NULL,
  year_of_admission YEAR NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(15) UNIQUE NOT NULL,
  department_id INT NOT NULL,
  semester INT NOT NULL,
  credits INT DEFAULT 3,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Faculty assignment to subjects
CREATE TABLE IF NOT EXISTS faculty_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  subject_id INT NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  subject_id INT NOT NULL,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_marks INT NOT NULL DEFAULT 100,
  passing_marks INT NOT NULL DEFAULT 40,
  room VARCHAR(50),
  status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') DEFAULT 'scheduled',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Questions (MCQ)
CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(255) NOT NULL,
  option_b VARCHAR(255) NOT NULL,
  option_c VARCHAR(255) NOT NULL,
  option_d VARCHAR(255) NOT NULL,
  correct_option ENUM('A', 'B', 'C', 'D') NOT NULL,
  marks INT NOT NULL DEFAULT 1,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Exam attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  status ENUM('in_progress', 'submitted') DEFAULT 'in_progress',
  total_marks INT NOT NULL DEFAULT 0,
  obtained_marks DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE KEY unique_student_exam_attempt (student_id, exam_id)
);

-- Student answers
CREATE TABLE IF NOT EXISTS student_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option ENUM('A', 'B', 'C', 'D'),
  is_correct TINYINT DEFAULT 0,
  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_question (attempt_id, question_id)
);

-- Hall tickets
CREATE TABLE IF NOT EXISTS hall_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  ticket_number VARCHAR(30) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- Marks
CREATE TABLE IF NOT EXISTS marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  marks_obtained DECIMAL(5,2),
  status ENUM('present', 'absent') DEFAULT 'present',
  entered_by INT NOT NULL,
  entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (entered_by) REFERENCES users(id),
  UNIQUE KEY unique_student_exam (student_id, exam_id)
);

-- Results (auto-calculated)
CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  exam_id INT NOT NULL,
  marks_obtained DECIMAL(5,2),
  total_marks INT,
  percentage DECIMAL(5,2),
  grade VARCHAR(5),
  result_status ENUM('pass', 'fail', 'absent') NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE KEY unique_student_exam_result (student_id, exam_id)
);

-- Seed departments
INSERT INTO departments (name, code) VALUES
('Computer Science', 'CSE'),
('Electronics', 'ECE'),
('Mechanical', 'MECH'),
('Civil', 'CIVIL'),
('Information Technology', 'IT');

-- Seed admin user (password: admin123)
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@exam.com', '$2b$10$BZUzF8p8DjwLBecbrkDc/.I4/090Cb3l/HTsji1nPnz0wMN01JUmy', 'admin');
