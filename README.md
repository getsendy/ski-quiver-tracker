# Ski Quiver Tracker

A small web app to **track ski days**, **boots used**, **snow/weather conditions**, and **maintenance** (wax, repair, edge tune) per ski. Data is stored in **MongoDB** via a **Node/Express** API.

## Stack

| Layer | Tech |
|--------|------|
| UI | React 19, TypeScript, Vite |
| API | Express 4, Mongoose 8 |
| DB | MongoDB (Atlas or local Community) |

## Features

- Register **skis** (brand, model, length) and **boots** (model, flex)
- Log **ski days** with resort and optional weather / snow / notes
- Log **service** entries per ski (wax, repair, edge)
- **Reminder-style summaries**: wax after N ski days, service check after N calendar days (stored in MongoDB)
- Edit/delete usage and maintenance logs from the UI

MongoDB collection names are explicit for easier browsing in Atlas: `ski_quiver_skis`, `ski_quiver_boots`, `ski_quiver_day_logs`, `ski_quiver_maintenance_logs`, `ski_quiver_settings`.

## Prerequisites

- **Node.js** 18+ (with `npm`)
- **MongoDB** reachable from your machine — e.g. [MongoDB Atlas](https://www.mongodb.com/atlas) or [MongoDB Community](https://www.mongodb.com/try/download/community) on `localhost`

## Setup

```bash
git clone <your-repo-url>
cd ski-quiver-tracker
npm install
npm install --prefix server
```

### Environment

```bash
cp server/.env.example server/.env
```

Edit **`server/.env`**:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Connection string. Include the **database name** in the path, e.g. `…mongodb.net/ski_quiver?…` or `mongodb://127.0.0.1:27017/ski-quiver-tracker` |
| `PORT` | API port (default **8787**) |

Restart the API after any change to `.env`.

**Atlas tips:** Allow your IP under **Network Access**. Put credentials in the URI; URL-encode special characters in the password.

## Run locally

Always run commands from the **`ski-quiver-tracker`** project root (where this `README` lives).

### API + UI together

```bash
npm run dev:full
```

- **UI:** Vite prints a **Local** URL (often `http://localhost:5173`; another port if that one is busy).
- **API:** `http://localhost:8787` — Vite proxies `/api` to the API in development.

### Run separately

```bash
npm run dev          # frontend only
npm run dev:server   # backend only (loads server/.env)
```

### Production build (frontend static assets)

```bash
npm run build
npm run preview      # optional local preview of dist/
```

Serve **`dist/`** with any static host and point **`VITE_API_URL`** at your deployed API origin if the UI is not same-origin (see below).

### Production API

```bash
cd server && npm start
```

Use `PORT` and `MONGODB_URI` from the environment (e.g. on Fly.io, Render, Railway).

### Frontend env for deployed UI

If the React app is hosted separately from the API, set at build time:

```bash
VITE_API_URL=https://your-api.example.com npm run build
```

Leave unset for local dev (requests use relative `/api` through the Vite proxy).

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/` | Short JSON describing the API |
| GET | `/api/bootstrap` | Full payload for the UI (skis, boots, logs, reminders) |
| POST/PATCH/DELETE | `/api/skis`, `/api/boots`, `/api/usage-logs`, `/api/service-logs`, `/api/settings` | CRUD used by the web app |

## Troubleshooting

- **`ENOENT` / could not read `package.json`:** run `cd` into **`ski-quiver-tracker`** before `npm run …`.
- **UI shows API error:** ensure **`npm run dev:server`** is running and **`MONGODB_URI`** is correct; check the API terminal for Mongoose errors.
- **Port in use:** stop other dev servers or change **`PORT`** in `server/.env`.

## License

Open source under the MIT License. 
