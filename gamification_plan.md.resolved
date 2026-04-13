# SKAI Gamification — Full-Stack Implementation Plan

## 🎯 Goal
Encourage restaurant owners to **stay engaged** with the dashboard (review calls, orders) and **keep paying** for the service by making usage rewarding and progress visible.

---

## 1. Database Schema (New Tables)

### `achievements` (Definition Table)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR (PK) | Slug: `first_call`, `revenue_1k`, etc. |
| title | VARCHAR | "First Call" |
| description | TEXT | "Receive your first AI-handled call" |
| icon | VARCHAR | Emoji or icon identifier |
| category | VARCHAR | `calls`, `revenue`, `setup`, `engagement` |
| tier | VARCHAR | `bronze`, `silver`, `gold`, `platinum` |
| threshold | INT | Numeric target (e.g., 100 for "100 calls") |
| sort_order | INT | Display ordering |

### `restaurant_achievements` (Earned Achievements)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| achievement_id | VARCHAR (FK) | |
| unlocked_at | TIMESTAMPTZ | When earned |
| seen | BOOLEAN | Has owner dismissed the celebration? |

### `restaurant_streaks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| streak_type | VARCHAR | `agent_active`, `daily_login`, `weekly_review` |
| current_count | INT | Current streak length |
| longest_count | INT | All-time best |
| last_activity_date | DATE | To detect streak breaks |
| updated_at | TIMESTAMPTZ | |

### `weekly_challenges`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| week_start | DATE | Monday of the challenge week |
| challenge_type | VARCHAR | `orders_target`, `revenue_target`, `review_calls` |
| title | VARCHAR | "Hit 50 orders this week" |
| target_value | DECIMAL | Goal number |
| current_value | DECIMAL | Progress so far |
| completed | BOOLEAN | |
| completed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `gamification_events` (Activity Log)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| event_type | VARCHAR | `call_reviewed`, `login`, `achievement_unlocked` |
| metadata | JSONB | Extra context |
| created_at | TIMESTAMPTZ | |

---

## 2. Achievement Catalog

### 📞 Calls Category

| ID | Title | Icon | Tier | Threshold | Description |
|----|-------|------|------|-----------|-------------|
| `first_call` | First Contact | 📞 | Bronze | 1 | Receive your first AI-handled call |
| `calls_50` | Rising Star | ⭐ | Silver | 50 | Handle 50 calls with your AI agent |
| `calls_100` | Century Club | 💯 | Gold | 100 | Reach the 100 call milestone |
| `calls_500` | Call Commander | 🎖️ | Gold | 500 | 500 calls handled — you're a pro |
| `calls_1000` | Thousand Strong | 👑 | Platinum | 1000 | 1,000 calls and counting |

### 💰 Revenue Category

| ID | Title | Icon | Tier | Threshold | Description |
|----|-------|------|------|-----------|-------------|
| `revenue_1k` | First Grand | 💵 | Bronze | 1000 | Generate $1K in AI-powered orders |
| `revenue_5k` | Revenue Rocket | 🚀 | Silver | 5000 | Surpass $5K in total revenue |
| `revenue_10k` | Money Machine | 💰 | Gold | 10000 | $10K earned through SKAI |
| `revenue_25k` | Quarter Master | 🏆 | Gold | 25000 | $25K revenue milestone |
| `revenue_50k` | Revenue Titan | 💎 | Platinum | 50000 | $50K — SKAI is paying for itself |

### ⚙️ Setup Category

| ID | Title | Icon | Tier | Threshold | Description |
|----|-------|------|------|-----------|-------------|
| `setup_complete` | Fully Loaded | ⚙️ | Silver | 100 | Configure all settings (100% setup) |
| `menu_described` | Menu Storyteller | 📝 | Bronze | 100 | Add descriptions to all menu items |
| `hours_configured` | Clockwork | 🕐 | Bronze | 1 | Set up your business hours |
| `agent_activated` | Go Live | 🟢 | Bronze | 1 | Enable your AI agent for the first time |

### 🔥 Engagement Category

| ID | Title | Icon | Tier | Threshold | Description |
|----|-------|------|------|-----------|-------------|
| `reviews_10` | Curious Owner | 🔍 | Bronze | 10 | Review 10 call transcripts |
| `reviews_50` | Transcript Pro | 📋 | Silver | 50 | Dive into 50 call transcripts |
| `reviews_100` | Detail Oriented | 🧐 | Gold | 100 | Review 100 calls — nothing slips by |
| `streak_7_agent` | Week Warrior | 🔥 | Silver | 7 | Keep agent active 7 days straight |
| `streak_30_agent` | Iron Will | ⚡ | Gold | 30 | Agent active for 30 consecutive days |
| `streak_7_login` | Daily Driver | 📅 | Silver | 7 | Log in 7 days in a row |
| `weekly_challenge_3` | Challenger | 🎯 | Silver | 3 | Complete 3 weekly challenges |
| `weekly_challenge_10` | Goal Crusher | 🏅 | Gold | 10 | Complete 10 weekly challenges |

---

## 3. Weekly Challenge System

Each Monday, the system auto-generates **3 challenges** for each restaurant based on their recent performance:

