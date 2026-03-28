const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isStudent } = require('../middleware/auth');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.use(isAuthenticated, isStudent);

router.get('/', wrap(async (req, res) => {
  const [student] = await db.query(`
    SELECT s.*, d.name as dept_name FROM students s
    JOIN departments d ON s.department_id = d.id
    WHERE s.user_id = ?
  `, [req.session.user.id]);

  if (student.length === 0) {
    return res.render('student/dashboard', { student: null, upcomingExams: [], recentResults: [] });
  }

  const [upcomingExams] = await db.query(`
    SELECT e.*, sub.name as subject_name FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id
    WHERE sub.department_id = ? AND sub.semester = ? AND e.exam_date >= CURDATE()
    ORDER BY e.exam_date LIMIT 5
  `, [student[0].department_id, student[0].semester]);

  const [recentResults] = await db.query(`
    SELECT r.*, e.name as exam_name, sub.name as subject_name
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    WHERE r.student_id = ?
    ORDER BY r.published_at DESC LIMIT 5
  `, [student[0].id]);

  res.render('student/dashboard', { student: student[0], upcomingExams, recentResults });
}));

// ==================== AVAILABLE EXAMS ====================
router.get('/exams', wrap(async (req, res) => {
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.render('student/exams', { exams: [], student: null });

  const [exams] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code,
    (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
    (SELECT ea.status FROM exam_attempts ea WHERE ea.student_id = ? AND ea.exam_id = e.id) as attempt_status
    FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id
    WHERE sub.department_id = ? AND sub.semester = ?
    AND e.status IN ('scheduled', 'ongoing')
    AND (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) > 0
    ORDER BY e.exam_date
  `, [student[0].id, student[0].department_id, student[0].semester]);

  res.render('student/exams', { exams, student: student[0] });
}));

// ==================== TAKE EXAM ====================
router.get('/exam/:examId', wrap(async (req, res) => {
  const examId = req.params.examId;
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.redirect('/student/exams');

  // Check if already submitted
  const [existingAttempt] = await db.query(
    'SELECT * FROM exam_attempts WHERE student_id = ? AND exam_id = ?',
    [student[0].id, examId]
  );
  if (existingAttempt.length > 0 && existingAttempt[0].status === 'submitted') {
    return res.redirect('/student/exam/' + examId + '/result');
  }

  const [exam] = await db.query(`
    SELECT e.*, sub.name as subject_name, sub.code as subject_code,
    TIMESTAMPDIFF(MINUTE, CAST(e.start_time AS TIME), CAST(e.end_time AS TIME)) as duration_minutes
    FROM exams e JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?
  `, [examId]);
  if (exam.length === 0) return res.redirect('/student/exams');

  const [questions] = await db.query('SELECT id, question_text, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ? ORDER BY id', [examId]);
  if (questions.length === 0) return res.redirect('/student/exams');

  // Create or get attempt
  let attempt;
  if (existingAttempt.length === 0) {
    const [result] = await db.query(
      'INSERT INTO exam_attempts (student_id, exam_id, total_marks) VALUES (?, ?, ?)',
      [student[0].id, examId, questions.reduce((sum, q) => sum + q.marks, 0)]
    );
    attempt = { id: result.insertId, started_at: new Date() };
  } else {
    attempt = existingAttempt[0];
  }

  // Get saved answers
  const [savedAnswers] = await db.query(
    'SELECT question_id, selected_option FROM student_answers WHERE attempt_id = ?',
    [attempt.id]
  );
  const answersMap = {};
  savedAnswers.forEach(a => { answersMap[a.question_id] = a.selected_option; });

  // Calculate remaining time
  const startedAt = new Date(attempt.started_at);
  const durationMs = (exam[0].duration_minutes || 60) * 60 * 1000;
  const endTime = new Date(startedAt.getTime() + durationMs);
  const remainingMs = Math.max(0, endTime.getTime() - Date.now());

  res.render('student/take-exam', {
    exam: exam[0],
    questions,
    attempt,
    answersMap,
    remainingMs,
    student: student[0]
  });
}));

// Save answer (AJAX)
router.post('/exam/:examId/save-answer', wrap(async (req, res) => {
  const { question_id, selected_option } = req.body;
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.json({ success: false });

  const [attempt] = await db.query(
    'SELECT * FROM exam_attempts WHERE student_id = ? AND exam_id = ? AND status = "in_progress"',
    [student[0].id, req.params.examId]
  );
  if (attempt.length === 0) return res.json({ success: false });

  await db.query(`
    INSERT INTO student_answers (attempt_id, question_id, selected_option)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)
  `, [attempt[0].id, question_id, selected_option || null]);

  res.json({ success: true });
}));

// Submit exam
router.post('/exam/:examId/submit', wrap(async (req, res) => {
  const examId = req.params.examId;
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.redirect('/student/exams');

  const [attempt] = await db.query(
    'SELECT * FROM exam_attempts WHERE student_id = ? AND exam_id = ? AND status = "in_progress"',
    [student[0].id, examId]
  );
  if (attempt.length === 0) return res.redirect('/student/exams');

  // Auto-evaluate
  const [answers] = await db.query(`
    SELECT sa.*, q.correct_option, q.marks
    FROM student_answers sa
    JOIN questions q ON sa.question_id = q.id
    WHERE sa.attempt_id = ?
  `, [attempt[0].id]);

  let obtainedMarks = 0;
  for (const answer of answers) {
    const isCorrect = answer.selected_option === answer.correct_option ? 1 : 0;
    if (isCorrect) obtainedMarks += answer.marks;
    await db.query('UPDATE student_answers SET is_correct = ? WHERE id = ?', [isCorrect, answer.id]);
  }

  // Update attempt
  await db.query(
    'UPDATE exam_attempts SET status = "submitted", submitted_at = NOW(), obtained_marks = ? WHERE id = ?',
    [obtainedMarks, attempt[0].id]
  );

  // Also store in results table
  const [exam] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
  const totalMarks = attempt[0].total_marks;
  const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
  let grade = 'F';
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B+';
  else if (percentage >= 60) grade = 'B';
  else if (percentage >= 50) grade = 'C';
  else if (percentage >= 40) grade = 'D';

  const passingPercentage = exam.length > 0 ? (exam[0].passing_marks / exam[0].total_marks) * 100 : 40;
  const resultStatus = percentage >= passingPercentage ? 'pass' : 'fail';

  await db.query(`
    INSERT INTO results (student_id, exam_id, marks_obtained, total_marks, percentage, grade, result_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), percentage = VALUES(percentage),
    grade = VALUES(grade), result_status = VALUES(result_status)
  `, [student[0].id, examId, obtainedMarks, totalMarks, percentage, grade, resultStatus]);

  res.redirect('/student/exam/' + examId + '/result');
}));

// Exam result
router.get('/exam/:examId/result', wrap(async (req, res) => {
  const examId = req.params.examId;
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.redirect('/student/exams');

  const [attempt] = await db.query(
    'SELECT * FROM exam_attempts WHERE student_id = ? AND exam_id = ? AND status = "submitted"',
    [student[0].id, examId]
  );
  if (attempt.length === 0) return res.redirect('/student/exams');

  const [exam] = await db.query(`
    SELECT e.*, sub.name as subject_name FROM exams e
    JOIN subjects sub ON e.subject_id = sub.id WHERE e.id = ?
  `, [examId]);

  const [answers] = await db.query(`
    SELECT sa.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks
    FROM student_answers sa
    JOIN questions q ON sa.question_id = q.id
    WHERE sa.attempt_id = ?
    ORDER BY q.id
  `, [attempt[0].id]);

  res.render('student/exam-result', {
    exam: exam[0],
    attempt: attempt[0],
    answers,
    student: student[0]
  });
}));

// ==================== HALL TICKETS ====================
router.get('/hall-tickets', wrap(async (req, res) => {
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.render('student/hall-tickets', { tickets: [] });

  const [tickets] = await db.query(`
    SELECT ht.*, e.name as exam_name, e.exam_date, e.start_time, e.end_time, e.room,
    sub.name as subject_name, sub.code as subject_code
    FROM hall_tickets ht
    JOIN exams e ON ht.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    WHERE ht.student_id = ?
    ORDER BY e.exam_date
  `, [student[0].id]);

  res.render('student/hall-tickets', { tickets, student: student[0] });
}));

// ==================== RESULTS ====================
router.get('/results', wrap(async (req, res) => {
  const [student] = await db.query('SELECT * FROM students WHERE user_id = ?', [req.session.user.id]);
  if (student.length === 0) return res.render('student/results', { results: [], student: null });

  const [results] = await db.query(`
    SELECT r.*, e.name as exam_name, sub.name as subject_name, sub.code as subject_code
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    JOIN subjects sub ON e.subject_id = sub.id
    WHERE r.student_id = ?
    ORDER BY r.published_at DESC
  `, [student[0].id]);

  res.render('student/results', { results, student: student[0] });
}));

module.exports = router;
