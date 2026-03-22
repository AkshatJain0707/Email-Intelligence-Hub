<div align="center">

# 📧 Email Intelligence Hub
### Enterprise-Grade Gmail Automation with AI Classification, Auto-Drafting & Approval Workflows

[![n8n](https://img.shields.io/badge/Built%20with-n8n-FF6D5A?style=flat-square&logo=n8n)](https://n8n.io)
[![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-7C3AED?style=flat-square)](https://openrouter.ai)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Claude](https://img.shields.io/badge/LLM-Claude%20Sonnet%204.5-D97706?style=flat-square)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0-3B82F6?style=flat-square)](CHANGELOG.md)

**From raw Gmail → AI classification → smart draft → human approval → sent reply — fully automated.**

[Quick Start](#-quick-start) · [Architecture](#-architecture) · [Features](#-features) · [Screenshots](#-screenshots) · [Configuration](#%EF%B8%8F-configuration) · [Prompts Gift](#-community-prompt-gift)

</div>

---

## 🌟 What Is This?

The **Email Intelligence Hub (EIH)** is a production-grade email automation system built entirely with open-source tools. It connects to your Gmail inbox, uses AI to classify every incoming email by priority and intent, generates context-aware draft replies in your voice, routes them through a human approval dashboard, and sends them — all automatically.

Built for pharma, legal, finance, and any professional who receives high-stakes email and cannot afford to miss critical messages or send inappropriate replies.

> **Built in public over 4 months.** Every node, every prompt, every SQL query — documented and open.

---

## ✨ Features

### 🧠 AI Classification Engine
- **5-tier priority system** — CRITICAL / HIGH / MEDIUM / LOW / NOISE
- **14 intent types** — ACTION_REQUIRED, LEGAL_NOTICE, ESCALATION, CONTRACT, PAYMENT, AUDIT, and more
- **13 industry profiles** — PHARMA, FINANCE, LEGAL, HEALTHCARE, TECH, and more
- **Hard override rules** — FDA/SEC/DOJ emails are always CRITICAL regardless of content
- **Anti-hallucination guards** — no fabricated names, dates, or reference numbers
- **Confidence scoring** — flags low-confidence classifications for extra human review

### ✍️ Smart Draft Generation
- **24 voice combinations** — 8 sender tiers × 3 formality levels
- **Domain-specific protocols** — REGULATORY, LEGAL, FINANCIAL, CLIENT, INTERNAL
- **Compliance checking** — detects inadvertent admissions of liability, missing legal warnings
- **Placeholder system** — `[NEEDS INPUT]`, `[VERIFY]`, `[WARNING]` tags for human review
- **Quality scoring** — CONFIDENT / PARTIAL / NEEDS_REVIEW ratings per draft

### 📊 Approval Dashboard
- Real-time email queue with priority sorting
- Live SLA countdown timers
- Editable draft textarea with word count and placeholder tracking
- Keyboard shortcuts: `↑↓` navigate · `A` approve · `X` reject · `E` escalate · `R` refresh
- One-click Approve, Edit & Send, Reject, Snooze, Escalate
- Analytics tab with priority distribution and domain breakdown

### ⏰ SLA Monitoring
- Configurable SLA windows per priority tier
- WARNING at 80% elapsed, BREACH at deadline, CRITICAL_OVERDUE at 4h past
- Business hours awareness — escalations only during configured hours
- Multi-channel alerts: Slack + Gmail + PostgreSQL log

### 🔁 Learning Feedback Loop
- Every user action generates a structured learning signal
- Edit distance analysis on EDIT_SEND actions — detects what the AI got wrong
- Calibration signals: CORRECT / OVER_RATED / UNDER_RATED
- Curated learning examples stored for future few-shot prompt improvement
- Prompt improvement recommendations generated automatically

### 📈 Daily Analytics
- 7-day volume, priority breakdown, SLA compliance rate
- Draft approval rate, AI confidence trends
- Anomaly detection — critical spikes, SLA below target, low draft approval
- Actionable recommendations generated from anomaly patterns
- HTML email digest + Slack summary + PostgreSQL snapshot

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PIPELINE 1 — MAIN EMAIL PROCESSING          │
│                                                                     │
│  Gmail Trigger                                                      │
│       ↓                                                             │
│  Parse & Normalize Email ──→ PostgreSQL Dedup Check                 │
│       ↓ (new email)                                                 │
│  IF Likely Noise ──→ Gmail Archive                                  │
│       ↓ (not noise)                                                 │
│  Metadata Enrichment Engine (134 domains, 8 categories)             │
│       ↓                                                             │
│  Build Classification Prompt ──→ OpenRouter AI ──→ Parse Response   │
│       ↓                                                             │
│  Gmail Apply Labels ──→ PostgreSQL Insert Email                     │
│       ↓                                                             │
│  IF Should Draft                                                    │
│       ↓ (yes)                                                       │
│  Build Reply Prompt ──→ OpenRouter AI ──→ Parse Reply Draft         │
│       ↓                                                             │
│  PostgreSQL Insert Draft ──→ HTTP Push to Dashboard                 │
│       ↓                                                             │
│  IF Critical ──→ Slack Alert                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         PIPELINE 2 — SLA MONITOR (every 15 min)    │
│                                                                     │
│  Schedule Trigger ──→ PostgreSQL Near-Breach Query                  │
│       ↓                                                             │
│  SLA Breach Processor ──→ Switch by Alert Level                    │
│       ↓ WARNING      ↓ BREACH        ↓ CRITICAL_OVERDUE            │
│  Slack Only    Slack + Gmail    Slack + Gmail + Escalation          │
│       ↓ (all) → PostgreSQL Log                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         PIPELINE 3 — APPROVAL WEBHOOK               │
│                                                                     │
│  Dashboard Action Webhook                                           │
│       ↓                                                             │
│  Learning Feedback Processor                                        │
│       ↓                                                             │
│  Switch by Action (APPROVE / EDIT_SEND / REJECT / SNOOZE / ESCALATE)│
│       ↓                  ↓                  ↓                       │
│  Gmail Send Reply    PG Update Status   Slack + Gmail Escalation    │
│       ↓ (all) → PostgreSQL Action Log → Learning Example Insert    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         PIPELINE 4 — DAILY ANALYTICS (7 AM)        │
│                                                                     │
│  Schedule Trigger ──→ PostgreSQL 7-Day Query                        │
│       ↓                                                             │
│  Analytics Report Builder ──→ Gmail HTML Digest + Slack Summary    │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|---|---|
| Automation engine | n8n (self-hosted) |
| AI classification | OpenRouter (Claude Sonnet 4.5 / GPT-4o / GPT-4o-mini) |
| AI draft generation | OpenRouter (Claude Sonnet 4.5) |
| Database | PostgreSQL 14+ (Docker) |
| Email | Gmail API via n8n Gmail node |
| Notifications | Slack API via n8n Slack node |
| Dashboard server | Node.js + Express |
| Dashboard UI | Vanilla HTML/CSS/JS (zero dependencies) |
| Containerisation | Docker Compose |

---

## 📁 Repository Structure

```
email-intelligence-hub/
│
├── n8n/
│   ├── EmailHub_n8n_Workflow_v4.json          # Full importable n8n workflow
│   ├── EmailHub_OpenRouter_Nodes_v4.json      # OpenRouter HTTP nodes only
│   └── EIH_HTTP_Push_Dashboard_v4.json        # Dashboard push sub-workflow
│
├── code-nodes/
│   ├── EmailHub_ParseNode_v3.js               # Gmail Trigger parser (588 lines)
│   ├── EmailHub_MetadataEngine_v3.js          # Domain enrichment (134 domains)
│   ├── EmailHub_PromptGenerator_v4.js         # Classification prompt builder
│   ├── EmailHub_ParseClassification_v4.js     # Classification response parser
│   ├── EmailHub_ReplyPromptGenerator_v4.js    # Reply prompt builder (1046 lines)
│   ├── EmailHub_ParseReplyDraft_v4.js         # Draft response parser
│   ├── EmailHub_BuildReplyRequest_v4.js       # OpenRouter request builder
│   ├── EmailHub_SLAProcessor_v4.js            # SLA breach processor
│   ├── EmailHub_AnalyticsReport_v4.js         # Daily analytics builder
│   ├── EmailHub_LearningFeedback_v4.js        # Feedback signal processor
│   └── BuildPushPayload_Hardcoded.js          # Dashboard push payload builder
│
├── database/
│   ├── EmailHub_PostgreSQL_Schema_v2_FIXED.sql  # Full schema (12 tables)
│   ├── EmailHub_Schema_Patch_001.sql            # NOISE enum + view alias
│   ├── EmailHub_Schema_Patch_002.sql            # domain_category + columns
│   └── EmailHub_Schema_Patch_003.sql            # 162 ADD COLUMN IF NOT EXISTS
│
├── dashboard/
│   ├── EmailHub_Dashboard_v4.html             # Single-file approval dashboard
│   └── server_v4.js                           # Express.js dashboard server
│
├── community/
│   └── EIH_LinkedIn_Prompt_Gift.html          # 17 community prompts
│
├── docker-compose.yml                          # PostgreSQL + n8n setup
├── .env.example                               # All environment variables
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- n8n (cloud or self-hosted)
- Gmail account with OAuth2 set up
- OpenRouter account with API key
- Node.js 18+ (for dashboard server)

### Step 1 — Start the database

```bash
git clone https://github.com/YOUR_USERNAME/email-intelligence-hub.git
cd email-intelligence-hub
docker compose up -d
```

### Step 2 — Run the PostgreSQL schema

```bash
# Copy schema into the container and execute
docker cp database/EmailHub_PostgreSQL_Schema_v2_FIXED.sql pharmaos_postgres:/tmp/schema.sql
docker exec -it pharmaos_postgres psql -U pharmaos_user -d pharmaos_db -f /tmp/schema.sql

# Apply patches in order
docker cp database/EmailHub_Schema_Patch_001.sql pharmaos_postgres:/tmp/patch1.sql
docker exec -it pharmaos_postgres psql -U pharmaos_user -d pharmaos_db -f /tmp/patch1.sql

docker cp database/EmailHub_Schema_Patch_002.sql pharmaos_postgres:/tmp/patch2.sql
docker exec -it pharmaos_postgres psql -U pharmaos_user -d pharmaos_db -f /tmp/patch2.sql

docker cp database/EmailHub_Schema_Patch_003.sql pharmaos_postgres:/tmp/patch3.sql
docker exec -it pharmaos_postgres psql -U pharmaos_user -d pharmaos_db -f /tmp/patch3.sql

# Verify tables exist
docker exec -it pharmaos_postgres psql -U pharmaos_user -d pharmaos_db \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'eih';"
```

### Step 3 — Start the dashboard server

```bash
cd dashboard
npm install express pg
node server_v4.js
```

Dashboard available at: `http://localhost:3001`

### Step 4 — Import n8n workflow

1. Open n8n → **Workflows → Import from file**
2. Import `n8n/EmailHub_n8n_Workflow_v4.json`
3. Set up credentials:
   - **Gmail OAuth2** — connect your Gmail account
   - **OpenRouter API Key** — HTTP Header Auth, header: `Authorization`, value: `Bearer sk-or-v1-...`
   - **Email Hub PostgreSQL** — host: `host.docker.internal`, port: `5432`, db: `pharmaos_db`
4. Paste Code node contents from `code-nodes/` into the corresponding n8n Code nodes
5. Configure the values at the top of each Code node (name, org, URLs)
6. **Activate** the workflow (green toggle top right)

### Step 5 — Configure the dashboard

Open `http://localhost:3001`, click **⚙ Configure**, and fill in:

| Field | Value |
|---|---|
| Ingest API URL | `http://127.0.0.1:3001/api/emails/pending` |
| n8n Approval Webhook URL | `http://host.docker.internal:5678/webhook/email-action` |
| Webhook Secret | `my-secret-2026` (match your server config) |
| Operator Name | Your name |

### Step 6 — Test the pipeline

Send an email to your Gmail account from any external address and watch it flow through the pipeline. Check:

- n8n **Executions** tab — should show a new run within 1–2 minutes
- Dashboard — email should appear with priority badge and draft
- PostgreSQL — `SELECT * FROM eih.eih_emails ORDER BY created_at DESC LIMIT 1;`

---

## ⚙️ Configuration

All values are hardcoded at the top of each Code node. No environment variables required.

### Core settings (in each Code node)

```javascript
const CFG = {
  userName:          'Your Name',
  userTitle:         'Your Title',
  userEmail:         'you@yourdomain.com',
  orgName:           'Your Organization',
  orgDomain:         'yourdomain.com',
  industry:          'PHARMA',      // PHARMA / FINANCE / LEGAL / HEALTHCARE / TECH / GENERAL
  notificationEmail: 'you@yourdomain.com',
  escalationEmail:   'senior@yourdomain.com',
  slackChannel:      '#email-alerts',
  dashboardUrl:      'http://localhost:3001',
};
```

### Dashboard server settings (server_v4.js)

```javascript
const CFG = {
  port:           3001,
  host:           '0.0.0.0',
  webhookSecret:  'my-secret-2026',
  dashboardFile:  'EmailHub_Dashboard_v4.html',
  maxEmails:      500,
  db: {
    host:     'pharmaos_postgres',
    port:     5432,
    user:     'pharmaos_user',
    password: 'YOUR_PASSWORD',
    database: 'pharmaos_db',
  },
};
```

### OpenRouter model routing

| Priority | Conditions | Model |
|---|---|---|
| CRITICAL | legalFlag, regulatoryFlag, CRITICAL priority | `anthropic/claude-sonnet-4-5` |
| STANDARD | HIGH, MEDIUM | `openai/gpt-4o-mini` |
| ECONOMY | LOW, NOISE | `openai/gpt-4o-mini` |

To change models, edit the top of `EmailHub_BuildReplyRequest_v4.js`.

---

## 🗄 Database Schema

12 tables in the `eih` schema:

| Table | Purpose |
|---|---|
| `eih_emails` | All incoming emails — partitioned monthly by `received_at` |
| `eih_draft_replies` | AI-generated drafts with approval status |
| `eih_sender_registry` | Auto-updated sender reputation and history |
| `eih_domain_registry` | 48 seeded domains with risk metadata |
| `eih_vip_registry` | VIP overrides by email or domain |
| `eih_sla_breaches` | SLA breach log with alert levels |
| `eih_action_log` | Immutable user action audit trail |
| `eih_learning_examples` | High-value feedback examples for AI improvement |
| `eih_error_log` | Pipeline error records with retry state |
| `eih_analytics_snapshots` | Daily pre-aggregated stats |
| `eih_prompt_versions` | Version history of AI prompts |
| `eih_notification_log` | All outbound alerts logged |

### Useful queries

```sql
-- Recent emails by priority
SELECT message_id, subject, priority_class, processing_status, created_at
FROM eih.eih_emails
ORDER BY created_at DESC LIMIT 20;

-- Pending drafts awaiting approval
SELECT e.subject, e.sender_email, e.priority_class, d.draft_status, d.draft_reply
FROM eih.eih_emails e
JOIN eih.eih_draft_replies d ON d.message_id = e.message_id
WHERE d.draft_status = 'AWAITING_APPROVAL'
ORDER BY e.priority_class, e.sla_deadline;

-- SLA compliance rate (last 7 days)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE sla_breach = true) AS breaches,
  ROUND(100.0 - COUNT(*) FILTER (WHERE sla_breach = true) * 100.0 / COUNT(*), 1) AS compliance_pct
FROM eih.eih_emails
WHERE received_at >= NOW() - INTERVAL '7 days'
  AND sla_bucket != 'NONE';

-- Learning signal quality distribution
SELECT feedback_type, COUNT(*), AVG(example_quality_score)::int AS avg_quality
FROM eih.eih_learning_examples
GROUP BY feedback_type
ORDER BY avg_quality DESC;
```

---

## 🔑 n8n Node Reference

### Pipeline 1 — Main Email Processing

| Node | Type | Purpose |
|---|---|---|
| Gmail Trigger | Gmail | Polls inbox every 1 minute |
| Parse and Normalize Email | Code | Extracts fields from raw Gmail format |
| PostgreSQL Dedup Lookup | PostgreSQL | COUNT check for existing messageId |
| Code: Dedup Check + Data Merge | Code | Decides if duplicate, merges data |
| IF Is Duplicate | IF | Routes duplicates to discard |
| IF Likely Noise | IF | Routes noise to Gmail Archive |
| Metadata Enrichment Engine | Code | Domain lookup, sender scoring, SLA pre-compute |
| Build Classification Prompt | Code | Assembles AI classification prompt |
| OpenRouter Email Classification | HTTP Request | Calls OpenRouter API |
| Parse Classification Response | Code | Extracts all fields from AI response |
| Gmail Apply Labels | Gmail | Applies EIH/* labels |
| PostgreSQL Insert Email | PostgreSQL | Saves to eih_emails table |
| IF Should Generate Draft | IF | Routes based on shouldDraft flag |
| Build Reply Draft Request | Code | Assembles reply prompt |
| OpenRouter Draft Reply | HTTP Request | Calls OpenRouter API |
| Parse Reply Draft Response | Code | Extracts draft from AI response |
| PostgreSQL Insert Draft | PostgreSQL | Saves to eih_draft_replies |
| Build Push Payload | Code | Prepares dashboard push |
| HTTP Push to Dashboard | HTTP Request | POSTs to server_v4.js |
| IF Is Critical | IF | Routes critical emails to Slack |
| Slack: Critical Alert | Slack | Sends alert message |

### Pipeline 4 — Approval Webhook

| Node | Type | Purpose |
|---|---|---|
| Dashboard Action Webhook | Webhook | Receives actions from dashboard |
| Extract Webhook Body | Code | Flattens nested body object |
| Learning Feedback Processor | Code | Generates learning signals |
| Switch: Route by Action | Switch | Routes 5 action types |
| Gmail Send Reply | Gmail | Sends approved draft |
| PostgreSQL Update Draft Status | PostgreSQL | Marks draft as SENT/REJECTED |
| PostgreSQL Insert Action Log | PostgreSQL | Immutable audit entry |
| PostgreSQL Update Email Status | PostgreSQL | Updates processing_status |
| IF Should Store Learning | IF | Gates high-value examples |
| PostgreSQL Insert Learning Example | PostgreSQL | Saves to learning table |

---

## 🐛 Known Issues & Fixes

### Gmail label "EIH/NOISE is not supported"
Gmail labels must be created manually first. Go to Gmail Settings → Labels → Create `EIH`, then nested labels `EIH/CRITICAL`, `EIH/HIGH`, `EIH/MEDIUM`, `EIH/LOW`, `EIH/NOISE`. After creation, pass the label ID (not name) to the Gmail node for reliability.

### ECONNREFUSED ::1:3001 from n8n
n8n (running in Docker) tries to reach the dashboard server on IPv6. Fix: use `host.docker.internal:3001` instead of `localhost:3001` in the Build Push Payload node URL. The server_v4.js is already configured to listen on `0.0.0.0`.

### PostgreSQL GENERATED ALWAYS AS error
PostgreSQL does not allow `NOW()` in generated columns (not immutable). Use a trigger function to compute the derived column on INSERT/UPDATE instead. See `EmailHub_Schema_Patch_003.sql` for the `sla_breach` trigger.

### Sender email undefined in draft prompts
The reply prompt generator runs after parse, but the parse node must extract sender fields from Gmail's three possible header formats (top-level, headers object, payload.headers array). The `Build Reply Draft Request` node includes a `repairPrompt()` function that fixes `undefined <undefined>` entries automatically.

### 409 Duplicate from dashboard push
Change the server.js response for duplicate pushKeys from HTTP 409 to HTTP 200 with `{ ok: true, duplicate: true }`. n8n treats any 4xx as an error requiring retry — but a duplicate is a success condition.

---

## 📊 Performance & Cost

Approximate per-email cost with default model routing:

| Email type | Model | Classification | Draft | Total |
|---|---|---|---|---|
| CRITICAL (legal/reg) | claude-sonnet-4-5 | ~$0.004 | ~$0.012 | ~$0.016 |
| HIGH/MEDIUM | gpt-4o-mini | ~$0.001 | ~$0.003 | ~$0.004 |
| LOW/NOISE | gpt-4o-mini | ~$0.0005 | — | ~$0.0005 |

At 100 emails/day (~70% low/noise, 25% medium/high, 5% critical), estimated monthly cost: **$8–15 USD**.

---

## 🤝 Contributing

Contributions are welcome. Areas where help is most valuable:

- Additional industry profiles (ENERGY, INSURANCE, REAL_ESTATE)
- More domain registry entries in MetadataEngine
- Better noise detection patterns
- Multi-language support in reply prompts
- n8n workflow export with all nodes pre-configured

Please open an issue before submitting a large PR to discuss approach.

---

## 🎁 Community Prompt Gift

The `community/EIH_LinkedIn_Prompt_Gift.html` file contains **17 production-grade prompts** extracted from this build, formatted as a beautiful interactive card collection with one-click copy. Categories include:

- Architecture & planning
- Gmail parsing and normalization
- AI classification system prompts
- Draft generation and voice profiles
- Error handling and retry logic
- SLA monitoring
- Dashboard and server setup
- Learning feedback processing
- Analytics and reporting
- Debugging any n8n node

Open the HTML file in any browser or host it on Netlify Drop for a public URL to share.

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- [n8n](https://n8n.io) — workflow automation that actually works
- [OpenRouter](https://openrouter.ai) — unified API for 100+ AI models  
- [Anthropic](https://anthropic.com) — Claude, the AI that wrote most of this
- The LinkedIn automation community — your questions made this better

---

<div align="center">

**Built with obsessive attention to detail by Akshat Jain**

*PharmaOS · March 2026*

⭐ Star this repo if it helped you build something real.

</div>
