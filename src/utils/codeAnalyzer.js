// Code Analyzer — client-side ZIP handling + multi-step API orchestration
// Uses JSZip for decompression, calls /api/analyze for each step

import { genNodeId } from './idGen.js';

// File extensions to analyze
const CODE_EXTS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'json', 'yaml', 'yml', 'toml', 'env', 'env.local',
  'sql', 'prisma', 'graphql', 'gql',
  'md', 'txt'
]);

// Files to skip
const SKIP_PATTERNS = [
  /node_modules\//,/\.git\//,/dist\//,/build\//,/\.next\//,
  /\.cache\//,/coverage\//,/__pycache__\//,/\.DS_Store/,
  /package-lock\.json/,/yarn\.lock/,/pnpm-lock/,
  /\.min\.js$/,/\.map$/,/\.chunk\./,
  /\.png$/,/\.jpg$/,/\.jpeg$/,/\.gif$/,/\.svg$/,/\.ico$/,
  /\.woff/,/\.ttf$/,/\.eot$/,
  /\.mp4$/,/\.mp3$/,/\.wav$/,/\.pdf$/,
];

// ========== ZIP EXTRACTION ==========

export async function extractZip(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const files = [];
  const fileList = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (SKIP_PATTERNS.some(p => p.test(path))) continue;

    const ext = path.split('.').pop()?.toLowerCase() || '';
    const isCode = CODE_EXTS.has(ext);
    const size = entry._data?.uncompressedSize || 0;

    fileList.push({ path, ext, size, isCode });

    if (isCode && size < 100000) { // skip files > 100KB
      try {
        const content = await entry.async('text');
        files.push({ path, content, ext, size: content.length });
      } catch {}
    }
  }

  // Find package.json
  const pkgEntry = zip.file(/package\.json$/)?.[0];
  let packageJson = null;
  if (pkgEntry) {
    try { packageJson = await pkgEntry.async('text'); } catch {}
  }

  return { files, fileList, packageJson };
}

// ========== STEP 1: SCAN ==========

export async function stepScan(fileList, packageJson) {
  const fileListStr = fileList
    .map(f => `${f.isCode ? '📄' : '📦'} ${f.path} (${formatSize(f.size)})`)
    .join('\n');

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'scan',
      data: { fileList: fileListStr, packageJson: packageJson?.slice(0, 5000) || 'not found' }
    })
  });

  if (!response.ok) throw new Error(`Scan failed: ${response.status}`);
  const result = await response.json();
  return result.parsed || JSON.parse(result.text);
}

// ========== STEP 2: ANALYZE ==========

export async function stepAnalyze(scanResult, files) {
  // Select key files identified in scan
  const keyPaths = new Set(scanResult.keyFiles || []);

  // Also include common structural files
  const autoInclude = [
    /routes?\.(js|ts)x?$/i,
    /router\.(js|ts)x?$/i,
    /app\.(js|ts)x?$/i,
    /index\.(js|ts)x?$/i,
    /schema\./i,
    /model/i,
    /middleware/i,
    /config/i,
    /\.env/,
    /firebase/i,
    /supabase/i,
  ];

  const selectedFiles = files.filter(f =>
    keyPaths.has(f.path) ||
    autoInclude.some(p => p.test(f.path))
  );

  // If too many, take top 20 by relevance
  const finalFiles = selectedFiles.slice(0, 20);

  // Build file contents string (truncate long files)
  const fileContents = finalFiles.map(f => {
    const content = f.content.length > 3000 ? f.content.slice(0, 3000) + '\n// ... truncated' : f.content;
    return `--- ${f.path} ---\n${content}\n`;
  }).join('\n');

  const scanSummary = JSON.stringify({
    framework: scanResult.framework,
    detectedPattern: scanResult.detectedPattern,
    structure: scanResult.structure,
    summary: scanResult.summary
  }, null, 2);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'analyze',
      data: { scanSummary, fileContents }
    })
  });

  if (!response.ok) throw new Error(`Analysis failed: ${response.status}`);
  const result = await response.json();
  return result.parsed || JSON.parse(result.text);
}

// ========== STEP 3: VERIFY ==========

export async function stepVerify(currentStructure, feedback) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'verify',
      data: {
        currentStructure: JSON.stringify(currentStructure, null, 2),
        feedback
      }
    })
  });

  if (!response.ok) throw new Error(`Verify failed: ${response.status}`);
  const result = await response.json();
  return result.parsed || JSON.parse(result.text);
}

// ========== STEP 4: NOTES ==========

