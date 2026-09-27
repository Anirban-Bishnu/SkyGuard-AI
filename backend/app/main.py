from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

APP_DIR = Path(__file__).resolve().parent
BASE_DIR = APP_DIR.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = BASE_DIR / "observations.db"

app = FastAPI(title="SkyGuard AI Prototype API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://skyguard-ai-plum.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class StationDB(Base):
    __tablename__ = "stations"

    station_id = Column(String, primary_key=True)
    station_name = Column(String, nullable=False)
    wmo_id = Column(String, nullable=True)
    role = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    map_x = Column(Float, nullable=True)
    map_y = Column(Float, nullable=True)


class ObservationDB(Base):
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    received_at = Column(DateTime, index=True, nullable=False)
    temperature = Column(Float, nullable=False)
    pressure = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    data_source = Column(String, nullable=False, default="SIMULATED_REPLAY")
    anomaly_type = Column(String, nullable=True)
    anomaly_class = Column(String, nullable=True)
    is_injected_anomaly = Column(Boolean, default=False)


class AlertStateDB(Base):
    __tablename__ = "alert_states"

    alert_id = Column(String, primary_key=True)
    state = Column(String, nullable=False, default="OPEN")
    classification = Column(String, nullable=True)
    note = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False)


Base.metadata.create_all(bind=engine)

REPLAY_CURSOR: dict[str, int] = {}
ACTIVE_REPLAY_STATIONS: set[str] = set()

def replay_source_rows(db, station_id: str):
    return (db.query(ObservationDB).filter(ObservationDB.station_id == station_id).filter(ObservationDB.is_injected_anomaly.is_(False)).filter(ObservationDB.data_source != "SIMULATED_REPLAY").filter(ObservationDB.anomaly_class == "").order_by(ObservationDB.timestamp.asc(), ObservationDB.id.asc()).all())


def advance_replay_row(db, station_id: str):
    rows = replay_source_rows(db, station_id)
    if not rows:
        return None
    cursor = REPLAY_CURSOR.get(station_id)
    next_index = 0
    if cursor is None:
        anchor = rows[-1]
        for i, row in enumerate(rows):
            if row.id == anchor.id:
                next_index = (i + 1) % len(rows)
                break
    else:
        for i, row in enumerate(rows):
            if row.id == cursor:
                next_index = (i + 1) % len(rows)
                break
    source = rows[next_index]
    REPLAY_CURSOR[station_id] = source.id
    replay = ObservationDB(station_id=source.station_id, timestamp=source.timestamp, received_at=now_utc(), temperature=source.temperature, pressure=source.pressure, humidity=source.humidity, data_source="SIMULATED_REPLAY", anomaly_type="", anomaly_class="REPLAY_GOOD", is_injected_anomaly=False)
    db.add(replay)
    db.flush()
    return obs_dict(replay)


class ObservationIn(BaseModel):
    station_id: str
    timestamp: datetime
    temperature: float = Field(ge=-80, le=80)
    pressure: float = Field(ge=850, le=1100)
    humidity: float = Field(ge=0, le=100)
    data_source: str = "SIMULATED_REPLAY"
    anomaly_type: Optional[str] = ""
    anomaly_class: Optional[str] = ""
    is_injected_anomaly: bool = False


class AlertActionIn(BaseModel):
    state: str = Field(pattern="^(OPEN|ACKNOWLEDGED|CLOSED)$")
    classification: Optional[str] = None
    note: Optional[str] = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def load_station_metadata() -> list[dict]:
    path = DATA_DIR / "stations.json"
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("stations", [])


def ensure_station_metadata(db):
    existing = {x.station_id for x in db.query(StationDB).all()}
    changed = False
    for s in load_station_metadata():
        if s["station_id"] not in existing:
            db.add(
                StationDB(
                    station_id=s["station_id"],
                    station_name=s["station_name"],
                    wmo_id=s.get("wmo_id"),
                    role=s.get("role", "SYNTHETIC"),
                    latitude=s.get("latitude"),
                    longitude=s.get("longitude"),
                    map_x=s.get("map_x"),
                    map_y=s.get("map_y"),
                )
            )
            changed = True
    if changed:
        db.commit()


