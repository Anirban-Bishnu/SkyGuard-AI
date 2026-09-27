# SkyGuard AI - Local Setup
    
1. Run `docker-compose up -d` in this folder to start the databases.
2. Open a terminal in `/backend`, run `pip install -r requirements.txt`, then `uvicorn app.main:app --reload`
3. Open a terminal in `/dashboard`, run `npm install`, then `npm run dev`
4. Open a terminal in `/backend` and run `python scripts/simulate_stream.py` to see data flow!
