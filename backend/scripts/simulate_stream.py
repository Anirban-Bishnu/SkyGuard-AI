import time
import random
import json
import urllib.request

API_URL = "http://127.0.0.1:8000/api/v1/observations"

print("Starting SkyGuard AI Stream Simulator...")
stations = ["AWS-DEL-01", "AWS-MUM-02", "AWS-BLR-03"]

def send_observation(data):
    payload = json.dumps(data).encode("utf-8")

    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            result = response.read().decode("utf-8")
            print(f"Sent: {json.dumps(data)}")
            print(f"API response: {result}")
    except Exception as e:
        print(f"ERROR sending data: {e}")

try:
    while True:
        for station in stations:
            data = {
                "station_id": station,
                "temperature": round(random.uniform(25.0, 35.0), 1),
                "pressure": round(random.uniform(1000.0, 1015.0), 1),
                "humidity": round(random.uniform(50.0, 80.0), 1)
            }

            send_observation(data)

        time.sleep(2)

except KeyboardInterrupt:
    print("Simulation stopped.")