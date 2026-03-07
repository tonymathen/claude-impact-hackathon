import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import express from 'express';

const EPA_THRESHOLD = 104;

function aggregateByYear(records) {
  const byYear = {};
  for (const r of records) {
    const year = r.date?.substring(0, 4);
    if (!year) continue;
    if (!byYear[year]) byYear[year] = { sum: 0, max: 0, count: 0 };
    byYear[year].sum += r.value;
    byYear[year].max = Math.max(byYear[year].max, r.value);
    byYear[year].count++;
  }
  return Object.entries(byYear)
    .map(([year, d]) => ({
      year,
      avg: Math.round((d.sum / d.count) * 100) / 100,
      max: d.max,
      sampleCount: d.count,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

function computeStationLevels(bacteria) {
  const recent = bacteria.filter(
    (r) => r.parameter === 'ENTERO' && r.date >= '2022-01-01'
  );
  const byStation = {};
  for (const r of recent) {
    if (!byStation[r.station]) byStation[r.station] = { sum: 0, max: 0, count: 0, exceed: 0 };
    byStation[r.station].sum += r.value;
    byStation[r.station].max = Math.max(byStation[r.station].max, r.value);
    byStation[r.station].count++;
    if (r.value > EPA_THRESHOLD) byStation[r.station].exceed++;
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
  return result;
}

function createMcpServer(appData) {
  const server = new McpServer({ name: 'pipe-to-pacific', version: '1.0.0' });

  server.tool(
    'get_bacteria_trend',
    'Yearly bacteria trend for San Diego ocean monitoring stations',
    {
      project: z.enum(['PLOO', 'SBOO', 'ALL']),
      parameter: z.string().optional(),
      start_year: z.number().optional(),
    },
    async ({ project, parameter, start_year }) => {
      const filtered = appData.bacteria.filter(
        (r) =>
          (project === 'ALL' || r.project === project) &&
          r.parameter === (parameter || 'ENTERO') &&
          (!start_year || parseInt(r.date) >= start_year)
      );
      return { content: [{ type: 'text', text: JSON.stringify(aggregateByYear(filtered)) }] };
    }
  );

  server.tool(
    'get_station_bacteria',
    'Recent bacteria levels per monitoring station with exceedance rates',
    { station: z.string().optional() },
    async ({ station }) => {
      const data = computeStationLevels(appData.bacteria);
      const result = station ? { [station]: data[station] } : data;
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_fish_contamination',
    'Fish tissue contaminant levels by species near San Diego outfalls',
    { species: z.string().optional(), param_class: z.string().optional() },
    async ({ species, param_class }) => {
      let data = appData.fishTissue;
      if (species) data = data.filter((r) => r.species === species);
      if (param_class) data = data.filter((r) => r.paramClass === param_class);
      return { content: [{ type: 'text', text: JSON.stringify(data.slice(0, 100)) }] };
    }
  );

  server.tool(
    'get_equity_data',
    'Join ocean contamination data with census income data by coastal tract',
    {},
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify(appData.equity || []) }] };
    }
  );

  const app = express();
  app.use(express.json());

  app.all('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

export { createMcpServer };
