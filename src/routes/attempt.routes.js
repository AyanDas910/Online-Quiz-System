const router = require('express').Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { authenticate, allowRoles } = require('../middleware/auth.middleware');
router.use(authenticate, allowRoles('student','admin'));

router.post('/:id/submit', asyncHandler(async(req,res) => {
  const answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length > 300) throw new HttpError(400,'Answers must be an array');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [attempts] = await conn.execute('SELECT * FROM attempts WHERE id=? FOR UPDATE',[req.params.id]);
    if (!attempts.length) throw new HttpError(404,'Attempt not found');
    const attempt = attempts[0];
    if (req.user.role !== 'admin' && Number(attempt.user_id) !== Number(req.user.id)) throw new HttpError(403,'Not your attempt');
    if (attempt.status !== 'in_progress') throw new HttpError(409,'Attempt already submitted or expired');
    const [questions] = await conn.execute('SELECT id,points FROM questions WHERE quiz_id=?',[attempt.quiz_id]);
    const validIds = new Set(questions.map(q=>String(q.id)));
    const submitted = new Map();
    for (const a of answers) {
      if (!a || !validIds.has(String(a.questionId)) || submitted.has(String(a.questionId))) throw new HttpError(400,'Invalid or duplicate question answer');
      submitted.set(String(a.questionId),a.optionId == null ? null : String(a.optionId));
    }
    let score = 0;
    for (const q of questions) {
      const optionId = submitted.get(String(q.id)) || null;
      let correct = false;
      if (optionId) {
        const [opts] = await conn.execute('SELECT id,is_correct FROM options WHERE id=? AND question_id=?',[optionId,q.id]);
        if (!opts.length) throw new HttpError(400,'Selected option does not belong to this question');
        correct = Boolean(opts[0].is_correct);
      }
      const awarded = correct ? Number(q.points) : 0;
      score += awarded;
      await conn.execute(
        'INSERT INTO attempt_answers(attempt_id,question_id,option_id,is_correct,awarded_points) VALUES(?,?,?,?,?)',
        [attempt.id,q.id,optionId,correct,awarded]);
    }
    const [clock] = await conn.execute('SELECT UTC_TIMESTAMP(3) AS now_utc');
    const expired = new Date(clock[0].now_utc) > new Date(attempt.deadline_at);
    await conn.execute(
      "UPDATE attempts SET score=?,submitted_at=UTC_TIMESTAMP(3),status=? WHERE id=?",
      [expired ? 0 : score,expired ? 'expired' : 'submitted',attempt.id]);
    await conn.commit();
    res.json({success:true,result:{attemptId:attempt.id,score:expired?0:score,maxScore:Number(attempt.max_score),status:expired?'expired':'submitted'}});
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.get('/results/me', asyncHandler(async(req,res) => {
  const [rows] = await db.execute(
    `SELECT a.id AS attempt_id,q.title,a.score,a.max_score,a.status,a.submitted_at
     FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
     WHERE a.user_id=? ORDER BY a.started_at DESC`,[req.user.id]);
  res.json({success:true,results:rows});
}));

router.get('/:id', asyncHandler(async(req,res) => {
  const [rows] = await db.execute(
    `SELECT a.id,a.status,a.score,a.max_score,a.started_at,a.deadline_at,a.submitted_at,
      q.title FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=?`,[req.params.id]);
  if (!rows.length) throw new HttpError(404,'Attempt not found');
  const [owner] = await db.execute('SELECT user_id FROM attempts WHERE id=?',[req.params.id]);
  if (req.user.role !== 'admin' && Number(owner[0].user_id)!==Number(req.user.id)) throw new HttpError(403,'Not your attempt');
  res.json({success:true,attempt:rows[0]});
}));
module.exports = router;
