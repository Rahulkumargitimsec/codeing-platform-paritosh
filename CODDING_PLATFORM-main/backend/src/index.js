require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const redisClient = require('./config/redis');
const seed = require('./seed/seed');
const { runnerMode } = require('./utils/problemUtility');

const authRouter = require('./routes/userAuth');
const problemRouter = require('./routes/problemCreator');
const submitRouter = require('./routes/submit');
const aiRouter = require('./routes/aiChatting');
const videoRouter = require('./routes/videoCreator');

const app = express();

if (!process.env.JWT_KEY) {
  // Don't block local development on a missing secret, but never do this in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Missing JWT_KEY. Set it in backend/.env.');
    process.exit(1);
  }
  process.env.JWT_KEY = 'codejudge-local-dev-secret-change-me';
  console.warn('JWT_KEY not set — using a development secret. Set JWT_KEY in backend/.env before deploying.');
}

// Any localhost / 127.0.0.1 port is allowed in development (Vite may pick 5174, 5175...)
const allowedOrigins = [
  'https://14-dev.vercel.app',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((s) => s.trim()) : []),
];
const isLocal = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || isLocal(origin) || allowedOrigins.includes(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/', (req, res) => res.send('CodeJudge API is running'));

// What's configured — the frontend uses this to show which features are available
app.get('/health', (req, res) => {
  const runner = runnerMode();
  const languages = runner === 'local'
    ? require('./utils/localRunner').availableLanguages()
    : { javascript: true, cpp: true, java: true };
  res.json({
    ok: true,
    runner,
    languages,
    ai: {
      groq: !!process.env.GROQ_API_KEY,
      gemini: !!process.env.GEMINI_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    },
    video: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  });
});

app.use('/user', authRouter);
app.use('/problem', problemRouter);
app.use('/submission', submitRouter);
app.use('/ai', aiRouter);
app.use('/video', videoRouter);

// Malformed JSON and other unhandled errors -> JSON instead of an HTML stack trace
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ message: err.status === 400 ? 'Invalid request body' : 'Something went wrong on the server' });
});

const port = process.env.PORT || 4000;

const start = async () => {
  try {
    await Promise.all([connectDB(), redisClient.connect()]);
    console.log('DB Connected');

    await seed({ onlyIfEmpty: true });

    const runner = runnerMode();
    if (runner === 'local') {
      const langs = require('./utils/localRunner').availableLanguages();
      const missing = Object.entries(langs).filter(([, ok]) => !ok).map(([l]) => l);
      console.log(`Code runner: local (${Object.keys(langs).filter((l) => langs[l]).join(', ')})` +
        (missing.length ? ` — not installed: ${missing.join(', ')}` : ''));
    } else {
      console.log('Code runner: Judge0');
    }

    const server = app.listen(port, () => {
      console.log(`Server listening at port number: ${port}`);
    });

    const stop = async () => {
      server.close();
      await connectDB.shutdown();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (err) {
    console.error('Error: ' + err.message);
    await connectDB.shutdown();
    process.exit(1);
  }
};

start();
