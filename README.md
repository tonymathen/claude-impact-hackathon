# Pipe to Pacific - SD Wastewater Impact Tracker

## Team

**Team Name:** PocketStack

**Members:**

- Tony Mathen
- Aryan Philip

---

## Problem Statement

San Diego discharges 175 million gallons of treated sewage into the Pacific Ocean every day through deep-water outfalls. The city has collected 24 years of ocean monitoring data across 157 stations - nearly a million readings tracking bacteria, sediment contamination, and fish tissue contaminants. But this data sits in disconnected CSV files on the city's open data portal, inaccessible to residents, journalists, surfers, and policymakers who need to understand: Is the ocean safe? Is it getting better? And who bears the burden of contamination?

The data reveals a stark environmental justice story: the poorest communities (Imperial Beach at $52K median income, San Ysidro at $38K) face the highest bacteria levels and exceedance rates, while affluent areas like La Jolla ($138K) enjoy near-zero contamination. No existing tool connects water quality data to demographics to make this inequity visible.

---

## What It Does

Pipe to Pacific is an interactive dashboard that tracks the lifecycle of San Diego's wastewater - from treatment plants to ocean outfall to measurable contamination. It loads all city ocean monitoring data into memory, serves it through 16 REST API endpoints, and layers on a Claude-powered AI analyst that uses tool-calling to query the data on demand. The dashboard includes an interactive Leaflet map with 157 color-coded stations, 6 chart views, proactive anomaly detection, a Census income-to-bacteria equity overlay, live ocean conditions from NOAA/NWS/NDBC, a 24-year time slider, a 5-stop guided narrative tour, and an MCP server exposing all data for external Claude integrations.

---

## Data Sources Used

### City of San Diego Open Data Portal (Primary)

| Dataset                         | Description                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Ocean Water Quality (2000-2029) | 3 CSV files covering bacteria (ENTERO, FECAL, TOTAL) and chemistry readings across 340 sq mi |
| Station Locations               | GPS coordinates for all 157 monitoring stations                                              |
| Fish Tissue Contaminants        | Metal and organic contaminant concentrations in fish liver/muscle tissue near outfalls       |
| Sediment Quality                | Seafloor contamination samples near discharge points                                         |

### External Data Joins

| Source                         | Data                                                                     | Join                                                                               |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| US Census ACS API              | Median household income by coastal community                             | Income joined to nearest station bacteria levels -- proves environmental injustice |
| NOAA CO-OPS (Station 9410170)  | Real-time water temperature, tide levels, air pressure, tide predictions | Live ocean conditions overlay                                                      |
| NWS Weather API (KSAN)         | Air temperature, wind speed, humidity, sky conditions                    | Current weather context                                                            |
| NDBC Buoy 46225 (Torrey Pines) | Wave height, wave period, water temperature                              | Real-time surf/ocean conditions                                                    |
| NDBC Buoy 46258 (Mission Bay)  | Wave height, wave period, water temperature                              | Second buoy for spatial coverage                                                   |

---

## Architecture / Approach

### How Claude Built It

The entire application was built using **Claude Code (Opus 4.6)** in a single hackathon session. Claude Code generated all 13 source files, configured the Express 5 server, wrote the data pipeline that parses ~1M CSV rows, implemented all API endpoints, built the full frontend dashboard, and integrated the real-time data feeds. The implementation plan was developed collaboratively in Claude Code's plan mode, then executed phase-by-phase.

### How Claude Works Inside the App

The AI Ocean Analyst uses **Claude Haiku 4.5** with an **agentic tool-use loop** - not context stuffing. Claude has 6 tools available (bacteria trends, distance analysis, station levels, monthly data, fish tissue, sediment) and decides which to call based on the user's question. The agentic loop continues until Claude has enough data to answer, calling multiple tools per question when needed. This means Claude acts as a data analyst, not a search bar.

### System Architecture

```
Browser (Vanilla HTML/CSS/JS)
  |-- Leaflet map + Chart.js charts + Chat panel
  |-- Fetches from 16 REST endpoints
  |
Express 5 Server (Node.js, port 3000)
  |-- Data Layer: ~1M CSV rows parsed into memory at startup
  |-- API Layer: water-quality, anomaly, equity, chat routes
  |-- Claude Service: Haiku 4.5 agentic loop with 6 tools
  |-- Real-time: NOAA, NWS, NDBC fetch on demand
  |
MCP Server (port 3001)
  |-- 4 tools: bacteria trend, station bacteria, fish contamination, equity data
  |-- StreamableHTTPServerTransport, no auth (localhost)
```

### Key Technical Decisions

- **No database** -- all data in memory for sub-millisecond queries on ~1M rows
- **Tool-use over context stuffing** -- Claude calls APIs to fetch only the data it needs
- **Express 5 factory pattern** -- routers created inside factory functions for proper scoping
- **Single HTML file** -- no build step, CDN dependencies only (Leaflet + Chart.js)
- **Anomaly detection** -- compares recent 90-day window against 2018-2022 baseline per project

---

## Demo Video
