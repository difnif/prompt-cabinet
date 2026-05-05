// Vercel Serverless: /api/analyze
// Multi-step code analysis endpoint
// Each step receives previous context + new data

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { step, data } = req.body;
  if (!step) return res.status(400).json({ error: 'step required' });

  try {
    const { system, user } = buildPrompt(step, data);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `API ${response.status}: ${err.slice(0, 200)}` });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Try to extract JSON from response
    let parsed = null;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        parsed = JSON.parse(jsonStr);
      }
    } catch {}

    return res.status(200).json({ text, parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function buildPrompt(step, data) {
  switch (step) {
    case 'scan':
      return {
        system: `You are a code architecture analyzer. Given a list of files and package.json, identify:
1. The framework/libraries used
2. Architecture pattern (MVC, Redux, Clean, etc.)
3. Key structural files to analyze further (routes, models, API definitions, configs)
4. Initial project structure estimation

Respond ONLY in JSON:
{
  "framework": "React/Next.js/Vue/etc",
  "detectedPattern": "mvc/redux/clean/layered/etc or null",
  "keyFiles": ["path1", "path2", ...],  // max 20 most important files
  "structure": {
    "pages": ["file paths"],
    "api": ["file paths"],
    "models": ["file paths"],
    "components": ["file paths"],
    "config": ["file paths"],
    "other": ["file paths"]
  },
  "summary": "Brief 2-line description of the project"
}`,
        user: `File list:\n${data.fileList}\n\npackage.json:\n${data.packageJson || 'not found'}`
      };

    case 'analyze':
      return {
        system: `You are a code architecture analyzer for the "sandroad" tool.
Given source files and a previous scan summary, generate a complete project structure.

Building types: page, component, api, db, auth, storage, noti, payment, analytics, cache, queue, external, config
Vehicle types (connection method): car (REST sync), drone (WebSocket), worker (manual), truck (batch/upload), bike (polling), train (cron), ambulance (error handling), police (auth check)
Data types: user, content, auth, file, noti, payment, analytics, state
Road types: highway (core pipeline), main (major API), sub (internal), tunnel (background)
Architecture patterns: mvc, mvp, mvvm, redux, mvi, clean, fsd, hexagonal, layered, microservice
Architecture layers: model, view, controller, presenter, viewmodel, store, reducer, entity, usecase, adapter, etc.

Respond ONLY in JSON:
{
  "columns": [
    { "label": "column name", "color": "sand/clay/river/moss/brick/sky" }
  ],
  "items": [
    {
      "column": 0,
      "name": "item name",
      "parentName": null or "parent item name",
      "buildingType": "page/api/db/etc",
      "archPattern": null or "redux/mvc/etc",
      "archLayer": null or "model/view/etc",
      "description": "brief description"
    }
  ],
  "roads": [
    {
      "from": "item name",
      "to": "item name",
      "roadType": "main/sub/highway/tunnel",
      "vehicle": "car/drone/truck/etc",
      "dataType": "user/content/auth/etc",
      "label": "optional description"
    }
  ],
  "detectedPattern": "mvc/redux/etc or null",
  "summary": "architecture summary"
}`,
        user: `Previous scan:\n${data.scanSummary}\n\nSource files:\n${data.fileContents}`
      };

    case 'verify':
      return {
        system: `You are reviewing a generated architecture structure. The user has feedback.
Based on their feedback, suggest modifications to the structure.

Respond ONLY in JSON:
{
  "addItems": [{ "column": 0, "name": "...", "parentName": null, "buildingType": "...", "description": "..." }],
  "removeItems": ["item name", ...],
  "addRoads": [{ "from": "...", "to": "...", "roadType": "...", "vehicle": "...", "dataType": "..." }],
  "removeRoads": [{ "from": "...", "to": "..." }],
  "warnings": ["potential issue 1", ...],
  "notes": "summary of changes"
}`,
        user: `Current structure:\n${data.currentStructure}\n\nUser feedback: ${data.feedback}`
      };

    case 'notes':
      return {
        system: `You are organizing development requirements and notes for a project.
Given the project structure and user's raw notes, organize them into clear categories.

Respond ONLY in JSON:
{
  "devNotes": [
    {
      "category": "requirement/constraint/integration/design/performance/security",
      "content": "organized note text",
      "priority": "high/medium/low"
    }
  ],
  "summary": "brief overall summary"
}`,
        user: `Project structure summary:\n${data.structureSummary}\n\nUser notes:\n${data.rawNotes}`
      };

    default:
      return { system: 'You are a helpful assistant.', user: JSON.stringify(data) };
  }
}
