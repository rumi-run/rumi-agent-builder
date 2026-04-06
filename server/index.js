const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDb } = require('./db');
const settings = require('./config/settings');

const http = require('http');
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const sharingRoutes = require('./routes/sharing');
const orgRoutes = require('./routes/orgs');
const commentRoutes = require('./routes/comments');
const communityTemplatesRoutes = require('./routes/communityTemplates');
const setupRoutes = require('./routes/setup');
const { setupWebSocket } = require('./ws');
const { ensureSetupTokenOnDisk } = require('./services/setupService');

const app = express();

if (process.env.BUILDER_TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://rumi.run']
    : ['http://localhost:5173', 'http://localhost:3020'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// API routes
app.use('/api/builder/auth', authRoutes);
app.use('/api/builder/agents', agentRoutes);
app.use('/api/builder/admin', adminRoutes);
app.use('/api/builder/ai', aiRoutes);
app.use('/api/builder/sharing', sharingRoutes);
app.use('/api/builder/orgs', orgRoutes);
app.use('/api/builder/comments', commentRoutes);
app.use('/api/builder/community-templates', communityTemplatesRoutes);
app.use('/api/builder/setup', setupRoutes);

// Health check
app.get('/api/builder/health', (req, res) => {
  res.json({ status: 'ok', service: 'rumi-agent-builder' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use('/builder', express.static(clientDist));
  app.get('/builder/*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  // Support clean /shared/:token URLs — redirect to /builder/shared/:token
  app.get('/shared/:token', (req, res) => {
    res.redirect(301, `/builder/shared/${req.params.token}`);
  });
}

// Start server
async function start() {
  try {
    await initDb();
    console.log('[DB] Database initialized');

    ensureSetupTokenOnDisk();

    const server = http.createServer(app);
    setupWebSocket(server);

    server.listen(settings.port, settings.host, () => {
      console.log(`[Server] RUMI Agent Builder running on http://${settings.host}:${settings.port}`);
      console.log(`[Server] API: http://localhost:${settings.port}/api/builder/health`);
      console.log(`[Server] WebSocket: ws://localhost:${settings.port}/ws/collab`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Server] Client dev server expected at http://localhost:5173/builder/`);
      }
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n[Server] ${signal} received, shutting down gracefully...`);
      server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
      // Force close after 10s
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
