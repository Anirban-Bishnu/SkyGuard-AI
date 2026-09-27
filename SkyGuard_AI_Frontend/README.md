# SkyGuard AI — Command Center

Professional React frontend for the existing SkyGuard AI FastAPI backend.

## Run

1. Start the existing backend:

```cmd
cd /d J:\SkyGuard_Project\backend
python -m uvicorn app.main:app --reload
```

2. In a second CMD window:

```cmd
cd /d J:\SkyGuard_Project\dashboard
npm install
npm run dev
```

If you extracted this package elsewhere, use that folder instead of `J:\SkyGuard_Project\dashboard`.

## API configuration

Create `.env` from `.env.example` if required. Default API URL is `http://127.0.0.1:8000`.

The frontend consumes:
- GET /api/v1/stations/status
- GET /api/v1/observations
- GET /api/v1/observations/history
- GET /api/v1/alerts
- POST /api/v1/observations

## Modes

`VITE_DATA_MODE=live` is the normal mode. The UI will use the FastAPI backend and clearly show connection status.

`VITE_DATA_MODE=demo` enables deterministic local demonstration data for presentation/testing. It is not presented as measured model accuracy.


Map tiles use OpenStreetMap in both themes; dark mode applies a visual filter to keep the map visible and avoid reliance on a separate dark-tile provider.
