import os

# This script automatically generates the folder structure and core files for SkyGuard AI.

print("Starting SkyGuard AI Project Generation...")

# 1. Define the folder structure based on the PRD
folders = [
    "backend/app/api/v1",
    "backend/app/models",
    "backend/app/workers",
    "backend/scripts",
    "dashboard/src/components",
    "ml/models",
    "edge/main",
    "data/raw",
    "docker",
]

# 2. Define the exact files and their contents
files = {
    # --- INFRASTRUCTURE ---
    "docker-compose.yml": """version: '3.8'
services:
  postgres:
    image: timescale/timescaledb-ha:pg15
    environment:
      - POSTGRES_USER=skyguard
      - POSTGRES_PASSWORD=skyguard_pass
      - POSTGRES_DB=skyguard
    ports:
      - "5432:5432"
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  emqx:
    image: emqx/emqx:5.3.0
    ports:
      - "1883:1883"
      - "8083:8083"
""",
    
    # --- BACKEND ---
    "backend/requirements.txt": """fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
sqlalchemy>=2.0.25
psycopg2-binary>=2.9.9
redis>=5.0.1
paho-mqtt>=1.6.1
""",
    
    "backend/app/main.py": """from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SkyGuard AI API", version="2.0")

class Observation(BaseModel):
    station_id: str
    temperature: float
    pressure: float
    humidity: float

@app.get("/")
def read_root():
    return {"status": "SkyGuard AI Backend is Online"}

@app.post("/api/v1/observations")
def ingest_observation(obs: Observation):
    # In a full run, this pushes to Kafka. For now, it returns success.
    return {"status": "success", "data": obs}
""",

    "backend/scripts/simulate_stream.py": """import time
import random
import json

print("Starting SkyGuard AI Stream Simulator...")
stations = ["AWS-DEL-01", "AWS-MUM-02", "AWS-BLR-03"]

try:
    while True:
        for station in stations:
            data = {
                "station_id": station,
                "temperature": round(random.uniform(25.0, 35.0), 1),
                "pressure": round(random.uniform(1000.0, 1015.0), 1),
                "humidity": round(random.uniform(50.0, 80.0), 1)
            }
            print(f"Emitting: {json.dumps(data)}")
        time.sleep(2)
except KeyboardInterrupt:
    print("Simulation stopped.")
""",

    # --- FRONTEND DASHBOARD ---
    "dashboard/package.json": """{
  "name": "skyguard-dashboard",
  "version": "1.0.0",
  "scripts": {
    "dev": "react-scripts start",
    "build": "react-scripts build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "lucide-react": "^0.300.0"
  }
}""",

    "dashboard/src/App.jsx": """import React, { useState, useEffect } from 'react';

export default function App() {
  const [health, setHealth] = useState("100%");

  return (
    <div style={{ backgroundColor: "#070D17", color: "#EAF0FA", minHeight: "100vh", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #28374C", paddingBottom: "15px" }}>
        <h1>SkyGuard AI Dashboard</h1>
        <div style={{ color: "#2FAE66", fontWeight: "bold" }}>Network Health: {health}</div>
      </header>
      
      <main style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div style={{ backgroundColor: "#101A2B", padding: "20px", borderRadius: "12px" }}>
          <h2>Live Alerts</h2>
          <p style={{ color: "#5B6B7C" }}>Waiting for telemetry anomalies...</p>
        </div>
        
        <div style={{ backgroundColor: "#101A2B", padding: "20px", borderRadius: "12px" }}>
          <h2>System Status</h2>
          <ul>
            <li>API: Online</li>
            <li>Database: TimescaleDB Ready</li>
            <li>ML Models: Isolation Forest Loaded</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
""",
    
    # --- DOCUMENTATION ---
    "README_LOCAL.md": """# SkyGuard AI - Local Setup
    
1. Run `docker-compose up -d` in this folder to start the databases.
2. Open a terminal in `/backend`, run `pip install -r requirements.txt`, then `uvicorn app.main:app --reload`
3. Open a terminal in `/dashboard`, run `npm install`, then `npm run dev`
4. Open a terminal in `/backend` and run `python scripts/simulate_stream.py` to see data flow!
"""
}

# 3. Execute the creation
for folder in folders:
    os.makedirs(folder, exist_ok=True)
    print(f"Created folder: {folder}")

for filepath, content in files.items():
    # Ensure the parent directory of the file exists
    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created file: {filepath}")

print("\n✅ Success! The SkyGuard AI project has been fully generated in this directory.")
print("Read the 'README_LOCAL.md' file that was just created to start the servers!")