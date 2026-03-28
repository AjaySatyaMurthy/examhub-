const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.use(isAuthenticated, isAdmin);

// Dashboard
router.get('/', wrap(async (req, res) => {
  try {
    const [[{ studentCount }]] = await db.query('SELECT COUNT(*) as studentCount FROM users WHERE role = "student"');
    const [[{ facultyCount }]] = await db.query('SELECT COUNT(*) as facultyCount FROM users WHERE role = "faculty"');
    const [[{ examCount }]] = await db.query('SELECT COUNT(*) as examCount FROM exams');
    const [[{ subjectCount }]] = await db.query('SELECT COUNT(*) as subjectCount FROM subjects');
    res.render('admin/dashboard', { stats: { studentCount, facultyCount, examCount, subjectCount } });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', { stats: { studentCount: 0, facultyCount: 0, examCount: 0, subjectCount: 0 } });
  }
}));

// ==================== FACULTY ====================
router.get('/faculty', wrap(async (req, res) => {
  const [faculty] = await db.query('SELECT * FROM users WHERE role = "faculty" ORDER BY name');
  res.render('admin/faculty', { faculty });
}));

router.post('/faculty/add', wrap(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "faculty", ?)',
    [name, email, hashedPassword, phone]);
  res.redirect('/admin/faculty');
}));

router.post('/faculty/edit/:id', wrap(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (password && password.trim().length > 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ? AND role = "faculty"',
      [name, email, phone, hashedPassword, req.params.id]);
  } else {
    await db.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ? AND role = "faculty"',
      [name, email, phone, req.params.id]);
  }
  res.redirect('/admin/faculty');
}));

router.post('/faculty/delete/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM users WHERE id = ? AND role = "faculty"', [req.params.id]);
  res.redirect('/admin/faculty');
}));

// ==================== STUDENTS ====================
router.get('/students', wrap(async (req, res) => {
  const [students] = await db.query(`
    SELECT s.*, u.name, u.email, u.phone, u.id as user_id, d.name as dept_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN departments d ON s.department_id = d.id
    ORDER BY s.roll_number
  `);
  const [departments] = await db.query('SELECT * FROM departments');
  res.render('admin/students', { students, departments });
}));

router.post('/students/add', wrap(async (req, res) => {
  const { name, email, password, phone, roll_number, department_id, semester, year_of_admission } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await db.query('INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "student", ?)',
    [name, email, hashedPassword, phone]);
  await db.query('INSERT INTO students (user_id, roll_number, department_id, semester, year_of_admission) VALUES (?, ?, ?, ?, ?)',
    [result.insertId, roll_number, department_id, semester, year_of_admission]);
  res.redirect('/admin/students');
}));

router.post('/students/edit/:id', wrap(async (req, res) => {
  const { name, email, phone, roll_number, department_id, semester, year_of_admission, password } = req.body;
  const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
  if (student.length === 0) return res.redirect('/admin/students');

  if (password && password.trim().length > 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ?',
      [name, email, phone, hashedPassword, student[0].user_id]);
  } else {
    await db.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, student[0].user_id]);
  }
  await db.query('UPDATE students SET roll_number = ?, department_id = ?, semester = ?, year_of_admission = ? WHERE id = ?',
    [roll_number, department_id, semester, year_of_admission, req.params.id]);
  res.redirect('/admin/students');
}));

router.post('/students/delete/:id', wrap(async (req, res) => {
  const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
  if (student.length > 0) {
    await db.query('DELETE FROM users WHERE id = ?', [student[0].user_id]);
  }
  res.redirect('/admin/students');
}));

// ==================== SUBJECTS ====================
router.get('/subjects', wrap(async (req, res) => {
  const [subjects] = await db.query(`
    SELECT s.*, d.name as dept_name FROM subjects s
    JOIN departments d ON s.department_id = d.id
    ORDER BY d.name, s.semester, s.name
  `);
  const [departments] = await db.query('SELECT * FROM departments');
  res.render('admin/subjects', { subjects, departments });
}));

router.post('/subjects/add', wrap(async (req, res) => {
  const { name, code, department_id, semester, credits } = req.body;
  await db.query('INSERT INTO subjects (name, code, department_id, semester, credits) VALUES (?, ?, ?, ?, ?)',
    [name, code, department_id, semester, credits]);
  res.redirect('/admin/subjects');
}));

router.post('/subjects/edit/:id', wrap(async (req, res) => {
  const { name, code, department_id, semester, credits } = req.body;
  await db.query('UPDATE subjects SET name = ?, code = ?, department_id = ?, semester = ?, credits = ? WHERE id = ?',
    [name, code, department_id, semester, credits, req.params.id]);
  res.redirect('/admin/subjects');
}));

router.post('/subjects/delete/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
  res.redirect('/admin/subjects');
}));

