from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BASE = "http://127.0.0.1:8000"
DATA = Path(__file__).resolve().parent.parent / "data" / "skyguard_prototype_dataset.csv"


def load_rows():
    grouped = defaultdict(list)
    with DATA.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            row["timestamp"] = datetime.fromisoformat(row["timestamp"])
            row["temperature_c"] = float(row["temperature_c"])
            row["humidity_percent"] = float(row["humidity_percent"])
            row["pressure_hpa"] = float(row["pressure_hpa"])
            row["is_injected_anomaly"] = row["is_injected_anomaly"] == "1"
            grouped[row["timestamp"]].append(row)
    return dict(sorted(grouped.items(), key=lambda x: x[0]))


def post_observation(row):
    payload = {
        "station_id": row["station_id"],
        "timestamp": row["timestamp"].isoformat(),
        "temperature": row["temperature_c"],
        "pressure": row["pressure_hpa"],
        "humidity": row["humidity_percent"],
        "data_source": row["data_source"],
        "anomaly_type": row["anomaly_type"],
        "anomaly_class": row["anomaly_class"],
        "is_injected_anomaly": row["is_injected_anomaly"],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/v1/observations",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.read()


def reset():
    req = urllib.request.Request(f"{BASE}/api/v1/reset", method="POST")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=0.30, help="Seconds between 30-minute timestamp batches.")
    parser.add_argument("--start", default="", help="Optional source timestamp, e.g. 2026-09-10T12:00:00")
    parser.add_argument("--limit", type=int, default=0, help="Optional number of timestamp batches.")
    parser.add_argument("--no-reset", action="store_true")
    args = parser.parse_args()

    groups = load_rows()

    if args.start:
        start = datetime.fromisoformat(args.start)
        groups = {k:v for k,v in groups.items() if k >= start}

    if args.limit:
        items = list(groups.items())[:args.limit]
        groups = dict(items)

    if not args.no_reset:
        reset()

    print(f"Streaming {len(groups)} timestamp batches from {DATA.name}")
    print("Press Ctrl+C to stop.")

    for idx, (ts, rows) in enumerate(groups.items(), start=1):
        for row in rows:
            post_observation(row)
        label = ", ".join(
            f"{r['station_id']}={r['temperature_c']:.1f}°C" for r in rows
        )
        print(f"[{idx}/{len(groups)}] {ts:%Y-%m-%d %H:%M}  {label}")
        time.sleep(max(0.02, args.interval))


if __name__ == "__main__":
    main()
