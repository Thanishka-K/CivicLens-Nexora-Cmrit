# CivicLens

Local full-stack demo: React/TypeScript frontend, FastAPI backend, and persistent SQLite data. The seeded records are synthetic and labeled in the UI/API.

## Run the backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

SQLite is initialized and seeded on startup at `backend/civiclens.db`. Set `DATABASE_URL` to use another SQLAlchemy-compatible database URL. CORS origins are configurable with `CORS_ORIGINS`.

## Run the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend reads `VITE_API_BASE_URL` and defaults to `http://127.0.0.1:8000`. Run `npm run typecheck` and `npm run build` from `frontend/` to validate it.

Citizen Connect submits reports and optional JPEG/PNG/WebP evidence through the API. Images are stored as files under `backend/uploads/` (not in complaint text); the SQLite record stores a generated media reference. Citizen tickets use random IDs and can be looked up from the tracking panel. This prototype stores no citizen name or contact details and does not yet provide account authentication.