export async function stepNotes(structureSummary, rawNotes) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'notes',
      data: { structureSummary, rawNotes }
    })
  });

  if (!response.ok) throw new Error(`Notes failed: ${response.status}`);
  const result = await response.json();
  return result.parsed || JSON.parse(result.text);
}

// ========== RESULT → PROJECT DATA ==========

export function analysisToProjectData(analysisResult, existingProject = null) {
  const { columns: colDefs, items, roads: roadDefs } = analysisResult;

  const COLORS = ['sand', 'clay', 'river', 'moss', 'brick', 'sky', 'dune', 'stone'];
  const columns = (colDefs || []).map((c, i) => ({
    key: `col_${i + 1}`,
    label: c.label,
    color: c.color || COLORS[i % COLORS.length]
  }));

  // Build structure tree
  const structure = {};
  const nameToId = {};

  for (const col of columns) structure[col.key] = [];

  // First pass: create all root items
  const itemsByCol = {};
  for (const item of (items || [])) {
    const colIdx = item.column || 0;
    if (!itemsByCol[colIdx]) itemsByCol[colIdx] = [];
    itemsByCol[colIdx].push(item);
  }

  for (const [colIdxStr, colItems] of Object.entries(itemsByCol)) {
    const colIdx = parseInt(colIdxStr);
    const col = columns[colIdx];
    if (!col) continue;

    // Separate roots and children
    const roots = colItems.filter(i => !i.parentName);
    const children = colItems.filter(i => i.parentName);

    // Create root nodes
    for (const item of roots) {
      const node = createNode(item);
      nameToId[item.name] = node.id;
      structure[col.key].push(node);
    }

    // Create children (may need multiple passes for deep nesting)
    let remaining = [...children];
    let maxPasses = 5;
    while (remaining.length > 0 && maxPasses > 0) {
      const nextRemaining = [];
      for (const item of remaining) {
        const parentId = nameToId[item.parentName];
        if (parentId) {
          const node = createNode(item);
          nameToId[item.name] = node.id;
          insertChild(structure[col.key], parentId, node);
        } else {
          nextRemaining.push(item);
        }
      }
      if (nextRemaining.length === remaining.length) {
        // Can't resolve more parents, add as roots
        for (const item of nextRemaining) {
          const node = createNode(item);
          nameToId[item.name] = node.id;
          structure[col.key].push(node);
        }
        break;
      }
      remaining = nextRemaining;
      maxPasses--;
    }
  }

  // Build roads
  const roads = (roadDefs || []).map(r => ({
    id: genNodeId(),
    from: nameToId[r.from] || '',
    to: nameToId[r.to] || '',
    type: r.roadType || 'main',
    vehicle: r.vehicle || 'car',
    dataType: r.dataType || 'content',
    label: r.label || ''
  })).filter(r => r.from && r.to);

  return { columns, structure, roads };
}

// Merge analysis into existing project (for case 2)
export function mergeAnalysisIntoProject(project, analysisResult) {
  const newData = analysisToProjectData(analysisResult);

  // Simple merge: add missing columns, add missing items, add missing roads
  const mergedColumns = [...project.columns];
  const mergedStructure = { ...project.structure };
  const mergedRoads = [...(project.roads || [])];

  // Add new columns that don't exist
  for (const newCol of newData.columns) {
    const exists = mergedColumns.some(c => c.label === newCol.label);
    if (!exists) {
      mergedColumns.push(newCol);
      mergedStructure[newCol.key] = newData.structure[newCol.key] || [];
    }
  }

  // Add new roads (skip duplicates by from+to name matching)
  const existingPairs = new Set(mergedRoads.map(r => `${r.from}|${r.to}`));
  for (const road of newData.roads) {
    const key = `${road.from}|${road.to}`;
    const keyR = `${road.to}|${road.from}`;
    if (!existingPairs.has(key) && !existingPairs.has(keyR)) {
      mergedRoads.push(road);
      existingPairs.add(key);
    }
  }

  return {
    columns: mergedColumns,
    structure: mergedStructure,
    roads: mergedRoads
  };
}

// ========== HELPERS ==========

function createNode(item) {
  return {
    id: genNodeId(),
    name: item.name || 'unnamed',
    description: item.description || '',
    children: [],
    tags: {},
    buildingType: item.buildingType || 'page',
    archPattern: item.archPattern || null,
    archLayer: item.archLayer || null,
    placed: true
  };
}

function insertChild(tree, parentId, childNode) {
  for (const node of tree) {
    if (node.id === parentId) {
      if (!node.children) node.children = [];
      node.children.push(childNode);
      return true;
    }
    if (node.children && insertChild(node.children, parentId, childNode)) return true;
  }
  return false;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
