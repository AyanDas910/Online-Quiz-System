const router = require('express').Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, allowRoles } = require('../middleware/auth.middleware');
router.use(authenticate,allowRoles('admin'));
router.get('/results',asyncHandler(async(req,res)=>{
  const [rows] = await db.execute(
    `SELECT a.id AS attempt_id,u.name,u.email,q.title,a.score,a.max_score,a.status,a.started_at,a.submitted_at
     FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id
     ORDER BY a.started_at DESC LIMIT 500`);
  res.json({success:true,results:rows});
}));
module.exports=router;