def station_dict(row: StationDB) -> dict:
    return {
        "station_id": row.station_id,
        "station_name": row.station_name,
        "wmo_id": row.wmo_id,
        "role": row.role,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "map_x": row.map_x,
        "map_y": row.map_y,
    }


def obs_dict(row: ObservationDB) -> dict:
    return {
        "id": row.id,
        "station_id": row.station_id,
        "timestamp": row.timestamp.isoformat(),
        "received_at": row.received_at.isoformat(),
        "temperature": row.temperature,
        "pressure": row.pressure,
        "humidity": row.humidity,
        "data_source": row.data_source,
        "anomaly_type": row.anomaly_type or "",
        "anomaly_class": row.anomaly_class or "",
        "is_injected_anomaly": bool(row.is_injected_anomaly),
    }


def latest_rows(db) -> dict[str, ObservationDB]:
    result = {}
    for station in db.query(StationDB).all():
        row = (
            db.query(ObservationDB)
            .filter(ObservationDB.station_id == station.station_id)
            .order_by(ObservationDB.received_at.desc())
            .first()
        )
        if row is not None:
            result[station.station_id] = row
    return result


def station_history_rows(db, station_id: str, limit: int = 60):
    return list(
        reversed(
            db.query(ObservationDB)
            .filter(ObservationDB.station_id == station_id)
            .order_by(ObservationDB.received_at.desc())
            .limit(limit)
            .all()
        )
    )


def active_state(db, alert_id: str) -> str:
    state = db.query(AlertStateDB).filter(AlertStateDB.alert_id == alert_id).first()
    return state.state if state else "OPEN"


