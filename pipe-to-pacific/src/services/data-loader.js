import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '../../data/raw');
const PROCESSED_DIR = path.join(__dirname, '../../data/processed');

const POINT_LOMA_OUTFALL = { lat: 32.6667, lng: -117.2833 };
const SOUTH_BAY_OUTFALL = { lat: 32.5333, lng: -117.2167 };

const BACTERIA_PARAMS = new Set(['FECAL', 'TOTAL', 'ENTERO']);
const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCSV(filename) {
  const filePath = path.join(RAW_DIR, filename);
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    const rows = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', () => resolve([]));
  });
}

async function loadStations() {
  const [waterStations, sedimentStations] = await Promise.all([
    parseCSV('stations_water_quality.csv'),
    parseCSV('stations_sediment.csv'),
  ]);

  const stations = {};

  for (const row of waterStations) {
    const id = row.station;
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.long || row.lng);
    if (!id || isNaN(lat) || isNaN(lng)) continue;
    stations[id] = {
      id,
      lat,
      lng,
      distToPointLoma: haversineDistance(lat, lng, POINT_LOMA_OUTFALL.lat, POINT_LOMA_OUTFALL.lng),
      distToSouthBay: haversineDistance(lat, lng, SOUTH_BAY_OUTFALL.lat, SOUTH_BAY_OUTFALL.lng),
    };
  }

  for (const row of sedimentStations) {
    const id = row.station || row.Station;
    const lat = parseFloat(row.lat || row.Lat);
    const lng = parseFloat(row.long || row.Long || row.lng || row.Lng);
    if (!id || isNaN(lat) || isNaN(lng) || stations[id]) continue;
    stations[id] = {
      id,
      lat,
      lng,
      distToPointLoma: haversineDistance(lat, lng, POINT_LOMA_OUTFALL.lat, POINT_LOMA_OUTFALL.lng),
      distToSouthBay: haversineDistance(lat, lng, SOUTH_BAY_OUTFALL.lat, SOUTH_BAY_OUTFALL.lng),
    };
  }

  return stations;
}

async function loadWaterQuality() {
  const files = [
    'water_quality_2000_2010.csv',
    'water_quality_2011_2019.csv',
    'water_quality_2020_2029.csv',
  ];
  const allRows = (await Promise.all(files.map(parseCSV))).flat();

  const bacteria = [];
  const chemistry = [];

  for (const row of allRows) {
    const value = parseFloat(row.value);
    if (isNaN(value)) continue;
    const record = {
      station: row.station,
      date: row.date_sample,
      project: row.project,
      parameter: row.parameter,
      value,
      units: row.units,
      depth: parseFloat(row.depth_m) || 0,
    };
    if (BACTERIA_PARAMS.has(row.parameter)) {
      bacteria.push(record);
    } else {
      chemistry.push(record);
    }
  }

  return { bacteria, chemistry };
}

async function loadSediment() {
  const rows = await parseCSV('sediment_quality.csv');
  const records = [];
  for (const row of rows) {
    const value = parseFloat(row.Value);
    if (isNaN(value)) continue;
    records.push({
      project: row.Project,
      date: row.SampleDate,
      station: row.Station,
      sampleId: row.SampleID,
      analyte: row.Analyte,
      value,
      units: row.Units,
      qualifier: row.Qualifier,
    });
  }
  return records;
}

async function loadFishTissue() {
  const rows = await parseCSV('fish_tissue.csv');
  const records = [];
  for (const row of rows) {
    const value = parseFloat(row.value);
    if (isNaN(value)) continue;
    records.push({
      project: row.project,
      date: row.date_sample,
      station: row.station,
      species: row.species,
      matrix: row.matrix,
      paramClass: row.param_class,
      parameter: row.parameter,
      value,
      units: row.units,
    });
  }
  return records;
}

async function loadAllData() {
  const [stations, waterQuality, sediment, fishTissue] = await Promise.all([
    loadStations(),
    loadWaterQuality(),
    loadSediment(),
    loadFishTissue(),
  ]);

  const appData = {
    stations,
    bacteria: waterQuality.bacteria,
    chemistry: waterQuality.chemistry,
    sediment,
    fishTissue,
    outfalls: {
      pointLoma: POINT_LOMA_OUTFALL,
      southBay: SOUTH_BAY_OUTFALL,
    },
  };

  const summary = {
    stationCount: Object.keys(stations).length,
    bacteriaCount: waterQuality.bacteria.length,
    chemistryCount: waterQuality.chemistry.length,
    sedimentCount: sediment.length,
    fishTissueCount: fishTissue.length,
  };

  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PROCESSED_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  /* eslint-disable no-console -- startup logging */
  console.log(`Loaded: ${summary.stationCount} stations`);
  console.log(`Loaded: ${summary.bacteriaCount} bacteria readings`);
  console.log(`Loaded: ${summary.chemistryCount} chemistry readings`);
  console.log(`Loaded: ${summary.sedimentCount} sediment samples`);
  console.log(`Loaded: ${summary.fishTissueCount} fish tissue samples`);
  /* eslint-enable no-console */

  return appData;
}

export { loadAllData, haversineDistance, POINT_LOMA_OUTFALL, SOUTH_BAY_OUTFALL };
