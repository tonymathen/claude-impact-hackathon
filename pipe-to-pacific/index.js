import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAllData } from './src/services/data-loader.js';
import { createWaterQualityRoutes } from './src/api/water-quality.js';
import { createChatRoutes } from './src/api/chat.js';
import { createAnomalyRoutes } from './src/api/anomaly.js';
import { createEquityRoutes } from './src/api/equity.js';
import { createMcpServer } from './mcp-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MCP_PORT = process.env.MCP_PORT || 3001;

async function start() {
  const appData = await loadAllData();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'client/public')));

  app.use('/api', createWaterQualityRoutes(appData));
  app.use('/api/chat', createChatRoutes(appData));
  app.use('/api', createAnomalyRoutes(appData));
  app.use('/api', createEquityRoutes(appData));

  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'client/public/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`); // eslint-disable-line no-console
  });

  const mcpApp = createMcpServer(appData);
  mcpApp.listen(MCP_PORT, () => {
    console.log(`MCP server on http://localhost:${MCP_PORT}`); // eslint-disable-line no-console
  });
}

start();