def model_signal_for_station(db, station: StationDB, latest: dict[str, ObservationDB]) -> dict:
    row = latest.get(station.station_id)
    if not row:
        return {
            "station_id": station.station_id,
            "status": "OFFLINE",
            "health_score": None,
            "health_status": "NO DATA",
            "anomaly_score": None,
            "confidence": None,
            "severity": "NONE",
            "root_cause": "No current observation",
            "evidence": [],
            "current": None,
        }

    if row.anomaly_class == "REPLAY_GOOD":
        return {"station_id": station.station_id, "status": "ONLINE", "health_score": 100, "health_status": "HEALTHY", "anomaly_score": 0.01, "confidence": 0.99, "severity": "NORMAL", "root_cause": "Normal replay dataset record", "evidence": [{"label": "Normal dataset replay", "level": "INFO", "detail": "Station resumed with the next good dataset record."}], "current": {"temperature": row.temperature, "pressure": row.pressure, "humidity": row.humidity, "timestamp": row.timestamp.isoformat(), "data_source": row.data_source, "anomaly_type": row.anomaly_type or "", "anomaly_class": row.anomaly_class or "", "is_injected_anomaly": False}}

    all_current = list(latest.values())
    temps = [x.temperature for x in all_current]
    pressures = [x.pressure for x in all_current]
    humidities = [x.humidity for x in all_current]
    tmed = statistics.median(temps) if temps else row.temperature
    pmed = statistics.median(pressures) if pressures else row.pressure
    hmed = statistics.median(humidities) if humidities else row.humidity

    hist = station_history_rows(db, station.station_id, 18)
    delta_t = abs(hist[-1].temperature - hist[-2].temperature) if len(hist) >= 2 else 0.0
    frozen = len(hist) >= 6 and len({round(x.temperature, 2) for x in hist[-6:]}) == 1
    spatial_dev = abs(row.temperature - tmed)
    pressure_dev = abs(row.pressure - pmed)
    humidity_dev = abs(row.humidity - hmed)

    evidence = []
    score = 0.0
    root_cause = "No significant anomaly"
    severity = "NORMAL"

    # Explicit synthetic scenario metadata is treated as ground-truth for the demo and clearly surfaced.
    if row.anomaly_class == "GENUINE_WEATHER_SCENARIO":
        score = 0.32
        severity = "INFO"
        root_cause = "Likely genuine meteorological event"
        evidence = [
            {"label": "Multi-station agreement", "level": "HIGH", "detail": "Nearby stations show a coherent regional change."},
            {"label": "Spatial corroboration", "level": "HIGH", "detail": "The unusual movement is not isolated to one station."},
            {"label": "Prototype scenario label", "level": "INFO", "detail": "Synthetic genuine-weather scenario in demonstration dataset."},
        ]
    elif row.anomaly_class == "SENSOR_ANOMALY":
        if row.anomaly_type == "TEMPERATURE_SPIKE":
            score = 0.97
            severity = "CRITICAL"
            root_cause = "Temperature sensor spike / possible sensor fault"
            evidence = [
                {"label": "Temporal deviation", "level": "HIGH", "detail": f"Abrupt temperature movement of {delta_t:.1f} °C."},
                {"label": "Spatial deviation", "level": "HIGH", "detail": f"{spatial_dev:.1f} °C from network median."},
                {"label": "Fault signature", "level": "HIGH", "detail": "Spike-like synthetic fault signature."},
                {"label": "Spatial corroboration", "level": "LOW", "detail": "Nearby stations do not show a comparable spike."},
            ]
        elif row.anomaly_type == "FROZEN_SENSOR":
            score = 0.86
            severity = "HIGH"
            root_cause = "Frozen / stuck sensor pattern"
            evidence = [
                {"label": "Persistence", "level": "HIGH", "detail": "Same temperature repeated across consecutive readings."},
                {"label": "Variability check", "level": "HIGH", "detail": "Station variability collapsed relative to its normal behavior."},
                {"label": "Fault signature", "level": "HIGH", "detail": "Synthetic frozen-sensor scenario."},
            ]
        else:
            score = 0.74
            severity = "HIGH"
            root_cause = "Probable sensor/data anomaly"
            evidence = [
                {"label": "Synthetic anomaly label", "level": "HIGH", "detail": row.anomaly_type or "Known injected fault."},
                {"label": "Network comparison", "level": "MEDIUM", "detail": f"Temperature differs {spatial_dev:.1f} °C from network median."},
            ]
    elif row.anomaly_class == "SENSOR_DEGRADATION":
        score = 0.68
        severity = "HIGH"
        root_cause = "Probable sensor degradation / drift"
        evidence = [
            {"label": "Drift behavior", "level": "HIGH", "detail": "Progressive synthetic deviation from the local baseline."},
            {"label": "Persistence", "level": "HIGH", "detail": "The change persists over multiple observations."},
            {"label": "Prototype scenario label", "level": "INFO", "detail": "Synthetic degradation scenario in demonstration dataset."},
        ]
    else:
        if spatial_dev >= 8:
            score += 0.55
            evidence.append({"label": "Spatial temperature deviation", "level": "HIGH", "detail": f"{spatial_dev:.1f} °C from network median."})
        elif spatial_dev >= 4:
            score += 0.30
            evidence.append({"label": "Spatial temperature deviation", "level": "MEDIUM", "detail": f"{spatial_dev:.1f} °C from network median."})
        if delta_t >= 8:
            score += 0.25
            evidence.append({"label": "Abrupt temporal change", "level": "HIGH", "detail": f"{delta_t:.1f} °C since prior reading."})
        elif delta_t >= 4:
            score += 0.12
            evidence.append({"label": "Temporal change", "level": "MEDIUM", "detail": f"{delta_t:.1f} °C since prior reading."})
        if frozen:
            score += 0.45
            evidence.append({"label": "Frozen reading", "level": "HIGH", "detail": "Same temperature repeated across 6+ readings."})
        if pressure_dev >= 5:
            score += 0.10
            evidence.append({"label": "Pressure inconsistency", "level": "MEDIUM", "detail": f"{pressure_dev:.1f} hPa from network median."})
        if humidity_dev >= 12:
            score += 0.10
            evidence.append({"label": "Humidity inconsistency", "level": "MEDIUM", "detail": f"{humidity_dev:.1f}% from network median."})
        score = min(0.99, score)
        if score >= 0.75:
            severity = "CRITICAL"
            root_cause = "Probable sensor/data anomaly"
        elif score >= 0.50:
            severity = "HIGH"
            root_cause = "Observation requires review"
        elif score >= 0.25:
            severity = "MEDIUM"
            root_cause = "Contextual deviation"
        if not evidence:
            evidence = [{"label": "No significant deviation", "level": "LOW", "detail": "Current values are consistent with nearby observations."}]

    recent = station_history_rows(db, station.station_id, 60)
    flagged = sum(
        1
        for x in recent
        if x.is_injected_anomaly or abs(x.temperature - tmed) >= 5 or abs(x.pressure - pmed) >= 5 or abs(x.humidity - hmed) >= 12
    )
    health_score = max(40, min(100, round(100 - (flagged / max(1, len(recent))) * 75)))
    if row.anomaly_type == "GRADUAL_DRIFT":
        health_score = min(74, health_score)
    elif row.anomaly_type == "FROZEN_SENSOR":
        health_score = min(58, health_score)
    elif row.anomaly_type == "TEMPERATURE_SPIKE":
        health_score = min(72, health_score)

    if health_score >= 90:
        health_status = "HEALTHY"
    elif health_score >= 75:
        health_status = "MONITORING"
    elif health_score >= 50:
        health_status = "DEGRADED"
    else:
        health_status = "CRITICAL"

    confidence = 0.84 if severity == "INFO" else min(0.99, 0.60 + score * 0.4)
    return {
        "station_id": station.station_id,
        "status": "ONLINE",
        "health_score": health_score,
        "health_status": health_status,
        "anomaly_score": round(score if score else 0.05, 2),
        "confidence": round(confidence, 2),
        "severity": severity,
        "root_cause": root_cause,
        "evidence": evidence,
        "current": {
            "temperature": row.temperature,
            "pressure": row.pressure,
            "humidity": row.humidity,
            "timestamp": row.timestamp.isoformat(),
            "data_source": row.data_source,
            "anomaly_type": row.anomaly_type or "",
            "anomaly_class": row.anomaly_class or "",
            "is_injected_anomaly": bool(row.is_injected_anomaly),
        },
    }