| Challenge Type | Logic | Example |
|----------------|-------|---------|
| `orders_target` | Last week's orders × 1.1 (10% growth) | "Get 55 orders this week" |
| `revenue_target` | Last week's revenue × 1.1 | "Hit $3,200 in revenue" |
| `review_calls` | Fixed escalating targets: 5→10→15→20 | "Review 10 calls this week" |

---

## 4. Streak System

| Streak | How It Works | Reset Condition |
|--------|-------------|-----------------|
| **Agent Active** | Increments daily if agent is enabled at midnight check | Agent disabled for a full day |
| **Daily Login** | Increments when owner opens dashboard on a new day | Miss a calendar day |
| **Weekly Review** | Increments if ≥1 call transcript viewed in a week | Miss a full week without reviewing |

---

## 5. Backend API Endpoints

### New Module: `gamification/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gamification/overview` | All achievements (earned + locked), streaks, active challenges, XP/level |
| POST | `/api/v1/gamification/events` | Record an event (call reviewed, login, etc.) |
| GET | `/api/v1/gamification/achievements` | Achievement catalog with unlock status |
| PUT | `/api/v1/gamification/achievements/{id}/seen` | Mark achievement celebration as seen |
| GET | `/api/v1/gamification/challenges` | Current week's challenges with progress |

### Integration Points (Existing Endpoints)

| Trigger Point | What Happens |
|---------------|-------------|
| `POST /webhooks/elevenlabs` (new call saved) | Check call-count achievements, update weekly challenge progress |
| Order saved (in webhook pipeline) | Check revenue achievements, update revenue challenge progress |
| `GET /calls/{id}/details` (call viewed) | Record `call_reviewed` event, check review achievements, update streak |
| Login (auth context) | Record `login` event, update login streak |
| Settings updated | Re-check setup completion percentage |
| Cron/scheduled (daily) | Check agent-active streak, generate weekly challenges on Monday |

---

## 6. Frontend Components

### New Components
1. **`GamificationProvider`** — Context that fetches and caches gamification state
2. **`AchievementToast`** — Subtle slide-in notification when a new achievement is unlocked (with confetti)
3. **`ProgressRing`** — Circular progress indicator for challenges
4. **`StreakBadge`** — Small flame/calendar icon with streak count (in TopBar)
5. **`AchievementCard`** — Individual badge card (locked/unlocked state)
6. **`ChallengeCard`** — Weekly challenge with progress bar
7. **`SetupProgress`** — Setup completion percentage bar
8. **`ConfettiOverlay`** — Lightweight confetti animation on milestones

### Page Changes
1. **Dashboard** — Add streaks in TopBar area, achievement highlights section, active challenges widget
2. **Sidebar** — Add small XP/level indicator near the bottom, streak flame icon
3. **Calls page** — Track when a call detail is opened (for review achievements)
4. **New "Achievements" page** — Full grid of all badges (earned + locked), streak history, challenge history

### Design Direction
- **Subtle, professional** — No garish colors. Uses the existing design system's palette
- Achievements use **muted tones** when locked (grayscale), **accent color glow** when unlocked
- Confetti is brief (2 seconds) and uses the app's primary accent colors
- Progress bars match existing UI patterns (rounded, thin, smooth animations)
- Streak indicators are small icon+number pairs, not loud

---

## 7. Implementation Phases

### Phase 1: Database + Backend Foundation
- [ ] Create migration SQL for all new tables
- [ ] Seed achievement definitions
- [ ] Create `gamification/` module (schemas, service, router)
- [ ] Implement achievement checking logic
- [ ] Implement streak tracking
- [ ] Wire into existing webhook/call-detail endpoints

### Phase 2: Frontend — Dashboard Widgets
- [ ] Create `GamificationProvider` context
- [ ] Build streak badges in TopBar
- [ ] Build achievement highlights on Dashboard
- [ ] Build weekly challenge cards on Dashboard
- [ ] Build setup completion progress bar

### Phase 3: Achievements Page + Celebrations
- [ ] Build full Achievements page with badge grid
- [ ] Build `AchievementToast` with confetti
- [ ] Add "Achievements" link to Sidebar
- [ ] Track call reviews on Calls page
- [ ] Polish animations and transitions

### Phase 4: Weekly Challenge Auto-Generation
- [ ] Implement challenge generation logic
- [ ] Add challenge completion celebrations
- [ ] Add challenge history view

---

## 8. XP / Level System (Lightweight)

| Action | XP Earned |
|--------|----------|
| Achieve Bronze badge | +50 XP |
| Achieve Silver badge | +100 XP |
| Achieve Gold badge | +250 XP |
| Achieve Platinum badge | +500 XP |
| Complete weekly challenge | +75 XP |
| Daily login streak (per day) | +10 XP |

### Levels
| Level | XP Required | Title |
|-------|------------|-------|
| 1 | 0 | Newcomer |
| 2 | 100 | Getting Started |
| 3 | 300 | Regular |
| 4 | 600 | Engaged |
| 5 | 1000 | Power User |
| 6 | 1500 | SKAI Pro |
| 7 | 2500 | Expert |
| 8 | 4000 | Master |
| 9 | 6000 | Legend |
| 10 | 10000 | SKAI Champion |

Level + XP shown as a small progress bar in the Sidebar footer.
