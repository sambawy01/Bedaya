require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const bedayaRouter = require('./routes/bedaya');
const { getProvider } = require('./services/ai-provider');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(helmet());
app.use(morgan('dev'));
// CORS allowlist in prod — comma-separated origins via ALLOWED_ORIGINS env
// (e.g. "https://bedaya.vercel.app,https://bedaya-staging.vercel.app").
// Falls back to permissive in prod when unset so the first deploy doesn't
// 403 itself before the env var lands.
const PROD_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (PROD_ORIGINS.length > 0 ? PROD_ORIGINS : true)
    : ['http://localhost:5183'],
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', service: 'bedaya', aiProvider: getProvider(), timestamp: new Date().toISOString() },
  });
});

app.use('/api/bedaya', bedayaRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Bedaya server running on port ${PORT}`);
  });
}

module.exports = app;