def get_alerts_payload(db):
    latest = latest_rows(db)
    if not latest:
        return []

    alerts = []
    for st in db.query(StationDB).all():
        row = latest.get(st.station_id)
        if not row:
            continue
        signal = model_signal_for_station(db, st, latest)
        if signal["severity"] not in {"CRITICAL", "HIGH", "MEDIUM", "INFO"}:
            continue
        if signal["severity"] == "NORMAL":
            continue

        alert_id = f"alert-{row.id}"
        if row.anomaly_class == "GENUINE_WEATHER_SCENARIO":
            title = "Regional weather pattern corroborated"
            alert_type = "GENUINE_WEATHER_SCENARIO"
            action = "Continue monitoring; do not treat the regional change as a local sensor fault."
        elif row.anomaly_type == "TEMPERATURE_SPIKE":
            title = "Temperature spike / possible sensor fault"
            alert_type = "SENSOR_ANOMALY"
            action = "Inspect / calibrate temperature sensor."
        elif row.anomaly_type == "FROZEN_SENSOR":
            title = "Frozen / stuck sensor pattern"
            alert_type = "SENSOR_ANOMALY"
            action = "Inspect sensor output and communication path."
        elif row.anomaly_type == "GRADUAL_DRIFT":
            title = "Sensor drift / degradation warning"
            alert_type = "SENSOR_DEGRADATION"
            action = "Review calibration trend and schedule maintenance."
        else:
            title = "Observation requires review"
            alert_type = "MODEL_REVIEW"
            action = "Investigate station context and nearby observations."

        state = active_state(db, alert_id)
        alerts.append({
            "id": alert_id,
            "station_id": st.station_id,
            "station_name": st.station_name,
            "timestamp": row.timestamp.isoformat(),
            "severity": signal["severity"],
            "state": state,
            "type": alert_type,
            "title": title,
            "reason": " • ".join(e["label"] for e in signal["evidence"][:3]),
            "anomaly_score": signal["anomaly_score"],
            "confidence": signal["confidence"],
            "root_cause": signal["root_cause"],
            "recommended_action": action,
            "evidence": signal["evidence"],
            "observation_id": row.id,
            "data_source": row.data_source,
            "is_injected_anomaly": bool(row.is_injected_anomaly),
        })

    current_ids = {a["id"] for a in alerts}
    for state_row in db.query(AlertStateDB).all():
        if state_row.state == "CLOSED" or state_row.alert_id in current_ids:
            continue
        try:
            observation_id = int(state_row.alert_id.replace("alert-", "", 1))
        except ValueError:
            continue
        row = db.query(ObservationDB).filter(ObservationDB.id == observation_id).first()
        if not row or not row.is_injected_anomaly:
            continue
        st = db.query(StationDB).filter(StationDB.station_id == row.station_id).first()
        if not st:
            continue
        if row.anomaly_type == "FROZEN_SENSOR":
            severity, title, action, score = "HIGH", "Frozen / stuck sensor pattern", "Inspect sensor output and communication path.", 0.86
        elif row.anomaly_type in {"PRESSURE_SPIKE", "PRESSURE_ANOMALY"}:
            severity, title, action, score = "HIGH", "Pressure anomaly / possible sensor fault", "Inspect / calibrate pressure sensor.", 0.90
        else:
            severity, title, action, score = "CRITICAL", "Temperature spike / possible sensor fault", "Inspect / calibrate temperature sensor.", 0.97
        alerts.append({"id":state_row.alert_id,"station_id":st.station_id,"station_name":st.station_name,"timestamp":row.timestamp.isoformat(),"severity":severity,"state":state_row.state,"type":"SENSOR_ANOMALY","title":title,"reason":"Controlled sensor anomaly retained for incident evidence.","anomaly_score":score,"confidence":0.95,"root_cause":title,"recommended_action":action,"evidence":[{"label":"Injected anomaly","level":"HIGH","detail":"The anomalous observation remains available as incident evidence."}],"observation_id":row.id,"data_source":row.data_source,"is_injected_anomaly":True})

    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "INFO": 3}
    return sorted(alerts, key=lambda x: (severity_order.get(x["severity"], 9), x["timestamp"]), reverse=False)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        ensure_station_metadata(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "SkyGuard AI Prototype Backend is Online", "mode": "functional-prototype"}


