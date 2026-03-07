import express from 'express';

const EPA_ENTERO_THRESHOLD = 104;

function inferProject(stationId) {
  if (!stationId) return 'OTHER';
  const first = stationId.charAt(0).toUpperCase();
  if (first === 'I' || first === 'S') return 'SBOO';
  if ('DABCFE'.includes(first)) return 'PLOO';
  return 'OTHER';
}

function getDistanceBucket(km) {
  if (km <= 2) return '0-2 km';
  if (km <= 5) return '2-5 km';
  if (km <= 10) return '5-10 km';
  if (km <= 20) return '10-20 km';
  return '20+ km';
}

const BUCKET_ORDER = ['0-2 km', '2-5 km', '5-10 km', '10-20 km', '20+ km'];

function createWaterQualityRoutes(appData) {
  const router = express.Router();

  // 7.1 GET /api/stations
  router.get('/stations', (_req, res) => {
    const result = Object.values(appData.stations).map((s) => ({
      ...s,
      project: inferProject(s.id),
    }));
    res.json(result);
  });

  // 7.2 GET /api/bacteria
  router.get('/bacteria', (req, res) => {
    const { station, startDate, endDate, parameter, project } = req.query;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;

    let filtered = appData.bacteria;
    if (station) filtered = filtered.filter((r) => r.station === station);
    if (startDate) filtered = filtered.filter((r) => r.date >= startDate);
    if (endDate) filtered = filtered.filter((r) => r.date <= endDate);
    if (parameter) filtered = filtered.filter((r) => r.parameter === parameter);
    if (project) filtered = filtered.filter((r) => r.project === project);

    res.json({
      total: filtered.length,
      offset,
      limit,
      data: filtered.slice(offset, offset + limit),
    });
  });

  // 7.3 GET /api/bacteria/yearly
  router.get('/bacteria/yearly', (req, res) => {
    const { station, parameter, project } = req.query;
    let filtered = appData.bacteria;
    if (station) filtered = filtered.filter((r) => r.station === station);
    if (parameter) filtered = filtered.filter((r) => r.parameter === parameter);
    if (project && project !== 'ALL') filtered = filtered.filter((r) => r.project === project);

    const byYear = {};
    for (const r of filtered) {
      const year = r.date?.substring(0, 4);
      if (!year) continue;
      if (!byYear[year]) byYear[year] = { sum: 0, max: 0, count: 0 };
      byYear[year].sum += r.value;
      byYear[year].max = Math.max(byYear[year].max, r.value);
      byYear[year].count++;
    }

    const result = Object.entries(byYear)
      .map(([year, d]) => ({
        year,
        avg: Math.round((d.sum / d.count) * 100) / 100,
        max: d.max,
        sampleCount: d.count,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));

    res.json(result);
  });

  // 7.4 GET /api/bacteria/by-distance
  router.get('/bacteria/by-distance', (req, res) => {
    const outfall = req.query.outfall || 'pointLoma';
    const parameter = req.query.parameter || 'ENTERO';

    const recent = appData.bacteria.filter(
      (r) => r.parameter === parameter && r.date >= '2020-01-01'
    );

    const buckets = {};
    for (const r of recent) {
      const station = appData.stations[r.station];
      if (!station) continue;
      const dist = outfall === 'southBay' ? station.distToSouthBay : station.distToPointLoma;
      const bucket = getDistanceBucket(dist);
      if (!buckets[bucket]) buckets[bucket] = { sum: 0, max: 0, count: 0 };
      buckets[bucket].sum += r.value;
      buckets[bucket].max = Math.max(buckets[bucket].max, r.value);
      buckets[bucket].count++;
    }

    const result = BUCKET_ORDER.map((distance) => {
      const d = buckets[distance] || { sum: 0, max: 0, count: 0 };
      return {
        distance,
        avg: d.count ? Math.round((d.sum / d.count) * 100) / 100 : 0,
        max: d.max,
        sampleCount: d.count,
      };
    });

    res.json(result);
  });

  // 7.5 GET /api/bacteria/monthly
  router.get('/bacteria/monthly', (req, res) => {
    const parameter = req.query.parameter || 'ENTERO';
    const startYear = req.query.startYear || '2020';

    const filtered = appData.bacteria.filter(
      (r) => r.parameter === parameter && r.date >= `${startYear}-01-01`
    );

    const byMonth = {};
    for (const r of filtered) {
      const month = r.date?.substring(0, 7);
      if (!month) continue;
      if (!byMonth[month]) byMonth[month] = { sum: 0, max: 0, count: 0, exceedances: 0 };
      byMonth[month].sum += r.value;
      byMonth[month].max = Math.max(byMonth[month].max, r.value);
      byMonth[month].count++;
      if (r.value > EPA_ENTERO_THRESHOLD) byMonth[month].exceedances++;
    }

    const result = Object.entries(byMonth)
      .map(([month, d]) => ({
        month,
        avg: Math.round((d.sum / d.count) * 100) / 100,
        max: d.max,
        sampleCount: d.count,
        exceedances: d.exceedances,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json(result);
  });

  // 7.6 GET /api/outfalls
  router.get('/outfalls', (_req, res) => {
    res.json(appData.outfalls);
  });

  // 7.7 GET /api/sediment
  router.get('/sediment', (req, res) => {
    const { station, analyte } = req.query;
    let filtered = appData.sediment;
    if (station) filtered = filtered.filter((r) => r.station === station);
    if (analyte) filtered = filtered.filter((r) => r.analyte === analyte);
    res.json(filtered.slice(0, 500));
  });

  // 7.8 GET /api/fish-tissue
  router.get('/fish-tissue', (req, res) => {
    const { species, parameter } = req.query;
    let filtered = appData.fishTissue;
    if (species) filtered = filtered.filter((r) => r.species === species);
    if (parameter) filtered = filtered.filter((r) => r.parameter === parameter);

    const groups = {};
    for (const r of filtered) {
      const key = `${r.species}||${r.parameter}`;
      if (!groups[key]) groups[key] = { species: r.species, parameter: r.parameter, project: r.project, sum: 0, max: 0, count: 0 };
      groups[key].sum += r.value;
      groups[key].max = Math.max(groups[key].max, r.value);
      groups[key].count++;
    }

    const result = Object.values(groups).map((g) => ({
      species: g.species,
      parameter: g.parameter,
      project: g.project,
      avg: Math.round((g.sum / g.count) * 1000) / 1000,
      max: g.max,
      sampleCount: g.count,
    }));

    res.json(result);
  });

  // 7.9 GET /api/summary
  router.get('/summary', (_req, res) => {
    const recentEntero = appData.bacteria.filter(
      (r) => r.parameter === 'ENTERO' && r.date >= '2023-01-01'
    );
    const exceedances = recentEntero.filter((r) => r.value > EPA_ENTERO_THRESHOLD).length;
    const exceedanceRate = recentEntero.length
      ? Math.round((exceedances / recentEntero.length) * 1000) / 10
      : 0;

    const years = new Set();
    for (const r of appData.bacteria) {
      const y = r.date?.substring(0, 4);
      if (y) years.add(y);
    }

    res.json({
      stations: Object.keys(appData.stations).length,
      bacteriaReadings: appData.bacteria.length,
      chemistryReadings: appData.chemistry.length,
      sedimentSamples: appData.sediment.length,
      fishTissueSamples: appData.fishTissue.length,
      exceedanceRate,
      yearsCovered: years.size,
      outfalls: appData.outfalls,
    });
  });

  // 7.10 GET /api/stations/bacteria-levels
  router.get('/stations/bacteria-levels', (req, res) => {
    const { station } = req.query;
    const recent = appData.bacteria.filter(
      (r) => r.parameter === 'ENTERO' && r.date >= '2022-01-01'
    );

    const byStation = {};
    for (const r of recent) {
      if (station && r.station !== station) continue;
      if (!byStation[r.station]) byStation[r.station] = { sum: 0, max: 0, count: 0, exceed: 0 };
      byStation[r.station].sum += r.value;
      byStation[r.station].max = Math.max(byStation[r.station].max, r.value);
      byStation[r.station].count++;
      if (r.value > EPA_ENTERO_THRESHOLD) byStation[r.station].exceed++;
    }

    const result = {};
    for (const [id, d] of Object.entries(byStation)) {
      result[id] = {
        avg: Math.round((d.sum / d.count) * 100) / 100,
        max: d.max,
        sampleCount: d.count,
        exceedanceRate: Math.round((d.exceed / d.count) * 1000) / 10,
      };
    }

    res.json(result);
  });

  // 7.11 GET /api/sediment/top-contaminants
  router.get('/sediment/top-contaminants', (_req, res) => {
    const byAnalyte = {};
    for (const r of appData.sediment) {
      if (!byAnalyte[r.analyte]) byAnalyte[r.analyte] = { sum: 0, max: 0, count: 0, stations: new Set() };
      byAnalyte[r.analyte].sum += r.value;
      byAnalyte[r.analyte].max = Math.max(byAnalyte[r.analyte].max, r.value);
      byAnalyte[r.analyte].count++;
      byAnalyte[r.analyte].stations.add(r.station);
    }

    const MIN_SAMPLES = 5;
    const result = Object.entries(byAnalyte)
      .filter(([, d]) => d.count >= MIN_SAMPLES)
      .map(([analyte, d]) => ({
        analyte,
        avg: Math.round((d.sum / d.count) * 1000) / 1000,
        max: d.max,
        sampleCount: d.count,
        stationCount: d.stations.size,
      }))
      .sort((a, b) => b.sampleCount - a.sampleCount)
      .slice(0, 25);

    res.json(result);
  });

  // 7.12 GET /api/fish-tissue/species-summary
  router.get('/fish-tissue/species-summary', (_req, res) => {
    const bySpecies = {};
    for (const r of appData.fishTissue) {
      if (!bySpecies[r.species]) bySpecies[r.species] = { totalSamples: 0, classes: {} };
      bySpecies[r.species].totalSamples++;
      const cls = r.paramClass || 'Unknown';
      if (!bySpecies[r.species].classes[cls]) bySpecies[r.species].classes[cls] = { sum: 0, max: 0, count: 0 };
      bySpecies[r.species].classes[cls].sum += r.value;
      bySpecies[r.species].classes[cls].max = Math.max(bySpecies[r.species].classes[cls].max, r.value);
      bySpecies[r.species].classes[cls].count++;
    }

    const result = Object.entries(bySpecies).map(([species, d]) => ({
      species,
      totalSamples: d.totalSamples,
      contaminants: Object.entries(d.classes).map(([cls, c]) => ({
        class: cls,
        avg: Math.round((c.sum / c.count) * 1000) / 1000,
        max: c.max,
        count: c.count,
      })),
    }));

    res.json(result);
  });

  // GET /api/stations/bacteria-levels-by-year?year=2015
  router.get('/stations/bacteria-levels-by-year', (req, res) => {
    const year = req.query.year || '2023';
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const filtered = appData.bacteria.filter(
      (r) => r.parameter === 'ENTERO' && r.date >= startDate && r.date <= endDate
    );

    const byStation = {};
    for (const r of filtered) {
      if (!byStation[r.station]) byStation[r.station] = { sum: 0, max: 0, count: 0, exceed: 0 };
      byStation[r.station].sum += r.value;
      byStation[r.station].max = Math.max(byStation[r.station].max, r.value);
      byStation[r.station].count++;
      if (r.value > EPA_ENTERO_THRESHOLD) byStation[r.station].exceed++;
    }

    const result = {};
    for (const [id, d] of Object.entries(byStation)) {
      result[id] = {
        avg: Math.round((d.sum / d.count) * 100) / 100,
        max: d.max,
        sampleCount: d.count,
        exceedanceRate: Math.round((d.exceed / d.count) * 1000) / 10,
      };
    }

    res.json(result);
  });

  // GET /api/noaa/current — live NOAA data for SD Bay
  router.get('/noaa/current', async (_req, res) => {
    try {
      const now = new Date();
      const end = now.toISOString().slice(0, 10).replace(/-/g, '');
      const start = new Date(now - 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
      const baseUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
      const common = `&station=9410170&units=metric&time_zone=gmt&format=json&begin_date=${start}&end_date=${end}`;

      const [tempResp, levelResp] = await Promise.all([
        fetch(`${baseUrl}?product=water_temperature${common}`).then(r => r.json()),
        fetch(`${baseUrl}?product=water_level&datum=MLLW${common}`).then(r => r.json()),
      ]);

      const temps = (tempResp.data || []).slice(-48);
      const levels = (levelResp.data || []).slice(-48);

      const latestTemp = temps.length ? parseFloat(temps[temps.length - 1].v) : null;
      const latestLevel = levels.length ? parseFloat(levels[levels.length - 1].v) : null;
      const avgTemp = temps.length
        ? Math.round((temps.reduce((s, d) => s + parseFloat(d.v), 0) / temps.length) * 10) / 10
        : null;

      res.json({
        station: '9410170 (San Diego Bay)',
        waterTemp: {
          latest: latestTemp,
          avg48h: avgTemp,
          unit: 'C',
          data: temps.map(d => ({ time: d.t, value: parseFloat(d.v) })),
        },
        waterLevel: {
          latest: latestLevel,
          unit: 'm (MLLW)',
          data: levels.map(d => ({ time: d.t, value: parseFloat(d.v) })),
        },
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.json({ error: 'NOAA data unavailable', detail: err.message });
    }
  });

  // GET /api/realtime — aggregated live ocean conditions
  router.get('/realtime', async (_req, res) => {
    try {
      const noaaBase = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
      const now = new Date();
      const end = now.toISOString().slice(0, 10).replace(/-/g, '');
      const start2d = new Date(now - 2 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
      const common = `&station=9410170&units=metric&time_zone=gmt&format=json&begin_date=${start2d}&end_date=${end}`;

      const [tempResp, levelResp, pressureResp, predictResp, weatherResp, buoy46225, buoy46258] = await Promise.all([
        fetch(`${noaaBase}?product=water_temperature${common}`).then(r => r.json()).catch(() => ({})),
        fetch(`${noaaBase}?product=water_level&datum=MLLW${common}`).then(r => r.json()).catch(() => ({})),
        fetch(`${noaaBase}?product=air_pressure${common}`).then(r => r.json()).catch(() => ({})),
        fetch(`${noaaBase}?product=predictions&station=9410170&units=metric&time_zone=gmt&format=json&date=today&datum=MLLW&interval=h`).then(r => r.json()).catch(() => ({})),
        fetch('https://api.weather.gov/stations/KSAN/observations/latest', { headers: { 'User-Agent': 'PipeToPacific/1.0' } }).then(r => r.json()).catch(() => ({})),
        fetch('https://www.ndbc.noaa.gov/data/realtime2/46225.txt').then(r => r.text()).catch(() => ''),
        fetch('https://www.ndbc.noaa.gov/data/realtime2/46258.txt').then(r => r.text()).catch(() => ''),
      ]);

      const temps = (tempResp.data || []).slice(-48);
      const levels = (levelResp.data || []).slice(-48);
      const pressures = (pressureResp.data || []).slice(-24);

      const wp = weatherResp.properties || {};

      const parseBuoy = (txt) => {
        if (!txt) return [];
        const lines = txt.split('\n').filter(l => l && !l.startsWith('#'));
        return lines.slice(0, 24).map(l => {
          const p = l.trim().split(/\s+/);
          return {
            time: `${p[0]}-${p[1]}-${p[2]} ${p[3]}:${p[4]}`,
            waveHeight: p[8] !== 'MM' ? parseFloat(p[8]) : null,
            wavePeriod: p[9] !== 'MM' ? parseFloat(p[9]) : null,
            waterTemp: p[14] !== 'MM' ? parseFloat(p[14]) : null,
          };
        });
      };

      const buoy225 = parseBuoy(buoy46225);
      const buoy258 = parseBuoy(buoy46258);

      const predictions = (predictResp.predictions || []).map(p => ({
        time: p.t,
        level: parseFloat(p.v),
      }));

      res.json({
        fetchedAt: new Date().toISOString(),
        sdBay: {
          station: '9410170 (San Diego Bay)',
          waterTemp: {
            latest: temps.length ? parseFloat(temps[temps.length - 1].v) : null,
            unit: 'C',
            data: temps.map(d => ({ time: d.t, value: parseFloat(d.v) })),
          },
          tideLevel: {
            latest: levels.length ? parseFloat(levels[levels.length - 1].v) : null,
            unit: 'm',
            data: levels.map(d => ({ time: d.t, value: parseFloat(d.v) })),
          },
          tidePredictions: predictions,
          airPressure: {
            latest: pressures.length ? parseFloat(pressures[pressures.length - 1].v) : null,
            unit: 'hPa',
          },
        },
        weather: {
          station: 'KSAN (San Diego Airport)',
          airTemp: wp.temperature?.value ?? null,
          windSpeed: wp.windSpeed?.value ?? null,
          windDirection: wp.windDirection?.value ?? null,
          humidity: wp.relativeHumidity?.value ? Math.round(wp.relativeHumidity.value) : null,
          conditions: wp.textDescription ?? null,
          barometer: wp.barometricPressure?.value ? Math.round(wp.barometricPressure.value / 100) : null,
        },
        buoys: {
          torreyPines: {
            id: '46225',
            name: 'Torrey Pines Outer',
            data: buoy225,
          },
          missionBay: {
            id: '46258',
            name: 'Mission Bay',
            data: buoy258,
          },
        },
      });
    } catch (err) {
      res.json({ error: 'Realtime data unavailable', detail: err.message });
    }
  });

  return router;
}

export { createWaterQualityRoutes };
