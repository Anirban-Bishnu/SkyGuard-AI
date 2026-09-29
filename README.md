#  SkyGuard AI
## Environmental Intelligence & Sensor Anomaly Command Center

> **Smart India Hackathon (SIH) — Team ASTRIX**

SkyGuard AI is an environmental monitoring and sensor-integrity command center designed to monitor AWS stations, analyze environmental telemetry, detect abnormal sensor behavior, and support structured incident response.

The platform combines a React/Vite command-center frontend with a FastAPI backend and a station/observation data pipeline.

---

##  Live Prototype

### 🌐 Live Dashboard
**https://skyguard-ai-plum.vercel.app**

### 🔧 Backend API
**https://skyguard-ai-711v.onrender.com**

### 📖 API Documentation
**https://skyguard-ai-711v.onrender.com/docs**

---

##  SIH 2026 Project

**Hackathon:** Smart India Hackathon (SIH)  
**Team:** **ASTRIX-- ,**
**Team ID :** **155429**  
**PS ID:** **26073**  
**Project:** SkyGuard AI  
**Domain:** Environmental Intelligence / Sensor Monitoring / Anomaly Detection

SkyGuard AI is developed as a prototype to demonstrate an operator-focused system for environmental station monitoring and sensor anomaly management.

---
## Tean Members

- Rasel Ahammed Biswas (Team Leader)
- Anirban Bishnu
- Golam Yeazdani
- Arnab Roy
- Sudiksha Mandal
- Sudesna Patra

---

## Problem Statement

Environmental monitoring networks continuously generate telemetry such as:

- Temperature
- Atmospheric pressure
- Humidity
- Station health
- Communication status

A monitoring system must do more than display raw values.

It should help operators:

1. Monitor station health.
2. Identify abnormal sensor readings.
3. Distinguish normal telemetry from suspicious behavior.
4. Create and investigate incidents.
5. Acknowledge and resolve incidents.
6. Maintain clear evidence and response information.

SkyGuard AI provides a centralized interface for this workflow.

---

## Solution

SkyGuard AI provides a command-center style monitoring platform with:

**Station Monitoring → Telemetry → Anomaly Detection → Incident → Operator Response → Resolution**

The system combines a web dashboard, REST API, observation pipeline, station data, and controlled test-event generation.

---

##  Main Features

### 1. Environmental Command Center

The overview dashboard provides:

- Network health
- Active incident count
- Observation count
- Data freshness
- Spatial station map
- Station health overview
- Temperature and pressure trends
- Recent incidents

---

### 2. Live AWS Network

The network view provides:

- Geographic station visualization
- Station selection
- Current telemetry
- Station health
- Communication state
- Temperature
- Pressure
- Humidity

Stations can be selected directly from the map or station list.

---

### 3. Event Injection

SkyGuard AI includes a controlled test workflow for validating the anomaly and incident pipeline.

Operators can select:

- Target station
- Temperature anomaly
- Pressure anomaly
- Frozen sensor

For temperature and pressure tests, an injected sensor value can be provided.

Example workflow:

```text
Select Station
      ↓
Select Sensor / Event Type
      ↓
Enter Test Value
      ↓
Generate Test Event
      ↓
Observation Pipeline
      ↓
Incident