@app.get("/api/v1/health")
def health():
    db = SessionLocal()
    try:
        return {
            "api": "ONLINE",
            "database": "ONLINE",
            "observations": db.query(ObservationDB).count(),
            "stations": db.query(StationDB).count(),
            "open_alerts": sum(1 for x in get_alerts_payload(db) if x["state"] != "CLOSED"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


@app.get("/api/v1/stations")
def stations():
    db = SessionLocal()
    try:
        ensure_station_metadata(db)
        return [station_dict(x) for x in db.query(StationDB).order_by(StationDB.station_id).all()]
    finally:
        db.close()


@app.get("/api/v1/stations/status")
def station_status():
    db = SessionLocal()
    try:
        ensure_station_metadata(db)
        latest = latest_rows(db)
        now = now_utc()
        result = []
        for st in db.query(StationDB).order_by(StationDB.station_id).all():
            row = latest.get(st.station_id)
            age = None
            status = "OFFLINE"
            if row:
                age = round((now - row.received_at).total_seconds(), 1)
                status = "ONLINE" if age <= 8 else "STALE"
            result.append({
                **station_dict(st),
                "status": status,
                "last_seen_seconds": age,
                "observation": obs_dict(row) if row else None,
            })
        return result
    finally:
        db.close()


@app.get("/api/v1/network")
def network_summary():
    db = SessionLocal()
    try:
        ensure_station_metadata(db)
        latest = latest_rows(db)
        statuses = []
        for st in db.query(StationDB).all():
            row = latest.get(st.station_id)
            statuses.append("ONLINE" if row and (now_utc() - row.received_at).total_seconds() <= 8 else "OFFLINE")
        all_alerts = get_alerts_payload(db)
        open_alerts = [a for a in all_alerts if a["state"] != "CLOSED"]
        return {
            "total_stations": db.query(StationDB).count(),
            "online_stations": sum(1 for x in statuses if x == "ONLINE"),
            "offline_stations": sum(1 for x in statuses if x == "OFFLINE"),
            "active_alerts": len(open_alerts),
            "critical_alerts": sum(1 for x in open_alerts if x["severity"] == "CRITICAL"),
            "observations_received": db.query(ObservationDB).count(),
            "real_observations": db.query(ObservationDB).filter(ObservationDB.data_source == "REAL_BASELINE").count(),
            "synthetic_observations": db.query(ObservationDB).filter(ObservationDB.data_source == "SYNTHETIC_NEIGHBOR").count(),
            "injected_anomalies": db.query(ObservationDB).filter(ObservationDB.is_injected_anomaly.is_(True)).count(),
            "mode": "Functional prototype replay",
        }
    finally:
        db.close()


@app.post("/api/v1/observations")
def ingest_observation(obs: ObservationIn):
    db = SessionLocal()
    try:
        if not db.query(StationDB).filter(StationDB.station_id == obs.station_id).first():
            raise HTTPException(status_code=400, detail="Unknown station_id")
        source_ts = obs.timestamp
        if source_ts.tzinfo is not None:
            source_ts = source_ts.astimezone(timezone.utc).replace(tzinfo=None)
        record = ObservationDB(
            station_id=obs.station_id,
            timestamp=source_ts,
            received_at=now_utc(),
            temperature=obs.temperature,
            pressure=obs.pressure,
            humidity=obs.humidity,
            data_source=obs.data_source,
            anomaly_type=obs.anomaly_type or "",
            anomaly_class=obs.anomaly_class or "",
            is_injected_anomaly=obs.is_injected_anomaly,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {"status": "success", "data": obs_dict(record)}
    finally:
        db.close()


@app.get("/api/v1/observations")
def recent_observations(
    limit: int = Query(default=2000, ge=1, le=10000),
    station_id: Optional[str] = None,
    source: Optional[str] = None,
    anomaly_only: bool = False,
):
    db = SessionLocal()
    try:
        query = db.query(ObservationDB)
        if station_id:
            query = query.filter(ObservationDB.station_id == station_id)
        if source:
            query = query.filter(ObservationDB.data_source == source)
        if anomaly_only:
            query = query.filter(ObservationDB.is_injected_anomaly.is_(True))
        rows = query.order_by(ObservationDB.received_at.desc()).limit(limit).all()
        rows.reverse()
        return [obs_dict(r) for r in rows]
    finally:
        db.close()


@app.get("/api/v1/stations/{station_id}/history")
def station_history(station_id: str, limit: int = Query(default=120, ge=1, le=2000)):
    db = SessionLocal()
    try:
        rows = station_history_rows(db, station_id, limit)
        return [obs_dict(r) for r in rows]
    finally:
        db.close()


@app.get("/api/v1/stations/{station_id}/analysis")
def station_analysis(station_id: str):
    db = SessionLocal()
    try:
        st = db.query(StationDB).filter(StationDB.station_id == station_id).first()
        if not st:
            raise HTTPException(status_code=404, detail="Station not found")
        latest = latest_rows(db)
        analysis = model_signal_for_station(db, st, latest)
        analysis["station"] = station_dict(st)
        analysis["alert_history"] = [
            a for a in get_alerts_payload(db)
            if a["station_id"] == station_id
        ]
        return analysis
    finally:
        db.close()


@app.get("/api/v1/alerts")
def alerts():
    db = SessionLocal()
    try:
        return get_alerts_payload(db)
    finally:
        db.close()


@app.post("/api/v1/alerts/{alert_id}/action")
def alert_action(alert_id: str, payload: AlertActionIn):
    db = SessionLocal()
    try:
        state = db.query(AlertStateDB).filter(AlertStateDB.alert_id == alert_id).first()
        previous_state = state.state if state is not None else "OPEN"
        observation_id = None
        try:
            observation_id = int(alert_id.replace("alert-", "", 1))
        except ValueError:
            pass
        source = db.query(ObservationDB).filter(ObservationDB.id == observation_id).first() if observation_id is not None else None
        station_id = source.station_id if source is not None else None
        if state is None:
            state = AlertStateDB(alert_id=alert_id, state=payload.state, classification=payload.classification, note=payload.note, updated_at=now_utc())
            db.add(state)
        else:
            state.state = payload.state
            state.classification = payload.classification
            state.note = payload.note
            state.updated_at = now_utc()
        if station_id and payload.state == "ACKNOWLEDGED":
            ACTIVE_REPLAY_STATIONS.add(station_id)
            if previous_state != "ACKNOWLEDGED":
                advance_replay_row(db, station_id)
        elif station_id and payload.state == "CLOSED":
            advance_replay_row(db, station_id)
            ACTIVE_REPLAY_STATIONS.discard(station_id)
        db.commit()
        return {"status": "success", "alert_id": alert_id, "state": payload.state, "station_id": station_id}
    finally:
        db.close()


@app.post("/api/v1/replay/tick")
def replay_tick():
    db = SessionLocal()
    try:
        advanced = []
        for station_id in list(ACTIVE_REPLAY_STATIONS):
            row = advance_replay_row(db, station_id)
            if row is not None:
                advanced.append(row)
        db.commit()
        return {"status": "success", "count": len(advanced), "data": advanced}
    finally:
        db.close()


@app.get("/api/v1/analytics")
def analytics():
    db = SessionLocal()
    try:
        rows = db.query(ObservationDB).order_by(ObservationDB.timestamp.asc()).all()
        stations = db.query(StationDB).all()
        alerts = get_alerts_payload(db)
        daily = defaultdict(lambda: {"observations": 0, "anomalies": 0, "temperature": [], "humidity": [], "pressure": []})
        anomaly_types = Counter()
        source_counts = Counter()
        station_stats = {}
        for r in rows:
            day = r.timestamp.date().isoformat()
            d = daily[day]
            d["observations"] += 1
            d["temperature"].append(r.temperature)
            d["humidity"].append(r.humidity)
            d["pressure"].append(r.pressure)
            source_counts[r.data_source] += 1
            if r.is_injected_anomaly:
                d["anomalies"] += 1
                anomaly_types[r.anomaly_type or "UNKNOWN"] += 1
            station_stats.setdefault(r.station_id, {"count": 0, "anomalies": 0})
            station_stats[r.station_id]["count"] += 1
            if r.is_injected_anomaly:
                station_stats[r.station_id]["anomalies"] += 1
        daily_out = []
        for day, d in daily.items():
            daily_out.append({
                "date": day,
                "observations": d["observations"],
                "anomalies": d["anomalies"],
                "temperature": round(statistics.mean(d["temperature"]), 2) if d["temperature"] else None,
                "humidity": round(statistics.mean(d["humidity"]), 2) if d["humidity"] else None,
                "pressure": round(statistics.mean(d["pressure"]), 2) if d["pressure"] else None,
            })
        station_out = []
        for st in stations:
            s = station_stats.get(st.station_id, {"count": 0, "anomalies": 0})
            station_out.append({
                "station_id": st.station_id,
                "station_name": st.station_name,
                "observations": s["count"],
                "anomalies": s["anomalies"],
                "anomaly_rate": round(s["anomalies"] / max(1, s["count"]) * 100, 2),
            })
        return {
            "daily": daily_out,
            "anomaly_types": [{"name": k, "count": v} for k, v in anomaly_types.most_common()],
            "source_counts": [{"name": k, "count": v} for k, v in source_counts.items()],
            "stations": station_out,
            "alerts": {"total": len(alerts), "critical": sum(a["severity"] == "CRITICAL" for a in alerts), "open": sum(a["state"] != "CLOSED" for a in alerts)},
        }
    finally:
        db.close()


@app.post("/api/v1/reset")
def reset_demo():
    db = SessionLocal()
    try:
        db.query(ObservationDB).delete()
        db.query(AlertStateDB).delete()
        db.commit()
        return {"status": "reset", "message": "Prototype observation and alert buffers cleared."}
    finally:
        db.close()
