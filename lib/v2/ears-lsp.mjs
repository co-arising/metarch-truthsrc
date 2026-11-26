// Lightweight zero-dependency Language Server Protocol (LSP 3.17) server for co-arising EARS (.ears).
// Provides live diagnostics (syntax, strict domain-boundary, Path-to-Layer), Go-to-Definition into
// structures/*.yaml, and Hover symbol inspection over standard JSON-RPC 2.0 Content-Length stdio.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEars } from '../ears/parser.mjs';
import { normalizeEars } from '../ears/normalize.mjs';
import { bindEarsSpec } from '../ears/binder.mjs';
import { loadV2Structures } from './structure-loader.mjs';

const APPLICATION_ONLY_ACTIONS = new Set(['pin', 'dispatch', 'respond', 'expose']);
const DOMAIN_ONLY_ACTIONS = new Set(['emit', 'transition']);

function uriToPath(uri) {
  if (!uri) return null;
  if (uri.startsWith('file://')) {
    try {
      return fileURLToPath(uri);
    } catch {
      return uri.slice('file://'.length);
    }
  }
  return resolve(uri);
}

export function discoverStructuresDir(earsFilePath) {
  let cur = dirname(resolve(earsFilePath));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(cur, 'structures');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function collectYamlFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  const walk = d => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(?:yaml|yml|json)$/u.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function buildStructureSymbolIndex(structuresDir) {
  const index = new Map(); // symbolName -> { uri, line (0-based), col (0-based), kind, detail }
  if (!structuresDir) return index;

  const files = collectYamlFiles(structuresDir);
  for (const file of files) {
    const uri = pathToFileURL(file).href;
    const lines = readFileSync(file, 'utf8').replace(/\r\n?/gu, '\n').split('\n');
    let currentSection = '';
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const topMatch = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*$/u);
      if (topMatch) {
        currentSection = topMatch[1];
        continue;
      }
      const nameMatch = raw.match(/^\s*-\s+name:\s*["']?([A-Za-z0-9_-]+)["']?/u);
      if (nameMatch) {
        const sym = nameMatch[1];
        const col = raw.indexOf(sym);
        if (!index.has(sym)) {
          index.set(sym, { uri, line: i, col: Math.max(0, col), kind: currentSection || 'symbol', detail: `${currentSection || 'structure'}: ${sym}` });
        }
        continue;
      }
      const fieldMatch = raw.match(/^\s*-\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^\s#=]+)/u);
      if (fieldMatch && fieldMatch[1] !== 'name') {
        const sym = fieldMatch[1];
        const typeStr = fieldMatch[2];
        const col = raw.indexOf(sym);
        if (!index.has(sym)) {
          index.set(sym, { uri, line: i, col: Math.max(0, col), kind: 'field', detail: `${sym}: ${typeStr}` });
        }
      }
    }
  }
  return index;
}

function checkLspPathLayer(filePath, spec) {
  const diagnostics = [];
  const norm = filePath.replaceAll('\\', '/');
  const inDomain = norm.includes('/behaviors/domain/') || norm.includes('/domain/');
  const inApp = norm.includes('/behaviors/application/') || norm.includes('/application/');

  if (inDomain && (spec.layer !== 'domain' || spec.kind === 'story')) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_PATH_LAYER_MISMATCH',
      span: spec.span,
      message: `spec "${spec.target}" (kind=${spec.kind}, layer=${spec.layer}) is under domain/ which only allows domain aggregate slices`,
    });
  }
  if (inApp && (spec.layer !== 'application' || spec.kind !== 'story')) {
    diagnostics.push({
      severity: 'error',
      code: 'V2_PATH_LAYER_MISMATCH',
      span: spec.span,
      message: `spec "${spec.target}" (kind=${spec.kind}, layer=${spec.layer}) is under application/ which only allows "story ... layer application"`,
    });
  }
  for (const rule of spec.rules ?? []) {
    for (const act of rule.actions ?? []) {
      if (spec.layer === 'domain' && APPLICATION_ONLY_ACTIONS.has(act.kind)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_LAYER_ACTION_VIOLATION',
          span: rule.span,
          message: `domain rule [${rule.id}] must not use application action "${act.kind}"`,
        });
      }
      if (spec.layer === 'application' && DOMAIN_ONLY_ACTIONS.has(act.kind)) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_LAYER_ACTION_VIOLATION',
          span: rule.span,
          message: `application rule [${rule.id}] must not use domain mutation action "${act.kind}"`,
        });
      }
    }
  }
  return diagnostics;
}

function wordAtPosition(text, line0, char0) {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const lineText = lines[line0] ?? '';
  if (char0 < 0 || char0 > lineText.length) return '';
  let start = char0;
  let end = char0;
  const isWord = ch => /[\p{L}\p{N}_-]/u.test(ch);
  while (start > 0 && isWord(lineText[start - 1])) start -= 1;
  while (end < lineText.length && isWord(lineText[end])) end += 1;
  return lineText.slice(start, end);
}

