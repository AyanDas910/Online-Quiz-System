const router = require('express').Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { authenticate, allowRoles } = require('../middleware/auth.middleware');
const { requiredString } = require('../middleware/validate');

router.use(authenticate);
router.get('/', asyncHandler(async (req,res) => {
  const [rows] = await db.execute(
    `SELECT q.id,q.title,q.description,q.duration_minutes,q.status,
      COUNT(DISTINCT qu.id) AS question_count
     FROM quizzes q LEFT JOIN questions qu ON qu.quiz_id=q.id
     WHERE q.status='published' OR ?='admin'
     GROUP BY q.id ORDER BY q.created_at DESC`, [req.user.role]);
  res.json({ success:true, quizzes:rows });
}));
router.get('/:id', asyncHandler(async (req,res) => {
  const [qrows] = await db.execute(
    'SELECT id,title,description,duration_minutes,status FROM quizzes WHERE id=?', [req.params.id]);
  if (!qrows.length || (qrows[0].status !== 'published' && req.user.role !== 'admin'))
    throw new HttpError(404,'Quiz not found');
  const [questions] = await db.execute(
    `SELECT qu.id,qu.question_text,qu.points,qu.position,
       o.id AS option_id,o.option_text,o.position AS option_position
     FROM questions qu JOIN options o ON o.question_id=qu.id
     WHERE qu.quiz_id=? ORDER BY qu.position,o.position`, [req.params.id]);
  const map = new Map();
  for (const row of questions) {
    if (!map.has(row.id)) map.set(row.id,{ id:row.id, question_text:row.question_text, points:row.points, options:[] });
    map.get(row.id).options.push({ id:row.option_id, option_text:row.option_text });
  }
  res.json({ success:true, quiz:{...qrows[0], questions:[...map.values()]} });
}));
router.post('/', allowRoles('admin'), asyncHandler(async(req,res) => {
  const title = requiredString(req.body.title,'Title',180);
  const description = (req.body.description || '').toString().slice(0,2000);
  const duration = Number(req.body.duration_minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 240) throw new HttpError(400,'Duration must be 1–240 minutes');
  const [r] = await db.execute('INSERT INTO quizzes(title,description,duration_minutes,created_by) VALUES(?,?,?,?)',
    [title,description,duration,req.user.id]);
  res.status(201).json({success:true,quizId:r.insertId});
}));
router.patch('/:id', allowRoles('admin'), asyncHandler(async(req,res) => {
  const title = requiredString(req.body.title,'Title',180);
  const description = (req.body.description || '').toString().slice(0,2000);
  const duration = Number(req.body.duration_minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 240) throw new HttpError(400,'Duration must be 1–240 minutes');
  const [r] = await db.execute("UPDATE quizzes SET title=?,description=?,duration_minutes=? WHERE id=? AND status='draft'",
    [title,description,duration,req.params.id]);
  if (!r.affectedRows) throw new HttpError(404,'Draft quiz not found');
  res.json({success:true,message:'Quiz updated'});
}));
router.post('/:id/questions', allowRoles('admin'), asyncHandler(async(req,res) => {
  const question = requiredString(req.body.question_text,'Question',3000);
  const points = Number(req.body.points || 1);
  const opts = req.body.options;
  if (!Number.isFinite(points) || points <= 0 || points > 1000) throw new HttpError(400,'Points must be greater than 0');
  if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6) throw new HttpError(400,'Provide 2–6 options');
  if (opts.some(o => typeof o.text !== 'string' || !o.text.trim() || o.text.length > 1000)) throw new HttpError(400,'Every option needs text');
  if (opts.filter(o => o.is_correct === true).length !== 1) throw new HttpError(400,'Exactly one option must be correct');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [quiz] = await conn.execute("SELECT id FROM quizzes WHERE id=? AND status='draft' FOR UPDATE",[req.params.id]);
    if (!quiz.length) throw new HttpError(404,'Draft quiz not found');
    const [count] = await conn.execute('SELECT COALESCE(MAX(position),0)+1 AS next FROM questions WHERE quiz_id=?',[req.params.id]);
    const [qr] = await conn.execute('INSERT INTO questions(quiz_id,question_text,points,position) VALUES(?,?,?,?)',
      [req.params.id,question,points,count[0].next]);
    for (let i=0;i<opts.length;i++) await conn.execute(
      'INSERT INTO options(question_id,option_text,is_correct,position) VALUES(?,?,?,?)',
      [qr.insertId,opts[i].text.trim(),opts[i].is_correct === true,i+1]);
    await conn.commit();
    res.status(201).json({success:true,questionId:qr.insertId});
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
router.post('/:id/publish', allowRoles('admin'), asyncHandler(async(req,res) => {
  const [count] = await db.execute(
    `SELECT COUNT(DISTINCT q.id) AS questions,
       SUM((SELECT COUNT(*) FROM options o WHERE o.question_id=q.id)) AS option_count
     FROM questions q WHERE q.quiz_id=?`,[req.params.id]);
  if (!count[0].questions || !count[0].option_count) throw new HttpError(400,'Add questions before publishing');
  const [r] = await db.execute("UPDATE quizzes SET status='published' WHERE id=? AND status='draft'",[req.params.id]);
  if (!r.affectedRows) throw new HttpError(404,'Draft quiz not found');
  res.json({success:true,message:'Quiz published'});
}));
router.post('/:id/start', allowRoles('student'), asyncHandler(async(req,res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [quiz] = await conn.execute("SELECT id,duration_minutes FROM quizzes WHERE id=? AND status='published' FOR UPDATE",[req.params.id]);
    if (!quiz.length) throw new HttpError(404,'Published quiz not found');
    const [existing] = await conn.execute(
      "SELECT id,deadline_at,status FROM attempts WHERE user_id=? AND quiz_id=? AND status='in_progress' FOR UPDATE",
      [req.user.id,req.params.id]);
    if (existing.length) {
      await conn.commit();
      return res.json({success:true,attemptId:existing[0].id,deadlineAt:existing[0].deadline_at});
    }
    const [total] = await conn.execute('SELECT COALESCE(SUM(points),0) AS max_score FROM questions WHERE quiz_id=?',[req.params.id]);
    const [a] = await conn.execute(
      `INSERT INTO attempts(user_id,quiz_id,started_at,deadline_at,max_score)
       VALUES(?,?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? MINUTE),?)`,
      [req.user.id,req.params.id,quiz[0].duration_minutes,total[0].max_score]);
    const [deadline] = await conn.execute('SELECT deadline_at FROM attempts WHERE id=?',[a.insertId]);
    await conn.commit();
    res.status(201).json({success:true,attemptId:a.insertId,deadlineAt:deadline[0].deadline_at});
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
module.exports = router;
