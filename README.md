# Mentio

> **WhatsApp is your inbox. Mentio turns it into a task system — automatically.**

---

## 💡 The Problem

Over **2 billion people** coordinate work, projects, and daily tasks inside **WhatsApp**. Teams chat, clients assign requests, and urgent deadlines are discussed every single second.

However, WhatsApp has **no built-in task management system**:
- Important action items get buried under hundreds of messages.
- There is no status tracking, assignee visibility, or deadline enforcement.
- Team members forget assignments or waste time manually copying chat messages into project management tools.

*Slack has Jira. WhatsApp has nothing. Mentio changes that.*

---

## ⚡ How It Works

Mentio bridges the gap between chaotic messaging and structured workflow automation:

```
┌──────────────────────────┐
│  WhatsApp Group Mention  │  "@Mentio create landing page design due Friday"
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   DeepSeek AI Engine     │  Extracts: Title, Description, Assignee, Priority, Due Date
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Automated Task Creation  │  Auto-categorized & mapped to project Kanban board
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Multi-Channel Automation │  Telegram alerts + Google Calendar two-way sync
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Close the Feedback Loop│  Reply `/done` in WA / Telegram → Task marked completed
└──────────────────────────┘
```

1. **Mention**: A team member or client mentions your bot or issues a slash command in any connected WhatsApp group.
2. **Extract**: DeepSeek AI parses the natural language message, extracts task intent, priority, deadlines, and automatically assigns it.
3. **Organize**: The task lands instantly in the Mentio Project Dashboard with customizable Kanban stages.
4. **Notify & Sync**: The assignee receives real-time Telegram notifications and their Google Calendar syncs the due date automatically.
5. **Complete**: Mark tasks as done directly from WhatsApp (`/done <task>`), Telegram inline buttons, or the web dashboard.

---

## 🚀 Key Features

### 1. WhatsApp Listener & Group Management
- **Baileys Integration**: Robust multi-session WhatsApp Web connection with QR code authentication.
- **Group Claiming & Watched JIDs**: Easily connect and monitor specific project groups or team chats.
- **Slash Commands**: Execute `/task <title>`, `/done <task>`, and `/remind <time>` directly inside WhatsApp chats.

### 2. DeepSeek AI Layer
- **Auto Task Extraction**: Intelligently converts conversational chatter and unstructured mentions into actionable, structured tasks.
- **AI Mentions Summarizer**: Generates concise, context-aware digests of recent discussions and action items.

### 3. Dashboard & Task Board
- **Kanban & List Views**: Modern, responsive drag-and-drop Kanban board with custom workflow stages.
- **Inbox**: Stream of incoming mentions and automated task extractions ready for review.
- **Group Page**: View group-specific chat history, activity, and tasks.
- **Calendar View**: Visual timeline and schedule for all project deadlines.

### 4. Workflow Automations & Notifications
- **Telegram Bot**: Instant task assignment alerts, morning briefing digests, deadline reminders, and one-tap task completion.
- **Google Calendar Sync**: Automatic 2-way event creation for tasks with start and due dates.
- **Notification Preferences**: Highly customizable reminder intervals (daily summary, periodic reminders, deadline countdowns).

### 5. Settings & Authentication
- **Project & Team Workspaces**: Multi-project support with role-based member management.
- **Appearance & Themes**: Rich visual aesthetics with support for dark/light themes and brutalist styles.
- **Auth & Onboarding**: Seamless authentication powered by Better Auth.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14** (App Router) | React Server Components, TailwindCSS, Framer Motion |
| **Auth** | **Better Auth** | Multi-session user authentication and verification |
| **Database & ORM** | **PostgreSQL** + **Prisma ORM** | Relational data model for tasks, mentions, sessions, and projects |
| **AI Extraction** | **DeepSeek API** | DeepSeek V3 / R1 for intent extraction and conversational summarization |
| **WhatsApp Engine**| **@whiskeysockets/baileys** | WebSocket connection to WhatsApp Web multi-device API |
| **Notifications** | **Telegram Bot API** | Real-time push notifications, inline actions, and webhook bot commands |
| **Calendar Sync** | **Google Calendar API** | OAuth2 integration for deadline syncing and event management |

---

## 🏁 Local Setup Instructions

### Prerequisites
- **Node.js** >= 18.x
- **PostgreSQL** database (e.g. local PostgreSQL, Supabase, Neon, or Railway)
- **DeepSeek API Key**
- *(Optional)* Telegram Bot Token & Google OAuth credentials for integrations

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd mentio
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mentio"

# Auth
BETTER_AUTH_SECRET="your-better-auth-secret"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:9000"

# AI
DEEPSEEK_API_KEY="your-deepseek-api-key"

# Integrations (Optional for local testing)
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Initialize Database

```bash
npm run db:push
```

### 4. Run the Development Server

Mentio includes a unified runner that launches the web dashboard, WhatsApp listener, session manager, and cron workers concurrently:

```bash
npm run dev
```

Or run the web app independently:

```bash
npm run web
```

Open [http://localhost:9000](http://localhost:9000) in your browser.

---

## 🏆 Hackathon Submission Pitch

> *"Slack has Jira. WhatsApp has nothing. Mentio changes that."*
