const jwt = require('jsonwebtoken');
const HttpError = require('../utils/httpError');
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { next(new HttpError(401, 'Invalid or expired token')); }
}
function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next() : next(new HttpError(403, 'You do not have permission'));
}
module.exports = { authenticate, allowRoles };