function toLspDiagnostic(d) {
  const line0 = Math.max(0, (d.line ?? d.span?.line ?? 1) - 1);
  const col0 = Math.max(0, (d.col ?? d.span?.col ?? 1) - 1);
  return {
    range: {
      start: { line: line0, character: col0 },
      end: { line: line0, character: col0 + 12 },
    },
    severity: d.severity === 'warning' ? 2 : 1,
    code: d.code ?? 'EARS_ERROR',
    source: 'co-arising-ears',
    message: d.message,
  };
}

export function createEarsLspSession({ sendNotification = () => {} } = {}) {
  const docs = new Map(); // uri -> { text, filePath, structuresDir, symbolIndex }

  function analyzeDocument(uri, text) {
    const filePath = uriToPath(uri) ?? '<memory>.ears';
    const structuresDir = discoverStructuresDir(filePath);
    const symbolIndex = buildStructureSymbolIndex(structuresDir);
    docs.set(uri, { text, filePath, structuresDir, symbolIndex });

    const diagnostics = [];
    let symbolTable = null;
    if (structuresDir) {
      try {
        const loaded = loadV2Structures(structuresDir);
        symbolTable = loaded.symbolTable;
      } catch (err) {
        diagnostics.push({
          severity: 'error',
          code: err.code ?? 'V2_STRUCTURE_ERROR',
          span: { line: 1, col: 1 },
          message: err.message,
        });
      }
    }

    try {
      const ast = parseEars(text, { file: filePath });
      const normalized = normalizeEars(ast);
      const bound = symbolTable
        ? bindEarsSpec(normalized, symbolTable, { strictDomainBoundary: true })
        : normalized;
      const layerDiags = checkLspPathLayer(filePath, bound);
      for (const d of [...bound.diagnostics, ...layerDiags]) {
        diagnostics.push(d);
      }
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        code: err.code ?? 'EARS_SYNTAX',
        line: err.line ?? 1,
        col: err.col ?? 1,
        message: err.message,
      });
    }

    const lspDiags = diagnostics.map(toLspDiagnostic);
    sendNotification('textDocument/publishDiagnostics', { uri, diagnostics: lspDiags });
    return lspDiags;
  }

  function handleMessage(msg) {
    const { id, method, params } = msg;
    if (method === 'initialize') {
      return {
        id,
        result: {
          capabilities: {
            textDocumentSync: 1,
            definitionProvider: true,
            hoverProvider: true,
          },
          serverInfo: { name: 'co-arising-ears-lsp', version: '2.0.0' },
        },
      };
    }
    if (method === 'shutdown') {
      return { id, result: null };
    }
    if (method === 'textDocument/didOpen') {
      analyzeDocument(params.textDocument.uri, params.textDocument.text);
      return null;
    }
    if (method === 'textDocument/didChange') {
      const lastChange = params.contentChanges?.[params.contentChanges.length - 1];
      if (lastChange && typeof lastChange.text === 'string') {
        analyzeDocument(params.textDocument.uri, lastChange.text);
      }
      return null;
    }
    if (method === 'textDocument/didSave') {
      const doc = docs.get(params.textDocument.uri);
      const text = params.text ?? doc?.text ?? '';
      analyzeDocument(params.textDocument.uri, text);
      return null;
    }
    if (method === 'textDocument/definition') {
      const doc = docs.get(params.textDocument.uri);
      if (!doc) return { id, result: null };
      const word = wordAtPosition(doc.text, params.position.line, params.position.character);
      const target = doc.symbolIndex.get(word);
      if (!target) return { id, result: null };
      return {
        id,
        result: {
          uri: target.uri,
          range: {
            start: { line: target.line, character: target.col },
            end: { line: target.line, character: target.col + word.length },
          },
        },
      };
    }
    if (method === 'textDocument/hover') {
      const doc = docs.get(params.textDocument.uri);
      if (!doc) return { id, result: null };
      const word = wordAtPosition(doc.text, params.position.line, params.position.character);
      const target = doc.symbolIndex.get(word);
      if (!target) return { id, result: null };
      return {
        id,
        result: {
          contents: {
            kind: 'markdown',
            value: `**${word}** — \`${target.detail}\``,
          },
        },
      };
    }
    if (id !== undefined) {
      return { id, result: null };
    }
    return null;
  }

  return { handleMessage, analyzeDocument };
}

export function encodeLspFrame(payload) {
  const json = JSON.stringify(payload);
  const byteLen = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${byteLen}\r\n\r\n${json}`;
}

export function runEarsLspServer() {
  const send = payload => {
    process.stdout.write(encodeLspFrame({ jsonrpc: '2.0', ...payload }));
  };
  const session = createEarsLspSession({
    sendNotification: (method, params) => send({ method, params }),
  });

  let buffer = Buffer.alloc(0);
  process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const lenMatch = headerText.match(/Content-Length:\s*(\d+)/iu);
      if (!lenMatch) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const bodyLen = Number(lenMatch[1]);
      const frameEnd = headerEnd + 4 + bodyLen;
      if (buffer.length < frameEnd) break;
      const bodyStr = buffer.slice(headerEnd + 4, frameEnd).toString('utf8');
      buffer = buffer.slice(frameEnd);
      const msg = JSON.parse(bodyStr);
      if (msg.method === 'exit') {
        process.exit(0);
      }
      const reply = session.handleMessage(msg);
      if (reply) send(reply);
    }
  });
}
