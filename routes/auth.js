const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null, fpError: null, fpSuccess: null, showForgot: false });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.render('login', { error: 'Invalid email or password', fpError: null, fpSuccess: null, showForgot: false });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Invalid email or password', fpError: null, fpSuccess: null, showForgot: false });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect(`/${user.role}`);
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Something went wrong', fpError: null, fpSuccess: null, showForgot: false });
  }
});

router.get('/register', (req, res) => {
  res.render('register', { error: null, success: null });
});

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.render('register', { error: 'Email already registered', success: null });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'student', phone]
    );
    res.render('register', { error: null, success: 'Registration successful! Please login.' });
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Registration failed', success: null });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email, new_password, confirm_password } = req.body;
  if (new_password !== confirm_password) {
    return res.render('login', { error: null, fpError: 'Passwords do not match', fpSuccess: null, showForgot: true });
  }
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.render('login', { error: null, fpError: 'No account found with that email', fpSuccess: null, showForgot: true });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    res.render('login', { error: null, fpError: null, fpSuccess: 'Password reset successful! You can now sign in.', showForgot: true });
  } catch (err) {
    console.error(err);
    res.render('login', { error: null, fpError: 'Something went wrong', fpSuccess: null, showForgot: true });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
