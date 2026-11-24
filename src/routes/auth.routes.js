const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requiredString } = require('../middleware/validate');

router.post('/register', asyncHandler(async (req, res) => {
  const name = requiredString(req.body.name, 'Name', 100);
  const email = requiredString(req.body.email, 'Email', 190).toLowerCase();
  const password = requiredString(req.body.password, 'Password', 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (password.length < 8) throw new HttpError(400, 'Password must contain at least 8 characters');
  const hash = await bcrypt.hash(password, 12);
  const [result] = await db.execute(
    'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
    [name,email,hash,'student']);
  res.status(201).json({ success: true, user: { id: result.insertId, name, email, role: 'student' } });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = requiredString(req.body.email, 'Email', 190).toLowerCase();
  const password = requiredString(req.body.password, 'Password', 100);
  const [rows] = await db.execute('SELECT id,name,email,password_hash,role FROM users WHERE email=?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash)))
    throw new HttpError(401, 'Invalid email or password');
  const user = rows[0];
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '2h' });
  res.json({ success: true, token, user: { id:user.id, name:user.name, email:user.email, role:user.role } });
}));
module.exports = router;
