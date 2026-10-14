# CodeJudge

Practice DSA against a real judge. React (Vite) frontend + Express/MongoDB backend.

## Run it locally (one command)

**Needs:** Node.js 18.18+ (20 or 22 recommended).
For C++ and Java submissions you also need `g++` and a JDK on your machine. JavaScript always works.

```bash
npm run setup     # installs root, backend and frontend dependencies
npm run dev       # starts the API on :4000 and the web app on :5173
```

Open **http://localhost:5173**.

No `.env` is required. On first start the backend:

- starts an **embedded MongoDB** (downloaded once, ~100 MB; data kept in `backend/.data/`)
- seeds **12 sample problems** with tested starter code and reference solutions in C++, Java and JavaScript
- creates a **demo admin**: `admin@codejudge.dev` / `Admin@1234`
- runs submitted code **on your machine** with node / g++ / javac, so Run and Submit work without a Judge0 key

Sign up for a normal account, or log in as the admin to add, edit and delete problems.

> The local runner executes submitted code directly on your computer. It's meant for local practice.
> For anything public, set `JUDGE0_KEY` (or a self-hosted `JUDGE0_URL`).

## Optional configuration — `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in only what you need:

| Feature | Variables |
|---|---|
| Your own MongoDB instead of the embedded one | `DB_CONNECT_STRING` (local or Atlas) |
| Code execution on Judge0 | `JUDGE0_KEY` (RapidAPI) or `JUDGE0_URL` |
| AI tutor | any of `GROQ_API_KEY`, `GEMINI_KEY`, `OPENROUTER_API_KEY` |
| Video editorials | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Logout blocklist in production | `REDIS_URL` |
| Production secret | `JWT_KEY` (required when `NODE_ENV=production`) |

Restart `npm run dev` after editing `.env`. The admin Overview page shows what's configured.

## Useful commands

```bash
npm run seed                                   # re-add any missing sample problems
npm run make-admin -- you@example.com          # promote an existing account to admin
npm run make-admin -- new@example.com "Pass@1234" Name   # create an admin
```

## Features

- Problem list with search, difficulty / topic / status filters, progress and acceptance rates
- Workspace with resizable panes, Monaco editor (bundled, works offline), auto-saved drafts per problem and language
- Run against examples (your output vs expected per case) and Submit against hidden tests, with a per-test verdict grid
- Reference solutions unlock after you solve a problem
- Socratic AI tutor that sees the problem and your current code
- Profile with activity heatmap, streak, recent submissions and solved list
- Admin: create / edit problems (reference solutions are verified on every test before saving), delete, upload video editorials
- Light (graph paper) and dark (blueprint) themes

## Troubleshooting

- **"Can't reach the server"** — the backend isn't running on port 4000. Check the `[api]` lines in the terminal.
- **Embedded MongoDB download fails** (offline / firewall) — install MongoDB Community or use a free Atlas cluster, then set `DB_CONNECT_STRING` in `backend/.env`.
- **C++ or Java shows "not installed"** — install `g++` (MinGW-w64 on Windows, `build-essential` on Linux, Xcode tools on macOS) or a JDK 17+, make sure it's on your PATH, then restart.
- **Port in use** — change `PORT` in `backend/.env`; if you change it, start the frontend with `API_TARGET=http://localhost:<port>`.

## Running the two apps separately

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Deploying (Render + Vercel)

Backend: set `NODE_ENV=production`, `JWT_KEY`, `DB_CONNECT_STRING`, `CLIENT_URL=https://your-frontend.vercel.app` and a Judge0 key.
Frontend: set `VITE_API_BASE_URL` to the backend URL.
