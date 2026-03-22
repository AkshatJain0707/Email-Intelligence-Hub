// ═══════════════════════════════════════════════════════════════════════════
// EMAIL INTELLIGENCE HUB — SERVER v4.0
// ─────────────────────────────────────────────────────────────────────────
// Express server — dashboard host + n8n push receiver + action webhook
// Run: node server.js
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const { Pool } = require('pg');
const path    = require('path');
const crypto  = require('crypto');

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — edit these values
// ─────────────────────────────────────────────────────────────────────────
const CFG = {
  port:           3001,
  host:           '0.0.0.0',         // listen on all interfaces — fixes IPv6 issue
  webhookSecret:  'my-secret-2026',
  dashboardFile:  'EmailHub_Dashboard_v3.html',
  maxEmails:      500,               // max emails kept in memory
  db: {
    host:     'pharmaos_postgres',   // docker service name — use 127.0.0.1 if not docker
    port:     5432,
    user:     'pharmaos_user',
    password: 'pharmaos_secure_2026',
    database: 'pharmaos_db',
    max:      10,                    // connection pool size
    idleTimeoutMillis:    30000,
    connectionTimeoutMillis: 5000,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────────────────────────────────
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS — allow dashboard to call API even when opened from file://
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const icon = res.statusCode >= 400 ? '✗' : '✓';
    console.log(`${icon} ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ─────────────────────────────────────────────────────────────────────────
// DATABASE POOL
// ─────────────────────────────────────────────────────────────────────────
const pool = new Pool(CFG.db);

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function dbQuery(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function dbHealthCheck() {
  try {
    await dbQuery('SELECT 1');
    return true;
  } catch(e) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// IN-MEMORY EMAIL STORE
// Deduplicates by pushKey — prevents double entries on retry
// ─────────────────────────────────────────────────────────────────────────
const emails    = [];
const pushKeys  = new Set();   // for deduplication
const stats     = {
  received:   0,
  duplicates: 0,
  actions:    0,
  errors:     0,
  startedAt:  new Date().toISOString(),
};

function addEmail(payload) {
  const key = payload.pushKey || payload.messageId;

  // Deduplicate — return 409 signal if already seen
  if (key && pushKeys.has(key)) {
    stats.duplicates++;
    return { duplicate: true };
  }

  if (key) pushKeys.add(key);

  // Prepend (newest first)
  emails.unshift(payload);

  // Cap memory store
  if (emails.length > CFG.maxEmails) {
    const removed = emails.splice(CFG.maxEmails);
    // Clean up pushKeys for removed emails
    removed.forEach(e => {
      if (e.pushKey) pushKeys.delete(e.pushKey);
    });
  }

  stats.received++;
  return { duplicate: false };
}

// ─────────────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  const incoming = req.headers['x-webhook-secret'];
  if (!incoming) {
    return res.status(401).json({ error: 'missing x-webhook-secret header' });
  }
  // Constant-time comparison to prevent timing attacks
  const expected = CFG.webhookSecret;
  if (incoming.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))) {
    stats.errors++;
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, CFG.dashboardFile);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[Dashboard] File not found:', filePath);
      res.status(404).send(
        '<h2>Dashboard file not found</h2>' +
        '<p>Expected: <code>' + CFG.dashboardFile + '</code> in the same folder as server.js</p>' +
        '<p>Current directory: <code>' + __dirname + '</code></p>'
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — EMAIL INGEST (n8n → server)
// POST /api/emails/pending — n8n pushes classified emails here
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/emails/pending', requireSecret, (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'invalid JSON body' });
    }

    const payload    = req.body;
    const { duplicate } = addEmail(payload);

    if (duplicate) {
      // 409 = already received — n8n error handler stops retrying on 409
      return res.status(409).json({
        ok:        false,
        duplicate: true,
        pushKey:   payload.pushKey,
        message:   'email already received',
      });
    }

    console.log('[Ingest]', payload.priorityClass, '|', payload.messageId, '|', payload.subject?.substring(0, 60));

    return res.status(201).json({
      ok:         true,
      received:   payload.messageId,
      pushKey:    payload.pushKey,
      totalStored: emails.length,
    });

  } catch(err) {
    stats.errors++;
    console.error('[Ingest] Error:', err.message);
    return res.status(500).json({ error: 'internal server error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — EMAIL FETCH (dashboard → server)
// GET /api/emails/pending — dashboard polls here
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/emails/pending', (req, res) => {
  try {
    // Optional filters via query params
    const priority  = req.query.priority;
    const domain    = req.query.domain;
    const status    = req.query.status;
    const limit     = Math.min(parseInt(req.query.limit  || '100'), 500);
    const offset    = parseInt(req.query.offset || '0');

    let filtered = emails;
    if (priority) filtered = filtered.filter(e => e.priorityClass === priority);
    if (domain)   filtered = filtered.filter(e => e.domainCategory === domain);
    if (status)   filtered = filtered.filter(e => e.processingStatus === status);

    const page  = filtered.slice(offset, offset + limit);
    const total = filtered.length;

    return res.json({
      ok:     true,
      total,
      limit,
      offset,
      count:  page.length,
      emails: page,
    });

  } catch(err) {
    stats.errors++;
    console.error('[Fetch] Error:', err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — ACTION WEBHOOK (dashboard → server → n8n)
// POST /api/emails/action — dashboard posts approve/reject/snooze/escalate
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/emails/action', (req, res) => {
  try {
    const { action, messageId, editedReply, snoozeUntil,
            escalateTo, escalationNote, rejectionReason, userId } = req.body;

    if (!action)    return res.status(400).json({ error: 'action is required' });
    if (!messageId) return res.status(400).json({ error: 'messageId is required' });

    const VALID_ACTIONS = ['APPROVE','EDIT_SEND','REJECT','SNOOZE','ESCALATE'];
    if (!VALID_ACTIONS.includes(action.toUpperCase())) {
      return res.status(400).json({ error: 'invalid action: ' + action });
    }

    // Update email status in memory store
    const idx = emails.findIndex(e => e.messageId === messageId);
    if (idx !== -1) {
      const STATUS_MAP = {
        APPROVE:   'SENT',
        EDIT_SEND: 'SENT',
        REJECT:    'DISMISSED',
        SNOOZE:    'SNOOZED',
        ESCALATE:  'ESCALATED',
      };
      emails[idx] = {
        ...emails[idx],
        processingStatus: STATUS_MAP[action.toUpperCase()] || emails[idx].processingStatus,
        actionTakenAt:    new Date().toISOString(),
        actionTakenBy:    userId || 'user',
        action:           action.toUpperCase(),
      };
    }

    stats.actions++;
    console.log('[Action]', action.toUpperCase(), '|', messageId);

    // Log action to DB (non-blocking — do not await)
    dbQuery(
      `INSERT INTO eih.eih_action_log
         (message_id, action, user_id, edited_reply,
          snooze_until, escalate_to, escalation_note,
          rejection_reason, action_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT DO NOTHING`,
      [
        messageId,
        action.toUpperCase(),
        userId || 'user',
        action === 'EDIT_SEND' ? (editedReply || null) : null,
        action === 'SNOOZE'    ? (snoozeUntil || null) : null,
        action === 'ESCALATE'  ? (escalateTo  || null) : null,
        escalationNote         || null,
        rejectionReason        || null,
      ]
    ).catch(err => console.error('[Action] DB log error:', err.message));

    return res.json({
      ok:        true,
      action:    action.toUpperCase(),
      messageId,
      timestamp: new Date().toISOString(),
    });

  } catch(err) {
    stats.errors++;
    console.error('[Action] Error:', err.message);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — HEALTH CHECK
// GET /health — n8n, Docker, and monitoring tools use this
// ─────────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const dbOk = await dbHealthCheck();
  const status = dbOk ? 200 : 503;
  return res.status(status).json({
    ok:         dbOk,
    status:     dbOk ? 'healthy' : 'degraded',
    db:         dbOk ? 'connected' : 'error',
    emails:     emails.length,
    uptime:     Math.round(process.uptime()) + 's',
    memory:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    stats,
    timestamp:  new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — STATS
// GET /api/stats — dashboard stats panel
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const byPriority = {};
  const byDomain   = {};
  const byStatus   = {};

  emails.forEach(e => {
    byPriority[e.priorityClass  || 'UNKNOWN'] = (byPriority[e.priorityClass  || 'UNKNOWN'] || 0) + 1;
    byDomain  [e.domainCategory || 'UNKNOWN'] = (byDomain  [e.domainCategory || 'UNKNOWN'] || 0) + 1;
    byStatus  [e.processingStatus||'UNKNOWN'] = (byStatus  [e.processingStatus||'UNKNOWN'] || 0) + 1;
  });

  return res.json({
    ok: true,
    total:       emails.length,
    byPriority,
    byDomain,
    byStatus,
    stats,
    timestamp:   new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ROUTES — CLEAR (dev/test only)
// POST /api/clear — wipes in-memory store
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/clear', requireSecret, (req, res) => {
  const count = emails.length;
  emails.length = 0;
  pushKeys.clear();
  console.log('[Clear] Removed', count, 'emails from memory store');
  return res.json({ ok: true, cleared: count });
});

// ─────────────────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'not found', path: req.path });
});

// ─────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  stats.errors++;
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'internal server error', message: err.message });
});

// ─────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log('\n[Server] Received', signal, '— shutting down gracefully');
  await pool.end();
  console.log('[Server] DB pool closed');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  err => console.error('[Uncaught]',  err.message));
process.on('unhandledRejection', err => console.error('[Unhandled]', err));

// ─────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────
app.listen(CFG.port, CFG.host, () => {
  console.log('');
  console.log('  Email Intelligence Hub — Server v4.0');
  console.log('  ─────────────────────────────────────');
  console.log('  Dashboard   →  http://127.0.0.1:' + CFG.port);
  console.log('  Ingest API  →  http://127.0.0.1:' + CFG.port + '/api/emails/pending');
  console.log('  Action API  →  http://127.0.0.1:' + CFG.port + '/api/emails/action');
  console.log('  Health      →  http://127.0.0.1:' + CFG.port + '/health');
  console.log('  Stats       →  http://127.0.0.1:' + CFG.port + '/api/stats');
  console.log('  ─────────────────────────────────────');
  console.log('  DB          →  ' + CFG.db.host + ':' + CFG.db.port + '/' + CFG.db.database);
  console.log('  n8n push URL →  http://host.docker.internal:' + CFG.port + '/api/emails/pending');
  console.log('');
});