import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are an expert ocean water quality analyst for San Diego's "Pipe to Pacific" dashboard.
You have tools to query 24 years of real monitoring data AND broad knowledge of San Diego's wastewater infrastructure.

ALWAYS answer the user's question fully. Use tools for data queries. Use your knowledge for background/context questions about treatment plants, infrastructure, policy, Pure Water SD, etc.

Key context: Point Loma Treatment Plant provides advanced primary treatment, discharges ~175M gal/day through a 4.5-mile outfall at 320ft depth. South Bay Outfall (SBOO) is near Tijuana River -- cross-border sewage is the main contamination driver. Pure Water SD is a $5B program to recycle wastewater instead of ocean discharge. EPA beach safety threshold: 104 CFU/100mL enterococcus.

RESPONSE FORMAT:
- 4-6 concise bullet points max
- Lead with the key finding or number
- Bold key numbers: **412 CFU**, **14.4%**
- No markdown headers, no horizontal rules, no emojis
- One concluding sentence
- Under 150 words total`;

const TOOLS = [
  {
    name: 'get_bacteria_trend',
    description: 'Yearly average bacteria levels. Use for trend questions, whether things are improving, or Pure Water SD effectiveness.',
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', enum: ['PLOO', 'SBOO', 'ALL'] },
        parameter: { type: 'string', enum: ['ENTERO', 'FECAL', 'TOTAL'] },
        start_year: { type: 'number' },
      },
      required: ['project'],
    },
  },
  {
    name: 'get_bacteria_by_distance',
    description: 'Bacteria levels by distance from outfall. Use to explain the contamination gradient or the outfall paradox.',
    input_schema: {
      type: 'object',
      properties: {
        outfall: { type: 'string', enum: ['pointLoma', 'southBay'] },
        parameter: { type: 'string', enum: ['ENTERO', 'FECAL', 'TOTAL'] },
      },
    },
  },
  {
    name: 'get_station_levels',
    description: 'Recent bacteria averages per station with exceedance rates. Use for questions about specific beaches or locations.',
    input_schema: {
      type: 'object',
      properties: {
        station: { type: 'string', description: 'Optional: filter to one station ID' },
      },
    },
  },
  {
    name: 'get_monthly_bacteria',
    description: 'Month-by-month bacteria data. Use for seasonal patterns or recent spikes.',
    input_schema: {
      type: 'object',
      properties: {
        parameter: { type: 'string', enum: ['ENTERO', 'FECAL', 'TOTAL'] },
        start_year: { type: 'number' },
      },
    },
  },
  {
    name: 'get_fish_tissue_summary',
    description: 'Contaminant levels in fish by species. Use for seafood safety questions or eating fish near outfalls.',
    input_schema: {
      type: 'object',
      properties: {
        species: { type: 'string' },
        param_class: { type: 'string', description: 'e.g. Metal, Organic' },
      },
    },
  },
  {
    name: 'get_sediment_contaminants',
    description: 'Top sediment contaminants near outfalls. Use for seafloor contamination questions.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

async function executeTool(name, input) {
  const base = `http://localhost:${process.env.PORT || 3000}/api`;
  const routes = {
    get_bacteria_trend: `/bacteria/yearly?project=${input.project}&parameter=${input.parameter || 'ENTERO'}${input.start_year ? `&startYear=${input.start_year}` : ''}`,
    get_bacteria_by_distance: `/bacteria/by-distance?outfall=${input.outfall || 'pointLoma'}&parameter=${input.parameter || 'ENTERO'}`,
    get_station_levels: `/stations/bacteria-levels${input.station ? `?station=${input.station}` : ''}`,
    get_monthly_bacteria: `/bacteria/monthly?parameter=${input.parameter || 'ENTERO'}&startYear=${input.start_year || 2020}`,
    get_fish_tissue_summary: `/fish-tissue/species-summary`,
    get_sediment_contaminants: `/sediment/top-contaminants`,
  };

  const route = routes[name];
  if (!route) return { error: `Unknown tool: ${name}` };

  try {
    const res = await fetch(`${base}${route}`);
    return await res.json();
  } catch (err) {
    return { error: `Tool fetch failed: ${err.message}` };
  }
}

async function chat(_appData, question) {
  const messages = [{ role: 'user', content: question }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.text ?? '';
    }

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock?.text ?? '';
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (tc) => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: JSON.stringify(await executeTool(tc.name, tc.input)),
      }))
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return 'I reached the maximum number of data lookups. Please try a more specific question.';
}

export { chat };
