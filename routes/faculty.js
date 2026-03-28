const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isFaculty } = require('../middleware/auth');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.use(isAuthenticated, isFaculty);

router.get('/', wrap(async (req, res) => {
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id
    ORDER BY e.exam_date DESC LIMIT 10
  `);
  res.render('faculty/dashboard', { exams });
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
    const [ex] = await db.query('SELECT e.*, sub.name as subject_name FROM exams e JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?', [examId]);
    selectedExam = ex[0] || null;
  }
  res.render('faculty/questions', { exams, questions, selectedExam, examId });
}));

router.post('/questions/add', wrap(async (req, res) => {
  const { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
  await db.query(
    'INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1]
  );
  res.redirect(`/faculty/questions?exam_id=${exam_id}`);
}));

router.post('/questions/edit/:id', wrap(async (req, res) => {
  const { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;
  await db.query(
    'UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ? WHERE id = ?',
    [question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1, req.params.id]
  );
  res.redirect(`/faculty/questions?exam_id=${exam_id}`);
}));

router.post('/questions/delete/:id', wrap(async (req, res) => {
  const { exam_id } = req.body;
  await db.query('DELETE FROM questions WHERE id = ?', [req.params.id]);
  res.redirect(`/faculty/questions?exam_id=${exam_id}`);
}));

// ==================== MARKS ====================
router.get('/marks', wrap(async (req, res) => {
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id
    WHERE e.status IN ('scheduled', 'completed')
    ORDER BY e.exam_date DESC
  `);
  res.render('faculty/marks', { exams, students: [], selectedExam: null });
}));

router.get('/marks/:examId', wrap(async (req, res) => {
  const examId = req.params.examId;
  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id
    WHERE e.status IN ('scheduled', 'completed')
    ORDER BY e.exam_date DESC
  `);

  const [selectedExam] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.department_id, sub.semester
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?
  `, [examId]);

  if (selectedExam.length === 0) return res.redirect('/faculty/marks');

  const [students] = await db.query(`
    SELECT s.id, s.roll_number, u.name,
    m.marks_obtained, m.status as mark_status
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN marks m ON m.student_id = s.id AND m.exam_id = ?
    WHERE s.department_id = ? AND s.semester = ?
    ORDER BY s.roll_number
  `, [examId, selectedExam[0].department_id, selectedExam[0].semester]);

  res.render('faculty/marks', { exams, students, selectedExam: selectedExam[0] });
}));

router.post('/marks/:examId', wrap(async (req, res) => {
  const examId = req.params.examId;
  let { student_ids, marks, statuses } = req.body;

  // Ensure arrays when single student
  if (!Array.isArray(student_ids)) student_ids = [student_ids];
  if (!Array.isArray(marks)) marks = [marks];
  if (!Array.isArray(statuses)) statuses = statuses ? [statuses] : student_ids.map(() => 'present');

  const [exam] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
  if (exam.length === 0) return res.redirect('/faculty/marks');

  for (let i = 0; i < student_ids.length; i++) {
    const studentId = student_ids[i];
    const marksObtained = statuses[i] === 'absent' ? null : parseFloat(marks[i]);
    const status = statuses[i];

    await db.query(`
      INSERT INTO marks (student_id, exam_id, marks_obtained, status, entered_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), status = VALUES(status), entered_by = VALUES(entered_by)
    `, [studentId, examId, marksObtained, status, req.session.user.id]);

    const percentage = marksObtained !== null ? (marksObtained / exam[0].total_marks) * 100 : 0;
    let grade = 'F';
    if (status === 'absent') {
      grade = 'AB';
    } else if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else if (percentage >= 40) grade = 'D';

    const resultStatus = status === 'absent' ? 'absent' : (marksObtained >= exam[0].passing_marks ? 'pass' : 'fail');

    await db.query(`
      INSERT INTO results (student_id, exam_id, marks_obtained, total_marks, percentage, grade, result_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), percentage = VALUES(percentage),
      grade = VALUES(grade), result_status = VALUES(result_status)
    `, [studentId, examId, marksObtained, exam[0].total_marks, percentage, grade, resultStatus]);
  }

  await db.query('UPDATE exams SET status = "completed" WHERE id = ?', [examId]);
  res.redirect(`/faculty/marks/${examId}`);
}));

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
  res.render('faculty/results', { results });
}));

module.exports = router;
