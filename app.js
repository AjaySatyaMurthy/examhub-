const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    secure: false
  }
}));

app.use((req, res, next) => {
  if (!req.session) {
    res.locals.user = null;
  } else {
    res.locals.user = req.session.user || null;
  }
  next();
});

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/faculty', require('./routes/faculty'));
app.use('/student', require('./routes/student'));

app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found',
    user: req.session ? req.session.user : null
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  const message =
    err.code === 'ER_DUP_ENTRY'
      ? 'A record with that information already exists.'
      : 'Something went wrong. Please try again.';

  res.status(500).render('error', {
    message,
    user: req.session ? req.session.user : null
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});