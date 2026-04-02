/**
 * API 규칙(해커톤): 모든 엔드포인트는 로그인 없이 사용 가능해야 함.
 * JWT는 로그인 응답용으로만 쓰고, 앞으로 새 API에 auth/JWT 가드·미들웨어를 붙이지 않는다.
 */
const express = require('express');
const aiRouter = require('../ai');
const authRouter = require('../auth');
const databaseRouter = require('../database');
const recipeRouter = require('../recipe');
const userRouter = require('../user');
const voiceRouter = require('../voice');
const uploadRouter = require('../upload');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ ok: true, message: 'backend is running', path: '/api' });
});

router.use('/auth', authRouter);
router.use('/ai', aiRouter);
router.use('/voice', voiceRouter);
router.use('/upload', uploadRouter);
router.use('/recipes', recipeRouter);
router.use('/users', userRouter);
router.use('/db', databaseRouter);

module.exports = router;
