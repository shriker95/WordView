# WorldView

A real-time interactive world map showing live flights, satellites, and ships — all in one dark-themed webapp. No build step, no framework, just open and run.

![WorldView](https://img.shields.io/badge/stack-Leaflet%20%7C%20Python%20%7C%20WebSocket-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### ✈ Live Flights
Real-time aircraft positions from [adsb.lol](https://adsb.lol) (ADS-B, no API key needed).  
Icons rotate with the aircraft's heading.

| Color | Classification | Method |
|---|---|---|
| 🔴 Red | Military | ICAO24 hex ranges (US, UK, FR, DE, CN, RU) + callsign patterns |
| 🟡 Yellow | Government | Callsign patterns (SAM, NASA, USCG, CBP…) |
| 🔵 Blue | Civilian | Everything else |

Click any plane for callsign, altitude, speed, squawk, and links to FlightAware · FR24 · Planespotters · OpenSky.

---

### 🛰 Satellites
~1,500 active satellites from [SatNOGS DB](https://db.satnogs.org), propagated in real-time using [satellite.js](https://github.com/shashwatak/satellite-js) orbital mechanics.

| Color | Classification | Examples |
|---|---|---|
| 🟡 Gold | Space stations | ISS, CSS/Tiangong, Hubble |
| 🔴 Red | Military | USA-XXX, YAOGAN, WGS, MUOS, AEHF, MILSTAR |
| 🔵 Cyan | Weather / Earth obs | NOAA, GOES, METEOSAT, SENTINEL, LANDSAT |
| 🟢 Green | Navigation | GPS, GLONASS, Galileo, BeiDou |
| ⚫ Grey dot | Other | Everything else |

Positions update every **30 seconds** from cached orbital elements. TLE data refreshes every **2 hours**.  
Click any satellite for name, altitude, NORAD ID, and links to N2YO · Heavens-Above · SatNOGS.

---

### ⚓ Ships
Real-time AIS vessel positions via [aisstream.io](https://aisstream.io) WebSocket (free API key required).  
Automatically re-subscribes when you pan the map.

| Color | AIS type codes | Vessel type |
|---|---|---|
| 🔴 Red | 35, 55 | Military / Law enforcement |
| 🟠 Orange | 80–89 | Tanker |
| 🔵 Blue | 70–79 | Cargo |
| 🟢 Green | 60–69 | Passenger |
| 🟡 Yellow | 30 | Fishing |
| ⚫ Grey | other | Unclassified |

Click any ship for MMSI, speed, heading, destination, and links to MarineTraffic · VesselFinder · MyShipTracking.

---

## Getting Started

### Requirements
- Python 3.8+
- A free [aisstream.io](https://aisstream.io) API key (for ships)

### Run

```bash
python serve.py
```

This starts a local server at `http://localhost:8000` and opens the app in your browser.  
The server also acts as a reverse proxy for the flight and satellite APIs to avoid CORS issues.

### First launch

1. **Flights & Satellites** load automatically — no setup needed.
2. **Ships** — click the ⚓ Ships button, paste your [aisstream.io](https://aisstream.io) API key into the prompt. The key is saved to `localStorage` and reused on future visits.

---

## Map Layers

| Button | Tile source |
|---|---|
| Street | CartoDB Voyager |
| Satellite | Esri World Imagery |
| Light | CartoDB Positron |

---

## Architecture

```
Browser
  ├── Leaflet.js          — map rendering & markers
  ├── satellite.js        — TLE orbital propagation
  └── app.js              — overlay logic

serve.py (Python HTTP server + proxy)
  ├── /              → static files
  ├── /api/…         → api.adsb.lol   (flights)
  └── /satnogs       → db.satnogs.org (TLEs)

External (direct from browser)
  └── wss://stream.aisstream.io  (ships, WebSocket)
```

The proxy is needed because the flight and satellite APIs block requests from a `null` (file://) or `localhost` origin. Ships use a WebSocket which bypasses CORS restrictions.

---

## Project Structure

```
WorldView/
├── index.html      — app shell, buttons, modal
├── app.js          — all overlay logic (flights, satellites, ships)
├── style.css       — dark theme, popups, modal
├── serve.py        — dev server + API proxy
└── requirements.txt
```

---

## Data Sources

| Data | Source | Terms |
|---|---|---|
| Flight positions | [adsb.lol](https://adsb.lol) | Free, open |
| Satellite TLEs | [SatNOGS DB](https://db.satnogs.org) | CC BY-SA |
| Ship AIS | [aisstream.io](https://aisstream.io) | Free tier |
| Map tiles (Street/Light) | [CARTO](https://carto.com) | Free tier |
| Map tiles (Satellite) | [Esri](https://www.esri.com) | Free tier |
