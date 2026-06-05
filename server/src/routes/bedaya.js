const express = require('express');
const router = express.Router();
const bedaya = require('../services/bedaya');
const { LETTERS } = require('../services/letters');

// POST /api/bedaya/learners — create
router.post('/learners', async (req, res, next) => {
  try {
    const { name, phone, voiceGuide, letterOrder, deviceId } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name required' });
    }
    const learner = await bedaya.createLearner({
      name: name.trim(),
      phone,
      voiceGuide,
      letterOrder,
      deviceId,
    });
    res.status(201).json({ success: true, data: learner });
  } catch (err) { next(err); }
});

// GET /api/bedaya/learners/:id
router.get('/learners/:id', async (req, res, next) => {
  try {
    const learner = await bedaya.getLearner(req.params.id);
    if (!learner) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, data: learner });
  } catch (err) { next(err); }
});

// GET /api/bedaya/lessons/next/:learnerId — plan the upcoming lesson
router.get('/lessons/next/:learnerId', async (req, res, next) => {
  try {
    const plan = await bedaya.planLesson(req.params.learnerId);
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// POST /api/bedaya/lessons/start — { learnerId, letter }
router.post('/lessons/start', async (req, res, next) => {
  try {
    const { learnerId, letter } = req.body || {};
    if (!learnerId || !letter) {
      return res.status(400).json({ success: false, error: 'learnerId and letter required' });
    }
    const session = await bedaya.startSession(learnerId, letter);
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

// POST /api/bedaya/lessons/phase — { sessionId, phase, letterIds? }
// letterIds is optional and only consumed for phase === 'warmup' to rate
// the FSRS cards that were reviewed in the panel.
router.post('/lessons/phase', async (req, res, next) => {
  try {
    const { sessionId, phase, letterIds } = req.body || {};
    if (!sessionId || !phase) {
      return res.status(400).json({ success: false, error: 'sessionId and phase required' });
    }
    await bedaya.markPhase(sessionId, phase, { letterIds });
    res.json({ success: true, data: { ok: true } });
  } catch (err) { next(err); }
});

// POST /api/bedaya/trace — { learnerId, letter }
router.post('/trace', async (req, res, next) => {
  try {
    const { learnerId, letter } = req.body || {};
    if (!learnerId || !letter) {
      return res.status(400).json({ success: false, error: 'learnerId and letter required' });
    }
    await bedaya.recordTrace(learnerId, letter);
    res.json({ success: true, data: { ok: true } });
  } catch (err) { next(err); }
});

// POST /api/bedaya/lessons/complete — { sessionId, masterLetter? }
router.post('/lessons/complete', async (req, res, next) => {
  try {
    const { sessionId, masterLetter } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }
    const learner = await bedaya.completeSession(sessionId, { masterLetter: !!masterLetter });
    res.json({ success: true, data: { learner } });
  } catch (err) { next(err); }
});

// POST /api/bedaya/story — { learnerId, topic? }
router.post('/story', async (req, res, next) => {
  try {
    const { learnerId, topic } = req.body || {};
    if (!learnerId) {
      return res.status(400).json({ success: false, error: 'learnerId required' });
    }
    const result = await bedaya.generateStory(learnerId, { topic });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/bedaya/letters — full inventory (for client-side rendering)
router.get('/letters', (_req, res) => {
  res.json({ success: true, data: LETTERS });
});

module.exports = router;
