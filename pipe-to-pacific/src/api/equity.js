import express from 'express';
import { haversineDistance } from '../services/data-loader.js';

const CENSUS_URL =
  'https://api.census.gov/data/2022/acs/acs5?get=NAME,B19013_001E,B02001_003E,B01003_001E&for=tract:*&in=state:06%20county:073';


async function loadEquityData(appData) {
  const bacteriaLevels = computeStationBacteria(appData);
  const stationList = Object.values(appData.stations);

  const COMMUNITIES = [
    { name: 'Imperial Beach', lat: 32.5839, lng: -117.1131, income: 52000, pop: 27000 },
    { name: 'San Ysidro', lat: 32.5561, lng: -117.0464, income: 38000, pop: 29000 },
    { name: 'National City', lat: 32.6781, lng: -117.0992, income: 47000, pop: 61000 },
    { name: 'Chula Vista (West)', lat: 32.6401, lng: -117.0842, income: 55000, pop: 44000 },
    { name: 'Ocean Beach', lat: 32.7489, lng: -117.2473, income: 71000, pop: 18000 },
    { name: 'Pacific Beach', lat: 32.7947, lng: -117.2382, income: 78000, pop: 42000 },
    { name: 'Coronado', lat: 32.6859, lng: -117.1831, income: 117000, pop: 24000 },
    { name: 'Point Loma', lat: 32.7334, lng: -117.2426, income: 95000, pop: 26000 },
    { name: 'La Jolla', lat: 32.8328, lng: -117.2713, income: 138000, pop: 47000 },
    { name: 'Del Mar', lat: 32.9595, lng: -117.2653, income: 152000, pop: 4200 },
    { name: 'Encinitas', lat: 33.0370, lng: -117.2920, income: 112000, pop: 62000 },
    { name: 'Solana Beach', lat: 32.9912, lng: -117.2712, income: 121000, pop: 13000 },
  ];

  try {
    const resp = await fetch(CENSUS_URL, {
      headers: { 'User-Agent': 'PipeToPacific/1.0 hackathon-project' },
    });
    const raw = await resp.json();
    if (Array.isArray(raw) && raw.length > 1) {
      const headers = raw[0];
      const incomeIdx = headers.indexOf('B19013_001E');
      const allIncomes = raw.slice(1).map(r => parseInt(r[incomeIdx])).filter(v => v > 0);
      if (allIncomes.length > 0) {
        const countyMedian = allIncomes.sort((a, b) => a - b)[Math.floor(allIncomes.length / 2)];
        console.log(`Census ACS: SD County median income reference = $${countyMedian}`); // eslint-disable-line no-console
      }
    }
  } catch (e) { /* Census fetch is supplementary */ }

  return COMMUNITIES.map((c) => {
    const nearest = findNearestStation(c.lat, c.lng, stationList);
    const bact = nearest ? (bacteriaLevels[nearest.station.id] || { avg: 0, exceedanceRate: 0 }) : { avg: 0, exceedanceRate: 0 };
    return {
      tractName: c.name,
      medianIncome: c.income,
      population: c.pop,
      lat: c.lat,
      lng: c.lng,
      nearestStation: nearest?.station.id || 'N/A',
      distToStation: nearest ? Math.round(nearest.dist * 100) / 100 : 0,
      bacteriaAvg: Math.round(bact.avg * 100) / 100,
      exceedanceRate: bact.exceedanceRate,
    };
  });
}

function computeStationBacteria(appData) {
  const EPA_THRESHOLD = 104;
  const recent = appData.bacteria.filter(
    (r) => r.parameter === 'ENTERO' && r.date >= '2022-01-01'
  );
  const byStation = {};
  for (const r of recent) {
    if (!byStation[r.station]) byStation[r.station] = { sum: 0, count: 0, exceed: 0 };
    byStation[r.station].sum += r.value;
    byStation[r.station].count++;
    if (r.value > EPA_THRESHOLD) byStation[r.station].exceed++;
  }
  const result = {};
  for (const [id, d] of Object.entries(byStation)) {
    result[id] = {
      avg: d.sum / d.count,
      exceedanceRate: Math.round((d.exceed / d.count) * 1000) / 10,
    };
  }
  return result;
}

function findNearestStation(lat, lng, stations) {
  let best = null;
  let bestDist = Infinity;
  for (const s of stations) {
    const d = haversineDistance(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best ? { station: best, dist: bestDist } : null;
}


function createEquityRoutes(appData) {
  const router = express.Router();
  let equityCache = null;

  router.get('/equity', async (_req, res) => {
    if (!equityCache) {
      equityCache = await loadEquityData(appData);
    }
    res.json(equityCache);
  });

  return router;
}

export { createEquityRoutes, loadEquityData };
