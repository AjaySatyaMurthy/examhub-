function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Admin only.', user: req.session.user });
}

function isFaculty(req, res, next) {
  if (req.session.user && (req.session.user.role === 'faculty' || req.session.user.role === 'admin')) {
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Faculty only.', user: req.session.user });
}

function isStudent(req, res, next) {
  if (req.session.user && req.session.user.role === 'student') {
    return next();
  }
  res.status(403).render('error', { message: 'Access denied. Students only.', user: req.session.user });
}

module.exports = { isAuthenticated, isAdmin, isFaculty, isStudent };
