# 🗺️ FlowMap – Visual Automation Orchestrator for monday.com

> Visualize your monday.com automation chains as interactive, color-coded flow diagrams — across multiple boards.

---

## 📁 Project Structure

```
flowmap/
├── public/
│   └── index.html              # App shell
├── src/
│   ├── api/
│   │   └── monday.js           # All monday.com GraphQL queries
│   ├── components/
│   │   ├── FlowCanvas.jsx      # React Flow visualization canvas
│   │   ├── FlowNodes.jsx       # Custom node types (Board, Trigger, Condition, Action)
│   │   ├── Header.jsx          # Top navigation bar
│   │   ├── LoginScreen.jsx     # OAuth login screen
│   │   └── Sidebar.jsx         # Board selector + conflict panel
│   ├── utils/
│   │   ├── flowBuilder.js      # Converts board data → React Flow nodes/edges
│   │   └── store.js            # Zustand global state
│   ├── App.jsx                 # Root component
│   └── index.js                # Entry point
├── server/
│   └── index.js                # Express backend (OAuth + API proxy)
├── mapps.config.json           # monday.com App manifest
├── package.json
├── .env.example                # Environment variables template
└── README.md
```

---

## 🚀 Step-by-Step Setup

### STEP 1 — Prerequisites (install these first)

```bash
# Check Node.js version (need 18+)
node --version

# If not installed: https://nodejs.org

# Install monday Apps CLI globally
npm install -g @mondaycom/apps-cli

# Verify
mapps --version
```

---

### STEP 2 — Create monday.com Developer Account

1. Go to your monday.com account
2. Click your **Avatar** (top right) → **Developers**
3. Click **"Create app"**
4. Name it: **FlowMap**
5. Note down:
   - `App ID`
   - `Client ID`
   - `Client Secret`

---

### STEP 3 — Configure OAuth in monday Developer Center

1. In your app → **OAuth** tab
2. Set **Redirect URI** to: `http://localhost:3001/auth/callback`
3. Add **Scopes**:
   - `boards:read`
   - `me:read`
   - `workspaces:read`
   - `account:read`
4. Save

---

### STEP 4 — Add App Features

In Developer Center → **Features** tab:

**Feature 1: Board View**
- Type: `Board View`
- Name: `FlowMap View`
- URL: `http://localhost:3000` (dev) / your deployed URL (prod)

**Feature 2: Dashboard Widget**
- Type: `Dashboard Widget`
- Name: `FlowMap Widget`
- URL: `http://localhost:3000/widget`

---

### STEP 5 — Configure Environment

```bash
# In the flowmap/ folder:
cp .env.example .env
```

Edit `.env`:
```
REACT_APP_MONDAY_CLIENT_ID=paste_your_client_id
MONDAY_CLIENT_SECRET=paste_your_client_secret
REACT_APP_MONDAY_APP_ID=paste_your_app_id
PORT=3001
REACT_APP_BACKEND_URL=http://localhost:3001
REDIRECT_URI=http://localhost:3001/auth/callback
```

---

### STEP 6 — Install Dependencies

```bash
# In the flowmap/ folder:
npm install
```

---

### STEP 7 — Run Locally

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
npm run server
# → Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
npm start
# → App running on http://localhost:3000
```

Open http://localhost:3000 in your browser.

---

### STEP 8 — Set Up tunnel for monday.com to reach localhost

```bash
# Terminal 3:
mapps tunnel:create
# This gives you a public HTTPS URL like: https://abc123.tunnel.monday.app
```

Update in Developer Center:
- Board View URL → `https://abc123.tunnel.monday.app`
- Dashboard Widget URL → `https://abc123.tunnel.monday.app/widget`

Also update your `.env`:
```
REDIRECT_URI=https://abc123.tunnel.monday.app/auth/callback
```

---

### STEP 9 — Test in monday.com

1. Go to any board → **Views** → **Add View** → Search for **FlowMap**
2. Or go to a **Dashboard** → **Add Widget** → **FlowMap Widget**
3. Click **Connect with monday.com** → Authorize
4. Select boards → Click **Visualize**

---

## 🧪 Testing Checklist

- [ ] Server starts on port 3001
- [ ] Frontend loads at localhost:3000
- [ ] OAuth flow works (redirects + comes back with token)
- [ ] Boards load in the sidebar
- [ ] Selecting boards and clicking Visualize generates the flow
- [ ] Nodes are clickable
- [ ] Minimap appears bottom-right
- [ ] Warnings appear in the Warnings tab

---

## 🚢 Deploying to Production

### Recommended: Vercel (frontend) + Railway (backend)

**Frontend (Vercel):**
```bash
npm install -g vercel
cd flowmap
vercel
# Follow prompts, set env vars in Vercel dashboard
```

**Backend (Railway):**
1. Push to GitHub
2. Create Railway project → Deploy from GitHub
3. Set environment variables in Railway dashboard
4. Get your Railway URL (e.g. `https://flowmap-backend.railway.app`)

**Update monday.com Developer Center:**
- OAuth Redirect URI → `https://flowmap-backend.railway.app/auth/callback`
- Board View URL → `https://your-app.vercel.app`

---

## 💰 Monetization

Plans are gated in `src/utils/store.js`:

```js
plan: 'free'  // Change to 'pro' or 'business' for testing
```

| Plan     | Boards | Conflicts | Export | Price     |
|----------|--------|-----------|--------|-----------|
| Free     | 1      | ❌        | ❌     | $0        |
| Pro      | ∞      | ✅        | ✅     | $8/seat/mo|
| Business | ∞      | ✅        | ✅+    | $15/seat/mo|

Enable monetization in monday Developer Center → **Monetization** tab.

---

## 📋 Marketplace Submission Checklist

- [ ] App works end-to-end
- [ ] Privacy Policy URL set
- [ ] Terms of Service URL set
- [ ] 3+ screenshots uploaded
- [ ] Demo video recorded (60–90 sec)
- [ ] App Review submitted in Developer Center

---

## 🛠️ Key Technologies

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Flow (reactflow) | Flow diagram canvas |
| Zustand | Global state management |
| Dagre | Auto-layout algorithm |
| Express.js | OAuth backend |
| monday SDK | monday.com integration |
| DM Sans | Typography |

---

## 📞 Support

- monday Developer Docs: https://developer.monday.com
- React Flow Docs: https://reactflow.dev
- Community: https://community.monday.com
