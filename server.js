require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./src/routes/auth.routes');
const quizRoutes = require('./src/routes/quiz.routes');
const attemptRoutes = require('./src/routes/attempt.routes');
const adminRoutes = require('./src/routes/admin.routes');
const { notFound, errorHandler } = require('./src/middleware/error.middleware');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'online-quiz-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Quiz system running at http://localhost:${port}`));