// ==================== EXAMS ====================
router.get('/exams', wrap(async (req, res) => {
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code
    FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id
    ORDER BY e.exam_date DESC
  `);
  const [subjects] = await db.query('SELECT * FROM subjects ORDER BY name');
  res.render('admin/exams', { exams, subjects });
}));

router.post('/exams/add', wrap(async (req, res) => {
  const { name, subject_id, exam_date, start_time, end_time, total_marks, passing_marks, room } = req.body;
  await db.query(
    'INSERT INTO exams (name, subject_id, exam_date, start_time, end_time, total_marks, passing_marks, room, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, subject_id, exam_date, start_time, end_time, total_marks, passing_marks, room, req.session.user.id]
  );
  res.redirect('/admin/exams');
}));

router.post('/exams/edit/:id', wrap(async (req, res) => {
  const { name, subject_id, exam_date, start_time, end_time, total_marks, passing_marks, room, status } = req.body;
  await db.query(
    'UPDATE exams SET name = ?, subject_id = ?, exam_date = ?, start_time = ?, end_time = ?, total_marks = ?, passing_marks = ?, room = ?, status = ? WHERE id = ?',
    [name, subject_id, exam_date, start_time, end_time, total_marks, passing_marks, room, status, req.params.id]
  );
  res.redirect('/admin/exams');
}));

router.post('/exams/delete/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
  res.redirect('/admin/exams');
}));

// ==================== HALL TICKETS ====================
router.get('/hall-tickets', wrap(async (req, res) => {
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code, sub.department_id, sub.semester
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id
    WHERE e.status = 'scheduled' ORDER BY e.exam_date
  `);
  const [tickets] = await db.query(`
    SELECT ht.*, u.name as student_name, s.roll_number, e.name as exam_name,
    sub.name as subject_name, sub.code as subject_code, e.exam_date, e.start_time, e.end_time, e.room
    FROM hall_tickets ht
    JOIN students s ON ht.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN exams e ON ht.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    ORDER BY e.exam_date, s.roll_number
  `);
  res.render('admin/hall-tickets', { exams, tickets });
}));

router.post('/hall-tickets/generate/:examId', wrap(async (req, res) => {
  const examId = req.params.examId;
  const [exam] = await db.query(`
    SELECT e.*, sub.department_id, sub.semester FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?
  `, [examId]);

  if (exam.length === 0) return res.redirect('/admin/hall-tickets');

  const [students] = await db.query(
    'SELECT * FROM students WHERE department_id = ? AND semester = ?',
    [exam[0].department_id, exam[0].semester]
  );

  for (const student of students) {
    const ticketNumber = `HT-${examId}-${student.id}-${Date.now().toString(36).toUpperCase()}`;
    const [existing] = await db.query(
      'SELECT id FROM hall_tickets WHERE student_id = ? AND exam_id = ?',
      [student.id, examId]
    );
    if (existing.length === 0) {
      await db.query(
        'INSERT INTO hall_tickets (student_id, exam_id, ticket_number) VALUES (?, ?, ?)',
        [student.id, examId, ticketNumber]
      );
    }
  }
  res.redirect('/admin/hall-tickets');
}));

// ==================== QUESTIONS ====================
router.get('/questions', wrap(async (req, res) => {
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id ORDER BY e.exam_date DESC
  `);
  const examId = req.query.exam_id || null;
  let questions = [];
  let selectedExam = null;
  if (examId) {
    [questions] = await db.query('SELECT * FROM questions WHERE exam_id = ? ORDER BY id', [examId]);
    const [ex] = await db.query(`SELECT e.*, sub.name as subject_name FROM exams e JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?`, [examId]);
    selectedExam = ex[0] || null;
  }
  res.render('admin/questions', { exams, questions, selectedExam, examId });
}));

router.post('/questions/add', wrap(async (req, res) => {
  const { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
  await db.query(
    'INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1]
  );
  res.redirect(`/admin/questions?exam_id=${exam_id}`);
}));

router.post('/questions/edit/:id', wrap(async (req, res) => {
  const { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
  await db.query(
    'UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ? WHERE id = ?',
    [question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1, req.params.id]
  );
  res.redirect(`/admin/questions?exam_id=${exam_id}`);
}));

router.post('/questions/delete/:id', wrap(async (req, res) => {
  const { exam_id } = req.body;
  await db.query('DELETE FROM questions WHERE id = ?', [req.params.id]);
  res.redirect(`/admin/questions?exam_id=${exam_id}`);
}));

// ==================== RESULTS & ANALYTICS ====================
router.get('/results', wrap(async (req, res) => {
  const [results] = await db.query(`
    SELECT r.*, u.name as student_name, s.roll_number, e.name as exam_name,
    sub.name as subject_name
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN exams e ON r.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    ORDER BY e.name, u.name
  `);
  res.render('admin/results', { results });
}));

router.get('/analytics', wrap(async (req, res) => {
  const [examStats] = await db.query(`
    SELECT e.name as exam_name, sub.name as subject_name,
    COUNT(r.id) as total_students,
    SUM(CASE WHEN r.result_status = 'pass' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN r.result_status = 'fail' THEN 1 ELSE 0 END) as failed,
    ROUND(AVG(r.percentage), 2) as avg_percentage,
    MAX(r.marks_obtained) as highest_marks,
    MIN(CASE WHEN r.result_status != 'absent' THEN r.marks_obtained END) as lowest_marks
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    GROUP BY e.id, e.name, sub.name
    ORDER BY e.name
  `);

  const [deptStats] = await db.query(`
    SELECT d.name as dept_name,
    COUNT(DISTINCT s.id) as total_students,
    ROUND(AVG(r.percentage), 2) as avg_percentage,
    SUM(CASE WHEN r.result_status = 'pass' THEN 1 ELSE 0 END) as passed
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN departments d ON s.department_id = d.id
    GROUP BY d.id, d.name
  `);

  res.render('admin/analytics', { examStats, deptStats });
}));

module.exports = router;
